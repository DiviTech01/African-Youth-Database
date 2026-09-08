import { Injectable, Logger } from '@nestjs/common';
import * as https from 'https';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache.service';
import { AiService } from '../insights/ai.service';
import { DEFAULT_AGE_GROUP } from '../../shared/constants';

const PUBLIC_SITE = 'https://africanyouthobservatory.org';

/**
 * Operator-facing rollups for the AYO platform.
 *
 * Everything here is read-only and shaped for a single spoken answer: one
 * `summary` sentence, plus a `problems` array written in plain language. The
 * consumer (B.I.L.L.I.E.) reads these to a human, so no field in this module
 * may ever contain a stack trace, a bare status code, or a Prisma error.
 */
@Injectable()
export class OpsService {
  private readonly logger = new Logger(OpsService.name);
  private startTime = Date.now();

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private ai: AiService,
  ) {}

  // ── Status: "is the site up / what's broken" ─────────────────

  async getStatus() {
    // Chat and reports route to different models now (Sonnet 5 / Opus 5), so
    // each is probed separately — one can be reachable while the other is not.
    const [database, website, ai, aiReport] = await Promise.all([
      this.checkDatabase(),
      this.checkPublicSite(),
      this.ai.probe("chat"),
      this.ai.probe("report"),
    ]);

    const dataFreshness = database.connected
      ? await this.checkDataFreshness()
      : { latestDataYear: null as number | null, lastIngestedAt: null as string | null, stale: false };

    // Problems are ordered by how much they matter to a person asking
    // "what's broken?" — data outage first, then public site, then AI.
    const problems: string[] = [];
    if (!database.connected) {
      problems.push(
        'The database is unreachable, so no data, rankings or user numbers can be served. This takes the whole platform down.',
      );
    }
    if (!website.reachable) {
      problems.push(
        `The public site at africanyouthobservatory.org is not responding (${website.detail}). Visitors cannot load it.`,
      );
    }
    // A billing or API-key fault takes out both surfaces at once. Report that
    // as one problem rather than reading the same fault out twice.
    if (!ai.ok && !aiReport.ok) {
      problems.push(
        ai.error === aiReport.error
          ? `AI is degraded across both chat and reports. ${ai.error}`
          : `AI chat is degraded (${ai.error}) and report generation is degraded (${aiReport.error}).`,
      );
    } else if (!ai.ok) {
      problems.push(`AI chat answers are degraded. ${ai.error}`);
    } else if (!aiReport.ok) {
      problems.push(`AI report generation is degraded. ${aiReport.error}`);
    }
    if (dataFreshness.stale) {
      problems.push(
        `No new data has been ingested since ${dataFreshness.lastIngestedAt}. The numbers are still served, but they are going stale.`,
      );
    }

    // A dead database or a dead public site is "down". Anything else that is
    // wrong is "degraded" — the platform still answers, just not fully.
    const status = !database.connected || !website.reachable
      ? 'down'
      : problems.length > 0
        ? 'degraded'
        : 'ok';

    return {
      status,
      summary: this.buildSummary(status, problems),
      problems,
      checkedAt: new Date().toISOString(),
      components: {
        api: {
          up: true,
          uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
          version: '1.0.0',
        },
        database,
        website,
        // ok/model/error stay top-level for the shape the manifest documents;
        // the per-surface detail is additive.
        ai: {
          ok: ai.ok && aiReport.ok,
          model: ai.model,
          error: ai.error ?? aiReport.error,
          chat: { ok: ai.ok, model: ai.model, error: ai.error },
          reports: { ok: aiReport.ok, model: aiReport.model, error: aiReport.error },
        },
      },
      data: dataFreshness,
    };
  }

  private buildSummary(status: string, problems: string[]): string {
    if (status === 'ok') return 'African Youth Observatory is fully up. Nothing is broken.';
    if (problems.length === 1) return problems[0];
    return `${problems.length} things need attention. ${problems[0]}`;
  }

  private async checkDatabase(): Promise<{
    connected: boolean;
    latencyMs: number | null;
    detail: string;
  }> {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const latencyMs = Date.now() - started;
      return { connected: true, latencyMs, detail: `Responded in ${latencyMs}ms.` };
    } catch (err: unknown) {
      this.logger.error(`Database check failed: ${err instanceof Error ? err.message : err}`);
      return {
        connected: false,
        latencyMs: null,
        detail: 'The database did not respond to a test query.',
      };
    }
  }

  /**
   * "Is the site up" means the public front-end, not just this API — the API
   * answering is not evidence that visitors can load anything. Cached for 60s
   * so repeated voice queries don't hammer the front-end.
   */
  private async checkPublicSite(): Promise<{
    url: string;
    reachable: boolean;
    httpStatus: number | null;
    latencyMs: number | null;
    detail: string;
  }> {
    const cacheKey = 'ops:public-site';
    const cached = this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const started = Date.now();
    const result = await new Promise<{
      url: string;
      reachable: boolean;
      httpStatus: number | null;
      latencyMs: number | null;
      detail: string;
    }>((resolve) => {
      const req = https.request(
        PUBLIC_SITE,
        { method: 'GET', timeout: 10_000, headers: { 'User-Agent': 'AYO-ops-check' } },
        (res) => {
          res.resume(); // drain, we only care about the status line
          const code = res.statusCode ?? 0;
          const latencyMs = Date.now() - started;
          // 2xx and 3xx both mean a visitor gets somewhere useful.
          const reachable = code >= 200 && code < 400;
          resolve({
            url: PUBLIC_SITE,
            reachable,
            httpStatus: code,
            latencyMs,
            detail: reachable
              ? `Responded ${code} in ${latencyMs}ms.`
              : `returned HTTP ${code}`,
          });
        },
      );
      req.on('timeout', () => {
        req.destroy();
        resolve({
          url: PUBLIC_SITE,
          reachable: false,
          httpStatus: null,
          latencyMs: null,
          detail: 'it timed out after 10 seconds',
        });
      });
      req.on('error', (err) => {
        resolve({
          url: PUBLIC_SITE,
          reachable: false,
          httpStatus: null,
          latencyMs: null,
          detail: `the connection failed: ${err.message}`,
        });
      });
      req.end();
    });

    this.cache.set(cacheKey, result, 60);
    return result;
  }

  private async checkDataFreshness() {
    const [latest, lastSource] = await Promise.all([
      this.prisma.indicatorValue.aggregate({
        where: { ageGroup: DEFAULT_AGE_GROUP },
        _max: { year: true },
      }),
      this.prisma.dataSource.findFirst({
        where: { lastSync: { not: null } },
        orderBy: { lastSync: 'desc' },
        select: { lastSync: true, name: true },
      }),
    ]);

    const lastSync = lastSource?.lastSync ?? null;
    // 90 days with no ingestion is the point where "the numbers are current"
    // stops being true for a platform that tracks annual indicators.
    const stale = lastSync
      ? Date.now() - lastSync.getTime() > 90 * 24 * 60 * 60 * 1000
      : false;

    return {
      latestDataYear: latest._max.year ?? null,
      lastIngestedAt: lastSync ? lastSync.toISOString() : null,
      lastIngestedSource: lastSource?.name ?? null,
      stale,
    };
  }

  // ── Users: "how many signed up" ──────────────────────────────

  async getUsers() {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [total, byRole, newThisWeek, newThisMonth, activeThisMonth, subscribers] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.groupBy({ by: ['role'], _count: { id: true } }),
        this.prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
        this.prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
        this.prisma.user.count({ where: { lastLogin: { gte: monthAgo } } }),
        this.prisma.newsletterSubscription.count({ where: { status: 'SUBSCRIBED' } }),
      ]);

    const roleMap: Record<string, number> = {};
    for (const entry of byRole) roleMap[entry.role] = entry._count.id;

    // `activeThisMonth` counts users with a lastLogin stamp inside 30 days.
    // Nothing wrote lastLogin before the JwtStrategy change that ships with
    // this module, so it undercounts until existing users next sign in — a 0
    // here means "no sign-ins recorded yet", not "nobody is using the site".
    // Said plainly rather than dropped, because a spoken "zero active users"
    // would otherwise sound like an outage.
    const activeIsReliable = activeThisMonth > 0;
    const activeSentence = activeIsReliable
      ? `${activeThisMonth} signed in within the last 30 days.`
      : 'No sign-ins recorded in the last 30 days — login tracking only starts once each user next signs in, so treat this as unknown rather than zero.';

    return {
      totalUsers: total,
      newThisWeek,
      newThisMonth,
      activeThisMonth,
      activeTrackingReliable: activeIsReliable,
      byRole: roleMap,
      newsletterSubscribers: subscribers,
      summary:
        `${total} registered ${total === 1 ? 'user' : 'users'}, ` +
        `${newThisWeek} new this week and ${newThisMonth} in the last 30 days. ` +
        `${activeSentence} ` +
        `${subscribers} newsletter subscribers.`,
      asOf: new Date().toISOString(),
    };
  }

  // ── Numbers: "just get me the numbers" ───────────────────────

  async getNumbers() {
    const cacheKey = 'ops:numbers';
    const cached = this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const ageGroupFilter = { ageGroup: DEFAULT_AGE_GROUP };

    const [
      countries,
      indicators,
      themes,
      dataPoints,
      yearRange,
      indexedCountries,
      experts,
      policies,
      documents,
      users,
      subscribers,
    ] = await Promise.all([
      this.prisma.country.count(),
      this.prisma.indicator.count(),
      this.prisma.theme.count(),
      this.prisma.indicatorValue.count({ where: ageGroupFilter }),
      this.prisma.indicatorValue.aggregate({
        where: ageGroupFilter,
        _min: { year: true },
        _max: { year: true },
      }),
      this.prisma.youthIndexScore.groupBy({ by: ['countryId'] }),
      this.prisma.expert.count(),
      this.prisma.countryPolicy.count(),
      this.prisma.document.count(),
      this.prisma.user.count(),
      this.prisma.newsletterSubscription.count({ where: { status: 'SUBSCRIBED' } }),
    ]);

    const result = {
      countries,
      indicators,
      themes,
      dataPoints,
      dataYearRange: { earliest: yearRange._min.year, latest: yearRange._max.year },
      countriesWithIndexScore: indexedCountries.length,
      experts,
      policies,
      documents,
      users,
      newsletterSubscribers: subscribers,
      summary:
        `${dataPoints.toLocaleString('en-US')} youth data points across ${countries} countries, ` +
        `${indicators} indicators and ${themes} themes, covering ` +
        `${yearRange._min.year}–${yearRange._max.year}. ` +
        `${indexedCountries.length} countries have a Youth Index score.`,
      asOf: new Date().toISOString(),
    };

    this.cache.set(cacheKey, result, 300);
    return result;
  }
}
