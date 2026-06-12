import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { NewsletterCampaignStatus, NewsletterAudience } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { R2Service } from '../content/r2.service';
import {
  SubscribeDto,
  CreateCampaignDto,
  UpdateCampaignDto,
  ListSubscribersDto,
} from './newsletter.dto';

type AttachmentLink = { label: string; url: string; sizeHint?: string };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Public, absolute base for the unsubscribe link embedded in every broadcast.
// Deliberately points at the API (not FRONTEND_URL) so one-click unsubscribe
// works even when FRONTEND_URL is misconfigured (it currently defaults to
// localhost) and without depending on SPA routing.
const PUBLIC_API_URL =
  process.env.PUBLIC_API_URL || 'https://african-youth-observatory.onrender.com';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly r2: R2Service,
  ) {}

  // ── Attachment upload ─────────────────────────────────────
  // Admins pick a file in the editor; we store it (R2 in prod, local-disk
  // fallback in dev), then return a shape the campaign can save directly into
  // its attachments[] array. Files are LINKED from the email, not attached —
  // works for any size and keeps emails fast.
  async uploadAttachment(
    file: Express.Multer.File,
  ): Promise<{ label: string; url: string; sizeHint: string }> {
    if (!file?.buffer) {
      throw new BadRequestException('No file received');
    }
    if (file.size > 25 * 1024 * 1024) {
      throw new BadRequestException('File is larger than 25 MB');
    }
    const stored = await this.r2.uploadFile(file, 'newsletter');
    // r2.uploadFile returns url=null on the local-disk fallback (dev without
    // R2). We still emit a usable link via /api/content/r2/object/<key> so
    // recipients can download — but flag it in the sizeHint for visibility.
    const url =
      stored.url ??
      `${process.env.PUBLIC_API_URL || 'http://localhost:3001'}/api/content/r2/object/${encodeURIComponent(stored.key)}`;
    const ext = (file.originalname.split('.').pop() || '').toUpperCase().slice(0, 6);
    return {
      label: file.originalname,
      url,
      sizeHint: ext ? `${formatBytes(file.size)} · ${ext}` : formatBytes(file.size),
    };
  }

  private unsubscribeUrl(token: string): string {
    return `${PUBLIC_API_URL}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
  }

  // ── Subscribe ──────────────────────────────────────────────
  /**
   * Idempotent: re-subscribing the same email is a no-op (status flipped back
   * to SUBSCRIBED if previously unsubscribed). A confirmation email and an
   * admin notice are sent fire-and-forget — a mail failure must never break
   * the DB write or the form UX.
   */
  async subscribe(dto: SubscribeDto) {
    const email = dto.email.trim().toLowerCase();

    // Core write only — deliberately does NOT touch unsubscribeToken so this
    // keeps working on a DB that hasn't run the migration yet. If even this
    // fails, the table itself is missing and the form should show an error.
    let row: { id: string };
    try {
      row = await this.prisma.newsletterSubscription.upsert({
        where: { email },
        create: { email, source: dto.source ?? null, status: 'SUBSCRIBED' },
        update: {
          status: 'SUBSCRIBED',
          unsubscribedAt: null,
          // keep the original source — it tells us what worked first
          source: undefined,
        },
        select: { id: true },
      });
    } catch (err) {
      this.logger.error(`newsletter subscribe failed for ${email}: ${(err as Error).message}`);
      return { ok: false, message: 'Subscription failed. Please try again later.' };
    }

    // Token + emails are best-effort and MUST NOT affect the result. They
    // tolerate an un-migrated DB (no unsubscribeToken column yet).
    this.postSubscribe(row.id, email, dto.source).catch((e) =>
      this.logger.warn(`post-subscribe side effects failed for ${email}: ${e?.message}`),
    );
    return { ok: true };
  }

  /** Best-effort token backfill + confirmation/admin emails. Never throws. */
  private async postSubscribe(id: string, email: string, source?: string | null) {
    let token: string | null = null;
    try {
      const cur = await this.prisma.newsletterSubscription.findUnique({
        where: { id },
        select: { unsubscribeToken: true },
      });
      token = cur?.unsubscribeToken ?? (await this.ensureToken(id));
    } catch (e) {
      this.logger.warn(
        `unsubscribe token unavailable for ${email} (DB not migrated?): ${(e as Error).message}`,
      );
    }
    if (token) {
      this.mail
        .sendNewsletterConfirmation(email, this.unsubscribeUrl(token))
        .catch((e) => this.logger.warn(`confirmation email failed for ${email}: ${e?.message}`));
    }
    this.mail
      .sendNewSubscriberNotice(email, source)
      .catch((e) => this.logger.warn(`admin notice failed for ${email}: ${e?.message}`));
  }

  private async ensureToken(id: string): Promise<string> {
    const token = randomUUID();
    await this.prisma.newsletterSubscription.update({
      where: { id },
      data: { unsubscribeToken: token },
    });
    return token;
  }

  // ── Unsubscribe ────────────────────────────────────────────
  async unsubscribe(token: string): Promise<{ ok: boolean; email?: string }> {
    if (!token) return { ok: false };
    const sub = await this.prisma.newsletterSubscription.findUnique({
      where: { unsubscribeToken: token },
    });
    if (!sub) return { ok: false };
    if (sub.status !== 'UNSUBSCRIBED') {
      await this.prisma.newsletterSubscription.update({
        where: { id: sub.id },
        data: { status: 'UNSUBSCRIBED', unsubscribedAt: new Date() },
      });
    }
    return { ok: true, email: sub.email };
  }

  // ── Subscriber stats (admin) ───────────────────────────────
  async subscriberStats() {
    const grouped = await this.prisma.newsletterSubscription.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const stats = { SUBSCRIBED: 0, UNSUBSCRIBED: 0, BOUNCED: 0, total: 0 };
    for (const g of grouped) {
      stats[g.status] = g._count._all;
      stats.total += g._count._all;
    }
    return stats;
  }

  // ── Campaign CRUD + workflow (admin) ───────────────────────
  listCampaigns() {
    return this.prisma.newsletterCampaign.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async getCampaign(id: string) {
    const c = await this.prisma.newsletterCampaign.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Campaign not found');
    return c;
  }

  createDraft(dto: CreateCampaignDto, userId?: string) {
    return this.prisma.newsletterCampaign.create({
      data: {
        title: dto.title.trim(),
        subject: dto.subject.trim(),
        bodyHtml: dto.bodyHtml,
        audience: dto.audience ?? 'SUBSCRIBERS',
        attachments: dto.attachments ? (dto.attachments as any) : undefined,
        status: 'DRAFT',
        createdById: userId ?? null,
      },
    });
  }

  async updateDraft(id: string, dto: UpdateCampaignDto) {
    const c = await this.getCampaign(id);
    if (!['DRAFT', 'PENDING_APPROVAL'].includes(c.status)) {
      throw new BadRequestException(`Cannot edit a campaign that is ${c.status}`);
    }
    return this.prisma.newsletterCampaign.update({
      where: { id },
      data: {
        title: dto.title?.trim() ?? undefined,
        subject: dto.subject?.trim() ?? undefined,
        bodyHtml: dto.bodyHtml ?? undefined,
        audience: dto.audience ?? undefined,
        // Pass through verbatim; pass null to clear, undefined to leave alone.
        attachments: dto.attachments === undefined ? undefined : (dto.attachments as any),
      },
    });
  }

  async submitForApproval(id: string) {
    const c = await this.getCampaign(id);
    if (c.status !== 'DRAFT') {
      throw new BadRequestException(`Only a DRAFT can be submitted (this is ${c.status})`);
    }
    const updated = await this.prisma.newsletterCampaign.update({
      where: { id },
      data: { status: 'PENDING_APPROVAL', submittedAt: new Date() },
    });
    this.mail
      .sendBriefingApprovalRequest({ id: c.id, title: c.title, subject: c.subject })
      .catch((e) => this.logger.warn(`approval-request email failed: ${e?.message}`));
    return updated;
  }

  async cancel(id: string) {
    const c = await this.getCampaign(id);
    if (['SENDING', 'SENT'].includes(c.status)) {
      throw new BadRequestException(`Cannot cancel a campaign that is ${c.status}`);
    }
    return this.prisma.newsletterCampaign.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  /** Restore a CANCELLED campaign back to DRAFT — powers the "Undo" toast. */
  async restore(id: string) {
    const c = await this.getCampaign(id);
    if (c.status !== 'CANCELLED') {
      throw new BadRequestException(`Only a CANCELLED campaign can be restored (this is ${c.status})`);
    }
    return this.prisma.newsletterCampaign.update({
      where: { id },
      data: { status: 'DRAFT' },
    });
  }

  /** Hard-delete a campaign. Guarded: never lose history for sent broadcasts. */
  async hardDelete(id: string) {
    const c = await this.getCampaign(id);
    if (!['DRAFT', 'CANCELLED'].includes(c.status)) {
      throw new BadRequestException(
        `Only DRAFT or CANCELLED campaigns can be permanently deleted (this is ${c.status}).`,
      );
    }
    await this.prisma.newsletterCampaign.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Admin approval is the ONLY gate that releases a briefing to the list.
   * We flip to APPROVED, then dispatch in the background so the HTTP request
   * returns immediately (Render kills long requests; the admin UI polls).
   */
  async approve(id: string, userId?: string) {
    if (!this.mail.isConfigured) {
      throw new BadRequestException(
        'Email service is not configured (RESEND_API_KEY missing) — cannot send.',
      );
    }
    const c = await this.getCampaign(id);
    if (c.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException(
        `Only a campaign pending approval can be approved (this is ${c.status})`,
      );
    }
    const updated = await this.prisma.newsletterCampaign.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedById: userId ?? null,
      },
    });
    // Background dispatch — do not await.
    this.dispatch(id).catch((e) =>
      this.logger.error(`dispatch failed for campaign ${id}: ${e?.message}`),
    );
    return updated;
  }

  /**
   * Ad-hoc broadcast used by the insight-reports feature: create an already-
   * APPROVED campaign from a pre-built body and dispatch it in the background to
   * the chosen audience (SUBSCRIBERS | USERS | BOTH). Reuses the same dispatch +
   * dedupe + unsubscribe-token machinery as the monthly briefing. Returns the
   * campaign row so the caller can report recipientCount / poll status.
   */
  async broadcastAdHoc(opts: {
    title: string;
    subject: string;
    bodyHtml: string;
    audience: NewsletterAudience;
    attachments?: AttachmentLink[] | null;
  }) {
    if (!this.mail.isConfigured) {
      throw new BadRequestException(
        'Email service is not configured (RESEND_API_KEY missing) — cannot send.',
      );
    }
    const campaign = await this.prisma.newsletterCampaign.create({
      data: {
        title: opts.title.trim(),
        subject: opts.subject.trim(),
        bodyHtml: opts.bodyHtml,
        audience: opts.audience,
        attachments: opts.attachments ? (opts.attachments as any) : undefined,
        status: 'APPROVED',
        approvedAt: new Date(),
      },
    });
    // Background dispatch — do not await (Render kills long requests).
    this.dispatch(campaign.id).catch((e) =>
      this.logger.error(`ad-hoc dispatch failed for campaign ${campaign.id}: ${e?.message}`),
    );
    return campaign;
  }

  /** Render the exact HTML recipients will receive (used by the preview UI). */
  async previewHtml(id: string): Promise<string> {
    const c = await this.getCampaign(id);
    const kind: 'subscriber' | 'user' = c.audience === 'USERS' ? 'user' : 'subscriber';
    return this.mail.renderBriefing({
      subject: c.subject,
      innerHtml: c.bodyHtml,
      unsubscribeUrl: kind === 'subscriber'
        ? this.unsubscribeUrl('preview-token-not-a-real-subscriber')
        : null,
      audienceKind: kind,
      attachments: this.coerceAttachments(c.attachments),
    });
  }

  async sendTest(id: string, toEmail: string) {
    if (!this.mail.isConfigured) {
      throw new BadRequestException('Email service is not configured (RESEND_API_KEY missing).');
    }
    const c = await this.getCampaign(id);
    const kind: 'subscriber' | 'user' = c.audience === 'USERS' ? 'user' : 'subscriber';
    await this.mail.sendBriefing({
      to: toEmail,
      subject: `[TEST] ${c.subject}`,
      innerHtml: c.bodyHtml,
      unsubscribeUrl: kind === 'subscriber'
        ? this.unsubscribeUrl('test-token-not-a-real-subscriber')
        : null,
      audienceKind: kind,
      attachments: this.coerceAttachments(c.attachments),
    });
    await this.prisma.newsletterCampaign.update({
      where: { id },
      data: { testSentTo: toEmail },
    });
    return { ok: true, sentTo: toEmail };
  }

  /** Defensive: the attachments column is Json — only let through well-formed rows. */
  private coerceAttachments(json: any): AttachmentLink[] | null {
    if (!json || !Array.isArray(json)) return null;
    const out = json
      .filter((a) => a && typeof a.label === 'string' && typeof a.url === 'string')
      .map((a) => ({ label: a.label, url: a.url, sizeHint: a.sizeHint }));
    return out.length ? out : null;
  }

  // ── Subscribers log (admin) ────────────────────────────────
  async listSubscribers(query: ListSubscribersDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.search?.trim()) {
      where.email = { contains: query.search.trim().toLowerCase(), mode: 'insensitive' };
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.newsletterSubscription.count({ where }),
      this.prisma.newsletterSubscription.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          source: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          unsubscribedAt: true,
        },
      }),
    ]);
    return {
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      rows,
    };
  }

  // ── The actual broadcast ───────────────────────────────────
  // Sequential with a delay so we stay under Resend's request-rate limit.
  // For very large lists this is slow but correct; batching can replace it
  // later (resend.batch.send, 100/call).
  private async dispatch(id: string) {
    const c = await this.prisma.newsletterCampaign.findUnique({ where: { id } });
    if (!c || c.status !== 'APPROVED') return;

    const attachments = this.coerceAttachments(c.attachments);
    const audience = c.audience as NewsletterAudience;

    // Build a deduped recipient list. Subscribers come first so they "win" the
    // dedupe and get the proper unsubscribe link, even when audience is BOTH.
    type Recip = {
      email: string;
      kind: 'subscriber' | 'user';
      token: string | null;
      subId?: string;
    };
    const recipMap = new Map<string, Recip>();

    if (audience === 'SUBSCRIBERS' || audience === 'BOTH') {
      const subs = await this.prisma.newsletterSubscription.findMany({
        where: { status: 'SUBSCRIBED' },
        select: { id: true, email: true, unsubscribeToken: true },
      });
      for (const s of subs) {
        const email = s.email.toLowerCase();
        if (!recipMap.has(email)) {
          recipMap.set(email, { email, kind: 'subscriber', token: s.unsubscribeToken, subId: s.id });
        }
      }
    }
    if (audience === 'USERS' || audience === 'BOTH') {
      const users = await this.prisma.user.findMany({
        select: { email: true },
      });
      for (const u of users) {
        const email = u.email?.toLowerCase();
        if (!email) continue;
        if (!recipMap.has(email)) {
          recipMap.set(email, { email, kind: 'user', token: null });
        }
      }
    }

    const recipients = [...recipMap.values()];
    await this.prisma.newsletterCampaign.update({
      where: { id },
      data: {
        status: 'SENDING',
        recipientCount: recipients.length,
        sentCount: 0,
        failedCount: 0,
      },
    });

    let sent = 0;
    let failed = 0;
    for (const r of recipients) {
      // Subscribers need a token before sending. Backfill if absent (best-effort).
      let token = r.token;
      if (r.kind === 'subscriber' && !token && r.subId) {
        try {
          token = await this.ensureToken(r.subId);
        } catch (e) {
          this.logger.warn(`token backfill failed for ${r.email}: ${(e as Error).message}`);
        }
      }
      try {
        await this.mail.sendBriefing({
          to: r.email,
          subject: c.subject,
          innerHtml: c.bodyHtml,
          unsubscribeUrl: r.kind === 'subscriber' && token ? this.unsubscribeUrl(token) : null,
          audienceKind: r.kind,
          attachments,
        });
        sent++;
      } catch (e) {
        failed++;
        this.logger.warn(`briefing send failed for ${r.email}: ${(e as Error).message}`);
      }
      if ((sent + failed) % 10 === 0) {
        await this.prisma.newsletterCampaign.update({
          where: { id },
          data: { sentCount: sent, failedCount: failed },
        });
      }
      await sleep(600); // ≈1.6 msg/s — under Resend's default 2 req/s cap
    }

    const status: NewsletterCampaignStatus =
      sent === 0 && recipients.length > 0 ? 'FAILED' : 'SENT';
    await this.prisma.newsletterCampaign.update({
      where: { id },
      data: {
        status,
        sentCount: sent,
        failedCount: failed,
        sentAt: new Date(),
        error: status === 'FAILED' ? 'All sends failed — check Resend config/domain.' : null,
      },
    });
    this.logger.log(
      `Campaign ${id} (audience=${audience}) finished: ${sent} sent, ${failed} failed`,
    );
  }

  // ── Monthly auto-draft (called by the scheduler or admin) ──
  /**
   * Idempotent per calendar month via the unique periodKey. If a draft for the
   * current month already exists, returns it (no duplicate). Otherwise builds
   * a starter briefing — Claude writes it from a live data context, with a
   * static fallback if the AI call fails or no API key is configured —
   * creates it as DRAFT, then submits it for admin approval.
   *
   * Returns { campaign, isNew } so the caller can tell admins whether a fresh
   * draft was generated or whether the existing one was returned untouched.
   */
  async generateMonthlyDraft(now: Date = new Date()) {
    const periodKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const existing = await this.prisma.newsletterCampaign.findUnique({ where: { periodKey } });
    if (existing) {
      this.logger.log(`Monthly draft for ${periodKey} already exists (${existing.id})`);
      return { campaign: existing, isNew: false };
    }

    const monthName = now.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const stats = await this.subscriberStats();
    const bodyHtml = await this.composeMonthlyBody(monthName);

    const campaign = await this.prisma.newsletterCampaign.create({
      data: {
        periodKey,
        title: `${monthName} Youth Briefing`,
        subject: `African youth data — ${monthName} briefing`,
        bodyHtml,
        status: 'DRAFT',
      },
    });
    this.logger.log(
      `Generated monthly draft ${campaign.id} for ${periodKey} (${stats.SUBSCRIBED} subscribers)`,
    );
    // Route through the normal submit path so the admin gets the approval email.
    await this.submitForApproval(campaign.id);
    const full = await this.getCampaign(campaign.id);
    return { campaign: full, isNew: true };
  }

  private async composeMonthlyBody(monthName: string): Promise<string> {
    // Try Claude first — it produces a much warmer, more analytical draft than
    // a static table. Fall back to the static template if the AI call fails
    // for any reason (no API key, rate limit, malformed output, etc.). The
    // admin can edit before approval either way.
    try {
      const context = await this.buildBriefingContext();
      const aiBody = await this.generateBodyWithAI(monthName, context);
      if (aiBody && aiBody.trim().length > 100) return aiBody + this.draftWatermark();
    } catch (e) {
      this.logger.warn(`AI draft generation failed, falling back to static: ${(e as Error).message}`);
    }
    return this.composeStaticBody(monthName);
  }

  private draftWatermark(): string {
    return `<p><em>This is an auto-generated draft. Edit before approving.</em></p>`;
  }

  /** Gather the live data the AI will reason over. Plain-text, compact. */
  private async buildBriefingContext(): Promise<string> {
    const latest = await this.prisma.youthIndexScore.findFirst({
      orderBy: { year: 'desc' },
      select: { year: true },
    });
    const stats = await this.subscriberStats();

    let ctx = `Subscribers on the list: ${stats.SUBSCRIBED}.\n`;

    if (latest?.year) {
      const top = await this.prisma.youthIndexScore.findMany({
        where: { year: latest.year },
        orderBy: { rank: 'asc' },
        take: 5,
        include: { country: { select: { name: true } } },
      });
      ctx += `\nLatest Youth Index year: ${latest.year}.\nTop 5 ranked countries:\n`;
      for (const t of top) {
        const d = (t.dimensionScores && typeof t.dimensionScores === 'object')
          ? (t.dimensionScores as Record<string, number>)
          : {};
        const fmt = (slug: string) => (typeof d[slug] === 'number' ? d[slug] : 50).toFixed(1);
        ctx += `- #${t.rank} ${t.country?.name ?? 'Unknown'} — score ${t.overallScore.toFixed(1)} (Education ${fmt('education')}, Employment ${fmt('employment')}, Health ${fmt('health')}, Entrepreneurship ${fmt('entrepreneurship')})\n`;
      }
      // Biggest movers up
      const movers = await this.prisma.youthIndexScore.findMany({
        where: { year: latest.year, rankChange: { not: null } },
        orderBy: { rankChange: 'desc' },
        take: 3,
        include: { country: { select: { name: true } } },
      });
      if (movers.length) {
        ctx += `\nBiggest rank gainers vs previous year:\n`;
        for (const m of movers) {
          if ((m.rankChange ?? 0) <= 0) continue;
          ctx += `- ${m.country?.name ?? 'Unknown'}: gained ${m.rankChange} positions to #${m.rank}\n`;
        }
      }
    } else {
      ctx += `\nNo Youth Index data computed yet — keep the briefing forward-looking and brief.\n`;
    }
    return ctx;
  }

  private async generateBodyWithAI(monthName: string, context: string): Promise<string> {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
    const client = new Anthropic();
    const model = process.env.AI_MODEL || 'claude-sonnet-4-5';

    const systemPrompt =
      'You are writing a monthly youth-data briefing for the African Youth Observatory newsletter — a public email sent to researchers, policymakers, students, and civil-society practitioners. ' +
      'Tone: warm, confident, briefly analytical. Surface the "so what". No filler, no hedging, no "as an AI" preamble. ' +
      'Length: 180–260 words, 2–4 short paragraphs, optional bulleted list (3–5 items max). ' +
      'Output ONLY clean inline HTML using <p>, <strong>, <em>, <ul>, <li>, <h3>. No inline styles, no <html>/<body>/<head>, no markdown, no code fences.';

    const userPrompt =
      `Month: ${monthName}\n\nLive data context:\n${context}\n\n` +
      `Write the briefing now. Open with a concise hook (no greeting like "Dear subscribers"). ` +
      `Use the context for specific names/numbers. Close with one forward-looking sentence.`;

    const res = await client.messages.create({
      model,
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const text = res.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n')
      .trim();
    return text;
  }

  private async composeStaticBody(monthName: string): Promise<string> {
    const latest = await this.prisma.youthIndexScore.findFirst({
      orderBy: { year: 'desc' },
      select: { year: true },
    });

    let html = `<p>Here's your ${monthName} snapshot of youth development across Africa.</p>`;

    if (latest?.year) {
      const top = await this.prisma.youthIndexScore.findMany({
        where: { year: latest.year },
        orderBy: { rank: 'asc' },
        take: 5,
        include: { country: { select: { name: true, flagEmoji: true } } },
      });
      if (top.length) {
        html += `<h3>Top-ranked countries — Youth Index ${latest.year}</h3><ul>`;
        for (const t of top) {
          html += `<li><strong>#${t.rank}</strong> ${t.country?.flagEmoji ?? ''} ${t.country?.name ?? 'Unknown'} — ${t.overallScore.toFixed(1)}</li>`;
        }
        html += `</ul>`;
      }
    } else {
      html += `<p>New indicator data is being processed — full rankings return next month.</p>`;
    }
    return html + this.draftWatermark();
  }
}
