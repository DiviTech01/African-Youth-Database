import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache.service';

const SHORT_THEME_LABELS: Record<string, string> = {
  'youth-demography-participation': 'Demo',
  'education': 'Edu',
  'employment': 'Emp',
  'health': 'Health',
  'entrepreneurship': 'Entre',
  'peace-security': 'Peace',
  'access-to-justice': 'Just',
};

function formatDimensions(dimensionScores: unknown): string {
  const d = (dimensionScores && typeof dimensionScores === 'object')
    ? (dimensionScores as Record<string, number>)
    : {};
  return Object.keys(SHORT_THEME_LABELS)
    .map((slug) => `${SHORT_THEME_LABELS[slug]}: ${(typeof d[slug] === 'number' ? d[slug] : 50).toFixed(1)}`)
    .join(' | ');
}

@Injectable()
export class AiContextService {
  private readonly logger = new Logger(AiContextService.name);

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  /**
   * Build a comprehensive data snapshot that the AI can reference.
   * Cached for 1 hour since it's expensive to build.
   */
  async buildFullContext(): Promise<string> {
    const cached = this.cache.get<string>('ai-context:full');
    if (cached) return cached;

    const [
      countries,
      themes,
      indicators,
      platformStats,
      youthIndexLatest,
      recentData,
    ] = await Promise.all([
      this.getCountrySummaries(),
      this.getThemeSummaries(),
      this.getIndicatorCatalog(),
      this.getPlatformStats(),
      this.getLatestYouthIndex(),
      this.getRecentDataSnapshot(),
    ]);

    const context = `
## PLATFORM OVERVIEW
${platformStats}

## COUNTRIES (54 African Nations)
${countries}

## THEMES (9 Thematic Areas)
${themes}

## INDICATOR CATALOG (All Available Indicators)
${indicators}

## YOUTH INDEX RANKINGS (Latest Year)
${youthIndexLatest}

## RECENT DATA SNAPSHOT (Key Indicators by Country)
${recentData}
`;
    this.cache.set('ai-context:full', context, 3600);
    return context;
  }

  /**
   * Build context specific to a country query
   */
  async buildCountryContext(countryId: string): Promise<string> {
    const cacheKey = `ai-context:country:${countryId}`;
    const cached = this.cache.get<string>(cacheKey);
    if (cached) return cached;

    const country = await this.prisma.country.findUnique({
      where: { id: countryId },
    });
    if (!country) return 'Country not found.';

    const [
      allValues,
      youthIndex,
      policies,
      regionalPeers,
    ] = await Promise.all([
      this.getCountryIndicatorValues(countryId),
      this.getCountryYouthIndex(countryId),
      this.getCountryPolicies(countryId),
      this.getRegionalComparison(countryId, country.region),
    ]);

    const context = `
## COUNTRY: ${country.name} (${country.isoCode3})
Region: ${country.region}
Capital: ${country.capital}
Population: ${Number(country.population).toLocaleString()}
Youth Population: ${Number(country.youthPopulation).toLocaleString()}
Languages: ${country.languages.join(', ')}
Economic Blocs: ${country.economicBlocs.join(', ')}

## YOUTH INDEX
${youthIndex}

## POLICY STATUS
${policies}

## ALL INDICATOR VALUES (Latest Available Year)
${allValues}

## REGIONAL COMPARISON (vs ${country.region} peers)
${regionalPeers}
`;
    this.cache.set(cacheKey, context, 3600);
    return context;
  }

  /**
   * Build context for a specific data query
   */
  async buildQueryContext(params: {
    countryIds?: string[];
    indicatorSlugs?: string[];
    themeSlug?: string;
    yearStart?: number;
    yearEnd?: number;
    region?: string;
  }): Promise<string> {
    const parts: string[] = [];

    if (params.countryIds?.length) {
      for (const cid of params.countryIds.slice(0, 10)) {
        const data = await this.getCountryIndicatorValues(cid, params.indicatorSlugs, params.yearStart, params.yearEnd);
        parts.push(data);
      }
    }

    if (params.themeSlug) {
      const themeData = await this.getThemeData(params.themeSlug, params.yearStart, params.yearEnd);
      parts.push(themeData);
    }

    if (params.region) {
      const regionData = await this.getRegionData(params.region, params.indicatorSlugs);
      parts.push(regionData);
    }

    return parts.join('\n\n');
  }

  // ── Helper methods ──────────────────────────────────────────

  private async getCountrySummaries(): Promise<string> {
    const countries = await this.prisma.country.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, isoCode3: true, region: true, capital: true, population: true, youthPopulation: true },
    });
    return countries.map(c =>
      `${c.name} (${c.isoCode3}) | Region: ${c.region} | Pop: ${Number(c.population).toLocaleString()} | Youth: ${Number(c.youthPopulation).toLocaleString()}`
    ).join('\n');
  }

  private async getThemeSummaries(): Promise<string> {
    const themes = await this.prisma.theme.findMany({
      include: { _count: { select: { indicators: true } } },
      orderBy: { sortOrder: 'asc' },
    });
    return themes.map(t =>
      `${t.name} (${t.slug}) — ${t._count.indicators} indicators — ${t.description}`
    ).join('\n');
  }

  private async getIndicatorCatalog(): Promise<string> {
    const indicators = await this.prisma.indicator.findMany({
      include: { theme: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });
    return indicators.map(i =>
      `${i.slug} | ${i.name} | Theme: ${i.theme.name} | Unit: ${i.unit} | Source: ${i.source}`
    ).join('\n');
  }

  private async getPlatformStats(): Promise<string> {
    const [countryCount, indicatorCount, valueCount, latestYear] = await Promise.all([
      this.prisma.country.count(),
      this.prisma.indicator.count(),
      this.prisma.indicatorValue.count(),
      this.prisma.indicatorValue.findFirst({ orderBy: { year: 'desc' }, select: { year: true } }),
    ]);
    return `Countries: ${countryCount} | Indicators: ${indicatorCount} | Data Points: ${valueCount.toLocaleString()} | Latest Year: ${latestYear?.year || 'N/A'}`;
  }

  private async getLatestYouthIndex(): Promise<string> {
    const latestYear = await this.prisma.youthIndexScore.findFirst({
      orderBy: { year: 'desc' },
      select: { year: true },
    });
    if (!latestYear) return 'No Youth Index data available.';

    const rankings = await this.prisma.youthIndexScore.findMany({
      where: { year: latestYear.year },
      include: { country: { select: { name: true, isoCode3: true, region: true } } },
      orderBy: { rank: 'asc' },
    });

    return `Youth Index Rankings (${latestYear.year}):\n` + rankings.map(r =>
      `#${r.rank} ${r.country.name} (${r.country.isoCode3}) — Score: ${r.overallScore.toFixed(1)} | ${formatDimensions(r.dimensionScores)} | Tier: ${r.tier} | Region: ${r.country.region}`
    ).join('\n');
  }

  private async getRecentDataSnapshot(): Promise<string> {
    const keyIndicators = [
      'youth-unemployment-rate',
      'youth-literacy-rate',
      'internet-penetration',
      'life-expectancy',
      'adolescent-fertility-rate',
      'education-expenditure-gdp',
      'health-expenditure-gdp',
    ];

    const data = await this.prisma.indicatorValue.findMany({
      where: {
        indicator: { slug: { in: keyIndicators } },
        gender: 'TOTAL',
      },
      include: {
        country: { select: { name: true, isoCode3: true } },
        indicator: { select: { name: true, slug: true, unit: true } },
      },
      orderBy: [{ year: 'desc' }],
      distinct: ['countryId', 'indicatorId'],
    });

    const grouped: Record<string, string[]> = {};
    for (const d of data) {
      const key = d.indicator.name;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(`${d.country.name}: ${d.value} (${d.year})`);
    }

    return Object.entries(grouped).map(([indicator, values]) =>
      `### ${indicator}\n${values.join(' | ')}`
    ).join('\n\n');
  }

  private async getCountryIndicatorValues(
    countryId: string,
    indicatorSlugs?: string[],
    yearStart?: number,
    yearEnd?: number,
  ): Promise<string> {
    const where: any = { countryId };
    if (indicatorSlugs?.length) {
      where.indicator = { slug: { in: indicatorSlugs } };
    }
    if (yearStart || yearEnd) {
      where.year = {};
      if (yearStart) where.year.gte = yearStart;
      if (yearEnd) where.year.lte = yearEnd;
    }

    const values = await this.prisma.indicatorValue.findMany({
      where,
      include: {
        indicator: { select: { name: true, slug: true, unit: true } },
        country: { select: { name: true } },
      },
      orderBy: [{ indicator: { name: 'asc' } }, { year: 'desc' }],
      distinct: ['indicatorId'],
    });

    if (!values.length) return 'No data available for this country.';

    return `Data for ${values[0].country.name}:\n` + values.map(v =>
      `${v.indicator.name}: ${v.value} ${v.indicator.unit} (${v.year}) [${v.gender}, ${v.source}]`
    ).join('\n');
  }

  private async getCountryYouthIndex(countryId: string): Promise<string> {
    const scores = await this.prisma.youthIndexScore.findMany({
      where: { countryId },
      orderBy: { year: 'desc' },
      take: 5,
    });
    if (!scores.length) return 'No Youth Index data.';
    return scores.map(s =>
      `${s.year}: Score ${s.overallScore.toFixed(1)} (Rank #${s.rank}, ${s.tier}) | ${formatDimensions(s.dimensionScores)}`
    ).join('\n');
  }

  private async getCountryPolicies(countryId: string): Promise<string> {
    const policies = await this.prisma.countryPolicy.findMany({
      where: { countryId },
    });
    if (!policies.length) return 'No policy data available.';
    return policies.map(p =>
      `${p.policyType}: ${p.policyName} (${p.yearAdopted || 'N/A'}) | AYC Ratified: ${p.aycRatified} | Compliance: ${p.complianceScore?.toFixed(1) || 'N/A'} | Status: ${p.status}`
    ).join('\n');
  }

  private async getRegionalComparison(countryId: string, region: string): Promise<string> {
    const latestYear = await this.prisma.youthIndexScore.findFirst({ orderBy: { year: 'desc' }, select: { year: true } });
    if (!latestYear) return 'No regional comparison data.';

    const peers = await this.prisma.youthIndexScore.findMany({
      where: {
        country: { region: region as any },
        year: latestYear.year,
      },
      include: { country: { select: { name: true, id: true } } },
      orderBy: { rank: 'asc' },
    });
    return peers.map(p =>
      `${p.country.id === countryId ? '→ ' : '  '}${p.country.name}: ${p.overallScore.toFixed(1)} (Rank #${p.rank})`
    ).join('\n');
  }

  private async getThemeData(themeSlug: string, yearStart?: number, yearEnd?: number): Promise<string> {
    const theme = await this.prisma.theme.findUnique({
      where: { slug: themeSlug },
      include: { indicators: true },
    });
    if (!theme) return 'Theme not found.';

    const where: any = {
      indicator: { themeId: theme.id },
      gender: 'TOTAL',
    };
    if (yearStart) where.year = { ...where.year, gte: yearStart };
    if (yearEnd) where.year = { ...where.year, lte: yearEnd };

    const values = await this.prisma.indicatorValue.findMany({
      where,
      include: {
        country: { select: { name: true } },
        indicator: { select: { name: true, unit: true } },
      },
      orderBy: [{ year: 'desc' }],
      distinct: ['countryId', 'indicatorId'],
      take: 500,
    });

    return `Theme: ${theme.name}\nIndicators: ${theme.indicators.map(i => i.name).join(', ')}\n\nData:\n` +
      values.map(v => `${v.country.name} | ${v.indicator.name}: ${v.value} ${v.indicator.unit} (${v.year})`).join('\n');
  }

  private async getRegionData(region: string, indicatorSlugs?: string[]): Promise<string> {
    const where: any = {
      country: { region: region as any },
      gender: 'TOTAL',
    };
    if (indicatorSlugs?.length) {
      where.indicator = { slug: { in: indicatorSlugs } };
    }

    const values = await this.prisma.indicatorValue.findMany({
      where,
      include: {
        country: { select: { name: true } },
        indicator: { select: { name: true, unit: true } },
      },
      orderBy: [{ year: 'desc' }],
      distinct: ['countryId', 'indicatorId'],
      take: 500,
    });

    return `Region: ${region}\n` +
      values.map(v => `${v.country.name} | ${v.indicator.name}: ${v.value} ${v.indicator.unit} (${v.year})`).join('\n');
  }

  /**
   * Execute an arbitrary data query — used by the AI via tool use
   */
  async executeDataQuery(query: {
    type: 'country_data' | 'indicator_ranking' | 'time_series' | 'regional_average' | 'comparison' | 'count' | 'search';
    params: Record<string, any>;
  }): Promise<any> {
    switch (query.type) {
      case 'country_data': {
        const { countryName, indicatorSlug, yearStart, yearEnd } = query.params;
        const country = await this.prisma.country.findFirst({
          where: { name: { contains: countryName, mode: 'insensitive' } },
        });
        if (!country) return { error: `Country "${countryName}" not found` };
        const where: any = { countryId: country.id };
        if (indicatorSlug) where.indicator = { slug: indicatorSlug };
        if (yearStart || yearEnd) {
          where.year = {};
          if (yearStart) where.year.gte = yearStart;
          if (yearEnd) where.year.lte = yearEnd;
        }
        const values = await this.prisma.indicatorValue.findMany({
          where,
          include: { indicator: { select: { name: true, slug: true, unit: true } } },
          orderBy: { year: 'desc' },
        });
        return {
          country: country.name,
          data: values.map(v => ({
            indicator: v.indicator.name,
            slug: v.indicator.slug,
            value: v.value,
            unit: v.indicator.unit,
            year: v.year,
            gender: v.gender,
          })),
        };
      }

      case 'indicator_ranking': {
        const { indicatorSlug, year, limit, order } = query.params;
        const indicator = await this.prisma.indicator.findUnique({ where: { slug: indicatorSlug } });
        if (!indicator) return { error: `Indicator "${indicatorSlug}" not found` };
        const targetYear = year || (await this.prisma.indicatorValue.findFirst({
          where: { indicatorId: indicator.id },
          orderBy: { year: 'desc' },
        }))?.year;
        const values = await this.prisma.indicatorValue.findMany({
          where: { indicatorId: indicator.id, year: targetYear, gender: 'TOTAL' },
          include: { country: { select: { name: true, isoCode3: true, region: true } } },
          orderBy: { value: order === 'asc' ? 'asc' : 'desc' },
          take: limit || 54,
        });
        return {
          indicator: indicator.name,
          unit: indicator.unit,
          year: targetYear,
          ranking: values.map((v, i) => ({
            rank: i + 1,
            country: v.country.name,
            isoCode3: v.country.isoCode3,
            region: v.country.region,
            value: v.value,
          })),
        };
      }

      case 'time_series': {
        const { countryName, indicatorSlug } = query.params;
        const country = await this.prisma.country.findFirst({
          where: { name: { contains: countryName, mode: 'insensitive' } },
        });
        const indicator = await this.prisma.indicator.findUnique({ where: { slug: indicatorSlug } });
        if (!country || !indicator) return { error: 'Country or indicator not found' };
        const values = await this.prisma.indicatorValue.findMany({
          where: { countryId: country.id, indicatorId: indicator.id, gender: 'TOTAL' },
          orderBy: { year: 'asc' },
        });
        return {
          country: country.name,
          indicator: indicator.name,
          unit: indicator.unit,
          series: values.map(v => ({ year: v.year, value: v.value })),
        };
      }

      case 'regional_average': {
        const { region, indicatorSlug, year } = query.params;
        const indicator = await this.prisma.indicator.findUnique({ where: { slug: indicatorSlug } });
        if (!indicator) return { error: `Indicator "${indicatorSlug}" not found` };
        const values = await this.prisma.indicatorValue.findMany({
          where: {
            indicatorId: indicator.id,
            country: { region: region as any },
            year: year || undefined,
            gender: 'TOTAL',
          },
          include: { country: { select: { name: true } } },
          orderBy: { year: 'desc' },
          distinct: ['countryId'],
        });
        const avg = values.reduce((sum, v) => sum + v.value, 0) / (values.length || 1);
        return {
          region,
          indicator: indicator.name,
          average: Math.round(avg * 100) / 100,
          countries: values.map(v => ({ name: v.country.name, value: v.value })),
          count: values.length,
        };
      }

      case 'comparison': {
        const { countryNames, indicatorSlugs } = query.params;
        const results: any[] = [];
        for (const name of (countryNames || [])) {
          const country = await this.prisma.country.findFirst({
            where: { name: { contains: name, mode: 'insensitive' } },
          });
          if (!country) continue;
          const values = await this.prisma.indicatorValue.findMany({
            where: {
              countryId: country.id,
              indicator: { slug: { in: indicatorSlugs } },
              gender: 'TOTAL',
            },
            include: { indicator: { select: { name: true, slug: true, unit: true } } },
            orderBy: { year: 'desc' },
            distinct: ['indicatorId'],
          });
          results.push({
            country: country.name,
            indicators: values.map(v => ({
              name: v.indicator.name,
              slug: v.indicator.slug,
              value: v.value,
              unit: v.indicator.unit,
              year: v.year,
            })),
          });
        }
        return { comparison: results };
      }

      case 'count': {
        const { entity } = query.params;
        const counts: Record<string, number> = {
          countries: await this.prisma.country.count(),
          indicators: await this.prisma.indicator.count(),
          dataPoints: await this.prisma.indicatorValue.count(),
          experts: await this.prisma.expert.count(),
          themes: await this.prisma.theme.count(),
        };
        return entity ? { [entity]: counts[entity] } : counts;
      }

      case 'search': {
        const { term } = query.params;
        const [countries, indicators] = await Promise.all([
          this.prisma.country.findMany({
            where: { name: { contains: term, mode: 'insensitive' } },
            select: { id: true, name: true, isoCode3: true, region: true },
            take: 5,
          }),
          this.prisma.indicator.findMany({
            where: {
              OR: [
                { name: { contains: term, mode: 'insensitive' } },
                { slug: { contains: term, mode: 'insensitive' } },
              ],
            },
            select: { slug: true, name: true, unit: true },
            take: 5,
          }),
        ]);
        return { countries, indicators };
      }

      default:
        return { error: 'Unknown query type' };
    }
  }
}
