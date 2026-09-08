/**
 * PDF renderer for generated insight reports.
 *
 * Same design system as html.renderer.ts — same palette, same typographic
 * hierarchy, same series colours — expressed with pdfkit primitives so the two
 * exports of one ReportDocument read as the same publication.
 *
 * Charts are drawn as vectors here rather than reusing the HTML renderer's SVG:
 * pdfkit cannot rasterise or parse SVG without extra dependencies, and a
 * rasterised chart would print soft. Everything is rect / moveTo / lineTo.
 *
 * Only the built-in Helvetica family is used — no font file is bundled with the
 * API, and referencing one that is absent throws at render time on Render.
 */

import PDFDocument from 'pdfkit';

import { ReportBlock, ReportChart, ReportDocument } from '../report-document.model';

// ── Page geometry ───────────────────────────────────────────────────────────

const PAGE_W = 595.28; // A4 portrait, points
const PAGE_H = 841.89;
const M = { top: 62, bottom: 64, left: 58, right: 58 };
const LEFT = M.left;
const CONTENT_W = PAGE_W - M.left - M.right;
const BOTTOM = PAGE_H - M.bottom;

// ── Palette (mirrors html.renderer.ts) ──────────────────────────────────────

const INK = '#16222c';
const BODY = '#33434f';
const MUTED = '#6d7d8a';
const FAINT = '#9aa7b2';
const RULE = '#dbe2e8';
const RULE_STRONG = '#b9c4cd';
const WASH = '#f4f7f9';
const ACCENT = '#0b6b5e';
const WARN = '#8a5a12';

const SERIES_COLOURS = [
  '#0b6b5e',
  '#b06d33',
  '#3a5f8a',
  '#7a5495',
  '#5d7a2e',
  '#a2453c',
  '#2f7d8a',
  '#8a6f2f',
];

const REG = 'Helvetica';
const BOLD = 'Helvetica-Bold';
const OBL = 'Helvetica-Oblique';

const EM_DASH = '—';

type Doc = PDFKit.PDFDocument;

// ── Formatting helpers ──────────────────────────────────────────────────────

function groupNumber(n: number): string {
  if (!Number.isFinite(n)) return '';
  const rounded = Number.isInteger(n) ? n : Math.round(n * 100) / 100;
  const [int, frac] = String(Math.abs(rounded)).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${rounded < 0 ? '-' : ''}${grouped}${frac ? `.${frac}` : ''}`;
}

/** pdfkit calls toISOString() on CreationDate — an invalid Date throws there. */
function safeDate(iso: string): Date {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso ?? '');
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

function truncate(str: string, max: number): string {
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

/**
 * Truncate to a measured width. `lineBreak: false` lets pdfkit overrun its
 * `width`, so legend entries would silently collide without this.
 */
function fitText(doc: Doc, text: string, font: string, size: number, maxW: number): string {
  doc.font(font).fontSize(size);
  if (doc.widthOfString(text) <= maxW) return text;
  let out = text;
  while (out.length > 1 && doc.widthOfString(`${out}…`) > maxW) out = out.slice(0, -1);
  return `${out}…`;
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Sparse data is real: a missing value is a gap, never a zero. */
function numOrNull(v: unknown): number | null {
  return v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v);
}

/**
 * Axis ticks. Deliberately identical in behaviour to the HTML renderer's
 * axisScale so the same chart gets the same gridlines in both formats.
 */
function axisScale(values: number[]): { lo: number; hi: number; ticks: number[] } {
  const finite = values.filter((v) => Number.isFinite(v));
  if (!finite.length) return { lo: 0, hi: 1, ticks: [0, 1] };

  const rawMin = Math.min(...finite);
  const rawMax = Math.max(...finite);
  let lo = rawMin >= 0 ? 0 : rawMin;
  let hi = rawMax <= 0 ? 0 : rawMax;
  if (hi === lo) hi = lo + Math.abs(lo || 1) * 0.1 || 1;

  const rough = (hi - lo) / 4;
  const exp = Math.floor(Math.log10(rough));
  const base = Math.pow(10, exp);
  const frac = rough / base;
  const step =
    (frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10) * base;

  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;

  const ticks: number[] = [];
  for (let i = 0; i <= 12; i++) {
    const v = lo + step * i;
    ticks.push(Number(v.toPrecision(12)));
    if (v >= hi - step / 1e6) break;
  }
  return { lo, hi: ticks[ticks.length - 1], ticks };
}

function tickLabel(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${groupNumber(Math.round(v / 100_000) / 10)}M`;
  if (abs >= 10_000) return `${groupNumber(Math.round(v / 100) / 10)}k`;
  return groupNumber(Math.round(v * 100) / 100);
}

// ── Layout primitives ───────────────────────────────────────────────────────

/**
 * Page-break guard. Every block measures itself first and asks for the room it
 * needs; nothing is allowed to start near the bottom and get sliced. Tables
 * break between rows only (see drawTable), charts move whole.
 */
function ensure(doc: Doc, height: number): void {
  if (doc.y + height > BOTTOM) doc.addPage();
}

function usableHeight(): number {
  return BOTTOM - M.top;
}

function measure(
  doc: Doc,
  text: string,
  font: string,
  size: number,
  width: number,
  lineGap = 0,
): number {
  doc.font(font).fontSize(size);
  return doc.heightOfString(text || ' ', { width, lineGap });
}

function hairline(doc: Doc, y: number, colour = RULE, width = 0.6, x = LEFT, w = CONTENT_W): void {
  doc.save().lineWidth(width).strokeColor(colour).moveTo(x, y).lineTo(x + w, y).stroke().restore();
}

// ── Cover ───────────────────────────────────────────────────────────────────

function drawCover(doc: Doc, report: ReportDocument): void {
  doc.save().rect(LEFT, 150, 68, 4).fill(ACCENT).restore();

  doc
    .font(BOLD)
    .fontSize(9)
    .fillColor(ACCENT)
    .text('AFRICAN YOUTH OBSERVATORY', LEFT, 176, {
      width: CONTENT_W,
      characterSpacing: 1.6,
    });

  doc
    .font(BOLD)
    .fontSize(30)
    .fillColor(INK)
    .text(report.title || 'Insight Report', LEFT, 210, { width: CONTENT_W, lineGap: 4 });

  if (report.subtitle) {
    doc
      .font(REG)
      .fontSize(14)
      .fillColor(MUTED)
      .text(report.subtitle, LEFT, doc.y + 10, { width: CONTENT_W * 0.86, lineGap: 3 });
  }

  hairline(doc, doc.y + 26, RULE_STRONG, 0.8);

  doc
    .font(REG)
    .fontSize(10)
    .fillColor(MUTED)
    .text(`Generated ${formatDate(report.generatedAt)}`, LEFT, doc.y + 40, {
      width: CONTENT_W,
    });

  // Cover colophon sits on the baseline of the page, not after the flow.
  doc
    .font(REG)
    .fontSize(8.5)
    .fillColor(FAINT)
    .text(
      'Insight report generated from the African Youth Observatory indicator database. ' +
        'Figures reflect the most recent year available for each indicator; gaps are shown as an em dash.',
      LEFT,
      PAGE_H - 120,
      { width: CONTENT_W * 0.78, lineGap: 2 },
    );
}

// ── Blocks ──────────────────────────────────────────────────────────────────

function drawSectionHeading(doc: Doc, index: number, heading: string): void {
  const h = measure(doc, heading, BOLD, 16, CONTENT_W, 2);
  // Keep the heading with at least a couple of lines of what follows.
  ensure(doc, h + 62);

  doc
    .font(BOLD)
    .fontSize(8.5)
    .fillColor(FAINT)
    .text(`SECTION ${String(index + 1).padStart(2, '0')}`, LEFT, doc.y, {
      width: CONTENT_W,
      characterSpacing: 1.3,
    });

  doc
    .font(BOLD)
    .fontSize(16)
    .fillColor(INK)
    .text(heading, LEFT, doc.y + 3, { width: CONTENT_W, lineGap: 2 });

  hairline(doc, doc.y + 7, RULE_STRONG, 0.8);
  doc.y += 20;
}

function drawParagraph(doc: Doc, text: string): void {
  // Never strand a single line at the foot of a page.
  ensure(doc, 34);
  doc
    .font(REG)
    .fontSize(10.5)
    .fillColor(BODY)
    .text(text, LEFT, doc.y, { width: CONTENT_W, align: 'left', lineGap: 4 });
  doc.y += 11;
}

function drawBullets(doc: Doc, items: string[]): void {
  const indent = 16;
  for (const item of items ?? []) {
    const h = measure(doc, item, REG, 10.5, CONTENT_W - indent, 3);
    ensure(doc, h + 6);
    const y = doc.y;
    doc.font(REG).fontSize(10.5).fillColor(ACCENT).text('•', LEFT + 2, y, { lineBreak: false });
    doc
      .font(REG)
      .fontSize(10.5)
      .fillColor(BODY)
      .text(item, LEFT + indent, y, { width: CONTENT_W - indent, lineGap: 3 });
    doc.y += 4;
  }
  doc.y += 7;
}

function drawStat(doc: Doc, block: Extract<ReportBlock, { type: 'stat' }>): void {
  const padX = 14;
  const innerW = CONTENT_W - padX * 2;
  const labelH = measure(doc, block.label, BOLD, 8.5, innerW);
  const valueH = measure(doc, block.value, BOLD, 26, innerW);
  const ctxH = block.context ? measure(doc, block.context, REG, 9.5, innerW, 2) + 5 : 0;
  const boxH = 13 + labelH + 3 + valueH + ctxH + 13;

  ensure(doc, boxH + 14);
  const top = doc.y;

  doc.save();
  doc.rect(LEFT, top, CONTENT_W, boxH).lineWidth(0.6).strokeColor(RULE).stroke();
  doc.rect(LEFT, top, 3, boxH).fill(ACCENT);
  doc.restore();

  let y = top + 13;
  doc
    .font(BOLD)
    .fontSize(8.5)
    .fillColor(MUTED)
    .text(block.label.toUpperCase(), LEFT + padX, y, { width: innerW, characterSpacing: 1 });
  y += labelH + 3;
  doc.font(BOLD).fontSize(26).fillColor(ACCENT).text(block.value, LEFT + padX, y, { width: innerW });
  y += valueH;
  if (block.context) {
    doc
      .font(REG)
      .fontSize(9.5)
      .fillColor(MUTED)
      .text(block.context, LEFT + padX, y + 5, { width: innerW, lineGap: 2 });
  }

  doc.y = top + boxH + 16;
}

function drawCallout(doc: Doc, block: Extract<ReportBlock, { type: 'callout' }>): void {
  const tones: Record<string, { colour: string; fill: string; label: string }> = {
    insight: { colour: ACCENT, fill: '#f1f7f6', label: 'INSIGHT' },
    warning: { colour: WARN, fill: '#fbf6ec', label: 'CAUTION' },
    note: { colour: RULE_STRONG, fill: WASH, label: 'NOTE' },
  };
  const tone = tones[block.tone] ?? tones.note;
  const labelColour = block.tone === 'note' ? MUTED : tone.colour;

  const padX = 14;
  const innerW = CONTENT_W - padX * 2;
  const textH = measure(doc, block.text, REG, 10.5, innerW, 3);
  const boxH = 12 + 11 + 4 + textH + 12;

  ensure(doc, boxH + 12);
  const top = doc.y;

  doc.save();
  doc.rect(LEFT, top, CONTENT_W, boxH).fill(tone.fill);
  doc.rect(LEFT, top, 3, boxH).fill(tone.colour);
  doc.restore();

  doc
    .font(BOLD)
    .fontSize(8)
    .fillColor(labelColour)
    .text(tone.label, LEFT + padX, top + 12, { width: innerW, characterSpacing: 1.2 });
  doc
    .font(REG)
    .fontSize(10.5)
    .fillColor(INK)
    .text(block.text, LEFT + padX, top + 27, { width: innerW, lineGap: 3 });

  doc.y = top + boxH + 14;
}

// ── Tables ──────────────────────────────────────────────────────────────────

function cellText(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return EM_DASH;
  return isNum(v) ? groupNumber(v) : String(v);
}

function columnWidths(doc: Doc, columns: string[], rows: (string | number | null)[][]): number[] {
  const weights = columns.map((col, ci) => {
    let w = String(col ?? '').length;
    for (const row of rows) w = Math.max(w, cellText(row?.[ci]).length);
    return Math.min(Math.max(w, 4), 36);
  });
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const widths = weights.map((w) => (w / total) * CONTENT_W);

  // A column narrower than ~46pt wraps every word; steal from the widest.
  const MIN = 46;
  for (let i = 0; i < widths.length; i++) {
    if (widths[i] >= MIN) continue;
    const deficit = MIN - widths[i];
    widths[i] = MIN;
    const donor = widths.indexOf(Math.max(...widths));
    if (donor !== i) widths[donor] -= deficit;
  }
  return widths;
}

function drawTable(doc: Doc, block: Extract<ReportBlock, { type: 'table' }>): void {
  const columns = block.columns ?? [];
  const rows = block.rows ?? [];
  if (!columns.length) return;

  const widths = columnWidths(doc, columns, rows);
  const numeric = columns.map((_, ci) => {
    const cells = rows.map((r) => r?.[ci]).filter((v) => v !== null && v !== undefined && v !== '');
    return cells.length > 0 && cells.every(isNum);
  });
  const padX = 7;

  const headerH =
    Math.max(
      ...columns.map((c, i) => measure(doc, String(c ?? ''), BOLD, 8, widths[i] - padX * 2)),
      11,
    ) + 12;

  const drawHeader = (): void => {
    const top = doc.y;
    doc.save().rect(LEFT, top, CONTENT_W, headerH).fill(WASH).restore();
    let x = LEFT;
    columns.forEach((col, ci) => {
      doc
        .font(BOLD)
        .fontSize(8)
        .fillColor(INK)
        .text(String(col ?? '').toUpperCase(), x + padX, top + 6, {
          width: widths[ci] - padX * 2,
          align: numeric[ci] ? 'right' : 'left',
          characterSpacing: 0.6,
        });
      x += widths[ci];
    });
    hairline(doc, top + headerH, RULE_STRONG, 1);
    doc.y = top + headerH;
  };

  const rowHeights = rows.map((row) =>
    Math.max(
      ...columns.map((_, ci) => measure(doc, cellText(row?.[ci]), REG, 9, widths[ci] - padX * 2, 1)),
      10,
    ) + 10,
  );

  // Header + at least one row must fit, or the table starts on a fresh page.
  ensure(doc, headerH + (rowHeights[0] ?? 0) + 12);
  drawHeader();

  rows.forEach((row, ri) => {
    const h = rowHeights[ri];
    if (doc.y + h > BOTTOM) {
      // Break between rows only — never through one — and repeat the header.
      doc.addPage();
      drawHeader();
    }
    const top = doc.y;
    if (ri % 2 === 1) doc.save().rect(LEFT, top, CONTENT_W, h).fill('#fafcfd').restore();

    let x = LEFT;
    columns.forEach((_, ci) => {
      const raw = row?.[ci];
      const missing = raw === null || raw === undefined || raw === '';
      doc
        .font(REG)
        .fontSize(9)
        .fillColor(missing ? FAINT : BODY)
        .text(cellText(raw), x + padX, top + 5, {
          width: widths[ci] - padX * 2,
          align: numeric[ci] || isNum(raw) || missing ? 'right' : 'left',
          lineGap: 1,
        });
      x += widths[ci];
    });
    hairline(doc, top + h, RULE, 0.5);
    doc.y = top + h;
  });

  if (block.caption) {
    const h = measure(doc, block.caption, REG, 8.5, CONTENT_W, 2);
    ensure(doc, h + 8);
    doc
      .font(OBL)
      .fontSize(8.5)
      .fillColor(MUTED)
      .text(block.caption, LEFT, doc.y + 7, { width: CONTENT_W, lineGap: 2 });
  }
  doc.y += 18;
}

// ── Charts ──────────────────────────────────────────────────────────────────

const PLOT_H = 168;
const AXIS_W = 42; // value-axis gutter

function legendRows(count: number, cols: number): number {
  return Math.ceil(count / cols) || 0;
}

function drawLegend(doc: Doc, names: string[], top: number, cols: number): number {
  if (names.length <= 1) return 0;
  const colW = CONTENT_W / cols;
  names.forEach((name, i) => {
    const x = LEFT + (i % cols) * colW;
    const y = top + Math.floor(i / cols) * 15;
    doc.save().rect(x, y + 1.5, 8, 8).fill(SERIES_COLOURS[i % SERIES_COLOURS.length]).restore();
    doc
      .font(REG)
      .fontSize(8.5)
      .fillColor(BODY)
      .text(fitText(doc, name, REG, 8.5, colW - 18), x + 12, y, {
        width: colW - 16,
        lineBreak: false,
      });
  });
  return legendRows(names.length, cols) * 15;
}

function drawCartesianChart(doc: Doc, chart: ReportChart, top: number, rotated: boolean): number {
  const cats = chart.categories ?? [];
  const series = (chart.series ?? []).filter((s) => s && Array.isArray(s.values));
  const all = series.flatMap((s) => s.values.map((v) => (numOrNull(v) === null ? NaN : Number(v))));
  const { lo, hi, ticks } = axisScale(all);

  const x0 = LEFT + AXIS_W;
  const plotW = CONTENT_W - AXIS_W;
  const yOf = (v: number) => top + PLOT_H - ((v - lo) / (hi - lo || 1)) * PLOT_H;
  const zeroY = lo < 0 && hi > 0 ? yOf(0) : top + PLOT_H;

  // Gridlines and value axis
  for (const t of ticks) {
    const y = yOf(t);
    hairline(doc, y, t === 0 ? RULE_STRONG : RULE, t === 0 ? 0.8 : 0.5, x0, plotW);
    doc
      .font(REG)
      .fontSize(7.5)
      .fillColor(FAINT)
      .text(tickLabel(t), LEFT, y - 3.5, { width: AXIS_W - 7, align: 'right', lineBreak: false });
  }

  if (chart.unit) {
    doc.save();
    doc.rotate(-90, { origin: [LEFT + 4, top + PLOT_H / 2] });
    doc
      .font(BOLD)
      .fontSize(7.5)
      .fillColor(MUTED)
      .text(chart.unit, LEFT + 4 - 40, top + PLOT_H / 2 - 5, {
        width: 80,
        align: 'center',
        lineBreak: false,
      });
    doc.restore();
  }

  const n = Math.max(cats.length, 1);
  const bandW = plotW / n;
  const xCentre = (i: number) => x0 + bandW * (i + 0.5);

  if (chart.chartType === 'bar') {
    const count = Math.max(series.length, 1);
    const barW = Math.min(30, (bandW * 0.72) / count);
    series.forEach((s, si) => {
      const colour = SERIES_COLOURS[si % SERIES_COLOURS.length];
      cats.forEach((_, i) => {
        const v = numOrNull(s.values[i]);
        if (v === null) return; // gap, not a zero bar
        const y = yOf(v);
        const x = xCentre(i) - (barW * count) / 2 + barW * si;
        doc
          .save()
          .rect(x, Math.min(y, zeroY), Math.max(barW - 1.5, 1), Math.max(Math.abs(zeroY - y), 0.8))
          .fill(colour)
          .restore();
      });
    });
  } else {
    series.forEach((s, si) => {
      const colour = SERIES_COLOURS[si % SERIES_COLOURS.length];
      let run: { x: number; y: number }[] = [];
      const flush = () => {
        if (run.length > 1) {
          doc.save().lineWidth(1.4).strokeColor(colour).lineJoin('round');
          doc.moveTo(run[0].x, run[0].y);
          for (let i = 1; i < run.length; i++) doc.lineTo(run[i].x, run[i].y);
          doc.stroke().restore();
        }
        run = [];
      };
      cats.forEach((_, i) => {
        const v = numOrNull(s.values[i]);
        if (v === null) {
          flush(); // a null breaks the line rather than plotting through it
          return;
        }
        run.push({ x: xCentre(i), y: yOf(v) });
      });
      flush();
      cats.forEach((_, i) => {
        const v = numOrNull(s.values[i]);
        if (v === null) return;
        doc.save().circle(xCentre(i), yOf(v), 2.2).fill(colour).restore();
      });
    });
  }

  hairline(doc, top + PLOT_H, RULE_STRONG, 0.8, x0, plotW);

  // Category axis
  const every = Math.ceil(cats.length / (rotated ? 20 : 10)) || 1;
  cats.forEach((cat, i) => {
    if (i % every !== 0) return;
    const x = xCentre(i);
    const raw = String(cat ?? '');
    // Rotated labels run diagonally into the band below the axis; cap their
    // length so the 45-degree drop stays inside the band height reserved below.
    const label = rotated ? fitText(doc, raw, REG, 7.5, 62) : truncate(raw, 12);
    if (rotated) {
      doc.save();
      doc.rotate(-45, { origin: [x, top + PLOT_H + 6] });
      doc
        .font(REG)
        .fontSize(7.5)
        .fillColor(MUTED)
        .text(label, x - 64, top + PLOT_H + 2, { width: 64, align: 'right', lineBreak: false });
      doc.restore();
    } else {
      doc
        .font(REG)
        .fontSize(7.5)
        .fillColor(MUTED)
        .text(label, x - bandW / 2, top + PLOT_H + 6, {
          width: bandW,
          align: 'center',
          lineBreak: false,
        });
    }
  });

  const bandH = rotated ? 52 : 20;
  const legendH = drawLegend(
    doc,
    series.map((s) => s.name),
    top + PLOT_H + bandH + 6,
    Math.min(4, Math.max(1, Math.floor(CONTENT_W / 140))),
  );
  return PLOT_H + bandH + (legendH ? legendH + 10 : 4);
}

function drawPieChart(doc: Doc, chart: ReportChart, top: number): number {
  const cats = chart.categories ?? [];
  const first = (chart.series ?? [])[0];
  const slices = cats
    .map((label, i) => ({ label: String(label ?? ''), value: numOrNull(first?.values?.[i]) }))
    .filter((d) => d.value !== null && d.value > 0) as { label: string; value: number }[];
  const omitted = cats.length - slices.length;
  const total = slices.reduce((a, d) => a + d.value, 0);

  const r = 84;
  const cx = LEFT + r + 6;
  const cy = top + r + 4;

  if (!total) {
    doc
      .font(OBL)
      .fontSize(9.5)
      .fillColor(MUTED)
      .text('No data available for this chart.', LEFT, top, { width: CONTENT_W });
    return 24;
  }

  // Slices are drawn as fine-grained polygons: pdfkit has no arc primitive and
  // 1.5-degree steps are indistinguishable from a true curve at print sizes.
  let angle = -Math.PI / 2;
  slices.forEach((d, i) => {
    const sweep = (d.value / total) * Math.PI * 2;
    const steps = Math.max(2, Math.ceil(sweep / (Math.PI / 120)));
    doc.save();
    doc.moveTo(cx, cy);
    for (let s = 0; s <= steps; s++) {
      const a = angle + (sweep * s) / steps;
      doc.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    doc.closePath().fillAndStroke(SERIES_COLOURS[i % SERIES_COLOURS.length], '#ffffff');
    doc.restore();
    angle += sweep;
  });

  // Legend carries the numbers — a pie without them is decoration.
  const lx = LEFT + r * 2 + 26;
  const lw = LEFT + CONTENT_W - lx;
  slices.forEach((d, i) => {
    const y = top + 6 + i * 15;
    doc.save().rect(lx, y + 1.5, 8, 8).fill(SERIES_COLOURS[i % SERIES_COLOURS.length]).restore();
    const value = `${groupNumber(d.value)}${chart.unit ? ` ${chart.unit}` : ''} (${((d.value / total) * 100).toFixed(1)}%)`;
    const valueW = Math.max(92, doc.font(REG).fontSize(8.5).widthOfString(value) + 4);
    doc
      .font(REG)
      .fontSize(8.5)
      .fillColor(BODY)
      .text(fitText(doc, d.label, REG, 8.5, lw - 20 - valueW), lx + 12, y, {
        width: lw - 12 - valueW,
        lineBreak: false,
      });
    doc
      .font(REG)
      .fontSize(8.5)
      .fillColor(MUTED)
      .text(value, lx + lw - valueW, y, { width: valueW, align: 'right', lineBreak: false });
  });

  let legendH = slices.length * 15 + 6;
  if (omitted > 0) {
    doc
      .font(OBL)
      .fontSize(8)
      .fillColor(FAINT)
      .text(
        `${omitted} categor${omitted === 1 ? 'y' : 'ies'} with no data ${EM_DASH} not shown`,
        lx,
        top + 6 + slices.length * 15 + 4,
        { width: lw, lineBreak: false },
      );
    legendH += 14;
  }

  return Math.max(r * 2 + 12, legendH);
}

function drawChart(doc: Doc, chart: ReportChart): void {
  const cats = chart.categories ?? [];
  const series = (chart.series ?? []).filter((s) => s && Array.isArray(s.values));
  const rotated =
    chart.chartType !== 'pie' &&
    (cats.length > 8 || cats.some((c) => String(c ?? '').length > 8));

  const titleH = measure(doc, chart.title || '', BOLD, 10.5, CONTENT_W) + 6;
  const noteH = chart.sourceNote ? measure(doc, chart.sourceNote, REG, 8, CONTENT_W, 2) + 6 : 0;

  // Estimate the plot height before drawing so the whole chart moves to the
  // next page as a unit instead of being cut across the boundary.
  const estimate =
    chart.chartType === 'pie'
      ? Math.max(180, (cats.length + 1) * 15 + 12)
      : PLOT_H +
        (rotated ? 52 : 20) +
        (series.length > 1 ? legendRows(series.length, 4) * 15 + 10 : 4);

  const needed = 14 + titleH + estimate + noteH + 14;
  // Charts taller than a page cannot be kept whole; start them on a clean page.
  ensure(doc, Math.min(needed, usableHeight() - 1));

  const top = doc.y + 14;
  hairline(doc, doc.y + 4, RULE, 0.6);

  doc
    .font(BOLD)
    .fontSize(10.5)
    .fillColor(INK)
    .text(chart.title || '', LEFT, top, { width: CONTENT_W });

  const plotTop = doc.y + 8;
  const drawn =
    chart.chartType === 'pie'
      ? drawPieChart(doc, chart, plotTop)
      : drawCartesianChart(doc, chart, plotTop, rotated);

  doc.y = plotTop + drawn;

  if (chart.sourceNote) {
    doc
      .font(REG)
      .fontSize(8)
      .fillColor(FAINT)
      .text(chart.sourceNote, LEFT, doc.y + 6, { width: CONTENT_W, lineGap: 2 });
  }
  doc.y += 18;
}

function drawBlock(doc: Doc, block: ReportBlock): void {
  switch (block.type) {
    case 'paragraph':
      drawParagraph(doc, block.text ?? '');
      break;
    case 'bullets':
      drawBullets(doc, block.items ?? []);
      break;
    case 'stat':
      drawStat(doc, block);
      break;
    case 'table':
      drawTable(doc, block);
      break;
    case 'chart':
      drawChart(doc, block);
      break;
    case 'callout':
      drawCallout(doc, block);
      break;
    default:
      // Silently skip unknown variants rather than emitting raw JSON into a
      // published document if the block union grows.
      break;
  }
}

// ── Front matter & back matter ──────────────────────────────────────────────

function drawSummary(doc: Doc, summary: string): void {
  doc
    .font(BOLD)
    .fontSize(8.5)
    .fillColor(ACCENT)
    .text('EXECUTIVE SUMMARY', LEFT, doc.y, { width: CONTENT_W, characterSpacing: 1.4 });
  doc.y += 6;

  const padX = 16;
  const innerW = CONTENT_W - padX * 2;
  const textH = measure(doc, summary, REG, 11.5, innerW, 4);
  const boxH = textH + 32;
  const top = doc.y;

  // The tinted panel only works if the summary fits on one page; long ones
  // fall back to plain flowing text rather than a box sliced in half.
  const boxed = boxH <= BOTTOM - top;
  if (boxed) {
    doc.save();
    doc.rect(LEFT, top, CONTENT_W, boxH).fill(WASH);
    doc.rect(LEFT, top, 3, boxH).fill(ACCENT);
    doc.restore();
    doc
      .font(REG)
      .fontSize(11.5)
      .fillColor(INK)
      .text(summary, LEFT + padX, top + 16, { width: innerW, lineGap: 4 });
    doc.y = top + boxH + 26;
  } else {
    doc
      .font(REG)
      .fontSize(11.5)
      .fillColor(INK)
      .text(summary, LEFT, top, { width: CONTENT_W, lineGap: 4 });
    doc.y += 24;
  }
}

function drawCitations(doc: Doc, citations: ReportDocument['citations']): void {
  if (!citations?.length) return;

  ensure(doc, 90);
  doc.y += 10;
  hairline(doc, doc.y, RULE_STRONG, 0.8);
  doc.y += 16;

  doc.font(BOLD).fontSize(14).fillColor(INK).text('Sources & notes', LEFT, doc.y, {
    width: CONTENT_W,
  });
  doc.y += 12;

  for (const c of citations) {
    const label = `${c.label} ${EM_DASH} `;
    const h = measure(doc, label + (c.detail ?? ''), REG, 9, CONTENT_W - 12, 2);
    ensure(doc, h + 10);
    const top = doc.y;
    doc.font(BOLD).fontSize(9).fillColor(INK).text(label, LEFT, top, {
      width: CONTENT_W,
      continued: true,
      lineGap: 2,
    });
    doc.font(REG).fontSize(9).fillColor(MUTED).text(c.detail ?? '', { lineGap: 2 });
    doc.y += 6;
  }
}

/**
 * Footers are stamped after the flow is complete (bufferPages), because the
 * total page count is only known then. The cover is left clean.
 */
function stampFooters(doc: Doc, report: ReportDocument): void {
  const range = doc.bufferedPageRange();
  const total = range.count;
  const running = truncate(report.title || 'Insight report', 74);

  for (let i = range.start; i < range.start + total; i++) {
    doc.switchToPage(i);
    if (i === range.start) continue; // no furniture on the cover

    // Writing inside the bottom margin would otherwise trigger a new page.
    const saved = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const y = PAGE_H - 44;
    hairline(doc, y - 10, RULE, 0.5);
    doc
      .font(REG)
      .fontSize(7.5)
      .fillColor(FAINT)
      .text(running, LEFT, y, { width: CONTENT_W * 0.7, lineBreak: false });
    doc
      .font(REG)
      .fontSize(7.5)
      .fillColor(FAINT)
      .text(`Page ${i - range.start + 1} of ${total}`, LEFT, y, {
        width: CONTENT_W,
        align: 'right',
        lineBreak: false,
      });

    doc.page.margins.bottom = saved;
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Render a ReportDocument to a print-ready A4 PDF. */
export async function renderReportPdf(report: ReportDocument): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: M,
      bufferPages: true, // footers need the final page count
      autoFirstPage: true,
      info: {
        Title: report.title || 'Insight Report',
        Author: 'African Youth Observatory',
        Subject: report.subtitle || 'Youth development insight report',
        Creator: 'African Youth Observatory API',
        CreationDate: safeDate(report.generatedAt),
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      drawCover(doc, report);

      doc.addPage();
      if (report.summary) drawSummary(doc, report.summary);

      (report.sections ?? []).forEach((section, i) => {
        drawSectionHeading(doc, i, section.heading ?? '');
        (section.blocks ?? []).forEach((block) => drawBlock(doc, block));
        doc.y += 6;
      });

      drawCitations(doc, report.citations ?? []);
      stampFooters(doc, report);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
