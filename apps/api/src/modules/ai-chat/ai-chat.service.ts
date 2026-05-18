import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../../prisma/prisma.service';
import { NlqService } from '../nlq/nlq.service';

export interface AiChatResponse {
  answer: string;
  /** First visualization (back-compat for older clients). */
  visualization?: object;
  /** All visualizations the assistant emitted, in order. New clients should
   *  prefer this — the assistant may attach multiple charts to a single answer. */
  visualizations?: object[];
  followUpQuestions?: string[];
  source: 'ai' | 'rule-based';
}

const REGION_LABEL: Record<string, string> = {
  NORTH_AFRICA: 'Northern Africa',
  WEST_AFRICA: 'Western Africa',
  CENTRAL_AFRICA: 'Central Africa',
  EAST_AFRICA: 'Eastern Africa',
  SOUTHERN_AFRICA: 'Southern Africa',
};

const SYSTEM_PROMPT = `You are the African Youth Observatory's research assistant — a knowledgeable, warm, and genuinely helpful partner for anyone researching African youth across education, employment, health, entrepreneurship, governance, and demographics. You cover all 54 African countries across 5 sub-regions (Northern, Western, Central, Eastern, Southern), drawing on the African Youth Charter (AYC), AU Agenda 2063 youth targets, the SDGs, and the platform's own AYIMS country-level indicators.

# Who you are
- This is a **research platform**. The people you talk to are students, researchers, policymakers, journalists, and civil-society practitioners. Treat every exchange as helping someone do real research.
- You are a thinking partner, not a database terminal. Converse in natural, plain language. Be encouraging and make research feel approachable and genuinely interesting — surface the "so what", the surprising contrast, the next question worth asking.
- You are proactive: when a question is broad, give a useful answer AND point to sharper angles the data on this platform can support.

# How to use the platform data
- A live <platform_data> snapshot of what currently exists on this platform is provided to you in a separate context block: the countries covered, the themes and indicators tracked, the latest Youth Index rankings, the policy-compliance picture, and which country reports are published and downloadable.
- Treat <platform_data> as ground truth about *what this platform holds right now*. When a user asks what's available, what the rankings are, which reports they can download, or anything the snapshot covers — answer from the snapshot, precisely.
- You may also draw on your broader knowledge of African development to add context, explain mechanisms, and interpret the numbers — but be explicit about the difference. Use phrasing like "On the platform, …" for snapshot facts and "More broadly, …" for general knowledge. Never present outside estimates as if they were platform data, and never contradict the snapshot.
- If the platform doesn't yet track something the user asked about, say so plainly and helpfully (e.g. "The platform doesn't track X yet, but it does have Y which is a close proxy — want me to pull that?").

# Reports & analysis
- When a user asks for a report, brief, comparison, or analysis, produce a well-structured research document: a short executive summary, then \`##\`/\`###\` sections, bullet findings, **bold** key numbers, and a closing "What this means / next steps" section.
- Build the analysis from the conversation so far plus the platform data — reference specific countries, indicators, years, and the platform's rankings/policy data. Offer to go deeper or narrow the scope at the end.
- Be specific: every claim should name a country, year, indicator, and source. Cite as "Kenya, youth literacy 82.6% (UNESCO UIS, 2022)".

# Tone & structure
- For quick questions: a direct 1–3 sentence answer first, then optional supporting bullets.
- For analyses/reports: markdown with an executive summary up top.
- Keep it human — no robotic "As an AI" hedging. Be confident, cite sources, and admit uncertainty honestly when data is thin.

# Visualizations — VERY IMPORTANT
When a question is comparative, ranked, time-series, distributional, or part-of-a-whole, **attach an inline visualization** by appending a fenced JSON block (or several) anywhere in the answer. You can attach **multiple** charts in one response when each illuminates a different angle.

Block syntax:
\`\`\`json
{ "type": "<chart-type>", "title": "<short title>", ...other fields }
\`\`\`

## Chart-type playbook (pick the right one)

**bar** — rankings or one-axis comparisons across countries/categories.
- Single series: \`"data":[{"name":"Kenya","value":82.6},{"name":"Nigeria","value":75.0}]\`
- Multi-series: same shape but each item has multiple numeric keys, e.g. \`"data":[{"name":"Kenya","male":85,"female":82},{"name":"Nigeria","male":78,"female":72}]\`. Every numeric key (other than \`name\`) becomes its own coloured bar group, so use clean keys like \`youth\`, \`adult\`, \`male\`, \`female\`, \`urban\`, \`rural\`, or specific years (\`"2018":62,"2024":74\`).
- Use for: "top 5 countries by X", "compare A vs B across indicators", "youth vs adult unemployment".

**line** — trends over time. Use when the data is naturally ordered.
- Single series: \`"data":[{"year":2018,"value":42},{"year":2019,"value":45},…]\`
- Multi-series: \`"data":[{"year":2018,"Kenya":42,"Nigeria":38},{"year":2019,"Kenya":45,"Nigeria":40}]\` — every numeric key beyond the x-axis becomes a coloured line.
- Use for: "trend over the last decade", "trajectory of literacy in West Africa".

**area** — same data shape as line; renderer treats it like a line. Use when emphasizing magnitude.

**pie** — parts of a whole. Items sum to 100%, or to a meaningful total. Use sparingly (≤6 slices) — bar is usually clearer.
- \`"data":[{"name":"Employed","value":34},{"name":"NEET","value":29},{"name":"In school","value":37}]\`

**radar** — comparing one or two entities across 4–8 dimensions.
- \`"data":[{"name":"Education","Kenya":78,"Nigeria":65},{"name":"Employment","Kenya":52,"Nigeria":48},…]\`
- Use for: AYEMI dimension scores, country-vs-country profile.

**scatter** — relationship between two variables across many countries.
- \`"data":[{"x":42,"y":68,"name":"Kenya"},{"x":33,"y":54,"name":"Nigeria"},…]\` with \`xAxis\`/\`yAxis\` labels.

**table** — when ≥3 columns matter and ranking by one metric isn't the point.
- \`{"type":"table","title":"Top 10 by Youth Literacy","columns":["Country","Literacy","Year","Source"],"rows":[["Kenya","82.6%","2022","UIS"],["Nigeria","75.0%","2022","UIS"]]}\`

**stat_cards** — 3–6 headline numbers, e.g. summary at top of a country profile.
- \`"data":[{"label":"Youth pop.","value":"3.2M","unit":"15–35"},{"label":"Literacy","value":"82.6","unit":"%","change":2.1},{"label":"Unemployment","value":"19.4","unit":"%","change":-1.4}]\`

## Visualization rules
- ALWAYS include \`"title"\` — short, neutral, descriptive ("Youth literacy by country, 2022", not "Bar chart").
- Use real country names, not codes. Cap rankings at the top 10 unless the user asked for more.
- For multi-series charts, keep the number of series ≤4 so colours stay readable.
- For time series, use 4-digit years as numbers (\`"year":2024\`), not strings.
- If you can't find solid data for a viz, **don't fabricate one**. Just answer in prose and skip the chart.
- It is fine — and often better — to attach **two charts side by side**: e.g. a bar chart of current rankings + a line chart of the trend. Just include two fenced JSON blocks.

# When to refuse a viz
- Single value answers ("What is X for one country?") — no chart, just say the number.
- Open-ended policy/qualitative questions — answer in prose, no chart.
- Anything where the user explicitly asks for "no chart" or "just text".`;

// Default model when AI_MODEL is unset. Anthropic's model registry rotates;
// keep this on a current Sonnet ID so a fresh deploy works without env tuning.
const DEFAULT_AI_MODEL = 'claude-sonnet-4-5';

const PLATFORM_CONTEXT_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);
  private anthropic: Anthropic | null = null;
  private model: string = DEFAULT_AI_MODEL;
  private platformContextCache: { text: string; expiry: number } | null = null;

  constructor(
    private readonly nlqService: NlqService,
    private readonly prisma: PrismaService,
  ) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    this.model = process.env.AI_MODEL || DEFAULT_AI_MODEL;
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
      this.logger.log(`Anthropic API client initialized (model=${this.model})`);
    } else {
      this.logger.warn(
        'ANTHROPIC_API_KEY not configured — AI chat will fall back to NLQ rule-based service',
      );
    }
  }

  async chat(
    message: string,
    context?: string,
    history?: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Promise<AiChatResponse> {
    if (this.anthropic) {
      try {
        return await this.callClaude(message, context, history);
      } catch (error) {
        this.logger.error(`Claude API call failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return this.fallbackToNlq(message);
  }

  /**
   * Builds a compact, token-budgeted snapshot of what the platform currently
   * holds, so Claude can ground its research help in the live database instead
   * of guessing from training data alone. Cached for 10 minutes — the
   * underlying data changes on the order of uploads, not requests.
   */
  private async getPlatformContext(): Promise<string> {
    const now = Date.now();
    if (this.platformContextCache && now < this.platformContextCache.expiry) {
      return this.platformContextCache.text;
    }

    try {
      const [
        countryCount,
        indicatorCount,
        dataPointCount,
        themes,
        countries,
        latestIndexYearRow,
        policies,
        reportDocs,
      ] = await Promise.all([
        this.prisma.country.count(),
        this.prisma.indicator.count(),
        this.prisma.indicatorValue.count(),
        this.prisma.theme.findMany({
          orderBy: { sortOrder: 'asc' },
          select: {
            name: true,
            indicators: { select: { name: true } },
          },
        }),
        this.prisma.country.findMany({
          select: { name: true, region: true },
          orderBy: { name: 'asc' },
        }),
        this.prisma.youthIndexScore.findFirst({
          orderBy: { year: 'desc' },
          select: { year: true },
        }),
        this.prisma.countryPolicy.findMany({
          select: {
            aycRatified: true,
            wpayCompliant: true,
            complianceScore: true,
            yearAdopted: true,
            country: { select: { name: true } },
          },
        }),
        this.prisma.document.findMany({
          where: {
            type: { in: ['PKPB_REPORT', 'COUNTRY_REPORT'] },
            status: 'PUBLISHED',
          },
          select: {
            title: true,
            year: true,
            country: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 80,
        }),
      ]);

      const indexYear = latestIndexYearRow?.year;
      const rankings = indexYear
        ? await this.prisma.youthIndexScore.findMany({
            where: { year: indexYear },
            orderBy: { rank: 'asc' },
            select: {
              rank: true,
              overallScore: true,
              tier: true,
              country: { select: { name: true } },
            },
          })
        : [];

      // Year coverage from indicator values.
      const yearAgg = await this.prisma.indicatorValue.aggregate({
        _min: { year: true },
        _max: { year: true },
      });

      // ---- Assemble the snapshot ----
      const lines: string[] = [];
      lines.push('# AFRICAN YOUTH OBSERVATORY — LIVE PLATFORM SNAPSHOT');
      lines.push(
        `Scale: ${countryCount} countries · ${indicatorCount} indicators · ${dataPointCount.toLocaleString()} data points · ${themes.length} themes · data years ${yearAgg._min.year ?? '—'}–${yearAgg._max.year ?? '—'}.`,
      );

      // Regions → countries
      const byRegion = new Map<string, string[]>();
      for (const c of countries) {
        const key = REGION_LABEL[c.region] ?? c.region;
        if (!byRegion.has(key)) byRegion.set(key, []);
        byRegion.get(key)!.push(c.name);
      }
      lines.push('');
      lines.push('## Countries by sub-region');
      for (const [region, names] of byRegion) {
        lines.push(`- **${region}** (${names.length}): ${names.join(', ')}`);
      }

      // Themes + indicators
      lines.push('');
      lines.push('## Themes & tracked indicators');
      for (const t of themes) {
        const inds = t.indicators.map((i) => i.name);
        lines.push(`- **${t.name}**: ${inds.length ? inds.join(', ') : 'no indicators yet'}`);
      }

      // Youth Index rankings
      if (rankings.length) {
        lines.push('');
        lines.push(`## African Youth Index — ${indexYear} rankings (overall score /100, tier)`);
        const top = rankings.slice(0, 15);
        for (const r of top) {
          lines.push(
            `${r.rank}. ${r.country.name} — ${r.overallScore.toFixed(1)} (${r.tier})`,
          );
        }
        if (rankings.length > 15) {
          const bottom = rankings.slice(-5);
          lines.push('…');
          for (const r of bottom) {
            lines.push(
              `${r.rank}. ${r.country.name} — ${r.overallScore.toFixed(1)} (${r.tier})`,
            );
          }
        }
      }

      // Policy snapshot
      if (policies.length) {
        const ratified = policies.filter((p) => p.aycRatified).length;
        const wpay = policies.filter((p) => p.wpayCompliant).length;
        const scored = policies
          .map((p) => p.complianceScore)
          .filter((s): s is number => typeof s === 'number');
        const avg = scored.length
          ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length)
          : null;
        const topPolicy = [...policies]
          .filter((p) => typeof p.complianceScore === 'number')
          .sort((a, b) => (b.complianceScore ?? 0) - (a.complianceScore ?? 0))
          .slice(0, 5);
        lines.push('');
        lines.push('## Policy compliance (AYC / WPAY / national youth policy)');
        lines.push(
          `Tracked: ${policies.length} · AYC ratified: ${ratified} · WPAY-aligned: ${wpay}${avg != null ? ` · avg compliance ${avg}/100` : ''}.`,
        );
        if (topPolicy.length) {
          lines.push(
            `Top compliance: ${topPolicy
              .map((p) => `${p.country.name} (${Math.round(p.complianceScore ?? 0)})`)
              .join(', ')}.`,
          );
        }
      }

      // Downloadable reports
      if (reportDocs.length) {
        const byCountry = new Map<string, string>();
        for (const d of reportDocs) {
          const cn = d.country?.name ?? 'Continental / multi-country';
          if (!byCountry.has(cn)) {
            byCountry.set(cn, `${d.title}${d.year ? ` (${d.year})` : ''}`);
          }
        }
        lines.push('');
        lines.push(
          `## Published reports available to download (${byCountry.size})`,
        );
        lines.push(
          [...byCountry.entries()]
            .map(([cn, title]) => `- ${cn}: ${title}`)
            .join('\n'),
        );
      }

      lines.push('');
      lines.push(
        'When the user asks "what data / which reports / what does the platform have", answer from this snapshot. It refreshes periodically; if something looks missing it may simply not be uploaded yet.',
      );

      const text = lines.join('\n');
      this.platformContextCache = {
        text,
        expiry: now + PLATFORM_CONTEXT_TTL_MS,
      };
      return text;
    } catch (error) {
      this.logger.error(
        `Failed to build platform context: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Non-fatal — Claude can still help from the base prompt.
      return '';
    }
  }

  private async callClaude(
    message: string,
    context?: string,
    history?: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Promise<AiChatResponse> {
    const userContent = context
      ? `Context from uploaded document:\n${context}\n\nUser question: ${message}`
      : message;

    const conversationMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...(history || []),
      { role: 'user', content: userContent },
    ];

    if (!this.anthropic) throw new Error('Anthropic client not initialized');

    const platformContext = await this.getPlatformContext();

    // System is sent as cacheable blocks: the static instructions + the
    // (10-min-stable) platform snapshot. Marking the last block with
    // cache_control lets Anthropic prompt-cache the whole prefix, so every
    // follow-up turn in a session is faster and cheaper.
    const systemBlocks: Anthropic.TextBlockParam[] = [
      { type: 'text', text: SYSTEM_PROMPT },
    ];
    if (platformContext) {
      systemBlocks.push({
        type: 'text',
        text: `<platform_data>\n${platformContext}\n</platform_data>`,
        cache_control: { type: 'ephemeral' },
      });
    } else {
      systemBlocks[0].cache_control = { type: 'ephemeral' };
    }

    const response = await this.anthropic.messages.create({
      model: this.model,
      // Bumped from 2048 → 4096 because the new viz playbook can produce
      // multi-chart answers with structured data arrays; truncating mid-JSON
      // would surface as a parse failure and lose the visualization.
      max_tokens: 4096,
      system: systemBlocks,
      messages: conversationMessages,
    });

    const rawText = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    // Extract every fenced JSON visualization block — the assistant is
    // encouraged to attach more than one chart per answer (e.g. ranking +
    // trend), so we surface them all and strip every block from the prose.
    const visualizations = this.extractAllVisualizations(rawText);
    const answer = visualizations.length
      ? rawText.replace(/```json\s*\{[\s\S]*?\}\s*```/g, '').trim()
      : rawText;

    return {
      answer,
      // Back-compat: older clients only consume `visualization` (singular).
      visualization: visualizations[0] || undefined,
      visualizations: visualizations.length ? visualizations : undefined,
      followUpQuestions: this.generateFollowUps(message),
      source: 'ai',
    };
  }

  private async fallbackToNlq(message: string): Promise<AiChatResponse> {
    this.logger.log('Falling back to NLQ rule-based service');

    const nlqResult = await this.nlqService.processQuery(message);

    return {
      answer: nlqResult.answer,
      visualization: nlqResult.visualization || undefined,
      followUpQuestions: nlqResult.followUpQuestions,
      source: 'rule-based',
    };
  }

  private extractVisualization(text: string): object | null {
    const jsonMatch = text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
    if (!jsonMatch) return null;

    try {
      return JSON.parse(jsonMatch[1]);
    } catch {
      return null;
    }
  }

  /**
   * Extracts every fenced JSON block in the assistant's text and returns
   * the ones that look like visualization payloads (have a `type` and a
   * `data` array, OR are a `table` with `rows`). Blocks that don't parse
   * or don't fit either shape are silently dropped — we'd rather miss a
   * malformed chart than corrupt the rendered prose.
   */
  private extractAllVisualizations(text: string): object[] {
    const re = /```json\s*(\{[\s\S]*?\})\s*```/g;
    const out: object[] = [];
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        if (!parsed || typeof parsed !== 'object') continue;
        const looksLikeViz =
          typeof (parsed as any).type === 'string' &&
          (Array.isArray((parsed as any).data) ||
            ((parsed as any).type === 'table' && Array.isArray((parsed as any).rows)));
        if (looksLikeViz) out.push(parsed);
      } catch {
        // skip malformed JSON
      }
    }
    return out;
  }

  private generateFollowUps(message: string): string[] {
    const q = message.toLowerCase();

    const followUps: string[] = [];

    if (/unemployment|employment|jobs/.test(q)) {
      followUps.push('Which African countries have the lowest youth unemployment?');
      followUps.push('How has youth employment changed over the last decade?');
      followUps.push('What is the relationship between education and youth employment in Africa?');
    } else if (/education|school|literacy/.test(q)) {
      followUps.push('Which countries have the highest youth literacy rates?');
      followUps.push('How does education spending correlate with enrollment rates?');
      followUps.push('What are the gender gaps in education across Africa?');
    } else if (/health|mortality|fertility/.test(q)) {
      followUps.push('Which regions have the best youth health outcomes?');
      followUps.push('How has adolescent fertility changed over time?');
      followUps.push('What is the HIV prevalence rate among African youth?');
    } else {
      followUps.push('What are the top challenges facing African youth today?');
      followUps.push('Which countries rank highest on the Youth Development Index?');
      followUps.push('How does internet access vary across African regions?');
    }

    return followUps.slice(0, 3);
  }
}
