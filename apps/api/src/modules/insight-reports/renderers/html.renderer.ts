/**
 * HTML renderer for generated insight reports.
 *
 * Two outputs, one design system:
 *   - renderReportHtml()      body fragment, fully inline-styled, safe to drop
 *                             into a Resend email or store as `StoredReport.html`
 *   - renderStandaloneHtml()  complete printable document with a <style> block
 *
 * Why the token indirection below: email clients strip <style> blocks, so the
 * fragment has to inline every declaration, while the standalone document wants
 * real CSS (print rules, zebra rows, responsive tables). Keeping one style map
 * and emitting it either as `style="..."` or `class="rp-..."` is the only way to
 * guarantee both surfaces stay visually identical as the design evolves — the
 * alternative is two stylesheets that silently drift apart.
 *
 * Charts are hand-built inline SVG on purpose: no charting library and no
 * <canvas>, because this markup is emailed and printed, where scripts never run
 * and a canvas is a blank rectangle.
 */

import {
  ReportBlock,
  ReportChart,
  ReportDocument,
} from '../report-document.model';

// ── Design tokens ───────────────────────────────────────────────────────────

const FONT =
  "'Helvetica Neue', Helvetica, Arial, 'Segoe UI', Roboto, sans-serif";

const C = {
  ink: '#16222c', // headings
  body: '#33434f', // running text
  muted: '#6d7d8a', // captions, metadata, null placeholders
  faint: '#9aa7b2',
  rule: '#dbe2e8',
  ruleStrong: '#b9c4cd',
  wash: '#f4f7f9', // table header / callout fill
  accent: '#0b6b5e', // deep teal — the observatory mark
  warn: '#8a5a12',
  page: '#ffffff',
};

/** Categorical series colours. Muted, print-safe, distinguishable in greyscale. */
const SERIES = [
  '#0b6b5e',
  '#b06d33',
  '#3a5f8a',
  '#7a5495',
  '#5d7a2e',
  '#a2453c',
  '#2f7d8a',
  '#8a6f2f',
];

const STYLES: Record<string, string> = {
  doc: `font-family:${FONT};font-size:15px;line-height:1.65;color:${C.body};max-width:760px;margin:0 auto;padding:8px 0 40px;background:${C.page};-webkit-font-smoothing:antialiased`,

  masthead: `border-top:4px solid ${C.accent};padding:18px 0 22px;margin:0 0 28px`,
  eyebrow: `font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${C.accent};margin:0 0 12px`,
  h1: `font-family:${FONT};font-size:30px;line-height:1.2;font-weight:700;color:${C.ink};margin:0 0 10px;letter-spacing:-0.4px`,
  subtitle: `font-family:${FONT};font-size:17px;line-height:1.45;color:${C.muted};margin:0 0 16px;font-weight:400`,
  meta: `font-family:${FONT};font-size:12px;letter-spacing:0.4px;color:${C.faint};margin:0`,

  summaryBox: `background:${C.wash};border-left:3px solid ${C.accent};padding:20px 24px;margin:0 0 36px`,
  summaryLabel: `font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${C.accent};margin:0 0 8px`,
  summaryText: `font-family:${FONT};font-size:15.5px;line-height:1.7;color:${C.ink};margin:0`,

  section: `margin:0 0 34px`,
  sectionHead: `border-bottom:1px solid ${C.ruleStrong};padding:0 0 8px;margin:0 0 18px`,
  sectionNum: `font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:1.4px;color:${C.faint};margin:0 0 4px`,
  h2: `font-family:${FONT};font-size:20px;font-weight:700;color:${C.ink};margin:0;letter-spacing:-0.2px`,

  p: `font-family:${FONT};font-size:15px;line-height:1.7;color:${C.body};margin:0 0 14px`,
  ul: `margin:0 0 16px;padding:0 0 0 20px`,
  li: `font-family:${FONT};font-size:15px;line-height:1.65;color:${C.body};margin:0 0 7px;padding:0 0 0 2px`,

  statBox: `border:1px solid ${C.rule};border-left:3px solid ${C.accent};padding:14px 18px;margin:0 0 18px;background:${C.page}`,
  statLabel: `font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${C.muted};margin:0 0 4px`,
  statValue: `font-family:${FONT};font-size:30px;line-height:1.1;font-weight:700;color:${C.accent};margin:0;letter-spacing:-0.6px`,
  statContext: `font-family:${FONT};font-size:13px;line-height:1.55;color:${C.muted};margin:6px 0 0`,

  tableWrap: `margin:0 0 20px;overflow-x:auto`,
  table: `border-collapse:collapse;width:100%;font-family:${FONT};font-size:13.5px`,
  caption: `font-family:${FONT};font-size:12px;color:${C.muted};margin:8px 0 0;text-align:left;line-height:1.5`,
  th: `text-align:left;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:${C.ink};background:${C.wash};border-bottom:1.5px solid ${C.ruleStrong};padding:9px 10px;white-space:nowrap`,
  thNum: `text-align:right;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:${C.ink};background:${C.wash};border-bottom:1.5px solid ${C.ruleStrong};padding:9px 10px;white-space:nowrap`,
  td: `text-align:left;font-family:${FONT};font-size:13.5px;color:${C.body};border-bottom:1px solid ${C.rule};padding:8px 10px;vertical-align:top`,
  tdNum: `text-align:right;font-family:${FONT};font-size:13.5px;color:${C.body};border-bottom:1px solid ${C.rule};padding:8px 10px;vertical-align:top;white-space:nowrap`,
  tdNull: `text-align:right;font-family:${FONT};font-size:13.5px;color:${C.faint};border-bottom:1px solid ${C.rule};padding:8px 10px;vertical-align:top`,
  rowAlt: `background:#fafcfd`,

  chartBox: `margin:0 0 24px;padding:16px 0 0;border-top:1px solid ${C.rule}`,
  chartTitle: `font-family:${FONT};font-size:14px;font-weight:700;color:${C.ink};margin:0 0 2px`,
  chartUnit: `font-family:${FONT};font-size:11.5px;letter-spacing:0.4px;color:${C.muted};margin:0 0 10px`,
  chartNote: `font-family:${FONT};font-size:11.5px;color:${C.faint};margin:6px 0 0;line-height:1.5`,

  calloutInsight: `border-left:3px solid ${C.accent};background:#f1f7f6;padding:14px 18px;margin:0 0 18px`,
  calloutWarning: `border-left:3px solid ${C.warn};background:#fbf6ec;padding:14px 18px;margin:0 0 18px`,
  calloutNote: `border-left:3px solid ${C.ruleStrong};background:${C.wash};padding:14px 18px;margin:0 0 18px`,
  calloutLabel: `font-family:${FONT};font-size:10.5px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;margin:0 0 5px`,
  calloutText: `font-family:${FONT};font-size:14.5px;line-height:1.65;color:${C.ink};margin:0`,

  sources: `margin:40px 0 0;border-top:1px solid ${C.ruleStrong};padding:22px 0 0`,
  sourceItem: `font-family:${FONT};font-size:13px;line-height:1.6;color:${C.muted};margin:0 0 9px`,
  sourceLabel: `font-family:${FONT};color:${C.ink};font-weight:700`,

  colophon: `font-family:${FONT};font-size:11.5px;color:${C.faint};margin:30px 0 0;border-top:1px solid ${C.rule};padding:14px 0 0;line-height:1.6`,
};

type Mode = 'inline' | 'class';

/** Emit a token as an inline `style` attribute (email) or a class (standalone). */
function s(mode: Mode, token: string): string {
  if (mode === 'class') return ` class="rp-${token}"`;
  const decl = STYLES[token];
  return decl ? ` style="${decl}"` : '';
}

// ── Escaping & formatting ───────────────────────────────────────────────────

/** Matches the escaping used elsewhere in the insight-reports module. */
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const NULL_CELL = '&mdash;';

function groupNumber(n: number): string {
  if (!Number.isFinite(n)) return '';
  const rounded = Number.isInteger(n) ? n : Math.round(n * 100) / 100;
  const [int, frac] = String(Math.abs(rounded)).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${rounded < 0 ? '-' : ''}${grouped}${frac ? `.${frac}` : ''}`;
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

// ── Chart geometry (shared by both HTML outputs) ────────────────────────────

/** A "nice" axis: rounded step, zero baseline whenever the data allows one. */
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
  const step = (frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10) * base;

  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;

  const ticks: number[] = [];
  // Guard against a runaway loop if step underflows on degenerate input.
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

function truncate(str: string, max: number): string {
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

function svgText(
  x: number,
  y: number,
  text: string,
  opts: {
    size?: number;
    fill?: string;
    anchor?: 'start' | 'middle' | 'end';
    weight?: number;
  } = {},
): string {
  const { size = 11, fill = C.muted, anchor = 'start', weight = 400 } = opts;
  return `<text x="${round(x)}" y="${round(y)}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(text)}</text>`;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

const CHART_W = 700;

/** Legend rendered inside the SVG so the chart stays a single portable node. */
function legendSvg(names: string[], x: number, y: number, cols: number): { markup: string; height: number } {
  if (names.length <= 1) return { markup: '', height: 0 };
  const colW = (CHART_W - x - 8) / cols;
  let out = '';
  names.forEach((name, i) => {
    const cx = x + (i % cols) * colW;
    const cy = y + Math.floor(i / cols) * 17;
    out += `<rect x="${round(cx)}" y="${round(cy - 8)}" width="10" height="10" rx="2" fill="${SERIES[i % SERIES.length]}"/>`;
    out += svgText(cx + 15, cy + 1, truncate(name, 28), { size: 11, fill: C.body });
  });
  return { markup: out, height: Math.ceil(names.length / cols) * 17 + 6 };
}

function cartesianSvg(c: ReportChart): string {
  const cats = c.categories ?? [];
  const series = (c.series ?? []).filter((sr) => sr && Array.isArray(sr.values));
  const all = series.flatMap((sr) => sr.values.map((v) => (v === null ? NaN : Number(v))));
  const { lo, hi, ticks } = axisScale(all);

  const padL = 56;
  const padR = 14;
  const padT = 10;
  const plotH = 216;
  // Long category labels get rotated rather than overlapped.
  const rotate = cats.length > 7 || cats.some((k) => String(k).length > 9);
  const labelBand = rotate ? 56 : 26;
  const plotW = CHART_W - padL - padR;
  const legend = legendSvg(
    series.map((sr) => sr.name),
    padL,
    padT + plotH + labelBand + 16,
    Math.min(4, Math.max(1, Math.floor(plotW / 170))),
  );
  const H = padT + plotH + labelBand + (legend.height ? legend.height + 12 : 4);

  const yOf = (v: number) => padT + plotH - ((v - lo) / (hi - lo || 1)) * plotH;
  const zeroY = lo < 0 && hi > 0 ? yOf(0) : padT + plotH;

  let g = '';

  // Gridlines + value axis
  for (const t of ticks) {
    const y = yOf(t);
    g += `<line x1="${padL}" y1="${round(y)}" x2="${padL + plotW}" y2="${round(y)}" stroke="${t === 0 ? C.ruleStrong : C.rule}" stroke-width="1"/>`;
    g += svgText(padL - 8, y + 3.5, tickLabel(t), { anchor: 'end', size: 10.5, fill: C.faint });
  }
  if (c.unit) {
    g += `<text x="14" y="${round(padT + plotH / 2)}" font-family="${FONT}" font-size="10.5" font-weight="700" fill="${C.muted}" text-anchor="middle" transform="rotate(-90 14 ${round(padT + plotH / 2)})">${esc(c.unit)}</text>`;
  }

  const n = Math.max(cats.length, 1);
  const bandW = plotW / n;
  const xCentre = (i: number) => padL + bandW * (i + 0.5);

  if (c.chartType === 'bar') {
    const count = Math.max(series.length, 1);
    const barW = Math.min(38, (bandW * 0.72) / count);
    series.forEach((sr, si) => {
      const colour = SERIES[si % SERIES.length];
      cats.forEach((_, i) => {
        const raw = sr.values[i];
        if (raw === null || raw === undefined || !Number.isFinite(Number(raw))) return; // sparse data: leave a gap
        const v = Number(raw);
        const y = yOf(v);
        const x = xCentre(i) - (barW * count) / 2 + barW * si;
        const top = Math.min(y, zeroY);
        const h = Math.max(1, Math.abs(zeroY - y));
        g += `<rect x="${round(x)}" y="${round(top)}" width="${round(barW - 1.5)}" height="${round(h)}" fill="${colour}"/>`;
      });
    });
  } else {
    series.forEach((sr, si) => {
      const colour = SERIES[si % SERIES.length];
      let run: string[] = [];
      const flush = () => {
        if (run.length > 1) {
          g += `<polyline points="${run.join(' ')}" fill="none" stroke="${colour}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
        }
        run = [];
      };
      cats.forEach((_, i) => {
        const raw = sr.values[i];
        if (raw === null || raw === undefined || !Number.isFinite(Number(raw))) {
          flush(); // a null breaks the line instead of being plotted as zero
          return;
        }
        run.push(`${round(xCentre(i))},${round(yOf(Number(raw)))}`);
      });
      flush();
      cats.forEach((_, i) => {
        const raw = sr.values[i];
        if (raw === null || raw === undefined || !Number.isFinite(Number(raw))) return;
        g += `<circle cx="${round(xCentre(i))}" cy="${round(yOf(Number(raw)))}" r="2.8" fill="${colour}"/>`;
      });
    });
  }

  // Baseline + category labels
  g += `<line x1="${padL}" y1="${round(padT + plotH)}" x2="${padL + plotW}" y2="${round(padT + plotH)}" stroke="${C.ruleStrong}" stroke-width="1"/>`;
  const every = Math.ceil(cats.length / (rotate ? 18 : 10)) || 1;
  cats.forEach((cat, i) => {
    if (i % every !== 0) return;
    const x = xCentre(i);
    const y = padT + plotH + (rotate ? 12 : 16);
    if (rotate) {
      g += `<text x="${round(x)}" y="${round(y)}" font-family="${FONT}" font-size="10" fill="${C.muted}" text-anchor="end" transform="rotate(-45 ${round(x)} ${round(y)})">${esc(truncate(String(cat), 16))}</text>`;
    } else {
      g += svgText(x, y, truncate(String(cat), 14), { size: 10.5, anchor: 'middle' });
    }
  });

  g += legend.markup;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CHART_W} ${round(H)}" width="${CHART_W}" height="${round(H)}" role="img" aria-label="${esc(c.title)}" style="max-width:100%;height:auto;display:block">${g}</svg>`;
}

function pieSvg(c: ReportChart): string {
  const cats = c.categories ?? [];
  const first = (c.series ?? [])[0];
  const values = cats.map((_, i) => {
    const raw = first?.values?.[i];
    return raw === null || raw === undefined || !Number.isFinite(Number(raw)) ? null : Number(raw);
  });
  const slices = cats
    .map((label, i) => ({ label, value: values[i] }))
    .filter((d) => d.value !== null && d.value > 0) as { label: string; value: number }[];
  const total = slices.reduce((a, d) => a + d.value, 0);
  const omitted = cats.length - slices.length;

  const cx = 150;
  const cy = 148;
  const r = 118;
  const rowH = 20;
  const H = Math.max(300, 34 + slices.length * rowH + (omitted ? rowH : 0));

  let g = '';
  if (!total) {
    g += svgText(cx, cy, 'No data available', { anchor: 'middle', size: 12 });
  } else {
    let angle = -Math.PI / 2; // start at 12 o'clock
    slices.forEach((d, i) => {
      const sweep = (d.value / total) * Math.PI * 2;
      const end = angle + sweep;
      const x1 = cx + r * Math.cos(angle);
      const y1 = cy + r * Math.sin(angle);
      const x2 = cx + r * Math.cos(end);
      const y2 = cy + r * Math.sin(end);
      const large = sweep > Math.PI ? 1 : 0;
      const path =
        slices.length === 1
          ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${round(cx - 0.01)} ${cy - r} Z`
          : `M ${round(cx)} ${round(cy)} L ${round(x1)} ${round(y1)} A ${r} ${r} 0 ${large} 1 ${round(x2)} ${round(y2)} Z`;
      g += `<path d="${path}" fill="${SERIES[i % SERIES.length]}" stroke="${C.page}" stroke-width="1.5"/>`;
      angle = end;
    });
  }

  // Legend with share of total — a pie without its numbers is decoration.
  const lx = 300;
  slices.forEach((d, i) => {
    const y = 34 + i * rowH;
    g += `<rect x="${lx}" y="${y - 9}" width="10" height="10" rx="2" fill="${SERIES[i % SERIES.length]}"/>`;
    g += svgText(lx + 16, y, truncate(d.label, 30), { size: 11.5, fill: C.body });
    g += svgText(CHART_W - 6, y, `${groupNumber(d.value)}${c.unit ? ` ${c.unit}` : ''}  (${((d.value / total) * 100).toFixed(1)}%)`, {
      size: 11.5,
      fill: C.muted,
      anchor: 'end',
    });
  });
  if (omitted > 0) {
    const y = 34 + slices.length * rowH;
    g += svgText(lx, y, `${omitted} categor${omitted === 1 ? 'y' : 'ies'} with no data — not shown`, {
      size: 11,
      fill: C.faint,
    });
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CHART_W} ${H}" width="${CHART_W}" height="${H}" role="img" aria-label="${esc(c.title)}" style="max-width:100%;height:auto;display:block">${g}</svg>`;
}

function chartSvg(c: ReportChart): string {
  return c.chartType === 'pie' ? pieSvg(c) : cartesianSvg(c);
}

// ── Block rendering ─────────────────────────────────────────────────────────

const CALLOUT_LABEL: Record<string, string> = {
  insight: 'Insight',
  warning: 'Caution',
  note: 'Note',
};
const CALLOUT_COLOUR: Record<string, string> = {
  insight: C.accent,
  warning: C.warn,
  note: C.muted,
};

function renderTable(
  mode: Mode,
  block: Extract<ReportBlock, { type: 'table' }>,
): string {
  const columns = block.columns ?? [];
  const rows = block.rows ?? [];
  // Right-align a column only when every populated cell in it is numeric.
  const numericCol = columns.map((_, ci) => {
    const cells = rows.map((r) => r?.[ci]).filter((v) => v !== null && v !== undefined && v !== '');
    return cells.length > 0 && cells.every((v) => typeof v === 'number' && Number.isFinite(v));
  });

  const head = columns
    .map((col, ci) => `<th${s(mode, numericCol[ci] ? 'thNum' : 'th')}>${esc(col)}</th>`)
    .join('');

  const body = rows
    .map((row, ri) => {
      const cells = columns
        .map((_, ci) => {
          const v = row?.[ci];
          if (v === null || v === undefined || v === '') {
            return `<td${s(mode, 'tdNull')}>${NULL_CELL}</td>`;
          }
          if (typeof v === 'number') {
            return `<td${s(mode, 'tdNum')}>${esc(groupNumber(v))}</td>`;
          }
          return `<td${s(mode, numericCol[ci] ? 'tdNum' : 'td')}>${esc(v)}</td>`;
        })
        .join('');
      const alt = ri % 2 === 1;
      const rowAttr =
        mode === 'inline' ? (alt ? ` style="${STYLES.rowAlt}"` : '') : alt ? ' class="rp-rowAlt"' : '';
      return `<tr${rowAttr}>${cells}</tr>`;
    })
    .join('');

  return (
    `<div${s(mode, 'tableWrap')}>` +
    `<table${s(mode, 'table')} cellspacing="0" cellpadding="0" role="table">` +
    `<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>` +
    (block.caption ? `<p${s(mode, 'caption')}>${esc(block.caption)}</p>` : '') +
    `</div>`
  );
}

function renderBlock(mode: Mode, block: ReportBlock): string {
  switch (block.type) {
    case 'paragraph':
      return `<p${s(mode, 'p')}>${esc(block.text)}</p>`;

    case 'bullets':
      return (
        `<ul${s(mode, 'ul')}>` +
        (block.items ?? []).map((i) => `<li${s(mode, 'li')}>${esc(i)}</li>`).join('') +
        `</ul>`
      );

    case 'stat':
      return (
        `<div${s(mode, 'statBox')}>` +
        `<p${s(mode, 'statLabel')}>${esc(block.label)}</p>` +
        `<p${s(mode, 'statValue')}>${esc(block.value)}</p>` +
        (block.context ? `<p${s(mode, 'statContext')}>${esc(block.context)}</p>` : '') +
        `</div>`
      );

    case 'table':
      return renderTable(mode, block);

    case 'chart':
      return (
        `<div${s(mode, 'chartBox')}>` +
        `<p${s(mode, 'chartTitle')}>${esc(block.title)}</p>` +
        (block.unit ? `<p${s(mode, 'chartUnit')}>Measured in ${esc(block.unit)}</p>` : '') +
        chartSvg(block) +
        (block.sourceNote ? `<p${s(mode, 'chartNote')}>${esc(block.sourceNote)}</p>` : '') +
        `</div>`
      );

    case 'callout': {
      const tone = CALLOUT_LABEL[block.tone] ? block.tone : 'note';
      const boxToken = `callout${tone.charAt(0).toUpperCase()}${tone.slice(1)}`;
      const labelStyle =
        mode === 'inline'
          ? ` style="${STYLES.calloutLabel};color:${CALLOUT_COLOUR[tone]}"`
          : ` class="rp-calloutLabel rp-calloutLabel--${tone}"`;
      return (
        `<div${s(mode, boxToken)}>` +
        `<p${labelStyle}>${esc(CALLOUT_LABEL[tone])}</p>` +
        `<p${s(mode, 'calloutText')}>${esc(block.text)}</p>` +
        `</div>`
      );
    }

    default:
      // Unknown block types are dropped rather than leaking "[object Object]"
      // into a published report if the model contract gains a variant.
      return '';
  }
}

function renderBody(mode: Mode, doc: ReportDocument): string {
  const sections = doc.sections ?? [];
  const citations = doc.citations ?? [];

  let out = '';

  out +=
    `<div${s(mode, 'masthead')}>` +
    `<p${s(mode, 'eyebrow')}>African Youth Observatory &middot; Insight Report</p>` +
    `<h1${s(mode, 'h1')}>${esc(doc.title)}</h1>` +
    (doc.subtitle ? `<p${s(mode, 'subtitle')}>${esc(doc.subtitle)}</p>` : '') +
    `<p${s(mode, 'meta')}>Generated ${esc(formatDate(doc.generatedAt))}</p>` +
    `</div>`;

  if (doc.summary) {
    out +=
      `<div${s(mode, 'summaryBox')}>` +
      `<p${s(mode, 'summaryLabel')}>Executive summary</p>` +
      `<p${s(mode, 'summaryText')}>${esc(doc.summary)}</p>` +
      `</div>`;
  }

  sections.forEach((section, i) => {
    out +=
      `<div${s(mode, 'section')}>` +
      `<div${s(mode, 'sectionHead')}>` +
      `<p${s(mode, 'sectionNum')}>Section ${String(i + 1).padStart(2, '0')}</p>` +
      `<h2${s(mode, 'h2')}>${esc(section.heading)}</h2>` +
      `</div>` +
      (section.blocks ?? []).map((b) => renderBlock(mode, b)).join('') +
      `</div>`;
  });

  if (citations.length) {
    out +=
      `<div${s(mode, 'sources')}>` +
      `<div${s(mode, 'sectionHead')}><h2${s(mode, 'h2')}>Sources &amp; notes</h2></div>` +
      citations
        .map(
          (c) =>
            `<p${s(mode, 'sourceItem')}><span${s(mode, 'sourceLabel')}>${esc(c.label)}</span> &mdash; ${esc(c.detail)}</p>`,
        )
        .join('') +
      `</div>`;
  }

  out +=
    `<p${s(mode, 'colophon')}>Produced by the African Youth Observatory from its indicator database. ` +
    `Figures reflect the most recent year available for each indicator; gaps are shown as &mdash;.</p>`;

  return out;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Body fragment with every style inlined — safe for email clients (which drop
 * <style> blocks) and for embedding in the web app's report viewer.
 */
export function renderReportHtml(doc: ReportDocument): string {
  return `<div${s('inline', 'doc')}>${renderBody('inline', doc)}</div>`;
}

/** Complete, printable HTML document with a real stylesheet. */
export function renderStandaloneHtml(doc: ReportDocument): string {
  const sheet = Object.entries(STYLES)
    .map(([token, decl]) => `.rp-${token}{${decl}}`)
    .join('\n');

  const extra = `
.rp-calloutLabel--insight{color:${C.accent}}
.rp-calloutLabel--warning{color:${C.warn}}
.rp-calloutLabel--note{color:${C.muted}}
body{margin:0;background:#eef2f5;color:${C.body}}
.rp-page{background:${C.page};max-width:860px;margin:0 auto;padding:48px 50px 56px;box-shadow:0 1px 3px rgba(20,35,45,.12)}
.rp-doc{max-width:none;padding:0}
.rp-table tbody tr:last-child .rp-td,.rp-table tbody tr:last-child td{border-bottom:none}
@media (max-width:640px){.rp-page{padding:24px 18px 32px}.rp-h1{font-size:24px}}
@media print{
  @page{size:A4;margin:18mm 16mm}
  body{background:#fff}
  .rp-page{box-shadow:none;max-width:none;padding:0}
  .rp-section,.rp-chartBox,.rp-statBox,.rp-tableWrap,.rp-calloutInsight,.rp-calloutWarning,.rp-calloutNote{page-break-inside:avoid;break-inside:avoid}
  .rp-h2,.rp-sectionHead{page-break-after:avoid;break-after:avoid}
  thead{display:table-header-group}
  tr{page-break-inside:avoid;break-inside:avoid}
}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(doc.title)}</title>
<meta name="description" content="${esc(doc.subtitle || doc.summary || doc.title).slice(0, 300)}">
<style>
${sheet}
${extra}
</style>
</head>
<body>
<main class="rp-page"><div class="rp-doc">${renderBody('class', doc)}</div></main>
</body>
</html>`;
}
