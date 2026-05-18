import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NewsletterCampaignStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { SubscribeDto, CreateCampaignDto, UpdateCampaignDto } from './newsletter.dto';

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
  ) {}

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

  /** Render the exact HTML subscribers will receive (used by the preview UI). */
  async previewHtml(id: string): Promise<string> {
    const c = await this.getCampaign(id);
    return this.mail.renderBriefing(
      c.subject,
      c.bodyHtml,
      this.unsubscribeUrl('preview-token-not-a-real-subscriber'),
    );
  }

  async sendTest(id: string, toEmail: string) {
    if (!this.mail.isConfigured) {
      throw new BadRequestException('Email service is not configured (RESEND_API_KEY missing).');
    }
    const c = await this.getCampaign(id);
    await this.mail.sendBriefing(
      toEmail,
      `[TEST] ${c.subject}`,
      c.bodyHtml,
      this.unsubscribeUrl('test-token-not-a-real-subscriber'),
    );
    await this.prisma.newsletterCampaign.update({
      where: { id },
      data: { testSentTo: toEmail },
    });
    return { ok: true, sentTo: toEmail };
  }

  // ── The actual broadcast ───────────────────────────────────
  // Sequential with a delay so we stay under Resend's request-rate limit.
  // For very large lists this is slow but correct; batching can replace it
  // later (resend.batch.send, 100/call).
  private async dispatch(id: string) {
    const c = await this.prisma.newsletterCampaign.findUnique({ where: { id } });
    if (!c || c.status !== 'APPROVED') return;

    const subs = await this.prisma.newsletterSubscription.findMany({
      where: { status: 'SUBSCRIBED' },
      select: { id: true, email: true, unsubscribeToken: true },
    });

    await this.prisma.newsletterCampaign.update({
      where: { id },
      data: { status: 'SENDING', recipientCount: subs.length, sentCount: 0, failedCount: 0 },
    });

    let sent = 0;
    let failed = 0;
    for (const s of subs) {
      const token = s.unsubscribeToken ?? (await this.ensureToken(s.id));
      try {
        await this.mail.sendBriefing(s.email, c.subject, c.bodyHtml, this.unsubscribeUrl(token));
        sent++;
      } catch (e) {
        failed++;
        this.logger.warn(`briefing send failed for ${s.email}: ${(e as Error).message}`);
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
      sent === 0 && subs.length > 0 ? 'FAILED' : 'SENT';
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
    this.logger.log(`Campaign ${id} finished: ${sent} sent, ${failed} failed`);
  }

  // ── Monthly auto-draft (called by the scheduler or admin) ──
  /**
   * Idempotent per calendar month via the unique periodKey. Builds a starter
   * briefing from the latest Youth Index, creates it as a DRAFT, then submits
   * it for approval (which emails an admin). Returns the existing campaign if
   * one was already created for this month.
   */
  async generateMonthlyDraft(now: Date = new Date()) {
    const periodKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const existing = await this.prisma.newsletterCampaign.findUnique({ where: { periodKey } });
    if (existing) {
      this.logger.log(`Monthly draft for ${periodKey} already exists (${existing.id})`);
      return existing;
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
    return this.getCampaign(campaign.id);
  }

  private async composeMonthlyBody(monthName: string): Promise<string> {
    const latest = await this.prisma.youthIndexScore.findFirst({
      orderBy: { year: 'desc' },
      select: { year: true },
    });

    let highlights = `<p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 16px;">
      Here's your ${monthName} snapshot of youth development across Africa.</p>`;

    if (latest?.year) {
      const top = await this.prisma.youthIndexScore.findMany({
        where: { year: latest.year },
        orderBy: { rank: 'asc' },
        take: 5,
        include: { country: { select: { name: true, flagEmoji: true } } },
      });
      if (top.length) {
        const rows = top
          .map(
            (t) => `<tr>
              <td style="color:#D4A017;padding:8px 12px;border-bottom:1px solid #222;width:48px;font-weight:700;">#${t.rank}</td>
              <td style="color:#ccc;padding:8px 12px;border-bottom:1px solid #222;">${t.country?.flagEmoji ?? ''} ${t.country?.name ?? 'Unknown'}</td>
              <td style="color:#ccc;padding:8px 12px;border-bottom:1px solid #222;text-align:right;">${t.overallScore.toFixed(1)}</td>
            </tr>`,
          )
          .join('');
        highlights += `
          <p style="color:#ccc;font-size:15px;line-height:1.6;margin:16px 0 8px;">
            <strong>Top-ranked countries — Youth Index ${latest.year}</strong></p>
          <table style="width:100%;border-collapse:collapse;margin:0 0 16px;">${rows}</table>`;
      }
    } else {
      highlights += `<p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 16px;">
        New indicator data is being processed — full rankings return next month.</p>`;
    }

    highlights += `<p style="color:#999;font-size:13px;line-height:1.6;margin:16px 0 0;">
      <em>This is an auto-generated draft. Edit the copy before approving.</em></p>`;
    return highlights;
  }
}
