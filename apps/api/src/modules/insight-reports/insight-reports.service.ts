import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NewsletterAudience } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache.service';
import { AiService } from '../insights/ai.service';
import { AiContextService } from '../insights/ai-context.service';
import { NewsletterService } from '../newsletter/newsletter.service';

export type ReportScope = 'continental' | 'country' | 'theme';

export interface GeneratedReport {
  id: string;
  scope: ReportScope;
  countryId: string | null;
  themeId: string | null;
  year: number | null;
  title: string;
  summary: string;
  sections: { heading: string; body: string }[];
  html: string;
  source: 'ai' | 'rule-based';
  createdAt: string;
  lastSentAt: string | null;
}

// Generated reports are cached (not persisted to a new table) so they can be
// downloaded or broadcast shortly after generation. 24h is plenty for the
// generate → review → download/send flow. Sending creates a durable newsletter
// campaign row, so the audit trail of what was actually emailed is preserved.
const REPORT_TTL_SECONDS = 24 * 60 * 60;

@Injectable()
export class InsightReportsService {
  private readonly logger = new Logger(InsightReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly ai: AiService,
    private readonly aiContext: AiContextService,
    private readonly newsletter: NewsletterService,
  ) {}

  private cacheKey(id: string) {
    return `insight-report:${id}`;
  }

  async getById(id: string): Promise<GeneratedReport> {
    const report = this.cache.get<GeneratedReport>(this.cacheKey(id));
    if (!report) {
      throw new NotFoundException(
        'Report not found or expired. Generate it again to download or send.',
      );
    }
    return report;
  }

  /**
   * Generate a data-backed insights report with Claude, falling back to a
   * deterministic rule-based report built from real DB rows when AI is
   * unavailable. Never fabricates numbers — the AI is given a real data context
   * and instructed to use only it.
   */
  async generate(opts: {
    scope: ReportScope;
    countryId?: string;
    themeId?: string;
    year?: number;
  }): Promise<GeneratedReport> {
    const scope = opts.scope;
    const id = randomUUID();

    // Resolve labels for title/context.
    let countryName: string | null = null;
    if (scope === 'country') {
      if (!opts.countryId) throw new BadRequestException('countryId is required for a country report');
      const c = await this.prisma.country.findUnique({
        where: { id: opts.countryId },
        select: { name: true },
      });
      if (!c) throw new NotFoundException(`Country ${opts.countryId} not found`);
      countryName = c.name;
    }
    let themeName: string | null = null;
    if (scope === 'theme') {
      if (!opts.themeId) throw new BadRequestException('themeId is required for a theme report');
      const t = await this.prisma.theme.findUnique({
        where: { id: opts.themeId },
        select: { name: true },
      });
      if (!t) throw new NotFoundException(`Theme ${opts.themeId} not found`);
      themeName = t.name;
    }

    const title =
      scope === 'country'
        ? `${countryName} — Youth Development Report`
        : scope === 'theme'
          ? `${themeName} Across Africa — Youth Data Report`
          : 'Africa Youth Development — Continental Report';

    // Build the real-data context.
    const context =
      scope === 'country' && opts.countryId
        ? await this.aiContext.buildCountryContext(opts.countryId)
        : await this.aiContext.buildFullContext();

    let html: string | null = null;
    let source: 'ai' | 'rule-based' = 'rule-based';

    if (await this.ai.isAvailable()) {
      const system =
        'You are the lead analyst for the African Youth Observatory writing a formal data report for ' +
        'policymakers, researchers, and civil-society leaders. Use ONLY the data provided in the context — ' +
        'never invent or estimate numbers; if something is missing, say data is unavailable. ' +
        'Cite the year for every statistic. Be analytical (explain why patterns exist and what to do about them), ' +
        'not merely descriptive. ' +
        'Output clean inline HTML only — use <h2> for section headings, <h3> for sub-points, <p>, <ul>, <li>, <strong>, <em>. ' +
        'No inline styles, no <html>/<head>/<body>, no markdown, no code fences. ' +
        'Structure: an <h2>Executive Summary</h2> (one short paragraph), <h2>Key Findings</h2> (a 4–6 item <ul>), ' +
        '2–4 thematic <h2> analysis sections with real figures, and a final <h2>Recommendations</h2> (3–5 item <ul>). ' +
        'Length: 600–1000 words.';
      const user =
        `Report scope: ${scope}${countryName ? ` (country: ${countryName})` : ''}${themeName ? ` (theme: ${themeName})` : ''}.\n\n` +
        `Real data context (authoritative — use only this):\n${context}\n\n` +
        `Write the full report now as inline HTML, starting with <h2>Executive Summary</h2>.`;

      try {
        html = await this.ai.generate(system, user, 3000);
        if (html && html.trim().length > 150) {
          html = this.stripCodeFences(html);
          source = 'ai';
        } else {
          html = null;
        }
      } catch (e) {
        this.logger.warn(`AI report generation failed, falling back: ${(e as Error).message}`);
        html = null;
      }
    }

    if (!html) {
      html = await this.buildRuleBasedReport(scope, opts.countryId, opts.year);
      source = 'rule-based';
    }

    const sections = this.splitSections(html);
    const summary = this.deriveSummary(html);

    const report: GeneratedReport = {
      id,
      scope,
      countryId: opts.countryId ?? null,
      themeId: opts.themeId ?? null,
      year: opts.year ?? null,
      title,
      summary,
      sections,
      html,
      source,
      createdAt: new Date().toISOString(),
      lastSentAt: null,
    };

    this.cache.set(this.cacheKey(id), report, REPORT_TTL_SECONDS);
    return report;
  }

  /** Standalone downloadable HTML document (self-contained, branded). */
  async renderDownloadHtml(id: string): Promise<{ filename: string; html: string }> {
    const report = await this.getById(id);
    const safe = report.title.replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, '_');
    const doc = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${this.esc(report.title)}</title>
<style>
  body { font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; max-width: 820px; margin: 0 auto; padding: 48px 28px; color: #1a1a1a; line-height: 1.7; }
  .brand { color: #D4A017; font-weight: 700; font-size: 14px; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 6px; }
  h1 { font-size: 28px; margin: 0 0 4px; }
  .meta { color: #777; font-size: 13px; margin-bottom: 32px; border-bottom: 2px solid #eee; padding-bottom: 16px; }
  h2 { font-size: 20px; margin: 32px 0 12px; color: #0A0A0A; }
  h3 { font-size: 16px; margin: 20px 0 8px; }
  ul { padding-left: 22px; } li { margin: 0 0 6px; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #eee; color: #999; font-size: 12px; }
  @media print { body { padding: 0; } }
</style></head>
<body>
  <div class="brand">African Youth Observatory</div>
  <h1>${this.esc(report.title)}</h1>
  <div class="meta">Generated ${new Date(report.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} · Data-backed report${report.source === 'rule-based' ? ' (statistical summary)' : ''}</div>
  ${report.html}
  <div class="footer">PACSDA — Pan African Centre for Social Development and Accountability · africanyouthobservatory.org</div>
</body></html>`;
    return { filename: `${safe}.html`, html: doc };
  }

  /**
   * Admin action: email a generated report to an audience. Maps the public
   * audience term to the NewsletterAudience enum and reuses the newsletter
   * dispatch pipeline (dedupe + per-recipient unsubscribe for subscribers).
   */
  async send(id: string, audience: 'subscribers' | 'users' | 'all'): Promise<{
    campaignId: string;
    audience: NewsletterAudience;
    recipientCount: number;
  }> {
    const report = await this.getById(id);
    const mapped: NewsletterAudience =
      audience === 'users' ? 'USERS' : audience === 'all' ? 'BOTH' : 'SUBSCRIBERS';

    const campaign = await this.newsletter.broadcastAdHoc({
      title: report.title,
      subject: report.title,
      bodyHtml: report.html,
      audience: mapped,
    });

    // Reflect the send time on the cached report.
    report.lastSentAt = new Date().toISOString();
    this.cache.set(this.cacheKey(id), report, REPORT_TTL_SECONDS);

    return { campaignId: campaign.id, audience: mapped, recipientCount: campaign.recipientCount ?? 0 };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private stripCodeFences(html: string): string {
    return html.replace(/```html\n?/gi, '').replace(/```\n?/g, '').trim();
  }

  private esc(s: string): string {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Split rendered HTML into {heading, body} sections by <h2> for the UI. */
  private splitSections(html: string): { heading: string; body: string }[] {
    const parts = html.split(/<h2[^>]*>/i).filter((p) => p.trim());
    const out: { heading: string; body: string }[] = [];
    for (const part of parts) {
      const close = part.indexOf('</h2>');
      if (close === -1) {
        out.push({ heading: 'Overview', body: part.trim() });
        continue;
      }
      const heading = part.slice(0, close).replace(/<[^>]+>/g, '').trim();
      const body = part.slice(close + 5).trim();
      out.push({ heading, body });
    }
    return out.length ? out : [{ heading: 'Report', body: html }];
  }

  /** First meaningful paragraph, stripped to plain text, for list previews. */
  private deriveSummary(html: string): string {
    const m = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const raw = m ? m[1] : html;
    return raw
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 280);
  }

  /**
   * Deterministic report from real DB rows when AI is unavailable — no
   * fabrication, just the actual top rankings + dimension breakdown.
   */
  private async buildRuleBasedReport(
    scope: ReportScope,
    countryId?: string,
    year?: number,
  ): Promise<string> {
    const latest = await this.prisma.youthIndexScore.findFirst({
      orderBy: { year: 'desc' },
      select: { year: true },
    });
    const useYear = year ?? latest?.year;

    if (scope === 'country' && countryId) {
      const country = await this.prisma.country.findUnique({
        where: { id: countryId },
        select: { name: true, region: true },
      });
      const score = useYear
        ? await this.prisma.youthIndexScore.findFirst({
            where: { countryId, year: useYear },
            select: { overallScore: true, rank: true, tier: true, dimensionScores: true },
          })
        : null;
      let html = `<h2>Executive Summary</h2><p>This report summarizes the latest available youth-development data for <strong>${this.esc(country?.name ?? 'this country')}</strong>${useYear ? ` (${useYear})` : ''}.</p>`;
      if (score) {
        html += `<h2>Youth Index</h2><ul><li>Overall score: <strong>${score.overallScore.toFixed(1)}</strong></li><li>Continental rank: <strong>#${score.rank}</strong></li><li>Tier: <strong>${score.tier}</strong></li></ul>`;
        const d = (score.dimensionScores && typeof score.dimensionScores === 'object')
          ? (score.dimensionScores as Record<string, number>)
          : {};
        const dims = Object.entries(d).map(([k, v]) => `<li>${this.esc(k)}: <strong>${Number(v).toFixed(1)}</strong></li>`).join('');
        if (dims) html += `<h2>Dimension Scores</h2><ul>${dims}</ul>`;
      } else {
        html += `<p>No Youth Index score is available for the selected year.</p>`;
      }
      return html;
    }

    // Continental / theme fallback: top + bottom ranked countries.
    let html = `<h2>Executive Summary</h2><p>A continental snapshot of youth development${useYear ? ` for ${useYear}` : ''}, based on the African Youth Index.</p>`;
    if (useYear) {
      const top = await this.prisma.youthIndexScore.findMany({
        where: { year: useYear },
        orderBy: { rank: 'asc' },
        take: 10,
        include: { country: { select: { name: true, flagEmoji: true } } },
      });
      if (top.length) {
        html += `<h2>Top 10 — Youth Index ${useYear}</h2><ul>`;
        for (const t of top) {
          html += `<li><strong>#${t.rank}</strong> ${t.country?.flagEmoji ?? ''} ${this.esc(t.country?.name ?? 'Unknown')} — ${t.overallScore.toFixed(1)}</li>`;
        }
        html += `</ul>`;
      }
    } else {
      html += `<p>No Youth Index data is available yet.</p>`;
    }
    return html;
  }
}
