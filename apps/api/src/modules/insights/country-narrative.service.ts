import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache.service';
import { AiService } from './ai.service';

interface CountryNarrative {
  countryId: string;
  countryName: string;
  narrative: string;
  keyStrengths: string[];
  keyChallenges: string[];
  outlook: string;
  generatedAt: string;
  source: 'ai' | 'rule-based';
}

const NARRATIVE_THEME_LABELS: Record<string, string> = {
  'youth-demography-participation': 'Youth Demography & Participation',
  'education': 'Education',
  'employment': 'Employment',
  'health': 'Health',
  'entrepreneurship': 'Entrepreneurship',
  'peace-security': 'Peace & Security',
  'access-to-justice': 'Access to Justice',
};

type NarrativeIndex = {
  overallScore: number;
  rank: number;
  tier: string;
  dimensionScores: unknown;
  year: number;
};

function narrativeDimsArray(yi: NarrativeIndex): { name: string; slug: string; score: number }[] {
  const d = (yi.dimensionScores && typeof yi.dimensionScores === 'object')
    ? (yi.dimensionScores as Record<string, number>)
    : {};
  return Object.keys(NARRATIVE_THEME_LABELS).map((slug) => ({
    name: NARRATIVE_THEME_LABELS[slug],
    slug,
    score: typeof d[slug] === 'number' ? d[slug] : 50,
  }));
}

function narrativeDimsLine(yi: NarrativeIndex): string {
  return narrativeDimsArray(yi).map((d) => `${d.name}: ${d.score.toFixed(1)}`).join(' | ');
}

@Injectable()
export class CountryNarrativeService {
  private readonly logger = new Logger(CountryNarrativeService.name);

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private ai: AiService,
  ) {}

  async generateNarrative(countryId: string): Promise<CountryNarrative | null> {
    const cacheKey = `narrative:${countryId}`;
    const cached = this.cache.get<CountryNarrative>(cacheKey);
    if (cached) return cached;

    const country = await this.prisma.country.findUnique({
      where: { id: countryId },
    });
    if (!country) return null;

    // Youth Index — latest + history
    const youthScores = await this.prisma.youthIndexScore.findMany({
      where: { countryId },
      orderBy: { year: 'desc' },
      take: 6,
    });
    const latestIndex = youthScores[0] || null;

    // Top indicators (latest year)
    const latestValues = await this.prisma.indicatorValue.findMany({
      where: { countryId, gender: 'TOTAL' },
      include: {
        indicator: {
          select: { name: true, unit: true, theme: { select: { name: true } } },
        },
      },
      orderBy: { year: 'desc' },
      take: 40,
    });

    // Deduplicate to latest per indicator
    const seen = new Set<string>();
    const uniqueLatest = latestValues.filter((v) => {
      if (seen.has(v.indicatorId)) return false;
      seen.add(v.indicatorId);
      return true;
    }).slice(0, 20);

    // Regional averages
    const indIds = uniqueLatest.map((v) => v.indicatorId);
    const regionPeers = await this.prisma.indicatorValue.findMany({
      where: {
        indicatorId: { in: indIds },
        gender: 'TOTAL',
        country: { region: country.region },
      },
      select: { indicatorId: true, countryId: true, value: true },
    });

    const regionalAvg = new Map<string, number>();
    const regGroup = new Map<string, { sum: number; count: number }>();
    const seenPeer = new Set<string>();
    for (const v of regionPeers) {
      const key = `${v.indicatorId}:${v.countryId}`;
      if (seenPeer.has(key)) continue;
      seenPeer.add(key);
      if (!regGroup.has(v.indicatorId)) regGroup.set(v.indicatorId, { sum: 0, count: 0 });
      const e = regGroup.get(v.indicatorId)!;
      e.sum += v.value;
      e.count += 1;
    }
    for (const [id, { sum, count }] of regGroup) {
      regionalAvg.set(id, Math.round((sum / count) * 100) / 100);
    }

    // Peer rank
    const peerCount = await this.prisma.country.count({ where: { region: country.region } });

    // Try AI narrative
    const aiResult = await this.tryAiNarrative(country, latestIndex, youthScores, uniqueLatest, regionalAvg, peerCount);
    if (aiResult) {
      this.cache.set(cacheKey, aiResult, 86400); // 24 hours
      return aiResult;
    }

    // Rule-based fallback
    const fallback = this.generateRuleBasedNarrative(country, latestIndex, youthScores, uniqueLatest, regionalAvg, peerCount);
    this.cache.set(cacheKey, fallback, 86400);
    return fallback;
  }

  private async tryAiNarrative(
    country: { id: string; name: string; region: string; flagEmoji: string | null },
    latestIndex: NarrativeIndex | null,
    indexHistory: { year: number; overallScore: number; rank: number }[],
    indicators: { indicatorId: string; value: number; year: number; indicator: { name: string; unit: string; theme: { name: string } } }[],
    regionalAvg: Map<string, number>,
    peerCount: number,
  ): Promise<CountryNarrative | null> {
    const dataSummary = [
      `Country: ${country.name}`,
      `Region: ${country.region.replace(/_/g, ' ')} (${peerCount} countries)`,
      '',
      latestIndex
        ? [
            `Youth Index (${latestIndex.year}): ${latestIndex.overallScore.toFixed(1)} (Rank ${latestIndex.rank}/54, Tier: ${latestIndex.tier})`,
            `  ${narrativeDimsLine(latestIndex)}`,
            '',
            'Index History:',
            ...indexHistory.map((s) => `  ${s.year}: Score ${s.overallScore.toFixed(1)}, Rank ${s.rank}`),
          ].join('\n')
        : 'Youth Index: Not yet computed',
      '',
      'Key Indicators (latest):',
      ...indicators.map((v) => {
        const avg = regionalAvg.get(v.indicatorId);
        return `- ${v.indicator.name}: ${v.value.toFixed(1)} ${v.indicator.unit} [${v.year}]${avg ? ` (regional avg: ${avg})` : ''} — ${v.indicator.theme.name}`;
      }),
    ].join('\n');

    const systemPrompt = `You are writing the overview narrative for a country profile on the African Youth Observatory.

Given the data below, produce a JSON object with:
{
  "narrative": "200-300 word analytical summary (see guidelines below)",
  "keyStrengths": ["strength 1", "strength 2", "strength 3"],
  "keyChallenges": ["challenge 1", "challenge 2", "challenge 3"],
  "outlook": "1-2 sentence forward-looking statement"
}

Narrative guidelines:
1. Overall youth development status (reference the Youth Index score and tier)
2. Key strengths (top-performing dimensions/indicators)
3. Key challenges (lowest-performing areas)
4. Recent trends (improving or declining over past years)
5. Regional context (how does this country compare to its regional peers)

Write in a professional, neutral analytical tone suitable for policymakers and researchers. Reference specific numbers. Do not speculate beyond the data.
Return ONLY valid JSON, nothing else.`;

    const raw = await this.ai.generate(systemPrompt, dataSummary, 1500);
    if (!raw) return null;

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]) as {
        narrative: string;
        keyStrengths: string[];
        keyChallenges: string[];
        outlook: string;
      };

      return {
        countryId: country.id,
        countryName: country.name,
        narrative: parsed.narrative,
        keyStrengths: parsed.keyStrengths || [],
        keyChallenges: parsed.keyChallenges || [],
        outlook: parsed.outlook || '',
        generatedAt: new Date().toISOString(),
        source: 'ai',
      };
    } catch (err) {
      this.logger.error('Failed to parse AI narrative JSON', err);
      return null;
    }
  }

  private generateRuleBasedNarrative(
    country: { id: string; name: string; region: string },
    latestIndex: NarrativeIndex | null,
    indexHistory: { year: number; overallScore: number; rank: number }[],
    indicators: { indicatorId: string; value: number; year: number; indicator: { name: string; unit: string; theme: { name: string } } }[],
    regionalAvg: Map<string, number>,
    peerCount: number,
  ): CountryNarrative {
    const tierDescriptions: Record<string, string> = {
      HIGH: 'a strong performer in youth development',
      MEDIUM_HIGH: 'an above-average performer in youth development',
      MEDIUM: 'a moderate performer in youth development',
      MEDIUM_LOW: 'a below-average performer in youth development',
      LOW: 'facing significant challenges in youth development',
    };

    const dimensions = latestIndex
      ? narrativeDimsArray(latestIndex).sort((a, b) => b.score - a.score)
      : [];

    const regionLabel = country.region.replace(/_/g, ' ');
    const best = dimensions[0];
    const worst = dimensions[dimensions.length - 1];

    // Trend
    let trendText = '';
    if (indexHistory.length >= 2) {
      const oldest = indexHistory[indexHistory.length - 1];
      const latest = indexHistory[0];
      const change = latest.overallScore - oldest.overallScore;
      const rankChange = oldest.rank - latest.rank;
      if (change > 2) {
        trendText = ` The country has shown improvement, with its Youth Index score rising from ${oldest.overallScore.toFixed(1)} in ${oldest.year} to ${latest.overallScore.toFixed(1)} in ${latest.year}, and its rank improving by ${rankChange} positions.`;
      } else if (change < -2) {
        trendText = ` The country has experienced a decline, with its Youth Index score falling from ${oldest.overallScore.toFixed(1)} in ${oldest.year} to ${latest.overallScore.toFixed(1)} in ${latest.year}.`;
      } else {
        trendText = ` Youth development outcomes have remained relatively stable over the observed period.`;
      }
    }

    // Count indicators above/below regional avg
    const aboveAvg = indicators.filter((i) => {
      const avg = regionalAvg.get(i.indicatorId);
      return avg !== undefined && i.value > avg;
    });
    const belowAvg = indicators.filter((i) => {
      const avg = regionalAvg.get(i.indicatorId);
      return avg !== undefined && i.value < avg;
    });

    const narrative = latestIndex
      ? `${country.name} is ${tierDescriptions[latestIndex.tier] || 'a moderate performer in youth development'}, ranked ${latestIndex.rank} out of 54 African Union member states with a Youth Empowerment & Development score of ${latestIndex.overallScore.toFixed(1)} out of 100 (${latestIndex.year}).${trendText}

The country's strongest dimension is ${best?.name || 'N/A'} (${best?.score.toFixed(1) || 'N/A'}), while ${worst?.name || 'N/A'} (${worst?.score.toFixed(1) || 'N/A'}) presents the most significant area for improvement. Among the ${peerCount} countries in ${regionLabel}, ${country.name} performs above the regional average on ${aboveAvg.length} of ${indicators.length} measured indicators and below average on ${belowAvg.length}.

Key youth development indicators show a mixed picture. ${indicators.slice(0, 3).map((i) => `${i.indicator.name} stands at ${i.value.toFixed(1)} ${i.indicator.unit}`).join(', ')}. ${indicators.length > 3 ? `Across all themes, the data covers ${indicators.length} indicators for the most recent available year.` : ''}`
      : `${country.name} is located in ${regionLabel}. Youth Index data has not yet been computed for this country. Available indicator data covers ${indicators.length} metrics across multiple themes.`;

    const keyStrengths = dimensions
      .filter((d) => d.score >= 55)
      .slice(0, 3)
      .map((d) => `${d.name} dimension scores ${d.score.toFixed(1)}, above continental average`);

    const keyChallenges = dimensions
      .filter((d) => d.score < 45)
      .slice(0, 3)
      .map((d) => `${d.name} dimension at ${d.score.toFixed(1)} needs significant attention`);

    const outlook = latestIndex
      ? `With targeted investment in ${worst?.name.toLowerCase() || 'key areas'}, ${country.name} has the potential to move into a higher tier of the Youth Development Index.`
      : `Comprehensive data collection and analysis is needed to establish a baseline for youth development planning.`;

    return {
      countryId: country.id,
      countryName: country.name,
      narrative,
      keyStrengths: keyStrengths.length > 0 ? keyStrengths : ['Data analysis in progress'],
      keyChallenges: keyChallenges.length > 0 ? keyChallenges : ['Data analysis in progress'],
      outlook,
      generatedAt: new Date().toISOString(),
      source: 'rule-based',
    };
  }
}
