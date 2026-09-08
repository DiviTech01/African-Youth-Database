/**
 * The canonical structured shape of a generated insight report.
 *
 * This is the contract every part of the report pipeline agrees on. Claude
 * emits a ReportDocument (structured output, not prose HTML); the HTML, PDF,
 * PPTX and XLSX renderers each consume one. Adding an export format means
 * adding a renderer, not touching generation.
 *
 * Why not HTML from the model: asking for HTML gave us exactly one output
 * format, and forced regex code-fence stripping plus `<h2>` splitting to
 * recover any structure at all. Structure first, presentation last.
 */

/** A chart the renderers draw natively — never a pre-rendered image. */
export interface ReportChart {
  chartType: 'bar' | 'line' | 'pie';
  title: string;
  /** X-axis labels (years, country names, ...). */
  categories: string[];
  /** One entry per plotted series. `values` is index-aligned to `categories`. */
  series: { name: string; values: (number | null)[] }[];
  /** Unit shown on the value axis, e.g. "%" or "per 1,000". */
  unit?: string;
  sourceNote?: string;
}

export type ReportBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'bullets'; items: string[] }
  /** A headline figure. `value` is pre-formatted for display ("62.4%"). */
  | { type: 'stat'; label: string; value: string; context?: string }
  | {
      type: 'table';
      columns: string[];
      rows: (string | number | null)[][];
      caption?: string;
    }
  | ({ type: 'chart' } & ReportChart)
  | { type: 'callout'; tone: 'insight' | 'warning' | 'note'; text: string };

export interface ReportSection {
  heading: string;
  blocks: ReportBlock[];
}

/**
 * Where a figure came from. Reports are cited artefacts — every number the
 * model states should be traceable to an indicator/year it was actually given.
 */
export interface ReportCitation {
  label: string;
  detail: string;
}

export interface ReportDocument {
  title: string;
  subtitle?: string;
  /** Plain-text executive summary. No markup — renderers style it. */
  summary: string;
  sections: ReportSection[];
  citations: ReportCitation[];
  generatedAt: string;
}

/** Export formats the pipeline can render a ReportDocument into. */
export type ReportFormat = 'html' | 'pdf' | 'pptx' | 'xlsx';

export const REPORT_MIME: Record<ReportFormat, string> = {
  html: 'text/html; charset=utf-8',
  pdf: 'application/pdf',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/**
 * Persistence contract for generated reports.
 *
 * The previous implementation kept reports in an in-process Map, so every
 * Render spin-down or redeploy silently invalidated download links that had
 * already been handed out. Implementations must survive a restart.
 */
export interface ReportStore {
  save(report: StoredReport): Promise<void>;
  get(id: string): Promise<StoredReport | null>;
  /** Persist a rendered binary and return a key the API can stream back. */
  putRendered(id: string, format: ReportFormat, body: Buffer): Promise<string>;
  getRendered(id: string, format: ReportFormat): Promise<Buffer | null>;
}

export interface StoredReport {
  id: string;
  scope: 'continental' | 'country' | 'theme';
  countryId: string | null;
  themeId: string | null;
  year: number | null;
  document: ReportDocument;
  /** Rendered HTML body (no <html> wrapper) — kept for email + fast reads. */
  html: string;
  source: 'ai' | 'rule-based';
  model: string | null;
  createdAt: string;
  lastSentAt: string | null;
}
