import PptxGenJS from 'pptxgenjs';

import type {
  ReportBlock,
  ReportChart,
  ReportDocument,
  ReportSection,
} from '../report-document.model';

/**
 * PPTX renderer for generated insight reports.
 *
 * Why PPTX at all: a PDF is a picture of an analysis, a deck is an artefact a
 * ministry or a funder can pull one slide out of and re-present. That only
 * holds if the charts stay *charts*, so every `chart` block becomes a native
 * pptxgenjs chart (`slide.addChart`) with its data embedded in the deck's
 * own workbook — never a rasterised image.
 *
 * The other half of "usable" is that nothing runs off the bottom of a slide.
 * There is no reflow engine in OOXML: whatever y-position we write is where
 * the shape lands, so this file measures every block before placing it and
 * paginates onto "(cont.)" slides when the remaining space runs out.
 */

// ---------------------------------------------------------------------------
// Geometry & palette
// ---------------------------------------------------------------------------

/**
 * 13.33" x 7.5" — 16:9, and the size PowerPoint itself calls "Widescreen".
 * pptxgenjs's other 16:9 preset (LAYOUT_16x9) is the same ratio at 10" wide,
 * which leaves noticeably less room for wide tables at the same font size.
 */
const LAYOUT = 'LAYOUT_WIDE';
const SLIDE_W = 13.33;
const SLIDE_H = 7.5;

const MARGIN = 0.62;
const CONTENT_W = SLIDE_W - MARGIN * 2;
/** First usable y on a content slide (below the heading and its gold rule). */
const BODY_TOP = 1.45;
/** Last usable y — below this sits the footer band. */
const BODY_BOTTOM = 6.85;
const BODY_H = BODY_BOTTOM - BODY_TOP;

const MASTER = 'AYO_CONTENT';

const BRAND = 'D4A017'; // matches the HTML renderer's .brand gold
const INK = '141414';
const BODY = '3A3A3A';
const MUTED = '6E6E6E';
const RULE = 'E4E4E4';
const TILE_BG = 'FBF7EC';

/** Series colours: brand gold first, then hues that stay distinct in greyscale. */
const SERIES_COLORS = [
  BRAND,
  '2E6F5E',
  '2E5AAC',
  'B54708',
  '7A5AA8',
  '1F7A8C',
  '9A6A2F',
  '4C6B22',
];

const CALLOUT_STYLE: Record<
  'insight' | 'warning' | 'note',
  { bar: string; fill: string; label: string }
> = {
  insight: { bar: BRAND, fill: 'FBF7EC', label: 'Insight' },
  warning: { bar: 'B54708', fill: 'FDF2E7', label: 'Watch out' },
  note: { bar: '2E5AAC', fill: 'EEF3FC', label: 'Note' },
};

// ---------------------------------------------------------------------------
// Text measurement
//
// Everything below is an estimate — we cannot ask PowerPoint to lay text out
// for us — so each helper deliberately errs on the tall side. Over-estimating
// costs a little whitespace; under-estimating pushes content off the slide.
// ---------------------------------------------------------------------------

/** Average glyph advance as a fraction of the point size, for Calibri-ish faces. */
const AVG_CHAR_RATIO = 0.52;

function charsPerLine(widthIn: number, fontPt: number): number {
  return Math.max(8, Math.floor((widthIn * 72) / (fontPt * AVG_CHAR_RATIO)));
}

function lineHeight(fontPt: number): number {
  return (fontPt * 1.35) / 72;
}

function countLines(text: string, widthIn: number, fontPt: number): number {
  const perLine = charsPerLine(widthIn, fontPt);
  // Hard newlines are honoured by PowerPoint, so measure each one separately.
  return (text || '')
    .split('\n')
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / perLine)), 0);
}

function textHeight(text: string, widthIn: number, fontPt: number): number {
  return countLines(text, widthIn, fontPt) * lineHeight(fontPt);
}

/**
 * Split a long string into chunks that each fit `budgetIn` inches of height,
 * breaking on whitespace so words survive. Used for the rare paragraph that is
 * taller than an entire slide body.
 */
function splitTextToBudget(
  text: string,
  widthIn: number,
  fontPt: number,
  budgetIn: number,
): string[] {
  const linesPerChunk = Math.max(1, Math.floor(budgetIn / lineHeight(fontPt)));
  const maxChars = linesPerChunk * charsPerLine(widthIn, fontPt);
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let rest = text;
  while (rest.length > maxChars) {
    let cut = rest.lastIndexOf(' ', maxChars);
    if (cut <= 0) cut = maxChars; // a single unbroken token — hard-cut it
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

// ---------------------------------------------------------------------------
// Cell formatting
// ---------------------------------------------------------------------------

/**
 * A null cell is a real statement: "this country-year has no observation".
 * It renders as blank. Turning it into 0 would fabricate a data point.
 */
function cellText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return Number.isInteger(value)
      ? value.toLocaleString('en-US')
      : value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  return String(value);
}

function formatGeneratedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Deck builder — owns the current slide and the y cursor
// ---------------------------------------------------------------------------

type Slide = ReturnType<PptxGenJS['addSlide']>;

class Deck {
  private slide: Slide | null = null;
  private y = BODY_TOP;
  private heading = '';
  private continued = false;

  constructor(private readonly pptx: PptxGenJS) {}

  /** Begin a section on a fresh slide. */
  startSection(heading: string): void {
    this.heading = heading;
    this.continued = false;
    this.newSlide();
  }

  /** Remaining vertical space on the current slide. */
  get remaining(): number {
    return BODY_BOTTOM - this.y;
  }

  /**
   * Guarantee `height` inches of room, spilling onto a "(cont.)" slide when
   * needed. Returns the slide to draw on and the y to draw at; callers then
   * advance the cursor with `advance()`.
   */
  reserve(height: number): { slide: Slide; y: number } {
    // A block taller than a whole slide body cannot be helped by paginating
    // again — callers chunk those themselves; here we just avoid an infinite
    // sequence of empty continuation slides.
    if (this.y > BODY_TOP && this.y + height > BODY_BOTTOM) this.newSlide();
    return { slide: this.slide as Slide, y: this.y };
  }

  advance(height: number): void {
    this.y += height;
  }

  private newSlide(): void {
    const slide = this.pptx.addSlide({ masterName: MASTER });
    const title = this.continued ? `${this.heading} (cont.)` : this.heading;
    this.continued = true;

    slide.addText(title, {
      x: MARGIN,
      y: 0.46,
      w: CONTENT_W,
      h: 0.62,
      fontSize: 24,
      bold: true,
      color: INK,
      valign: 'middle',
      fit: 'shrink',
    });
    slide.addShape(this.pptx.ShapeType.rect, {
      x: MARGIN,
      y: 1.16,
      w: 1.5,
      h: 0.05,
      fill: { color: BRAND },
    });

    this.slide = slide;
    this.y = BODY_TOP;
  }
}

// ---------------------------------------------------------------------------
// Block renderers
// ---------------------------------------------------------------------------

function renderParagraph(deck: Deck, text: string): void {
  const fontPt = 14;
  const chunks = splitTextToBudget(text, CONTENT_W, fontPt, BODY_H - 0.2);
  for (const chunk of chunks) {
    const h = textHeight(chunk, CONTENT_W, fontPt) + 0.12;
    const { slide, y } = deck.reserve(h);
    slide.addText(chunk, {
      x: MARGIN,
      y,
      w: CONTENT_W,
      h,
      fontSize: fontPt,
      color: BODY,
      valign: 'top',
      lineSpacingMultiple: 1.2,
    });
    deck.advance(h + 0.16);
  }
}

function renderBullets(deck: Deck, items: string[]): void {
  const fontPt = 13;
  const textW = CONTENT_W - 0.35; // bullet glyph + indent
  const heights = items.map(
    (item) => textHeight(item, textW, fontPt) + 0.1,
  );

  let index = 0;
  while (index < items.length) {
    // Fill the current slide, then continue the list on the next one.
    let budget = deck.remaining;
    if (budget < heights[index] && budget < BODY_H) {
      deck.reserve(BODY_H); // forces a continuation slide
      budget = deck.remaining;
    }

    const chunk: string[] = [];
    let used = 0;
    while (index < items.length && (chunk.length === 0 || used + heights[index] <= budget)) {
      used += heights[index];
      chunk.push(items[index]);
      index += 1;
    }

    const { slide, y } = deck.reserve(Math.min(used, budget));
    slide.addText(
      chunk.map((item) => ({
        text: item,
        options: { bullet: { code: '2022' }, breakLine: true },
      })),
      {
        x: MARGIN,
        y,
        w: CONTENT_W,
        h: used,
        fontSize: fontPt,
        color: BODY,
        valign: 'top',
        lineSpacingMultiple: 1.15,
        paraSpaceAfter: 6,
      },
    );
    deck.advance(used + 0.18);
  }
}

/**
 * Stat tiles are laid out as a grid rather than one-per-block, so a run of
 * consecutive `stat` blocks reads as a KPI strip instead of a stack of
 * near-empty rows. The caller hands us the whole run.
 */
function renderStatRun(
  deck: Deck,
  pptx: PptxGenJS,
  stats: { label: string; value: string; context?: string }[],
): void {
  const gap = 0.28;
  const tileH = 1.55;
  let index = 0;

  while (index < stats.length) {
    const cols = Math.min(3, stats.length - index);
    const tileW = (CONTENT_W - gap * (cols - 1)) / cols;
    const { slide, y } = deck.reserve(tileH);

    for (let col = 0; col < cols; col += 1) {
      const stat = stats[index + col];
      const runs: { text: string; options: Record<string, unknown> }[] = [
        {
          text: stat.label.toUpperCase(),
          options: {
            fontSize: 10,
            bold: true,
            color: MUTED,
            charSpacing: 1,
            breakLine: true,
          },
        },
        {
          text: stat.value,
          options: { fontSize: 30, bold: true, color: INK, breakLine: true },
        },
      ];
      if (stat.context) {
        runs.push({
          text: stat.context,
          options: { fontSize: 10, color: BODY, breakLine: false },
        });
      }

      slide.addText(runs, {
        x: MARGIN + col * (tileW + gap),
        y,
        w: tileW,
        h: tileH,
        shape: pptx.ShapeType.roundRect,
        rectRadius: 0.06,
        fill: { color: TILE_BG },
        line: { color: 'EFE3C4', width: 1 },
        align: 'left',
        valign: 'middle',
        margin: 12,
        fit: 'shrink',
      });
    }

    index += cols;
    deck.advance(tileH + 0.24);
  }
}

function renderCallout(
  deck: Deck,
  pptx: PptxGenJS,
  tone: 'insight' | 'warning' | 'note',
  text: string,
): void {
  const style = CALLOUT_STYLE[tone];
  const fontPt = 13;
  const innerW = CONTENT_W - 0.55;
  const chunks = splitTextToBudget(text, innerW, fontPt, BODY_H - 1.0);

  chunks.forEach((chunk, i) => {
    const h = Math.max(0.72, textHeight(chunk, innerW, fontPt) + 0.5);
    const { slide, y } = deck.reserve(h);

    slide.addShape(pptx.ShapeType.rect, {
      x: MARGIN,
      y,
      w: CONTENT_W,
      h,
      fill: { color: style.fill },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: MARGIN,
      y,
      w: 0.07,
      h,
      fill: { color: style.bar },
    });
    slide.addText(
      [
        // Only label the first fragment; a continued callout is still one callout.
        ...(i === 0
          ? [
              {
                text: style.label.toUpperCase(),
                options: {
                  fontSize: 9,
                  bold: true,
                  color: style.bar,
                  charSpacing: 1,
                  breakLine: true,
                },
              },
            ]
          : []),
        { text: chunk, options: { fontSize: fontPt, color: INK, breakLine: false } },
      ],
      {
        x: MARGIN + 0.24,
        y: y + 0.06,
        w: innerW,
        h: h - 0.12,
        valign: 'middle',
        lineSpacingMultiple: 1.15,
      },
    );
    deck.advance(h + 0.2);
  });
}

/** Weight column widths by their widest cell so codes don't get the same space as names. */
function columnWidths(
  columns: string[],
  rows: (string | number | null)[][],
): number[] {
  const weights = columns.map((column, i) => {
    let widest = column.length;
    for (const row of rows) {
      const len = cellText(row[i]).length;
      if (len > widest) widest = len;
    }
    return Math.min(Math.max(widest, 7), 42);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => (w / total) * CONTENT_W);
}

function renderTable(
  deck: Deck,
  columns: string[],
  rows: (string | number | null)[][],
  caption?: string,
): void {
  const fontPt = 10;
  const colW = columnWidths(columns, rows);
  const headerH = Math.max(0.34, textHeight(columns.join(' '), CONTENT_W, fontPt) * 0.6 + 0.18);

  // Per-row heights, because one wrapped cell makes the whole row taller and
  // a uniform guess would silently overflow the slide.
  const rowH = rows.map((row) => {
    const lines = row.reduce<number>(
      (max, cell, i) => Math.max(max, countLines(cellText(cell), colW[i] - 0.16, fontPt)),
      1,
    );
    return lines * lineHeight(fontPt) + 0.16;
  });

  const captionH = caption ? textHeight(caption, CONTENT_W, 10) + 0.12 : 0;

  let index = 0;
  let firstChunk = true;
  while (index < rows.length) {
    let budget = deck.remaining;
    const minNeeded = headerH + (rowH[index] ?? 0.3) + (firstChunk ? captionH : 0);
    if (budget < minNeeded && budget < BODY_H) {
      deck.reserve(BODY_H);
      budget = deck.remaining;
    }

    const chunk: (string | number | null)[][] = [];
    let used = headerH + (firstChunk ? captionH : 0);
    while (index < rows.length && (chunk.length === 0 || used + rowH[index] <= budget)) {
      used += rowH[index];
      chunk.push(rows[index]);
      index += 1;
    }

    const { slide, y } = deck.reserve(Math.min(used, budget));
    let cursor = y;

    if (firstChunk && caption) {
      slide.addText(caption, {
        x: MARGIN,
        y: cursor,
        w: CONTENT_W,
        h: captionH,
        fontSize: 10,
        italic: true,
        color: MUTED,
        valign: 'top',
      });
      cursor += captionH;
    }

    // The header row repeats on every continuation — a headerless half-table
    // pasted into another deck is unreadable.
    const tableRows = [
      columns.map((column) => ({
        text: column,
        options: { bold: true, color: 'FFFFFF', fill: { color: INK } },
      })),
      ...chunk.map((row) =>
        columns.map((_column, i) => ({ text: cellText(row[i]), options: {} })),
      ),
    ];

    slide.addTable(tableRows as never, {
      x: MARGIN,
      y: cursor,
      w: CONTENT_W,
      colW,
      fontSize: fontPt,
      color: BODY,
      border: { type: 'solid', pt: 0.5, color: RULE },
      valign: 'top',
      margin: 4,
      autoPage: false, // we paginate ourselves; pptxgenjs's autoPage ignores our cursor
    });

    deck.advance(Math.min(used, budget) + 0.22);
    firstChunk = false;
  }
}

function renderChart(deck: Deck, pptx: PptxGenJS, block: ReportChart): void {
  const titleH = textHeight(block.title, CONTENT_W, 14) + 0.1;
  const noteH = block.sourceNote ? textHeight(block.sourceNote, CONTENT_W, 9) + 0.08 : 0;

  const usableSeries = block.series.filter((s) => Array.isArray(s.values));
  if (!block.categories.length || !usableSeries.length) {
    renderParagraph(deck, `${block.title} — no data available for this chart.`);
    return;
  }

  // A chart is atomic: give it a whole slide's worth of room if the current
  // one is more than half used, rather than squashing it into a strip.
  const chartH = Math.min(4.35, Math.max(2.6, BODY_H - titleH - noteH - 0.2));
  const total = titleH + chartH + noteH;
  const { slide, y } = deck.reserve(total);
  let cursor = y;

  slide.addText(block.title, {
    x: MARGIN,
    y: cursor,
    w: CONTENT_W,
    h: titleH,
    fontSize: 14,
    bold: true,
    color: INK,
    valign: 'top',
  });
  cursor += titleH;

  const isPie = block.chartType === 'pie';
  const chartType = isPie
    ? pptx.ChartType.pie
    : block.chartType === 'line'
      ? pptx.ChartType.line
      : pptx.ChartType.bar;

  /*
   * Nulls are passed straight through. pptxgenjs writes an empty <c:v/> for a
   * null, which PowerPoint reads as "no value" — a gap in a line, a missing
   * column in a bar. Substituting 0 here would draw a confident zero over a
   * country-year we simply have no observation for.
   */
  const data = (isPie ? usableSeries.slice(0, 1) : usableSeries).map((series) => ({
    name: series.name,
    labels: block.categories,
    values: series.values as unknown as number[],
  }));

  slide.addChart(chartType, data, {
    x: MARGIN,
    y: cursor,
    w: CONTENT_W,
    h: chartH,
    chartColors: SERIES_COLORS,
    showLegend: isPie || data.length > 1,
    legendPos: 'b',
    legendFontSize: 10,
    catAxisLabelFontSize: 10,
    valAxisLabelFontSize: 10,
    dataLabelFontSize: 10,
    showValue: isPie,
    showPercent: false,
    valAxisTitle: block.unit,
    showValAxisTitle: Boolean(block.unit) && !isPie,
    valAxisTitleFontSize: 10,
    catAxisLabelRotate: block.categories.length > 8 ? 45 : 0,
    lineSmooth: false,
    lineDataSymbolSize: 6,
    border: { pt: 0, color: 'FFFFFF' },
    chartArea: { fill: { color: 'FFFFFF' } },
  } as never);
  cursor += chartH;

  if (block.sourceNote) {
    slide.addText(block.sourceNote, {
      x: MARGIN,
      y: cursor,
      w: CONTENT_W,
      h: noteH,
      fontSize: 9,
      italic: true,
      color: MUTED,
      valign: 'top',
    });
  }

  deck.advance(total + 0.2);
}

// ---------------------------------------------------------------------------
// Slides
// ---------------------------------------------------------------------------

function addTitleSlide(pptx: PptxGenJS, doc: ReportDocument): void {
  // No master here: the title slide carries no footer or slide number.
  const slide = pptx.addSlide();
  slide.background = { color: '0F0F0F' };

  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 0.22,
    h: SLIDE_H,
    fill: { color: BRAND },
    line: { color: BRAND, width: 0 },
  });

  slide.addText('AFRICAN YOUTH OBSERVATORY', {
    x: 0.95,
    y: 1.5,
    w: SLIDE_W - 1.9,
    h: 0.35,
    fontSize: 12,
    bold: true,
    color: BRAND,
    charSpacing: 2,
  });
  slide.addText(doc.title, {
    x: 0.95,
    y: 2.0,
    w: SLIDE_W - 1.9,
    h: 1.9,
    fontSize: 40,
    bold: true,
    color: 'FFFFFF',
    valign: 'top',
    fit: 'shrink',
  });
  if (doc.subtitle) {
    slide.addText(doc.subtitle, {
      x: 0.95,
      y: 3.95,
      w: SLIDE_W - 1.9,
      h: 0.9,
      fontSize: 17,
      color: 'CFCFCF',
      valign: 'top',
      fit: 'shrink',
    });
  }
  slide.addText(`Generated ${formatGeneratedAt(doc.generatedAt)}`, {
    x: 0.95,
    y: SLIDE_H - 1.15,
    w: SLIDE_W - 1.9,
    h: 0.35,
    fontSize: 12,
    color: '9A9A9A',
  });
}

function addSummarySlide(pptx: PptxGenJS, deck: Deck, doc: ReportDocument): void {
  deck.startSection('Executive summary');
  const summary = (doc.summary || '').trim();
  if (!summary) {
    renderParagraph(deck, 'No summary was produced for this report.');
    return;
  }
  // Blank-line-separated paragraphs are common in model output; keep them apart.
  for (const para of summary.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)) {
    renderParagraph(deck, para);
  }
}

function addSourcesSlides(deck: Deck, doc: ReportDocument): void {
  deck.startSection('Sources');
  if (!doc.citations.length) {
    renderParagraph(deck, 'No sources were recorded for this report.');
    return;
  }
  renderBullets(
    deck,
    doc.citations.map((c) => (c.detail ? `${c.label} — ${c.detail}` : c.label)),
  );
}

function renderSection(deck: Deck, pptx: PptxGenJS, section: ReportSection): void {
  deck.startSection(section.heading || 'Findings');

  const blocks = section.blocks || [];
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];

    if (block.type === 'stat') {
      // Swallow the whole consecutive run so the tiles share a row.
      const run: { label: string; value: string; context?: string }[] = [];
      while (i < blocks.length && blocks[i].type === 'stat') {
        const stat = blocks[i] as Extract<ReportBlock, { type: 'stat' }>;
        run.push({ label: stat.label, value: stat.value, context: stat.context });
        i += 1;
      }
      renderStatRun(deck, pptx, run);
      continue;
    }

    switch (block.type) {
      case 'paragraph':
        renderParagraph(deck, block.text);
        break;
      case 'bullets':
        if (block.items?.length) renderBullets(deck, block.items);
        break;
      case 'table':
        renderTable(deck, block.columns || [], block.rows || [], block.caption);
        break;
      case 'chart':
        renderChart(deck, pptx, block);
        break;
      case 'callout':
        renderCallout(deck, pptx, block.tone, block.text);
        break;
      default: {
        // Exhaustiveness guard: a new block type added to the contract without
        // a renderer here becomes a compile error rather than a silent gap.
        const unreachable: never = block;
        void unreachable;
      }
    }
    i += 1;
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function renderReportPptx(doc: ReportDocument): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = LAYOUT;
  pptx.author = 'African Youth Observatory';
  pptx.company = 'African Youth Observatory';
  pptx.title = doc.title;
  pptx.subject = doc.subtitle || 'Insight report';

  pptx.defineSlideMaster({
    title: MASTER,
    background: { color: 'FFFFFF' },
    objects: [
      {
        line: {
          x: MARGIN,
          y: SLIDE_H - 0.42,
          w: CONTENT_W,
          h: 0,
          line: { color: RULE, width: 1 },
        },
      },
      {
        text: {
          text: doc.title,
          options: {
            x: MARGIN,
            y: SLIDE_H - 0.38,
            w: CONTENT_W - 1.2,
            h: 0.26,
            fontSize: 9,
            color: MUTED,
            valign: 'middle',
          },
        },
      },
    ],
    slideNumber: {
      x: SLIDE_W - MARGIN - 0.6,
      y: SLIDE_H - 0.38,
      w: 0.6,
      h: 0.26,
      fontSize: 9,
      color: MUTED,
      align: 'right',
    },
  });

  const deck = new Deck(pptx);

  addTitleSlide(pptx, doc);
  addSummarySlide(pptx, deck, doc);
  for (const section of doc.sections || []) renderSection(deck, pptx, section);
  addSourcesSlides(deck, doc);

  /*
   * pptxgenjs v4 `write()` returns Promise<string | ArrayBuffer | Blob |
   * Uint8Array>; the 'nodebuffer' output type resolves to a real Node Buffer,
   * but the declared union does not narrow, hence the cast.
   */
  const out = await pptx.write({ outputType: 'nodebuffer' });
  return out as Buffer;
}
