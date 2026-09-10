/**
 * African Youth Index — Computation Engine (7-theme rewrite)
 *
 * METHODOLOGY:
 *   Composite index over 7 user-mandated themes with weights from DB (Theme.weight):
 *     Youth Demography & Participation 20% | Education 15% | Employment 15% |
 *     Health 15% | Entrepreneurship 15% | Peace & Security 10% | Access to Justice 10%
 *   Sub-weights per theme live in ./youth-index-weights.ts.
 *
 * NORMALIZATION:
 *   Min-max per indicator across countries for the same year, to 0-100.
 *     higher-is-better: ((val - min) / (max - min)) * 100
 *     lower-is-better:  ((max - val) / (max - min)) * 100
 *   Range==0 → 50 (all countries identical).
 *
 * MISSING DATA:
 *   Missing indicator → weight redistributed to remaining sub-indicators.
 *   Missing entire theme → regional average; if none, 50 (neutral).
 *
 * STORAGE:
 *   Per-theme scores stored in YouthIndexScore.dimensionScores (Json, keyed by theme slug).
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache.service';
import { DEFAULT_AGE_GROUP } from '../../shared/constants';
import { SUB_WEIGHTS, ALL_INDEX_INDICATOR_SLUGS } from './youth-index-weights';

/**
 * How a dimension score came to exist.
 *
 * 'measured'         - computed from indicators that actually have values
 * 'regional-average' - the country had no data, filled from its region's mean
 * 'default'          - neither the country nor its region had any data; 50
 *
 * Every dimension previously arrived as a bare number, so a country scored on
 * one indicator was indistinguishable from one scored on twelve, and a
 * wholly-invented 50 was indistinguishable from a measurement. Peace & Security
 * is 'default' for all 54 countries; nothing surfaced that.
 */
type DimensionSource = 'measured' | 'regional-average' | 'default';

interface DimensionCoverage {
  source: DimensionSource;
  /** Indicators that contributed a value. */
  indicators: number;
  /** Indicators the methodology defines for this dimension. */
  of: number;
}

interface CountryDimensionScores {
  countryId: string;
  region: string;
  dimensions: Record<string, number | null>;
  coverage: Record<string, DimensionCoverage>;
  overallScore: number;
}

@Injectable()
export class YouthIndexCalculatorService {
  private readonly logger = new Logger(YouthIndexCalculatorService.name);

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  async computeForYear(year: number): Promise<{
    year: number;
    countriesComputed: number;
    averageScore: number;
    topPerformer: { name: string; score: number };
    bottomPerformer: { name: string; score: number };
  }> {
    this.logger.log(`Computing Youth Index for year ${year}...`);

    const countries = await this.prisma.country.findMany({
      select: { id: true, name: true, region: true },
    });

    // Theme weights from DB (source of truth)
    const themes = await this.prisma.theme.findMany({
      where: { weight: { not: null } },
      select: { slug: true, weight: true },
    });
    const themeWeight = new Map<string, number>(themes.map((t) => [t.slug, t.weight!]));

    // Resolve indicator slugs → IDs
    const indicators = await this.prisma.indicator.findMany({
      where: { slug: { in: ALL_INDEX_INDICATOR_SLUGS } },
      select: { id: true, slug: true },
    });
    const slugToId = new Map(indicators.map((i) => [i.slug, i.id]));
    const indicatorIds = indicators.map((i) => i.id);

    const allValues = await this.prisma.indicatorValue.findMany({
      where: {
        year,
        gender: 'TOTAL',
        ageGroup: DEFAULT_AGE_GROUP,
        indicatorId: { in: indicatorIds },
      },
      select: { countryId: true, indicatorId: true, value: true },
    });

    // indicatorId → countryId → value
    const valueMap = new Map<string, Map<string, number>>();
    for (const v of allValues) {
      let m = valueMap.get(v.indicatorId);
      if (!m) {
        m = new Map();
        valueMap.set(v.indicatorId, m);
      }
      m.set(v.countryId, v.value);
    }

    // min/max per indicator
    const minMax = new Map<string, { min: number; max: number }>();
    for (const [indId, countryValues] of valueMap) {
      const vals = Array.from(countryValues.values());
      if (vals.length === 0) continue;
      minMax.set(indId, { min: Math.min(...vals), max: Math.max(...vals) });
    }

    // Compute dimension scores per country
    const countryScores: CountryDimensionScores[] = [];
    for (const country of countries) {
      const dimensions: Record<string, number | null> = {};
      const coverage: Record<string, DimensionCoverage> = {};
      for (const themeSlug of Object.keys(SUB_WEIGHTS)) {
        const subs = SUB_WEIGHTS[themeSlug];
        let weightedSum = 0;
        let totalWeight = 0;
        let contributing = 0;
        for (const sub of subs) {
          const indId = slugToId.get(sub.slug);
          if (!indId) continue;
          const mm = minMax.get(indId);
          if (!mm) continue;
          const raw = valueMap.get(indId)?.get(country.id);
          if (raw === undefined || raw === null) continue;
          const range = mm.max - mm.min;
          // Soft-floor normalization: map min-max into [5, 100] instead of
          // [0, 100]. The worst country gets 5, not 0 — preserves relative
          // ranking but prevents the "looks like missing data" 0 reading.
          // Standard practice in composite indices (UNDP HDI uses similar
          // bounding to avoid degenerate extreme values).
          const FLOOR = 5;
          const SCALE = 100 - FLOOR; // 95
          let normalized: number;
          if (range === 0) normalized = 50;
          else if (sub.direction === 'higher-is-better') normalized = FLOOR + ((raw - mm.min) / range) * SCALE;
          else normalized = FLOOR + ((mm.max - raw) / range) * SCALE;
          weightedSum += normalized * sub.weight;
          totalWeight += sub.weight;
          contributing += 1;
        }
        dimensions[themeSlug] = totalWeight > 0
          ? Math.round((weightedSum / totalWeight) * 100) / 100
          : null;
        // Weights are redistributed across whichever indicators had data, with
        // no floor -- so one indicator can carry an entire 20% dimension.
        // Record what it was actually built from.
        coverage[themeSlug] = { source: 'measured', indicators: contributing, of: subs.length };
      }
      countryScores.push({ countryId: country.id, region: country.region, dimensions, coverage, overallScore: 0 });
    }

    // Regional averages to fill missing theme scores
    const regionDimAvg = new Map<string, Map<string, { sum: number; count: number }>>();
    for (const cs of countryScores) {
      let regionMap = regionDimAvg.get(cs.region);
      if (!regionMap) {
        regionMap = new Map();
        regionDimAvg.set(cs.region, regionMap);
      }
      for (const [k, v] of Object.entries(cs.dimensions)) {
        if (v === null) continue;
        const entry = regionMap.get(k) ?? { sum: 0, count: 0 };
        entry.sum += v;
        entry.count += 1;
        regionMap.set(k, entry);
      }
    }
    for (const cs of countryScores) {
      for (const themeSlug of Object.keys(SUB_WEIGHTS)) {
        if (cs.dimensions[themeSlug] !== null) continue;
        const regionMap = regionDimAvg.get(cs.region);
        const e = regionMap?.get(themeSlug);
        const imputed = e && e.count > 0;
        cs.dimensions[themeSlug] = imputed
          ? Math.round((e.sum / e.count) * 100) / 100
          : 50;
        // Neither measured nor honest-by-default until now: both branches used
        // to emit a plain number that read exactly like a real score.
        cs.coverage[themeSlug] = {
          source: imputed ? 'regional-average' : 'default',
          indicators: 0,
          of: SUB_WEIGHTS[themeSlug]?.length ?? 0,
        };
      }
    }

    // Overall score = sum(dim * themeWeight)
    for (const cs of countryScores) {
      let overall = 0;
      for (const [themeSlug, dim] of Object.entries(cs.dimensions)) {
        const w = themeWeight.get(themeSlug) ?? 0;
        overall += (dim ?? 50) * w;
      }
      cs.overallScore = Math.round(overall * 100) / 100;
    }

    // Rank
    countryScores.sort((a, b) => b.overallScore - a.overallScore);
    const total = countryScores.length;

    // Previous-year ranks (for rank change)
    const prev = await this.prisma.youthIndexScore.findMany({
      where: { year: year - 1 },
      select: { countryId: true, rank: true },
    });
    const previousRanks = new Map(prev.map((p) => [p.countryId, p.rank]));

    const tierOf = (pct: number) =>
      pct >= 80 ? 'HIGH' : pct >= 60 ? 'MEDIUM_HIGH' : pct >= 40 ? 'MEDIUM' : pct >= 20 ? 'MEDIUM_LOW' : 'LOW';

    const countryNameMap = new Map(countries.map((c) => [c.id, c.name]));

    // Upsert
    for (let i = 0; i < countryScores.length; i++) {
      const cs = countryScores[i];
      const rank = i + 1;
      const percentile = Math.round(((total - rank) / total) * 10000) / 100;
      const prevRank = previousRanks.get(cs.countryId) ?? null;
      const data = {
        countryId: cs.countryId,
        year,
        overallScore: cs.overallScore,
        // _meta rides inside the existing JSON column so provenance ships without
        // a schema migration. Readers must skip keys starting with '_'.
        dimensionScores: { ...cs.dimensions, _meta: { coverage: cs.coverage } } as any,
        rank,
        previousRank: prevRank,
        rankChange: prevRank !== null ? prevRank - rank : null,
        percentile,
        tier: tierOf(percentile) as 'HIGH' | 'MEDIUM_HIGH' | 'MEDIUM' | 'MEDIUM_LOW' | 'LOW',
      };
      await this.prisma.youthIndexScore.upsert({
        where: { countryId_year: { countryId: cs.countryId, year } },
        create: data,
        update: {
          overallScore: data.overallScore,
          dimensionScores: data.dimensionScores,
          rank: data.rank,
          previousRank: data.previousRank,
          rankChange: data.rankChange,
          percentile: data.percentile,
          tier: data.tier,
        },
      });
    }

    this.cache.clearPrefix('youth-index');

    const scores = countryScores.map((c) => c.overallScore);
    const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
    const top = countryScores[0];
    const bottom = countryScores[countryScores.length - 1];
    const result = {
      year,
      countriesComputed: countryScores.length,
      averageScore: avg,
      topPerformer: { name: countryNameMap.get(top.countryId) || 'Unknown', score: top.overallScore },
      bottomPerformer: { name: countryNameMap.get(bottom.countryId) || 'Unknown', score: bottom.overallScore },
    };
    this.logger.log(
      `Year ${year}: ${result.countriesComputed} countries, avg=${avg}, ` +
      `top=${result.topPerformer.name} (${result.topPerformer.score}), ` +
      `bottom=${result.bottomPerformer.name} (${result.bottomPerformer.score})`,
    );
    return result;
  }

  async computeAll(): Promise<{
    yearsComputed: number;
    results: { year: number; countriesComputed: number; averageScore: number }[];
  }> {
    this.logger.log('Computing Youth Index for all years with data...');
    const yearsWithData = await this.prisma.indicatorValue.groupBy({
      by: ['year'],
      where: { gender: 'TOTAL', ageGroup: DEFAULT_AGE_GROUP },
      _count: { _all: true },
      orderBy: { year: 'asc' },
    });
    const results: { year: number; countriesComputed: number; averageScore: number }[] = [];
    for (const y of yearsWithData) {
      const r = await this.computeForYear(y.year);
      results.push({ year: r.year, countriesComputed: r.countriesComputed, averageScore: r.averageScore });
    }
    this.logger.log(`Computation complete: ${results.length} years processed`);
    return { yearsComputed: results.length, results };
  }
}
