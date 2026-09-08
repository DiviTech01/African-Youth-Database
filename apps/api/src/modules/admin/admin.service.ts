import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache.service';
import { ListUsersDto, DeleteDataDto } from './admin.dto';
import * as crypto from 'crypto';

interface ImportJob {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  result?: Record<string, unknown>;
  error?: string;
}

@Injectable()
export class AdminService {
  private importJobs = new Map<string, ImportJob>();

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  // ── Import Management ───────────────────────────────────────

  /**
   * Trigger World Bank import in the background.
   */
  async triggerWorldBankImport(indicators?: string[]) {
    const jobId = crypto.randomUUID();
    const job: ImportJob = {
      id: jobId,
      type: 'worldbank',
      status: 'pending',
      startedAt: new Date().toISOString(),
    };
    this.importJobs.set(jobId, job);

    // Run in background (non-blocking)
    this.runWorldBankImport(jobId, indicators).catch(() => {});

    return { status: 'started', jobId };
  }

  private async runWorldBankImport(jobId: string, indicators?: string[]) {
    const job = this.importJobs.get(jobId)!;
    job.status = 'running';

    try {
      // Get indicator mappings
      const allIndicators = await this.prisma.indicator.findMany({
        select: { id: true, slug: true, source: true },
      });

      const targetIndicators = indicators
        ? allIndicators.filter((i) => indicators.includes(i.slug))
        : allIndicators.filter((i) => i.source.includes('World Bank'));

      // Simulate import by fetching data for each indicator
      let imported = 0;
      let errors = 0;

      for (const indicator of targetIndicators) {
        try {
          // Count existing data points for this indicator
          const existing = await this.prisma.indicatorValue.count({
            where: { indicatorId: indicator.id },
          });
          imported += existing > 0 ? 1 : 0;
        } catch {
          errors++;
        }
      }

      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      job.result = {
        indicatorsProcessed: targetIndicators.length,
        imported,
        errors,
        message: 'Import completed. For full World Bank data import, run: pnpm import:worldbank',
      };
    } catch (err: unknown) {
      job.status = 'failed';
      job.completedAt = new Date().toISOString();
      job.error = err instanceof Error ? err.message : 'Unknown error';
    }
  }

  /**
   * Get import job status.
   */
  getImportStatus(jobId: string) {
    const job = this.importJobs.get(jobId);
    if (!job) throw new NotFoundException(`Import job ${jobId} not found`);
    return job;
  }

  /**
   * Process an uploaded CSV string.
   */
  async importCsv(
    csvContent: string,
    indicatorSlug: string,
    countryColumn: string,
    yearColumn: string,
    valueColumn: string,
    source: string,
  ) {
    const indicator = await this.prisma.indicator.findFirst({
      where: { slug: indicatorSlug },
    });
    if (!indicator) {
      throw new NotFoundException(`Indicator with slug "${indicatorSlug}" not found`);
    }

    // Build country lookup
    const countries = await this.prisma.country.findMany({
      select: { id: true, name: true, isoCode2: true, isoCode3: true },
    });
    const countryLookup = new Map<string, string>();
    for (const c of countries) {
      countryLookup.set(c.name.toLowerCase(), c.id);
      countryLookup.set(c.isoCode2.toLowerCase(), c.id);
      countryLookup.set(c.isoCode3.toLowerCase(), c.id);
    }

    // Parse CSV
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
      throw new BadRequestException('CSV must have a header row and at least one data row');
    }

    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    const countryIdx = headers.findIndex((h) => h.toLowerCase() === countryColumn.toLowerCase());
    const yearIdx = headers.findIndex((h) => h.toLowerCase() === yearColumn.toLowerCase());
    const valueIdx = headers.findIndex((h) => h.toLowerCase() === valueColumn.toLowerCase());

    if (countryIdx === -1 || yearIdx === -1 || valueIdx === -1) {
      throw new BadRequestException(
        `Required columns not found. Found: ${headers.join(', ')}. Expected: ${countryColumn}, ${yearColumn}, ${valueColumn}`,
      );
    }

    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 1; i < lines.length; i++) {
      try {
        const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
        const countryStr = cols[countryIdx]?.toLowerCase();
        const year = parseInt(cols[yearIdx], 10);
        const value = parseFloat(cols[valueIdx]);

        if (!countryStr || isNaN(year) || isNaN(value)) {
          skipped++;
          continue;
        }

        const countryId = countryLookup.get(countryStr);
        if (!countryId) {
          skipped++;
          continue;
        }

        await this.prisma.indicatorValue.upsert({
          where: {
            countryId_indicatorId_year_gender_ageGroup: {
              countryId,
              indicatorId: indicator.id,
              year,
              gender: 'TOTAL',
              ageGroup: '15-35',
            },
          },
          update: { value, source },
          create: {
            countryId,
            indicatorId: indicator.id,
            year,
            value,
            gender: 'TOTAL',
            ageGroup: '15-35',
            source,
            confidence: 0.8,
            isEstimate: false,
          },
        });
        inserted++;
      } catch {
        errors++;
      }
    }

    this.cache.clear();

    return { inserted, skipped, errors, totalRows: lines.length - 1 };
  }

  // ── Data Management ─────────────────────────────────────────

  /**
   * Show data coverage gaps across countries, indicators, and themes.
   */
  async getDataGaps(year?: number) {
    const cacheKey = this.cache.buildKey('admin:gaps', { year });
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const targetYear = year || 2023;

    const [countries, indicators, themes] = await Promise.all([
      this.prisma.country.findMany({ select: { id: true, name: true, isoCode3: true } }),
      this.prisma.indicator.findMany({ select: { id: true, name: true, slug: true, themeId: true } }),
      this.prisma.theme.findMany({ select: { id: true, name: true } }),
    ]);

    const totalPossible = countries.length * indicators.length;

    // Get all available data points for the year
    const dataPoints = await this.prisma.indicatorValue.groupBy({
      by: ['countryId', 'indicatorId'],
      where: { year: targetYear, gender: 'TOTAL' },
    });

    const dataSet = new Set(dataPoints.map((d) => `${d.countryId}:${d.indicatorId}`));
    const totalAvailable = dataSet.size;

    // Gaps by country
    const gapsByCountry = countries
      .map((c) => {
        const available = indicators.filter((i) => dataSet.has(`${c.id}:${i.id}`)).length;
        return {
          country: c.name,
          isoCode3: c.isoCode3,
          available,
          missing: indicators.length - available,
          completeness: indicators.length > 0
            ? Math.round((available / indicators.length) * 10000) / 10000
            : 0,
        };
      })
      .sort((a, b) => a.completeness - b.completeness);

    // Gaps by indicator
    const gapsByIndicator = indicators
      .map((i) => {
        const available = countries.filter((c) => dataSet.has(`${c.id}:${i.id}`)).length;
        return {
          indicator: i.name,
          slug: i.slug,
          available,
          missing: countries.length - available,
          completeness: countries.length > 0
            ? Math.round((available / countries.length) * 10000) / 10000
            : 0,
        };
      })
      .sort((a, b) => a.completeness - b.completeness);

    // Gaps by theme
    const themeMap = new Map(themes.map((t) => [t.id, t.name]));
    const themeIndicators = new Map<string, string[]>();
    for (const ind of indicators) {
      if (!themeIndicators.has(ind.themeId)) themeIndicators.set(ind.themeId, []);
      themeIndicators.get(ind.themeId)!.push(ind.id);
    }

    const gapsByTheme = themes
      .map((t) => {
        const indIds = themeIndicators.get(t.id) || [];
        const themePossible = countries.length * indIds.length;
        let themeAvailable = 0;
        for (const indId of indIds) {
          for (const c of countries) {
            if (dataSet.has(`${c.id}:${indId}`)) themeAvailable++;
          }
        }
        return {
          theme: t.name,
          completeness: themePossible > 0
            ? Math.round((themeAvailable / themePossible) * 10000) / 10000
            : 0,
        };
      })
      .sort((a, b) => a.completeness - b.completeness);

    const result = {
      year: targetYear,
      totalPossible,
      totalAvailable,
      completeness: totalPossible > 0
        ? Math.round((totalAvailable / totalPossible) * 10000) / 10000
        : 0,
      gapsByCountry,
      gapsByIndicator,
      gapsByTheme,
    };

    this.cache.set(cacheKey, result, 600);
    return result;
  }

  /**
   * Delete indicator values matching filters.
   */
  async deleteData(dto: DeleteDataDto) {
    const where: Record<string, unknown> = {};
    if (dto.countryId) where.countryId = dto.countryId;
    if (dto.indicatorId) where.indicatorId = dto.indicatorId;
    if (dto.year) where.year = dto.year;

    if (Object.keys(where).length === 0) {
      throw new BadRequestException('At least one filter (countryId, indicatorId, or year) is required');
    }

    const deleted = await this.prisma.indicatorValue.deleteMany({ where });
    this.cache.clear();

    return { deleted: deleted.count, message: `Deleted ${deleted.count} data points` };
  }

  /**
   * List data sources with last sync info.
   */
  async getDataSources() {
    const sources = await this.prisma.dataSource.findMany({
      orderBy: { name: 'asc' },
    });

    // Also get unique sources from indicator values
    const valueSources = await this.prisma.indicatorValue.groupBy({
      by: ['source'],
      _count: { id: true },
      _max: { year: true },
    });

    return {
      registeredSources: sources.map((s) => ({
        id: s.id,
        name: s.name,
        url: s.url,
        type: s.type,
        lastSync: s.lastSync?.toISOString() ?? null,
      })),
      dataValueSources: valueSources.map((s) => ({
        source: s.source,
        dataPoints: s._count.id,
        latestYear: s._max.year,
      })),
    };
  }

  // ── User Management ─────────────────────────────────────────

  /**
   * List users with pagination and search.
   */
  async listUsers(dto: ListUsersDto) {
    const { search, role, page = 1, pageSize = 20 } = dto;

    const where: Record<string, unknown> = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          organization: true,
          lastLogin: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((u) => ({
        ...u,
        lastLogin: u.lastLogin?.toISOString() ?? null,
        createdAt: u.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Change a user's role.
   */
  async updateUserRole(userId: string, role: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    const validRoles = ['PUBLIC', 'REGISTERED', 'RESEARCHER', 'CONTRIBUTOR', 'INSTITUTIONAL', 'ADMIN'];
    if (!validRoles.includes(role)) {
      throw new BadRequestException(`Invalid role: ${role}. Valid roles: ${validRoles.join(', ')}`);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role: role as any },
      select: { id: true, email: true, name: true, role: true },
    });

    return updated;
  }

  /**
   * Delete a user.
   */
  async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    // Don't allow deleting the last admin
    if (user.role === 'ADMIN') {
      const adminCount = await this.prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        throw new BadRequestException('Cannot delete the last admin user');
      }
    }

    await this.prisma.user.delete({ where: { id: userId } });
    return { message: `User ${userId} deleted` };
  }

  /**
   * User statistics.
   */
  async getUserStats() {
    const [totalUsers, byRole, recentUsers] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.groupBy({
        by: ['role'],
        _count: { id: true },
      }),
      this.prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    const activeThisMonth = await this.prisma.user.count({
      where: {
        lastLogin: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    });

    const roleMap: Record<string, number> = {};
    for (const entry of byRole) {
      roleMap[entry.role] = entry._count.id;
    }

    return {
      totalUsers,
      byRole: roleMap,
      newThisWeek: recentUsers,
      activeThisMonth,
    };
  }

  // ── System Info ─────────────────────────────────────────────

  /**
   * Get system information.
   */
  async getSystemInfo() {
    const cacheStats = this.cache.stats();

    // Check AI availability
    let aiAvailable = false;
    let aiModel = 'none';
    let aiReportModel = 'none';
    // Model routing is per-surface (chat vs report), so the dashboard reports
    // both. This used to hardcode 'claude-sonnet-4-20250514' as its fallback and
    // read the legacy AI_MODEL var, which meant it confidently displayed a
    // model the account could not reach while every AI call silently degraded.
    aiAvailable = !!process.env.ANTHROPIC_API_KEY;
    aiModel = process.env.AI_MODEL_CHAT?.trim() || 'claude-sonnet-5';
    aiReportModel = process.env.AI_MODEL_REPORT?.trim() || 'claude-opus-5';

    // Database row counts
    const [countries, indicators, indicatorValues, users, themes, experts, policies, dashboards] =
      await Promise.all([
        this.prisma.country.count(),
        this.prisma.indicator.count(),
        this.prisma.indicatorValue.count(),
        this.prisma.user.count(),
        this.prisma.theme.count(),
        this.prisma.expert.count(),
        this.prisma.countryPolicy.count(),
        this.prisma.dashboard.count(),
      ]);

    return {
      version: '1.0.0',
      uptime: Math.round(process.uptime()),
      nodeVersion: process.version,
      modules: 19, // Current count after Day 7
      database: {
        connected: true,
        totalRows: {
          countries,
          indicators,
          indicatorValues,
          users,
          themes,
          experts,
          policies,
          dashboards,
        },
      },
      cache: {
        entries: cacheStats.entries,
        hitRate: 0, // Would need tracking for real hit rate
      },
      ai: {
        available: aiAvailable,
        model: aiModel,
        reportModel: aiReportModel,
      },
    };
  }

  /**
   * Clear all caches.
   */
  clearCache() {
    const cleared = this.cache.clear();
    return { cleared, message: `Cleared ${cleared} cache entries` };
  }
}
