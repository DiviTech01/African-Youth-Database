import * as XLSX from 'xlsx';

import type {
  ReportChart,
  ReportDocument,
  ReportSection,
} from '../report-document.model';

/**
 * XLSX renderer for generated insight reports.
 *
 * The deck and the PDF are for reading; this workbook is for *checking*. An
 * analyst who wants to re-plot a chart, join a table against their own data,
 * or verify a headline figure needs the underlying values as values — so every
 * `table` and every `chart` block gets its own sheet with real numbers in the
 * cells, never the pre-formatted display strings.
 *
 * Cell-level rules that matter:
 *  - a null stays empty. The data is genuinely sparse, and a 0 in a coverage
 *    or enrolment column is a claim we would be inventing.
 *  - numbers are written as numbers (SheetJS infers `t:'n'` from the JS type),
 *    so SUM/AVERAGE and any downstream parser work without cleaning.
 */

type SheetRow = (string | number | null)[];

// ---------------------------------------------------------------------------
// Sheet naming
// ---------------------------------------------------------------------------

const MAX_SHEET_NAME = 31;
/** Excel rejects these outright in a sheet name. */
const ILLEGAL_SHEET_CHARS = /[[\]:*?/\\]/g;

/**
 * Excel silently refuses to open a workbook with an invalid or duplicated
 * sheet name, and report headings are free text from a model — so names get
 * scrubbed here rather than trusted.
 */
function sanitiseSheetName(raw: string, fallback: string): string {
  let name = (raw || '')
    .replace(ILLEGAL_SHEET_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // Excel also disallows a leading or trailing apostrophe.
    .replace(/^'+/, '')
    .replace(/'+$/, '')
    .trim();

  if (!name) name = fallback;
  if (name.length > MAX_SHEET_NAME) name = name.slice(0, MAX_SHEET_NAME).trim();
  return name || fallback;
}

/** Tracks names already handed out (case-insensitively, as Excel compares). */
class SheetNamer {
  private readonly taken = new Set<string>();

  next(raw: string, fallback: string): string {
    const base = sanitiseSheetName(raw, fallback);
    if (!this.taken.has(base.toLowerCase())) {
      this.taken.add(base.toLowerCase());
      return base;
    }
    // Collisions get a numeric suffix, with the stem trimmed so the whole
    // name still fits inside Excel's 31-character limit.
    for (let n = 2; n < 1000; n += 1) {
      const suffix = ` (${n})`;
      const stem = base.slice(0, MAX_SHEET_NAME - suffix.length).trim();
      const candidate = `${stem}${suffix}`;
      if (!this.taken.has(candidate.toLowerCase())) {
        this.taken.add(candidate.toLowerCase());
        return candidate;
      }
    }
    const last = `Sheet ${this.taken.size + 1}`;
    this.taken.add(last.toLowerCase());
    return last;
  }
}

// ---------------------------------------------------------------------------
// Sheet helpers
// ---------------------------------------------------------------------------

/** Size columns to their widest cell so nothing opens as `#####`. */
function fitColumns(rows: SheetRow[], min = 10, max = 60): XLSX.ColInfo[] {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, i) => {
      const len = cell === null || cell === undefined ? 0 : String(cell).length;
      if (len > (widths[i] ?? 0)) widths[i] = len;
    });
  }
  return widths.map((w) => ({ wch: Math.min(max, Math.max(min, (w || 0) + 2)) }));
}

function appendSheet(
  wb: XLSX.WorkBook,
  namer: SheetNamer,
  rawName: string,
  fallback: string,
  rows: SheetRow[],
  opts: { autoFilterCols?: number; autoFilterRows?: number } = {},
): void {
  // aoa_to_sheet leaves a null as an empty cell rather than writing 0 — which
  // is exactly the "no observation" semantics the contract asks for.
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = fitColumns(rows);

  if (opts.autoFilterCols && opts.autoFilterRows) {
    const lastCol = XLSX.utils.encode_col(opts.autoFilterCols - 1);
    ws['!autofilter'] = { ref: `A1:${lastCol}${opts.autoFilterRows}` };
  }

  XLSX.utils.book_append_sheet(wb, ws, namer.next(rawName, fallback));
}

function formatGeneratedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Document traversal
// ---------------------------------------------------------------------------

interface Narrative {
  section: string;
  kind: string;
  text: string;
}

interface Collected {
  stats: { section: string; label: string; value: string; context?: string }[];
  tables: {
    section: string;
    columns: string[];
    rows: (string | number | null)[][];
    caption?: string;
  }[];
  charts: { section: string; chart: ReportChart }[];
  narrative: Narrative[];
}

function collect(sections: ReportSection[]): Collected {
  const out: Collected = { stats: [], tables: [], charts: [], narrative: [] };

  for (const section of sections || []) {
    const heading = section.heading || 'Findings';
    for (const block of section.blocks || []) {
      switch (block.type) {
        case 'paragraph':
          out.narrative.push({ section: heading, kind: 'Paragraph', text: block.text });
          break;
        case 'bullets':
          // One row per bullet keeps the list filterable/sortable.
          for (const item of block.items || []) {
            out.narrative.push({ section: heading, kind: 'Bullet', text: item });
          }
          break;
        case 'callout':
          out.narrative.push({
            section: heading,
            kind: `Callout (${block.tone})`,
            text: block.text,
          });
          break;
        case 'stat':
          out.stats.push({
            section: heading,
            label: block.label,
            value: block.value,
            context: block.context,
          });
          break;
        case 'table':
          out.tables.push({
            section: heading,
            columns: block.columns || [],
            rows: block.rows || [],
            caption: block.caption,
          });
          break;
        case 'chart':
          out.charts.push({ section: heading, chart: block });
          break;
        default: {
          // Exhaustiveness guard: adding a block type to the contract without
          // handling it here becomes a compile error, not a silent omission.
          const unreachable: never = block;
          void unreachable;
        }
      }
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Sheets
// ---------------------------------------------------------------------------

function summaryRows(doc: ReportDocument, collected: Collected): SheetRow[] {
  const rows: SheetRow[] = [
    ['African Youth Observatory — insight report'],
    ['Title', doc.title],
  ];
  if (doc.subtitle) rows.push(['Subtitle', doc.subtitle]);
  rows.push(['Generated', formatGeneratedAt(doc.generatedAt)]);
  rows.push([]);

  rows.push(['Executive summary']);
  const paragraphs = (doc.summary || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length) {
    for (const para of paragraphs) rows.push([para]);
  } else {
    rows.push(['No summary was produced for this report.']);
  }

  if (collected.stats.length) {
    rows.push([]);
    rows.push(['Key figures']);
    rows.push(['Section', 'Metric', 'Value', 'Context']);
    for (const stat of collected.stats) {
      // `value` is pre-formatted by contract ("62.4%"), so it stays a string
      // here; the machine-readable numbers live on the table/chart sheets.
      rows.push([stat.section, stat.label, stat.value, stat.context ?? null]);
    }
  }

  rows.push([]);
  rows.push(['Contents']);
  rows.push([
    `${collected.tables.length} table sheet(s), ${collected.charts.length} chart sheet(s)`,
  ]);

  return rows;
}

function tableSheetRows(table: Collected['tables'][number]): SheetRow[] {
  const rows: SheetRow[] = [table.columns.slice()];

  for (const row of table.rows) {
    // Normalise ragged rows to the header width; a short row would otherwise
    // shift values left into the wrong column.
    rows.push(table.columns.map((_column, i) => row?.[i] ?? null));
  }

  if (table.caption || table.section) {
    rows.push([]);
    if (table.caption) rows.push(['Caption', table.caption]);
    if (table.section) rows.push(['Section', table.section]);
  }

  return rows;
}

function chartSheetRows(entry: Collected['charts'][number]): SheetRow[] {
  const { chart } = entry;
  const series = chart.series || [];

  /*
   * Header first, data immediately under it, metadata after a blank row. Any
   * naive reader (pandas.read_excel, Power Query, a plain CSV export) picks up
   * a clean rectangular frame from A1 without needing to skip a preamble.
   */
  const rows: SheetRow[] = [['Category', ...series.map((s) => s.name)]];

  chart.categories.forEach((category, i) => {
    rows.push([category, ...series.map((s) => (s.values ? (s.values[i] ?? null) : null))]);
  });

  rows.push([]);
  rows.push(['Chart', chart.title]);
  rows.push(['Type', chart.chartType]);
  if (chart.unit) rows.push(['Unit', chart.unit]);
  if (chart.sourceNote) rows.push(['Source', chart.sourceNote]);
  if (entry.section) rows.push(['Section', entry.section]);

  return rows;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function renderReportXlsx(doc: ReportDocument): Promise<Buffer> {
  const collected = collect(doc.sections || []);
  const wb = XLSX.utils.book_new();
  const namer = new SheetNamer();

  appendSheet(wb, namer, 'Summary', 'Summary', summaryRows(doc, collected));

  collected.tables.forEach((table, i) => {
    const rows = tableSheetRows(table);
    appendSheet(
      wb,
      namer,
      table.caption || table.section || `Table ${i + 1}`,
      `Table ${i + 1}`,
      rows,
      { autoFilterCols: table.columns.length, autoFilterRows: table.rows.length + 1 },
    );
  });

  collected.charts.forEach((entry, i) => {
    const rows = chartSheetRows(entry);
    appendSheet(
      wb,
      namer,
      entry.chart.title || `Chart ${i + 1}`,
      `Chart ${i + 1}`,
      rows,
      {
        autoFilterCols: (entry.chart.series || []).length + 1,
        autoFilterRows: entry.chart.categories.length + 1,
      },
    );
  });

  if (collected.narrative.length) {
    const rows: SheetRow[] = [['Section', 'Block', 'Text']];
    for (const item of collected.narrative) {
      rows.push([item.section, item.kind, item.text]);
    }
    appendSheet(wb, namer, 'Narrative', 'Narrative', rows, {
      autoFilterCols: 3,
      autoFilterRows: collected.narrative.length + 1,
    });
  }

  const sourceRows: SheetRow[] = [['Source', 'Detail']];
  for (const citation of doc.citations || []) {
    sourceRows.push([citation.label, citation.detail]);
  }
  if (!(doc.citations || []).length) {
    sourceRows.push(['No sources were recorded for this report.', null]);
  }
  appendSheet(wb, namer, 'Sources', 'Sources', sourceRows);

  wb.Props = {
    Title: doc.title,
    Subject: doc.subtitle || 'Insight report',
    Author: 'African Youth Observatory',
  };

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
