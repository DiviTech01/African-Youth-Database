import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache.service';
import { AiService } from './ai.service';

// ---- Types ----

interface Insight {
  id: string;
  type: 'trend' | 'anomaly' | 'comparison' | 'achievement' | 'concern' | 'opportunity';
  title: string;
  description: string;
  severity: 'info' | 'positive' | 'warning' | 'critical';
  confidence: number;
  relatedCountryId?: string;
  relatedCountryName?: string;
  relatedIndicatorId?: string;
  relatedIndicatorName?: string;
  dataPoints?: { label: string; value: number; year: number }[];
  recommendations?: string[];
  generatedAt: string;
  source: 'ai' | 'rule-based';
}

interface Anomaly {
  countryId: string;
  countryName: string;
  indicatorId: string;
  indicatorName: string;
  value: number;
  mean: number;
  stdDev: number;
  deviations: number;
  direction: 'above' | 'below';
  severity: 'positive' | 'warning' | 'critical';
  year: number;
}

interface Correlation {
  indicator1: { id: string; name: string; theme: string };
  indicator2: { id: string; name: string; theme: string };
  correlation: number;
  strength: 'strong' | 'moderate';
  direction: 'positive' | 'negative';
  sampleSize: number;
  interpretation: string;
}

@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private ai: AiService,
  ) {}

  // ============================================================
  // 1. Country Insights (AI + rule-based fallback)
  // ============================================================

  async generateCountryInsights(countryId: string): Promise<Insight[]> {
    const cacheKey = `insights:country:${countryId}`;
    const cached = this.cache.get<Insight[]>(cacheKey);
    if (cached) return cached;

    // Fetch country data
    const country = await this.prisma.country.findUnique({
      where: { id: countryId },
      select: { id: true, name: true, region: true, flagEmoji: true },
    });
    if (!country) return [];

    // Youth Index (latest)
    const youthIndex = await this.prisma.youthIndexScore.findFirst({
      where: { countryId },
      orderBy: { year: 'desc' },
    });

    // Top indicators (latest year, TOTAL gender)
    const latestValues = await this.prisma.indicatorValue.findMany({
      where: { countryId, gender: 'TOTAL' },
      include: { indicator: { select: { id: true, name: true, slug: true, unit: true, theme: { select: { name: true } } } } },
      orderBy: { year: 'desc' },
      take: 30,
    });

    // Deduplicate to latest year per indicator
    const seenIndicators = new Set<string>();
    const uniqueLatest = latestValues.filter((v) => {
      if (seenIndicators.has(v.indicatorId)) return false;
      seenIndicators.add(v.indicatorId);
      return true;
    });

    // Regional averages for context
    const indicatorIds = uniqueLatest.map((v) => v.indicatorId);
    const regionalValues = await this.prisma.indicatorValue.findMany({
      where: {
        indicatorId: { in: indicatorIds },
        gender: 'TOTAL',
        country: { region: country.region },
      },
      include: { indicator: { select: { id: true } } },
      orderBy: { year: 'desc' },
    });

    // Compute regional averages per indicator (latest year)
    const regionalAvgMap = new Map<string, { sum: number; count: number }>();
    const seenRegional = new Set<string>();
    for (const v of regionalValues) {
      const key = `${v.indicatorId}:${v.countryId}`;
      if (seenRegional.has(key)) continue;
      seenRegional.add(key);
      if (!regionalAvgMap.has(v.indicatorId)) regionalAvgMap.set(v.indicatorId, { sum: 0, count: 0 });
      const entry = regionalAvgMap.get(v.indicatorId)!;
      entry.sum += v.value;
      entry.count += 1;
    }

    // Build data summary for LLM
    const indicatorSummary = uniqueLatest.slice(0, 15).map((v) => {
      const avg = regionalAvgMap.get(v.indicatorId);
      const regionalAvg = avg ? Math.round((avg.sum / avg.count) * 100) / 100 : null;
      return {
        name: v.indicator.name,
        slug: v.indicator.slug,
        value: v.value,
        unit: v.indicator.unit,
        year: v.year,
        theme: v.indicator.theme.name,
        regionalAverage: regionalAvg,
      };
    });

    // Try AI generation
    const aiInsights = await this.tryAiCountryInsights(country, youthIndex, indicatorSummary);
    if (aiInsights) {
      this.cache.set(cacheKey, aiInsights, 3600); // 1 hour
      return aiInsights;
    }

    // Rule-based fallback
    const ruleInsights = this.generateRuleBasedInsights(
      country,
      youthIndex,
      uniqueLatest.map((v) => ({
        id: v.indicatorId,
        name: v.indicator.name,
        slug: v.indicator.slug,
        value: v.value,
        unit: v.indicator.unit,
        year: v.year,
        theme: v.indicator.theme.name,
        regionalAverage: regionalAvgMap.has(v.indicatorId)
          ? Math.round((regionalAvgMap.get(v.indicatorId)!.sum / regionalAvgMap.get(v.indicatorId)!.count) * 100) / 100
          : null,
      })),
    );
    this.cache.set(cacheKey, ruleInsights, 3600);
    return ruleInsights;
  }

  private async tryAiCountryInsights(
    country: { id: string; name: string; region: string },
    youthIndex: { overallScore: number; rank: number; tier: string; educationScore: number; employmentScore: number; healthScore: number; civicScore: number; innovationScore: number; year: number } | null,
    indicators: { name: string; slug: string; value: number; unit: string; year: number; theme: string; regionalAverage: number | null }[],
  ): Promise<Insight[] | null> {
    const dataSummary = [
      `Country: ${country.name}`,
      `Region: ${country.region.replace(/_/g, ' ')}`,
      youthIndex
        ? `Youth Index: ${youthIndex.overallScore} (rank ${youthIndex.rank}/54, tier: ${youthIndex.tier})\nEducation: ${youthIndex.educationScore} | Employment: ${youthIndex.employmentScore} | Health: ${youthIndex.healthScore} | Civic: ${youthIndex.civicScore} | Innovation: ${youthIndex.innovationScore}`
        : 'Youth Index: Not yet computed',
      '',
      'Key Indicators:',
      ...indicators.map((i) => {
        const avg = i.regionalAverage !== null ? ` (regional avg: ${i.regionalAverage})` : '';
        return `- ${i.name}: ${i.value} ${i.unit}${avg} [${i.year}]`;
      }),
    ].join('\n');

    const systemPrompt = `You are a data analyst for the African Youth Observatory. Generate insights about African youth development.

Given country data, produce exactly 5 insights in JSON format. Each insight must be grounded in the data provided — never make up statistics.

Return ONLY a JSON array with this structure:
[
  {
    "type": "trend|anomaly|comparison|achievement|concern|opportunity",
    "title": "Short headline (max 80 chars)",
    "description": "2-3 sentence explanation referencing specific numbers from the data",
    "severity": "info|positive|warning|critical",
    "confidence": 0.85,
    "recommendations": ["Actionable recommendation 1", "Actionable recommendation 2"]
  }
]

Rules:
- Always reference real numbers from the data
- Compare to regional averages when available
- Identify strengths (achievements) and weaknesses (concerns)
- Include at least 1 opportunity insight
- Be specific to this country, not generic`;

    const raw = await this.ai.generate(systemPrompt, dataSummary, 1500);
    if (!raw) return null;

    try {
      // Extract JSON array from response (handle markdown code blocks)
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]) as {
        type: string;
        title: string;
        description: string;
        severity: string;
        confidence: number;
        recommendations?: string[];
      }[];

      return parsed.slice(0, 5).map((item, i) => ({
        id: `ai-${country.id}-${i}`,
        type: item.type as Insight['type'],
        title: item.title,
        description: item.description,
        severity: item.severity as Insight['severity'],
        confidence: item.confidence || 0.8,
        relatedCountryId: country.id,
        relatedCountryName: country.name,
        recommendations: item.recommendations,
        generatedAt: new Date().toISOString(),
        source: 'ai' as const,
      }));
    } catch (err) {
      this.logger.error('Failed to parse AI insights JSON', err);
      return null;
    }
  }

  private generateRuleBasedInsights(
    country: { id: string; name: string; region: string },
    youthIndex: { overallScore: number; rank: number; tier: string; educationScore: number; employmentScore: number; healthScore: number; civicScore: number; innovationScore: number } | null,
    indicators: { id: string; name: string; slug: string; value: number; unit: string; year: number; theme: string; regionalAverage: number | null }[],
  ): Insight[] {
    const insights: Insight[] = [];
    const now = new Date().toISOString();

    // 1. Youth Index tier insight
    if (youthIndex) {
      const tierDescriptions: Record<string, { label: string; severity: Insight['severity'] }> = {
        HIGH: { label: 'a top performer', severity: 'positive' },
        MEDIUM_HIGH: { label: 'an above-average performer', severity: 'positive' },
        MEDIUM: { label: 'a moderate performer', severity: 'info' },
        MEDIUM_LOW: { label: 'a below-average performer', severity: 'warning' },
        LOW: { label: 'facing significant challenges', severity: 'critical' },
      };
      const td = tierDescriptions[youthIndex.tier] || tierDescriptions.MEDIUM;

      insights.push({
        id: `rb-${country.id}-tier`,
        type: 'comparison',
        title: `${country.name} ranks #${youthIndex.rank} in youth development`,
        description: `With a Youth Index score of ${youthIndex.overallScore.toFixed(1)}, ${country.name} is ${td.label} among Africa's 54 nations. The country is in the ${youthIndex.tier.replace(/_/g, ' ')} tier.`,
        severity: td.severity,
        confidence: 1.0,
        relatedCountryId: country.id,
        relatedCountryName: country.name,
        generatedAt: now,
        source: 'rule-based',
      });

      // 2. Best dimension
      const dimensions = [
        { name: 'Education', score: youthIndex.educationScore },
        { name: 'Employment', score: youthIndex.employmentScore },
        { name: 'Health', score: youthIndex.healthScore },
        { name: 'Civic Engagement', score: youthIndex.civicScore },
        { name: 'Innovation', score: youthIndex.innovationScore },
      ];
      const best = dimensions.reduce((a, b) => (a.score > b.score ? a : b));
      const worst = dimensions.reduce((a, b) => (a.score < b.score ? a : b));

      insights.push({
        id: `rb-${country.id}-strength`,
        type: 'achievement',
        title: `${best.name} is ${country.name}'s strongest dimension`,
        description: `${country.name} scores ${best.score.toFixed(1)} in ${best.name}, the highest among its five Youth Index dimensions. This suggests relatively strong youth outcomes in this area.`,
        severity: 'positive',
        confidence: 1.0,
        relatedCountryId: country.id,
        relatedCountryName: country.name,
        generatedAt: now,
        source: 'rule-based',
      });

      // 3. Weakest dimension (opportunity)
      insights.push({
        id: `rb-${country.id}-opportunity`,
        type: 'opportunity',
        title: `${worst.name} presents the greatest opportunity for improvement`,
        description: `At ${worst.score.toFixed(1)}, ${worst.name} is ${country.name}'s lowest-scoring dimension. Targeted investment here could yield the largest gains in the country's overall Youth Index ranking.`,
        severity: worst.score < 40 ? 'warning' : 'info',
        confidence: 1.0,
        relatedCountryId: country.id,
        relatedCountryName: country.name,
        recommendations: [
          `Analyze specific ${worst.name.toLowerCase()} indicators to identify root causes`,
          `Benchmark against regional leaders in ${worst.name.toLowerCase()}`,
        ],
        generatedAt: now,
        source: 'rule-based',
      });
    }

    // 4. Indicators above regional average
    const aboveAvg = indicators.filter(
      (i) => i.regionalAverage !== null && i.value > i.regionalAverage * 1.2,
    );
    if (aboveAvg.length > 0) {
      const top = aboveAvg[0];
      insights.push({
        id: `rb-${country.id}-above`,
        type: 'achievement',
        title: `${top.name} exceeds regional average`,
        description: `${country.name}'s ${top.name.toLowerCase()} stands at ${top.value.toFixed(1)}, which is ${((top.value / (top.regionalAverage || 1) - 1) * 100).toFixed(0)}% above the ${country.region.replace(/_/g, ' ')} regional average of ${top.regionalAverage?.toFixed(1)}.`,
        severity: 'positive',
        confidence: 0.9,
        relatedCountryId: country.id,
        relatedCountryName: country.name,
        relatedIndicatorId: top.id,
        relatedIndicatorName: top.name,
        generatedAt: now,
        source: 'rule-based',
      });
    }

    // 5. Indicators below regional average (concern)
    const belowAvg = indicators.filter(
      (i) => i.regionalAverage !== null && i.value < i.regionalAverage * 0.8,
    );
    if (belowAvg.length > 0) {
      const bottom = belowAvg[0];
      insights.push({
        id: `rb-${country.id}-below`,
        type: 'concern',
        title: `${bottom.name} lags behind regional peers`,
        description: `At ${bottom.value.toFixed(1)}, ${country.name}'s ${bottom.name.toLowerCase()} falls ${((1 - bottom.value / (bottom.regionalAverage || 1)) * 100).toFixed(0)}% below the regional average of ${bottom.regionalAverage?.toFixed(1)}. This may warrant policy attention.`,
        severity: 'warning',
        confidence: 0.9,
        relatedCountryId: country.id,
        relatedCountryName: country.name,
        relatedIndicatorId: bottom.id,
        relatedIndicatorName: bottom.name,
        generatedAt: now,
        source: 'rule-based',
      });
    }

    return insights.slice(0, 5);
  }

  // ============================================================
  // 2. Trend Analysis (AI + rule-based fallback)
  // ============================================================

  async generateTrendAnalysis(indicatorId: string, countryId: string) {
    const cacheKey = this.cache.buildKey('insights:trend', { indicatorId, countryId });
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // Fetch time series
    const values = await this.prisma.indicatorValue.findMany({
      where: { indicatorId, countryId, gender: 'TOTAL' },
      orderBy: { year: 'asc' },
      select: { year: true, value: true },
    });

    const indicator = await this.prisma.indicator.findUnique({
      where: { id: indicatorId },
      select: { id: true, name: true, unit: true, slug: true },
    });

    const country = await this.prisma.country.findUnique({
      where: { id: countryId },
      select: { id: true, name: true, region: true },
    });

    if (!values.length || !indicator || !country) {
      return { error: 'No data available for this indicator-country combination' };
    }

    // Basic statistics
    const first = values[0];
    const last = values[values.length - 1];
    const pctChange = first.value !== 0
      ? Math.round(((last.value - first.value) / Math.abs(first.value)) * 10000) / 100
      : 0;
    const yearSpan = last.year - first.year;
    const annualGrowth = yearSpan > 0
      ? Math.round((pctChange / yearSpan) * 100) / 100
      : 0;

    const direction = pctChange > 5 ? 'improving' : pctChange < -5 ? 'declining' : 'stable';

    // Continental average trend
    const continentalValues = await this.prisma.indicatorValue.findMany({
      where: { indicatorId, gender: 'TOTAL' },
      orderBy: { year: 'asc' },
      select: { year: true, value: true },
    });

    const continentalByYear = new Map<number, { sum: number; count: number }>();
    for (const v of continentalValues) {
      if (!continentalByYear.has(v.year)) continentalByYear.set(v.year, { sum: 0, count: 0 });
      const entry = continentalByYear.get(v.year)!;
      entry.sum += v.value;
      entry.count += 1;
    }

    const continentalTrend = Array.from(continentalByYear.entries())
      .map(([year, { sum, count }]) => ({ year, value: Math.round((sum / count) * 100) / 100 }))
      .sort((a, b) => a.year - b.year);

    // Try AI narrative
    let narrative: string | null = null;
    let source: 'ai' | 'rule-based' = 'rule-based';

    const aiNarrative = await this.ai.generate(
      'You are a data analyst. Given time series data, provide a concise 2-3 sentence trend analysis. Reference specific numbers. Do not speculate.',
      `Indicator: ${indicator.name} (${indicator.unit})\nCountry: ${country.name}\nData: ${values.map((v) => `${v.year}: ${v.value}`).join(', ')}\nOverall change: ${pctChange}% over ${yearSpan} years (${direction})\nContinental average latest: ${continentalTrend.length > 0 ? continentalTrend[continentalTrend.length - 1].value : 'N/A'}`,
      300,
    );

    if (aiNarrative) {
      narrative = aiNarrative;
      source = 'ai';
    } else {
      narrative = `${country.name}'s ${indicator.name.toLowerCase()} has been ${direction} over ${yearSpan} years, moving from ${first.value.toFixed(1)} in ${first.year} to ${last.value.toFixed(1)} in ${last.year} (${pctChange > 0 ? '+' : ''}${pctChange}%). The annual rate of change is ${annualGrowth > 0 ? '+' : ''}${annualGrowth}% per year.`;
    }

    const result = {
      indicator: { id: indicator.id, name: indicator.name, unit: indicator.unit },
      country: { id: country.id, name: country.name },
      direction,
      percentChange: pctChange,
      annualGrowthRate: annualGrowth,
      startValue: { year: first.year, value: first.value },
      endValue: { year: last.year, value: last.value },
      dataPoints: values,
      continentalTrend,
      narrative,
      source,
      generatedAt: new Date().toISOString(),
    };

    this.cache.set(cacheKey, result, 3600);
    return result;
  }

  // ============================================================
  // 3. Anomaly Detection (rule-based)
  // ============================================================

  async generateAnomalies(year?: number): Promise<Anomaly[]> {
    const targetYear = year || 2023;
    const cacheKey = `insights:anomalies:${targetYear}`;
    const cached = this.cache.get<Anomaly[]>(cacheKey);
    if (cached) return cached;

    // Get all values for the year
    const values = await this.prisma.indicatorValue.findMany({
      where: { year: targetYear, gender: 'TOTAL' },
      include: {
        country: { select: { id: true, name: true } },
        indicator: { select: { id: true, name: true } },
      },
    });

    // Group by indicator
    const byIndicator = new Map<string, { countryId: string; countryName: string; indicatorId: string; indicatorName: string; value: number }[]>();
    for (const v of values) {
      const key = v.indicatorId;
      if (!byIndicator.has(key)) byIndicator.set(key, []);
      byIndicator.get(key)!.push({
        countryId: v.country.id,
        countryName: v.country.name,
        indicatorId: v.indicator.id,
        indicatorName: v.indicator.name,
        value: v.value,
      });
    }

    const anomalies: Anomaly[] = [];

    for (const [, entries] of byIndicator) {
      if (entries.length < 5) continue; // Need enough data points

      const vals = entries.map((e) => e.value);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
      const stdDev = Math.sqrt(variance);

      if (stdDev === 0) continue; // No variation

      for (const entry of entries) {
        const deviations = Math.abs(entry.value - mean) / stdDev;
        if (deviations >= 2) {
          const direction: 'above' | 'below' = entry.value > mean ? 'above' : 'below';
          let severity: 'positive' | 'warning' | 'critical';
          if (deviations >= 3) {
            severity = direction === 'above' ? 'positive' : 'critical';
          } else {
            severity = direction === 'above' ? 'positive' : 'warning';
          }

          anomalies.push({
            countryId: entry.countryId,
            countryName: entry.countryName,
            indicatorId: entry.indicatorId,
            indicatorName: entry.indicatorName,
            value: Math.round(entry.value * 100) / 100,
            mean: Math.round(mean * 100) / 100,
            stdDev: Math.round(stdDev * 100) / 100,
            deviations: Math.round(deviations * 100) / 100,
            direction,
            severity,
            year: targetYear,
          });
        }
      }
    }

    // Sort by absolute deviation (most anomalous first)
    anomalies.sort((a, b) => b.deviations - a.deviations);

    this.cache.set(cacheKey, anomalies, 1800); // 30 min
    return anomalies;
  }

  // ============================================================
  // 4. Correlation Detection (rule-based)
  // ============================================================

  async generateCorrelations(themeId?: string): Promise<Correlation[]> {
    const cacheKey = `insights:correlations:${themeId || 'all'}`;
    const cached = this.cache.get<Correlation[]>(cacheKey);
    if (cached) return cached;

    // Get indicators (scoped to theme if provided)
    const where: Record<string, unknown> = {};
    if (themeId) where.themeId = themeId;

    const indicators = await this.prisma.indicator.findMany({
      where,
      select: { id: true, name: true, theme: { select: { name: true } } },
      take: 20, // Limit to prevent combinatorial explosion
    });

    if (indicators.length < 2) return [];

    // Get latest year's data for all these indicators
    const latestYear = await this.prisma.indicatorValue.aggregate({
      where: { indicatorId: { in: indicators.map((i) => i.id) }, gender: 'TOTAL' },
      _max: { year: true },
    });
    const year = latestYear._max.year || 2023;

    const allValues = await this.prisma.indicatorValue.findMany({
      where: {
        indicatorId: { in: indicators.map((i) => i.id) },
        year,
        gender: 'TOTAL',
      },
      select: { countryId: true, indicatorId: true, value: true },
    });

    // Build lookup: indicatorId → Map<countryId, value>
    const dataMap = new Map<string, Map<string, number>>();
    for (const v of allValues) {
      if (!dataMap.has(v.indicatorId)) dataMap.set(v.indicatorId, new Map());
      dataMap.get(v.indicatorId)!.set(v.countryId, v.value);
    }

    const indMap = new Map(indicators.map((i) => [i.id, i]));
    const correlations: Correlation[] = [];

    // Compute pairwise Pearson correlations
    for (let i = 0; i < indicators.length; i++) {
      for (let j = i + 1; j < indicators.length; j++) {
        const ind1 = indicators[i];
        const ind2 = indicators[j];
        const data1 = dataMap.get(ind1.id);
        const data2 = dataMap.get(ind2.id);
        if (!data1 || !data2) continue;

        // Find countries with data for both
        const commonCountries = Array.from(data1.keys()).filter((c) => data2.has(c));
        if (commonCountries.length < 10) continue; // Need sufficient sample

        const x = commonCountries.map((c) => data1.get(c)!);
        const y = commonCountries.map((c) => data2.get(c)!);

        const r = this.pearsonCorrelation(x, y);
        if (Math.abs(r) < 0.6) continue; // Only notable correlations

        const dir = r > 0 ? 'positive' : 'negative';
        const str = Math.abs(r) >= 0.8 ? 'strong' : 'moderate';

        const higherLower = r > 0 ? 'higher' : 'lower';
        const interpretation = `Countries with higher ${ind1.name.toLowerCase()} tend to have ${higherLower} ${ind2.name.toLowerCase()} (r = ${r.toFixed(2)}).`;

        correlations.push({
          indicator1: { id: ind1.id, name: ind1.name, theme: ind1.theme.name },
          indicator2: { id: ind2.id, name: ind2.name, theme: ind2.theme.name },
          correlation: Math.round(r * 1000) / 1000,
          strength: str,
          direction: dir,
          sampleSize: commonCountries.length,
          interpretation,
        });
      }
    }

    // Sort by absolute correlation
    correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

    this.cache.set(cacheKey, correlations, 1800);
    return correlations;
  }

  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    if (n === 0) return 0;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
    const sumX2 = x.reduce((a, b) => a + b * b, 0);
    const sumY2 = y.reduce((a, b) => a + b * b, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));

    return denominator === 0 ? 0 : numerator / denominator;
  }
}
