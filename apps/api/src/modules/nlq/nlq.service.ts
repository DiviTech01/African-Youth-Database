import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache.service';
import { AiService } from '../insights/ai.service';

// All 54 AU countries for keyword matching
const COUNTRY_NAMES = [
  'Algeria', 'Egypt', 'Libya', 'Mauritania', 'Morocco', 'Tunisia',
  'Benin', 'Burkina Faso', 'Cabo Verde', "Cote d'Ivoire", 'Gambia', 'Ghana',
  'Guinea', 'Guinea-Bissau', 'Liberia', 'Mali', 'Niger', 'Nigeria', 'Senegal',
  'Sierra Leone', 'Togo', 'Cameroon', 'Central African Republic', 'Chad',
  'Congo', 'DR Congo', 'Equatorial Guinea', 'Gabon', 'Sao Tome and Principe',
  'Burundi', 'Comoros', 'Djibouti', 'Eritrea', 'Ethiopia', 'Kenya',
  'Madagascar', 'Malawi', 'Mozambique', 'Rwanda', 'Somalia', 'Sudan',
  'South Sudan', 'Tanzania', 'Uganda', 'Angola', 'Botswana', 'Eswatini',
  'Lesotho', 'Mauritius', 'Namibia', 'Seychelles', 'South Africa', 'Zambia', 'Zimbabwe',
];

const REGION_MAP: Record<string, string> = {
  'north africa': 'NORTH_AFRICA',
  'west africa': 'WEST_AFRICA',
  'central africa': 'CENTRAL_AFRICA',
  'east africa': 'EAST_AFRICA',
  'southern africa': 'SOUTHERN_AFRICA',
  'northern africa': 'NORTH_AFRICA',
  'western africa': 'WEST_AFRICA',
  'eastern africa': 'EAST_AFRICA',
};

const INDICATOR_KEYWORDS: Record<string, string> = {
  'unemployment': 'youth-unemployment-rate',
  'jobless': 'youth-unemployment-rate',
  'literacy': 'youth-literacy-rate',
  'internet': 'internet-penetration-rate',
  'online': 'internet-penetration-rate',
  'fertility': 'adolescent-fertility-rate',
  'mortality': 'youth-mortality-rate',
  'enrollment': 'secondary-school-net-enrollment-rate',
  'school': 'secondary-school-net-enrollment-rate',
  'education spending': 'education-expenditure-gdp',
  'health spending': 'youth-healthcare-access',
  'hiv': 'hiv-prevalence-rate-youth',
  'mobile': 'mobile-cellular-subscriptions',
  'neet': 'youth-neet-rate',
  'self-employed': 'youth-self-employment-rate',
  'corruption': 'youth-trust-in-government-index',
  'governance': 'youth-political-participation-index',
  'maternal mortality': 'maternal-mortality-ratio',
  'primary completion': 'primary-completion-rate',
  'tertiary': 'tertiary-education-gross-enrollment-rate',
  'labor force': 'youth-labor-force-participation-rate',
  'participation': 'youth-labor-force-participation-rate',
  'life expectancy': 'stunting-prevalence-under-5',
  'bank account': 'youth-bank-account-ownership',
  'agriculture': 'youth-employment-in-agriculture',
  'gender parity': 'gender-parity-index-education',
  'broadband': 'fixed-broadband-subscriptions',
  'co2': 'carbon-emissions-per-capita',
  'emissions': 'carbon-emissions-per-capita',
};

interface ParsedQuery {
  intent: 'single_value' | 'comparison' | 'ranking' | 'trend' | 'regional' | 'correlation';
  countries: string[];
  regions: string[];
  indicatorSlugs: string[];
  themes: string[];
  yearStart: number | null;
  yearEnd: number | null;
  gender: string | null;
  limit: number;
  sortOrder: 'asc' | 'desc';
}

interface NlqResponse {
  question: string;
  answer: string;
  data: Record<string, unknown>[];
  visualization: {
    type: string;
    title: string;
    xAxis?: string;
    yAxis?: string;
  };
  followUpQuestions: string[];
  intent: string;
  source: 'ai' | 'rule-based';
  processingTime: number;
}

@Injectable()
export class NlqService {
  private readonly logger = new Logger(NlqService.name);

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private ai: AiService,
  ) {}

  async processQuery(question: string): Promise<NlqResponse> {
    const start = Date.now();

    // Step 1: Parse the question (AI or keyword-based)
    const parsed = await this.parseQuestion(question);

    // Step 2: Execute database query based on parsed intent
    const queryResult = await this.executeQuery(parsed);

    // Step 3: Generate answer (AI or template-based)
    const answer = await this.generateAnswer(question, parsed, queryResult);

    // Step 4: Suggest visualization
    const visualization = this.suggestVisualization(parsed, queryResult);

    // Step 5: Follow-up questions
    const followUpQuestions = await this.generateFollowUps(question, parsed);

    const processingTime = Math.round((Date.now() - start) / 100) / 10;

    return {
      question,
      answer: answer.text,
      data: queryResult.data,
      visualization,
      followUpQuestions,
      intent: parsed.intent,
      source: answer.source,
      processingTime,
    };
  }

  // ============================================================
  // Step 1: Parse the question
  // ============================================================

  private async parseQuestion(question: string): Promise<ParsedQuery> {
    // Try AI parsing first
    const aiParsed = await this.tryAiParse(question);
    if (aiParsed) return aiParsed;

    // Fallback to keyword parsing
    return this.keywordParse(question);
  }

  private async tryAiParse(question: string): Promise<ParsedQuery | null> {
    const systemPrompt = `You are a query parser for the African Youth Observatory. The database contains youth-related indicators for 54 African countries, organized into 9 themes: Education, Employment & Entrepreneurship, Health, Civic Engagement & Governance, Innovation & Technology, Agriculture, Gender Equality, Financial Inclusion, Environment & Climate.

Given a user question, extract structured query parameters. Return ONLY valid JSON:

{
  "intent": "single_value|comparison|ranking|trend|regional|correlation",
  "countries": ["Nigeria"] or [],
  "regions": ["NORTH_AFRICA"] or [],
  "indicatorSlugs": ["youth-unemployment-rate"] or [],
  "themes": ["education"] or [],
  "yearStart": 2020 or null,
  "yearEnd": 2023 or null,
  "gender": "MALE"|"FEMALE"|"TOTAL" or null,
  "limit": 10 or null,
  "sortOrder": "asc"|"desc"
}

Available indicator slugs: youth-unemployment-rate, youth-literacy-rate, internet-penetration-rate, adolescent-fertility-rate, youth-mortality-rate, secondary-school-net-enrollment-rate, education-expenditure-gdp, youth-healthcare-access, maternal-mortality-ratio, youth-neet-rate, youth-labor-force-participation-rate, informal-employment-rate, mobile-cellular-subscriptions, primary-completion-rate, tertiary-education-gross-enrollment-rate, youth-bank-account-ownership, gender-parity-index-education, carbon-emissions-per-capita, youth-employment-in-agriculture.

Regions: NORTH_AFRICA, WEST_AFRICA, CENTRAL_AFRICA, EAST_AFRICA, SOUTHERN_AFRICA.

Rules:
- If asking about rankings ("highest", "top", "best", "worst", "lowest"), set intent to "ranking" and sortOrder accordingly
- If comparing countries, set intent to "comparison"
- If asking about change over time, set intent to "trend"
- If mentioning a region without specific countries, set intent to "regional"
- Match flexibly: "joblessness" → youth-unemployment-rate, "schooling" → education theme`;

    const raw = await this.ai.generate(systemPrompt, question, 400);
    if (!raw) return null;

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        intent: parsed.intent || 'single_value',
        countries: parsed.countries || [],
        regions: parsed.regions || [],
        indicatorSlugs: parsed.indicatorSlugs || [],
        themes: parsed.themes || [],
        yearStart: parsed.yearStart || null,
        yearEnd: parsed.yearEnd || null,
        gender: parsed.gender || null,
        limit: parsed.limit || 10,
        sortOrder: parsed.sortOrder || 'desc',
      };
    } catch {
      return null;
    }
  }

  private keywordParse(question: string): ParsedQuery {
    const q = question.toLowerCase();

    // Detect countries
    const countries = COUNTRY_NAMES.filter((c) =>
      q.includes(c.toLowerCase()),
    );

    // Detect regions
    const regions: string[] = [];
    for (const [keyword, region] of Object.entries(REGION_MAP)) {
      if (q.includes(keyword)) regions.push(region);
    }

    // Detect indicators
    const indicatorSlugs: string[] = [];
    for (const [keyword, slug] of Object.entries(INDICATOR_KEYWORDS)) {
      if (q.includes(keyword) && !indicatorSlugs.includes(slug)) {
        indicatorSlugs.push(slug);
      }
    }

    // Detect intent
    let intent: ParsedQuery['intent'] = 'single_value';
    if (q.includes('compare') || countries.length >= 2) intent = 'comparison';
    else if (/trend|over time|changed|history|progress/.test(q)) intent = 'trend';
    else if (/highest|lowest|top|best|worst|rank|most|least/.test(q)) intent = 'ranking';
    else if (regions.length > 0 && countries.length === 0) intent = 'regional';
    else if (/correlat|relat|connect|link/.test(q)) intent = 'correlation';

    // Detect years
    const yearMatches = q.match(/\b(20\d{2})\b/g);
    let yearStart: number | null = null;
    let yearEnd: number | null = null;
    if (yearMatches) {
      const years = yearMatches.map(Number).sort();
      yearStart = years[0];
      yearEnd = years.length > 1 ? years[years.length - 1] : null;
    }

    // Sort order
    const sortOrder: 'asc' | 'desc' = /lowest|worst|least|bottom/.test(q) ? 'asc' : 'desc';

    // Limit
    const limitMatch = q.match(/top\s+(\d+)|(\d+)\s+(?:best|worst|top|bottom)/);
    const limit = limitMatch ? parseInt(limitMatch[1] || limitMatch[2]) : 10;

    // Detect themes — map natural-language keywords to the 7 canonical theme slugs.
    // Stale themes (innovation/agriculture/gender/environment as standalone) were
    // consolidated; their keywords now route to their absorbing theme:
    //   civic / participation / democracy → demography & participation
    //   innovation / technology / digital → entrepreneurship (where internet/IP/etc live)
    //   finance / credit                 → entrepreneurship (financial inclusion folded in)
    //   peace / extremism / displaced    → peace & security
    //   justice / prison / trial         → access to justice
    const themes: string[] = [];
    const themeKeywords: Record<string, string> = {
      // Education / Employment / Health — clean 1:1
      education: 'education',
      literacy: 'education',
      enrollment: 'education',
      employment: 'employment',
      unemployment: 'employment',
      labour: 'employment',
      labor: 'employment',
      health: 'health',
      // Demography & participation (absorbed Civic Engagement & Governance)
      demography: 'youth-demography-participation',
      population: 'youth-demography-participation',
      civic: 'youth-demography-participation',
      participation: 'youth-demography-participation',
      voter: 'youth-demography-participation',
      voting: 'youth-demography-participation',
      governance: 'youth-demography-participation',
      democracy: 'youth-demography-participation',
      // Entrepreneurship (absorbed Innovation & Financial Inclusion)
      entrepreneurship: 'entrepreneurship',
      startup: 'entrepreneurship',
      innovation: 'entrepreneurship',
      technology: 'entrepreneurship',
      digital: 'entrepreneurship',
      internet: 'entrepreneurship',
      finance: 'entrepreneurship',
      credit: 'entrepreneurship',
      // Peace & Security
      peace: 'peace-security',
      security: 'peace-security',
      extremism: 'peace-security',
      trafficking: 'peace-security',
      displaced: 'peace-security',
      // Access to Justice
      justice: 'access-to-justice',
      prison: 'access-to-justice',
      imprisoned: 'access-to-justice',
      trial: 'access-to-justice',
      juvenile: 'access-to-justice',
    };
    for (const [kw, slug] of Object.entries(themeKeywords)) {
      if (q.includes(kw) && !themes.includes(slug)) themes.push(slug);
    }

    return { intent, countries, regions, indicatorSlugs, themes, yearStart, yearEnd, gender: null, limit, sortOrder };
  }

  // ============================================================
  // Step 2: Execute database query
  // ============================================================

  private async executeQuery(parsed: ParsedQuery): Promise<{ data: Record<string, unknown>[]; meta: Record<string, unknown> }> {
    // Resolve country names to IDs
    let countryIds: string[] = [];
    if (parsed.countries.length > 0) {
      const countries = await this.prisma.country.findMany({
        where: { name: { in: parsed.countries } },
        select: { id: true, name: true },
      });
      countryIds = countries.map((c) => c.id);
    }

    // Resolve indicator slugs to IDs
    let indicatorIds: string[] = [];
    if (parsed.indicatorSlugs.length > 0) {
      const indicators = await this.prisma.indicator.findMany({
        where: { slug: { in: parsed.indicatorSlugs } },
        select: { id: true, slug: true },
      });
      indicatorIds = indicators.map((i) => i.id);
    }

    // If no indicator detected, try theme-based
    if (indicatorIds.length === 0 && parsed.themes.length > 0) {
      const themeIndicators = await this.prisma.indicator.findMany({
        where: { theme: { slug: { in: parsed.themes } } },
        select: { id: true },
        take: 5,
      });
      indicatorIds = themeIndicators.map((i) => i.id);
    }

    const year = parsed.yearEnd || parsed.yearStart || 2023;

    switch (parsed.intent) {
      case 'ranking': {
        const indicatorId = indicatorIds[0];
        if (!indicatorId) return this.emptyResult('No matching indicator found');

        const where: Record<string, unknown> = {
          indicatorId,
          gender: parsed.gender || 'TOTAL',
          year,
        };
        if (parsed.regions.length > 0) {
          where.country = { region: { in: parsed.regions } };
        }

        const values = await this.prisma.indicatorValue.findMany({
          where,
          include: {
            country: { select: { name: true, isoCode3: true, region: true } },
            indicator: { select: { name: true, unit: true } },
          },
          orderBy: { value: parsed.sortOrder },
          take: parsed.limit,
        });

        return {
          data: values.map((v, i) => ({
            rank: i + 1,
            country: v.country.name,
            isoCode3: v.country.isoCode3,
            region: v.country.region,
            value: v.value,
            unit: v.indicator.unit,
            year: v.year,
            indicator: v.indicator.name,
          })),
          meta: { intent: 'ranking', indicatorName: values[0]?.indicator.name, year },
        };
      }

      case 'trend': {
        const countryId = countryIds[0];
        const indicatorId = indicatorIds[0];
        if (!countryId || !indicatorId) return this.emptyResult('Need both a country and indicator for trend analysis');

        const where: Record<string, unknown> = {
          countryId,
          indicatorId,
          gender: parsed.gender || 'TOTAL',
        };
        if (parsed.yearStart) (where as any).year = { ...(where as any).year, gte: parsed.yearStart };
        if (parsed.yearEnd) (where as any).year = { ...(where as any).year, lte: parsed.yearEnd };

        const values = await this.prisma.indicatorValue.findMany({
          where,
          include: {
            country: { select: { name: true } },
            indicator: { select: { name: true, unit: true } },
          },
          orderBy: { year: 'asc' },
        });

        return {
          data: values.map((v) => ({
            country: v.country.name,
            year: v.year,
            value: v.value,
            unit: v.indicator.unit,
            indicator: v.indicator.name,
          })),
          meta: { intent: 'trend', country: values[0]?.country.name, indicator: values[0]?.indicator.name },
        };
      }

      case 'comparison': {
        if (countryIds.length < 2) return this.emptyResult('Need at least 2 countries for comparison');

        const where: Record<string, unknown> = {
          countryId: { in: countryIds },
          gender: parsed.gender || 'TOTAL',
          year,
        };
        if (indicatorIds.length > 0) where.indicatorId = { in: indicatorIds };

        const values = await this.prisma.indicatorValue.findMany({
          where,
          include: {
            country: { select: { name: true, isoCode3: true } },
            indicator: { select: { name: true, unit: true } },
          },
          orderBy: { country: { name: 'asc' } },
        });

        return {
          data: values.map((v) => ({
            country: v.country.name,
            indicator: v.indicator.name,
            value: v.value,
            unit: v.indicator.unit,
            year: v.year,
          })),
          meta: { intent: 'comparison', year },
        };
      }

      case 'regional': {
        const region = parsed.regions[0];
        if (!region) return this.emptyResult('No region detected');

        const where: Record<string, unknown> = {
          country: { region },
          gender: 'TOTAL',
          year,
        };
        if (indicatorIds.length > 0) where.indicatorId = { in: indicatorIds };

        const values = await this.prisma.indicatorValue.findMany({
          where,
          include: {
            country: { select: { name: true } },
            indicator: { select: { name: true, unit: true } },
          },
          orderBy: { value: parsed.sortOrder },
          take: parsed.limit,
        });

        return {
          data: values.map((v) => ({
            country: v.country.name,
            indicator: v.indicator.name,
            value: v.value,
            unit: v.indicator.unit,
            year: v.year,
          })),
          meta: { intent: 'regional', region, year },
        };
      }

      default: {
        // single_value
        const where: Record<string, unknown> = {
          gender: parsed.gender || 'TOTAL',
          year,
        };
        if (countryIds.length > 0) where.countryId = countryIds[0];
        if (indicatorIds.length > 0) where.indicatorId = indicatorIds[0];

        const values = await this.prisma.indicatorValue.findMany({
          where,
          include: {
            country: { select: { name: true } },
            indicator: { select: { name: true, unit: true } },
          },
          take: 10,
        });

        return {
          data: values.map((v) => ({
            country: v.country.name,
            indicator: v.indicator.name,
            value: v.value,
            unit: v.indicator.unit,
            year: v.year,
          })),
          meta: { intent: 'single_value', year },
        };
      }
    }
  }

  private emptyResult(reason: string) {
    return { data: [], meta: { error: reason } };
  }

  // ============================================================
  // Step 3: Generate answer
  // ============================================================

  private async generateAnswer(
    question: string,
    parsed: ParsedQuery,
    result: { data: Record<string, unknown>[]; meta: Record<string, unknown> },
  ): Promise<{ text: string; source: 'ai' | 'rule-based' }> {
    if (result.data.length === 0) {
      return {
        text: `I couldn't find data matching your question. ${result.meta.error || 'Try being more specific about the country, indicator, or time period.'}`,
        source: 'rule-based',
      };
    }

    // Try AI answer
    const aiAnswer = await this.ai.generate(
      `You are a data analyst answering a question about African youth data. Generate a clear, concise answer in 2-4 sentences. Reference specific numbers from the results. If the data shows something surprising or noteworthy, mention it. Do NOT make up data — only reference what's in the results.`,
      `User question: "${question}"\n\nQuery results:\n${JSON.stringify(result.data.slice(0, 20), null, 2)}`,
      400,
    );

    if (aiAnswer) {
      return { text: aiAnswer, source: 'ai' };
    }

    // Rule-based answer
    return { text: this.templateAnswer(parsed, result), source: 'rule-based' };
  }

  private templateAnswer(
    parsed: ParsedQuery,
    result: { data: Record<string, unknown>[]; meta: Record<string, unknown> },
  ): string {
    const rows = result.data;
    if (rows.length === 0) return 'No data found for your query.';

    const first = rows[0];

    switch (parsed.intent) {
      case 'ranking': {
        const top = rows.slice(0, 3);
        return `Based on available data, the top performers are: ${top.map((r, i) => `${i + 1}. ${r.country} (${(r.value as number).toFixed(1)} ${r.unit})`).join(', ')}. Data covers ${rows.length} countries for ${first.indicator} in ${first.year}.`;
      }
      case 'trend': {
        const start = rows[0];
        const end = rows[rows.length - 1];
        const change = ((end.value as number) - (start.value as number)).toFixed(1);
        return `${first.country}'s ${first.indicator} went from ${(start.value as number).toFixed(1)} in ${start.year} to ${(end.value as number).toFixed(1)} in ${end.year}, a change of ${change} ${first.unit} over the period.`;
      }
      case 'comparison': {
        return `Comparing the requested countries: ${rows.map((r) => `${r.country}: ${(r.value as number).toFixed(1)} ${r.unit} (${r.indicator}, ${r.year})`).join('; ')}.`;
      }
      default: {
        return `${first.country}'s ${first.indicator} is ${(first.value as number).toFixed(1)} ${first.unit} as of ${first.year}.`;
      }
    }
  }

  // ============================================================
  // Step 4: Suggest visualization
  // ============================================================

  private suggestVisualization(
    parsed: ParsedQuery,
    result: { data: Record<string, unknown>[]; meta: Record<string, unknown> },
  ) {
    const first = result.data[0];
    const indicatorName = (first?.indicator as string) || 'Data';

    const vizMap: Record<string, { type: string; xAxis?: string; yAxis?: string }> = {
      single_value: { type: 'stat_card' },
      comparison: { type: 'bar_chart', xAxis: 'Country', yAxis: indicatorName },
      ranking: { type: 'bar_chart', xAxis: 'Country', yAxis: indicatorName },
      trend: { type: 'line_chart', xAxis: 'Year', yAxis: indicatorName },
      regional: { type: 'grouped_bar', xAxis: 'Country', yAxis: indicatorName },
      correlation: { type: 'scatter_plot', xAxis: 'Indicator 1', yAxis: 'Indicator 2' },
    };

    const viz = vizMap[parsed.intent] || vizMap.single_value;

    return {
      type: viz.type,
      title: `${indicatorName}${parsed.countries.length > 0 ? ` — ${parsed.countries.join(', ')}` : ''}`,
      xAxis: viz.xAxis,
      yAxis: viz.yAxis,
    };
  }

  // ============================================================
  // Step 5: Follow-up questions
  // ============================================================

  private async generateFollowUps(question: string, parsed: ParsedQuery): Promise<string[]> {
    // Try AI
    const aiFollowUps = await this.ai.generate(
      'Given a question about African youth data, suggest exactly 3 relevant follow-up questions. Return ONLY a JSON array of 3 strings.',
      `Original question: "${question}"\nDetected intent: ${parsed.intent}\nCountries: ${parsed.countries.join(', ') || 'none'}\nIndicators: ${parsed.indicatorSlugs.join(', ') || 'none'}`,
      200,
    );

    if (aiFollowUps) {
      try {
        const match = aiFollowUps.match(/\[[\s\S]*\]/);
        if (match) {
          const arr = JSON.parse(match[0]) as string[];
          if (Array.isArray(arr) && arr.length > 0) return arr.slice(0, 3);
        }
      } catch { /* fall through */ }
    }

    // Rule-based follow-ups
    const country = parsed.countries[0] || 'this country';
    const followUps: string[] = [];

    if (parsed.intent !== 'trend' && parsed.countries.length > 0) {
      followUps.push(`How has ${country}'s performance changed over the past decade?`);
    }
    if (parsed.intent !== 'comparison' && parsed.countries.length > 0) {
      followUps.push(`How does ${country} compare to its regional peers?`);
    }
    if (parsed.intent !== 'ranking') {
      followUps.push('Which African countries have the highest youth development scores?');
    }
    if (followUps.length < 3) {
      followUps.push('What are the main challenges facing youth in Africa?');
    }

    return followUps.slice(0, 3);
  }
}
