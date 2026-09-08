import { Injectable, Logger } from '@nestjs/common';
import { AiContextService } from './ai-context.service';
import { CacheService } from '../../common/cache.service';

/** Which product surface a call is for — decides which model it routes to. */
export type AiSurface = 'chat' | 'report';

/**
 * Current-generation defaults. Sonnet 5 is $2/$10 per MTok, Opus 5 is $5/$25 —
 * the split keeps high-volume chat cheap while reports get the better model.
 */
const DEFAULT_MODELS: Record<AiSurface, string> = {
  chat: 'claude-sonnet-5',
  report: 'claude-opus-5',
};

/**
 * AYO AI Intelligence Service — answers ANY question with full database access.
 * Uses Claude tool use to dynamically query data, with rule-based fallback.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private client: any = null;
  private clientPromise: Promise<any> | null = null;

  constructor(
    private contextService: AiContextService,
    private cache: CacheService,
  ) {}

  /**
   * Memoises the in-flight initialisation PROMISE, not a boolean.
   *
   * The previous version set `initialized = true` synchronously and only then
   * awaited the dynamic import, so a second concurrent caller took the early
   * return and got `this.client` while it was still null — indistinguishable
   * from a genuinely failed SDK load. /ops/status probing chat and report in
   * parallel hit this every time, reporting "the SDK could not be loaded"
   * alongside the true "out of credit" and sending an operator down the wrong
   * path. Awaiting one shared promise makes every caller see the same result.
   */
  private async ensureClient(): Promise<any> {
    if (this.clientPromise) return this.clientPromise;

    this.clientPromise = (async () => {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        this.logger.warn('ANTHROPIC_API_KEY not set — AI features will use rule-based fallback');
        return null;
      }

      try {
        const { default: Anthropic } = await import('@anthropic-ai/sdk');
        this.client = new Anthropic({ apiKey });
        this.logger.log('Anthropic SDK initialized successfully');
      } catch {
        this.logger.warn('Failed to load @anthropic-ai/sdk — AI features will use rule-based fallback');
        this.client = null;
      }
      return this.client;
    })();

    return this.clientPromise;
  }

  async isAvailable(): Promise<boolean> {
    const client = await this.ensureClient();
    return client !== null;
  }

  /**
   * The initialized Anthropic client, or null when no key is configured.
   *
   * Exposed for callers that need request features `generate()` deliberately
   * does not model — tool-use loops, per-request effort/thinking config, prompt
   * caching breakpoints. Report generation is the one such caller today; it
   * shares this client so key handling and SDK loading stay in one place.
   */
  async getClient(): Promise<any> {
    return this.ensureClient();
  }

  /**
   * Honest AI health check — actually calls Anthropic instead of just asserting
   * that a key is present.
   *
   * `isAvailable()` above returns true whenever ANTHROPIC_API_KEY is set and the
   * SDK imports, which is why the platform can report a healthy AI while every
   * real request silently falls through to `fallbackAnswer()` — e.g. when
   * AI_MODEL is pinned to a model ID the account can no longer reach (see the
   * note on `getModel()`). That failure mode is invisible to callers because
   * the fallback returns well-formed JSON.
   *
   * This does a 1-token round trip so the answer reflects reality. Result is
   * cached (10 min on success, 60s on failure) so status polling can't turn
   * into a billing problem.
   */
  async probe(surface: AiSurface = 'chat'): Promise<{ ok: boolean; model: string; error: string | null }> {
    const model = this.getModel(surface);
    const cacheKey = `ai-probe:${model}`;
    const cached = this.cache.get<{ ok: boolean; model: string; error: string | null }>(cacheKey);
    if (cached) return cached;

    let result: { ok: boolean; model: string; error: string | null };

    const client = await this.ensureClient();
    if (!client) {
      result = {
        ok: false,
        model,
        error: process.env.ANTHROPIC_API_KEY
          ? 'The Anthropic SDK could not be loaded on the server.'
          : 'No Anthropic API key is configured on the server.',
      };
    } else {
      try {
        await client.messages.create({
          model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        });
        result = { ok: true, model, error: null };
      } catch (err: any) {
        result = { ok: false, model, error: describeAnthropicError(err, model) };
      }
    }

    this.cache.set(cacheKey, result, result.ok ? 600 : 60);
    if (!result.ok) {
      this.logger.warn(`AI probe failed for model "${model}": ${result.error}`);
    }
    return result;
  }

  /**
   * Model routing is per-surface, not global.
   *
   * Chat and NLQ are high-volume and latency-sensitive, so they run Sonnet 5.
   * Reports are low-volume, long-form and cited — the place where reasoning
   * quality is worth paying for — so they run Opus 5.
   *
   * The legacy `AI_MODEL` variable is deliberately NOT read. Production had it
   * pinned to `claude-sonnet-4-20250514`, a model this account can no longer
   * reach, which made every AI call fall through to the rule-based engine while
   * `/insights/status` still reported `aiAvailable: true`. Honouring it would
   * mean the fix could not ship without a dashboard change; ignoring it makes
   * the deploy self-healing. Override per surface instead.
   */
  getModel(surface: AiSurface = 'chat'): string {
    const override =
      surface === 'report' ? process.env.AI_MODEL_REPORT : process.env.AI_MODEL_CHAT;
    return override?.trim() || DEFAULT_MODELS[surface];
  }

  /**
   * Legacy generate method — kept for backward compatibility with
   * InsightsService and CountryNarrativeService.
   */
  async generate(
    systemPrompt: string,
    userPrompt: string,
    maxTokens?: number,
    surface: AiSurface = 'chat',
  ): Promise<string | null> {
    const client = await this.ensureClient();
    if (!client) return null;

    try {
      const response = await client.messages.create({
        model: this.getModel(surface),
        max_tokens: maxTokens || 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const first = response.content[0];
      return first?.type === 'text' ? first.text ?? null : null;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`AI generation failed: ${msg}`);
      return null;
    }
  }

  /**
   * The main intelligence method — answers ANY question with full data access.
   * Uses Claude with tool use to query the database dynamically.
   */
  async answerQuestion(question: string, options?: {
    countryId?: string;
    includeVisualization?: boolean;
    language?: string;
  }): Promise<AiAnswer> {
    const startTime = Date.now();

    // Check cache
    const cacheKey = `ai-answer:${question}:${options?.countryId || ''}:${options?.language || 'en'}`;
    const cached = this.cache.get<AiAnswer>(cacheKey);
    if (cached) return cached;

    const client = await this.ensureClient();
    if (!client) {
      return this.fallbackAnswer(question, options);
    }

    // Build context based on question scope
    let dataContext: string;
    if (options?.countryId) {
      dataContext = await this.contextService.buildCountryContext(options.countryId);
    } else {
      dataContext = await this.contextService.buildFullContext();
    }

    const systemPrompt = this.buildSystemPrompt(dataContext, options);
    const tools = this.buildTools();

    try {
      let messages: any[] = [{ role: 'user', content: question }];
      let response = await client.messages.create({
        model: this.getModel(),
        max_tokens: 4096,
        system: systemPrompt,
        tools,
        messages,
      });

      // Tool use loop — max 5 iterations to prevent runaway
      let iterations = 0;
      while (response.stop_reason === 'tool_use' && iterations < 5) {
        iterations++;
        const toolUseBlocks = response.content.filter((b: any) => b.type === 'tool_use');
        const toolResults: any[] = [];

        for (const toolUse of toolUseBlocks) {
          const result = await this.executeTool(toolUse.name, toolUse.input);
          this.logger.debug(`Tool ${toolUse.name} returned ${JSON.stringify(result).length} chars`);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
          });
        }

        messages = [
          ...messages,
          { role: 'assistant', content: response.content },
          { role: 'user', content: toolResults },
        ];

        response = await client.messages.create({
          model: this.getModel(),
          max_tokens: 4096,
          system: systemPrompt,
          tools,
          messages,
        });
      }

      // Extract the final text response
      const textBlock = response.content.find((b: any) => b.type === 'text');
      if (!textBlock) {
        return this.fallbackAnswer(question, options);
      }

      const elapsed = Date.now() - startTime;
      this.logger.log(`AI query completed in ${elapsed}ms, ${iterations} tool calls: "${question.slice(0, 80)}"`);

      // Parse the JSON response
      const answer = this.parseAiResponse(textBlock.text);
      this.cache.set(cacheKey, answer, 1800);
      return answer;
    } catch (err: any) {
      this.logger.error(`AI query failed: ${err.message}`);
      return this.fallbackAnswer(question, options);
    }
  }

  private buildSystemPrompt(dataContext: string, options?: {
    countryId?: string;
    includeVisualization?: boolean;
    language?: string;
  }): string {
    const langInstruction = options?.language && options.language !== 'en'
      ? `Respond in ${options.language === 'fr' ? 'French' : options.language === 'ar' ? 'Arabic' : options.language === 'pt' ? 'Portuguese' : options.language === 'sw' ? 'Swahili' : 'English'}.`
      : 'Respond in English.';

    const vizInstruction = options?.includeVisualization
      ? `When your answer would benefit from a chart or graph, include a "visualization" object in your response with:
- type: "bar_chart" | "line_chart" | "radar_chart" | "pie_chart" | "scatter_plot" | "table" | "stat_cards"
- title: Chart title
- data: Array of data points

For bar charts: { data: [{ name: "Nigeria", value: 14.07 }, ...], xAxis: "Country", yAxis: "Rate (%)" }
For line charts: { data: [{ year: 2015, value: 20.3 }, ...], xAxis: "Year", yAxis: "Value" }
For stat cards: { data: [{ label: "Youth Unemployment", value: "14.1%", change: -2.3 }, ...] }
For tables: { headers: ["Country", "Score", "Rank"], rows: [["Nigeria", "42.5", "35"], ...] }`
      : 'Do not include visualizations.';

    return `You are the AI analyst for the African Youth Observatory (AYO), the most comprehensive data intelligence platform on African youth across all 54 nations.

You have direct access to the platform's database through tools. Use them to fetch specific data to answer questions accurately.

YOUR CORE RULES:
1. NEVER make up numbers. Every statistic you cite MUST come from the data provided or fetched via tools.
2. When you cite a number, always include the year and source.
3. If data is not available for a specific question, say so clearly — don't estimate.
4. Always provide context: compare to regional averages, continental trends, or peer countries.
5. Be analytical, not just descriptive. Explain WHY patterns exist, what they mean, and what actions could address issues.
6. When relevant, reference the Youth Index scores, policy compliance, or AU frameworks.
7. ${langInstruction}

YOUR DATA ACCESS:
${dataContext}

VISUALIZATION INSTRUCTIONS:
${vizInstruction}

RESPONSE FORMAT:
Respond with a JSON object:
{
  "answer": "Your detailed analytical response (2-6 paragraphs, markdown supported)",
  "keyFindings": ["Finding 1", "Finding 2", "Finding 3"],
  "dataCitations": [
    { "indicator": "Youth unemployment rate", "country": "Nigeria", "value": 14.07, "year": 2023, "source": "Sample Data" }
  ],
  "visualization": { ... } or null,
  "followUpQuestions": ["Question 1?", "Question 2?", "Question 3?"],
  "confidence": 0.95,
  "dataAvailability": "full" | "partial" | "limited"
}`;
  }

  private buildTools(): any[] {
    return [
      {
        name: 'query_country_data',
        description: 'Get indicator data for a specific country.',
        input_schema: {
          type: 'object' as const,
          properties: {
            countryName: { type: 'string', description: 'Country name (e.g., "Nigeria")' },
            indicatorSlug: { type: 'string', description: 'Optional indicator slug (e.g., "youth-unemployment-rate")' },
            yearStart: { type: 'number', description: 'Optional start year' },
            yearEnd: { type: 'number', description: 'Optional end year' },
          },
          required: ['countryName'],
        },
      },
      {
        name: 'query_indicator_ranking',
        description: 'Get countries ranked by a specific indicator.',
        input_schema: {
          type: 'object' as const,
          properties: {
            indicatorSlug: { type: 'string', description: 'Indicator slug' },
            year: { type: 'number', description: 'Optional year (defaults to latest)' },
            limit: { type: 'number', description: 'Number of countries (default 10)' },
            order: { type: 'string', enum: ['asc', 'desc'], description: '"desc" for highest first' },
          },
          required: ['indicatorSlug'],
        },
      },
      {
        name: 'query_time_series',
        description: 'Get historical trend data for an indicator in a country.',
        input_schema: {
          type: 'object' as const,
          properties: {
            countryName: { type: 'string' },
            indicatorSlug: { type: 'string' },
          },
          required: ['countryName', 'indicatorSlug'],
        },
      },
      {
        name: 'query_regional_average',
        description: 'Get the average value of an indicator across a region.',
        input_schema: {
          type: 'object' as const,
          properties: {
            region: { type: 'string', enum: ['NORTH_AFRICA', 'WEST_AFRICA', 'CENTRAL_AFRICA', 'EAST_AFRICA', 'SOUTHERN_AFRICA'] },
            indicatorSlug: { type: 'string' },
            year: { type: 'number', description: 'Optional year filter' },
          },
          required: ['region', 'indicatorSlug'],
        },
      },
      {
        name: 'query_comparison',
        description: 'Compare multiple countries across multiple indicators.',
        input_schema: {
          type: 'object' as const,
          properties: {
            countryNames: { type: 'array', items: { type: 'string' }, description: 'Country names to compare' },
            indicatorSlugs: { type: 'array', items: { type: 'string' }, description: 'Indicator slugs to compare on' },
          },
          required: ['countryNames', 'indicatorSlugs'],
        },
      },
      {
        name: 'search_data',
        description: 'Search for countries or indicators by name.',
        input_schema: {
          type: 'object' as const,
          properties: {
            term: { type: 'string', description: 'Search term' },
          },
          required: ['term'],
        },
      },
    ];
  }

  private async executeTool(toolName: string, input: any): Promise<any> {
    const typeMap: Record<string, string> = {
      query_country_data: 'country_data',
      query_indicator_ranking: 'indicator_ranking',
      query_time_series: 'time_series',
      query_regional_average: 'regional_average',
      query_comparison: 'comparison',
      search_data: 'search',
    };

    const type = typeMap[toolName];
    if (!type) return { error: 'Unknown tool' };

    try {
      return await this.contextService.executeDataQuery({ type: type as any, params: input });
    } catch (err: any) {
      return { error: `Tool execution failed: ${err.message}` };
    }
  }

  private parseAiResponse(text: string): AiAnswer {
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return {
        answer: parsed.answer || text,
        keyFindings: parsed.keyFindings || [],
        dataCitations: parsed.dataCitations || [],
        visualization: parsed.visualization || null,
        followUpQuestions: parsed.followUpQuestions || [],
        confidence: parsed.confidence || 0.9,
        dataAvailability: parsed.dataAvailability || 'partial',
        source: 'ai' as const,
      };
    } catch {
      return {
        answer: text,
        keyFindings: [],
        dataCitations: [],
        visualization: null,
        followUpQuestions: [],
        confidence: 0.8,
        dataAvailability: 'partial',
        source: 'ai' as const,
      };
    }
  }

  /**
   * Fallback when AI is not available — uses rule-based analysis
   */
  async fallbackAnswer(question: string, options?: any): Promise<AiAnswer> {
    const countries = await this.contextService.executeDataQuery({ type: 'search', params: { term: question } });

    let answer = 'I can help analyze African youth data. ';
    let visualization: any = null;

    if (countries?.countries?.length) {
      const country = countries.countries[0];
      const data = await this.contextService.executeDataQuery({
        type: 'country_data',
        params: { countryName: country.name },
      });
      if (data?.data?.length) {
        answer += `Here's what I found for ${country.name}:\n\n`;
        const topIndicators = data.data.slice(0, 10);
        answer += topIndicators.map((d: any) =>
          `- **${d.indicator}**: ${d.value} ${d.unit} (${d.year})`
        ).join('\n');

        visualization = {
          type: 'stat_cards',
          title: `Key Indicators — ${country.name}`,
          data: topIndicators.map((d: any) => ({
            label: d.indicator,
            value: `${d.value}`,
            unit: d.unit,
          })),
        };
      }
    } else {
      answer += 'Please try asking about a specific country, indicator, or region. For example: "What is the youth unemployment rate in Nigeria?" or "Compare education spending in East Africa."';
    }

    return {
      answer,
      keyFindings: [],
      dataCitations: [],
      visualization,
      followUpQuestions: [
        'What are the top 10 countries by Youth Index score?',
        'Compare youth unemployment in Nigeria and South Africa',
        'How has internet penetration changed in East Africa since 2010?',
      ],
      confidence: 0.6,
      dataAvailability: 'partial',
      source: 'rule-based' as const,
    };
  }
}

/**
 * Turn an Anthropic SDK error into a sentence an operator can act on. The
 * output of this is surfaced by /api/ops/status and read aloud by a voice
 * assistant, so it must never be a stack trace or a bare status code.
 */
function describeAnthropicError(err: any, model: string): string {
  const status = err?.status ?? err?.response?.status;
  const raw = String(err?.message ?? err ?? 'unknown error');

  if (status === 404 || /not_found|does not exist|model:/i.test(raw)) {
    return `The configured AI model "${model}" is not reachable on this Anthropic account. Every AI answer is silently falling back to the rule-based engine until AI_MODEL is changed to a current model.`;
  }
  if (status === 401 || status === 403) {
    return 'The Anthropic API key is rejected — it is invalid, revoked, or lacks access.';
  }
  if (status === 429) {
    return 'The Anthropic account is rate-limited right now. AI answers will be degraded until it clears.';
  }
  if (status === 400 && /credit|balance/i.test(raw)) {
    return 'The Anthropic account is out of credit. AI answers are disabled until it is topped up.';
  }
  if (status && status >= 500) {
    return "Anthropic's API is returning server errors. This is on their side, not yours.";
  }
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|fetch failed/i.test(raw)) {
    return 'The server cannot reach the Anthropic API — a network or DNS problem on the host.';
  }
  return `The AI call failed: ${raw}`;
}

export interface AiAnswer {
  answer: string;
  keyFindings: string[];
  dataCitations: { indicator: string; country?: string; value: number; year: number; source?: string }[];
  visualization: {
    type: 'bar_chart' | 'line_chart' | 'radar_chart' | 'pie_chart' | 'scatter_plot' | 'table' | 'stat_cards';
    title: string;
    data: any[];
    xAxis?: string;
    yAxis?: string;
    headers?: string[];
    rows?: string[][];
  } | null;
  followUpQuestions: string[];
  confidence: number;
  dataAvailability: 'full' | 'partial' | 'limited';
  source: 'ai' | 'rule-based';
}
