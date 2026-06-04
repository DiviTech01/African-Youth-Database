import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

const BRAND = {
  gold: '#D4A017',
  dark: '#0A0A0A',
  gray: '#A89070',
  white: '#FFFFFF',
};

function layout(title: string, body: string): string {
  // Inline styles drive the desktop look; the media query in <style> tightens
  // paddings on small screens (Gmail iOS, Apple Mail, most modern clients
  // honour it — those that strip it fall back to the desktop padding, which
  // still reads fine on phones because the card flexes to 100% width).
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title}</title>
<style>
  /* Base typography for the body content — covers AI-generated tags that
     come back without inline styles (Claude returns plain <p>/<h3>/<ul>/etc).
     Without this, default browser/email-client colours render headings and
     paragraph text as black, invisible against the dark card. */
  .ayo-body, .ayo-body p, .ayo-body li, .ayo-body td {
    color: #d0d0d0;
    font-size: 15px;
    line-height: 1.75;
  }
  .ayo-body p { margin: 0 0 18px; }
  .ayo-body h1, .ayo-body h2, .ayo-body h3, .ayo-body h4 {
    color: #ffffff;
    font-weight: 700;
    margin: 24px 0 12px;
    line-height: 1.3;
  }
  .ayo-body h1 { font-size: 22px; }
  .ayo-body h2 { font-size: 19px; }
  .ayo-body h3 { font-size: 17px; }
  .ayo-body h4 { font-size: 15px; }
  .ayo-body strong, .ayo-body b { color: #ffffff; }
  .ayo-body em, .ayo-body i { color: #bdbdbd; }
  .ayo-body ul, .ayo-body ol { margin: 0 0 18px; padding-left: 22px; }
  .ayo-body li { margin: 0 0 6px; }
  .ayo-body a { color: #D4A017; text-decoration: underline; }
  .ayo-body blockquote {
    margin: 16px 0; padding: 10px 16px;
    border-left: 3px solid #D4A017; color: #bdbdbd;
  }
  @media screen and (max-width: 480px) {
    .ayo-card { width: 100% !important; border-radius: 0 !important; }
    .ayo-h    { padding: 28px 22px 20px !important; }
    .ayo-body { padding: 28px 22px !important; }
    .ayo-foot { padding: 24px 22px !important; }
    .ayo-p    { font-size: 15px !important; line-height: 1.7 !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${BRAND.dark};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.dark};padding:40px 16px;">
<tr><td align="center">
<table role="presentation" class="ayo-card" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#111;border-radius:12px;overflow:hidden;border:1px solid #222;">
  <!-- Header -->
  <tr><td class="ayo-h" style="padding:40px 44px 28px;border-bottom:1px solid #222;">
    <span style="font-size:22px;font-weight:700;color:${BRAND.gold};letter-spacing:-0.01em;">African Youth Observatory</span>
  </td></tr>
  <!-- Body — inline color + typography so clients that strip <style>
       (older Outlook, some webmail) still inherit a visible light text
       colour into AI-generated unstyled <p>/<h3>/<ul> children. -->
  <tr><td class="ayo-body" style="padding:40px 44px;color:#d0d0d0;font-size:15px;line-height:1.75;">
    ${body}
  </td></tr>
  <!-- Footer -->
  <tr><td class="ayo-foot" style="padding:28px 44px;border-top:1px solid #222;text-align:center;">
    <p style="color:#888;font-size:12px;line-height:1.6;margin:0;">PACSDA &mdash; Pan African Centre for Social Development and Accountability</p>
    <p style="color:#666;font-size:11px;margin:10px 0 0;">
      <a href="https://africanyouthobservatory.org" style="color:${BRAND.gold};text-decoration:none;">africanyouthobservatory.org</a>
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function btn(text: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;padding:12px 32px;background:${BRAND.gold};color:${BRAND.dark};font-weight:600;font-size:14px;text-decoration:none;border-radius:8px;">${text}</a>`;
}

function p(text: string): string {
  // More vertical breathing room than before — old 16px/1.6 felt cramped,
  // especially on mobile where the card runs full-bleed.
  return `<p class="ayo-p" style="color:#d0d0d0;font-size:15px;line-height:1.75;margin:0 0 20px;">${text}</p>`;
}

// Minimal HTML escape for user-provided text inside attachment labels / URLs.
function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Crude HTML → plain text. Good enough for the multipart/alternative text
// part most spam filters expect: they don't compare it to the HTML, they
// just want a non-trivial text body to exist. Without one, more mail lands
// in Promotions / spam.
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

// Renders the "Attached resources" block. We link to files rather than
// attaching binaries — better deliverability and works for files of any size.
function attachmentsBlock(
  items?: Array<{ label: string; url: string; sizeHint?: string }> | null,
): string {
  if (!items || items.length === 0) return '';
  const rows = items
    .map(
      (a) => `<li style="margin:0 0 10px;list-style:none;">
        <a href="${esc(a.url)}" style="display:block;padding:14px 16px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;color:${BRAND.gold};text-decoration:none;font-weight:600;font-size:14px;">
          ${esc(a.label)}
          ${a.sizeHint ? `<span style="color:#777;font-weight:400;font-size:12px;margin-left:8px;">${esc(a.sizeHint)}</span>` : ''}
        </a>
      </li>`,
    )
    .join('');
  return `<div style="margin-top:28px;padding-top:24px;border-top:1px solid #222;">
    <p style="color:#bbb;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;margin:0 0 14px;">Attached resources</p>
    <ul style="margin:0;padding:0;">${rows}</ul>
  </div>`;
}

@Injectable()
export class MailService {
  private resend: Resend | null = null;
  private from: string;
  private adminEmail: string;
  private readonly logger = new Logger(MailService.name);

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.logger.log('Resend email client initialized');
    } else {
      this.logger.warn('RESEND_API_KEY not set — email sending disabled');
    }
    this.from = process.env.FROM_EMAIL || 'African Youth Observatory <noreply@pacsda.org>';
    this.adminEmail = process.env.ADMIN_EMAIL || 'admin@africanyouthobservatory.org';
  }

  // ── Welcome Email ──────────────────────────────────────────

  async sendWelcome(to: string, name?: string) {
    if (!this.resend) {
      this.logger.warn('Email not sent — Resend not configured');
      return;
    }
    const displayName = name || to.split('@')[0];
    const html = layout('Welcome to the African Youth Observatory', `
      ${p(`Hi ${displayName},`)}
      ${p('Welcome to the <strong>African Youth Observatory</strong> — the continental data intelligence platform for African youth development.')}
      ${p('With your account you can:')}
      <ul style="color:#ccc;font-size:14px;line-height:1.8;margin:0 0 20px;padding-left:20px;">
        <li>Explore youth indicators across 54 African countries</li>
        <li>Build custom dashboards and comparisons</li>
        <li>Access the Expert Directory and Policy Monitor</li>
        <li>Use AI-powered data analysis</li>
      </ul>
      <div style="text-align:center;margin:24px 0;">
        ${btn('Go to Dashboard', process.env.FRONTEND_URL || 'https://africanyouthobservatory.org/dashboard')}
      </div>
      ${p('If you have any questions, reply to this email or visit our Contact page.')}
    `);

    return this.send(to, 'Welcome to the African Youth Observatory', html);
  }

  // ── Password Reset ─────────────────────────────────────────

  async sendPasswordReset(to: string, code: string, name?: string) {
    if (!this.resend) {
      this.logger.warn('Email not sent — Resend not configured');
      return;
    }
    const displayName = name || to.split('@')[0];
    const html = layout('Password Reset Code', `
      ${p(`Hi ${displayName},`)}
      ${p('You requested a password reset for your African Youth Observatory account. Use the code below to reset your password:')}
      <div style="text-align:center;margin:24px 0;">
        <span style="display:inline-block;padding:16px 40px;background:#1a1a1a;border:2px solid ${BRAND.gold};border-radius:8px;font-size:32px;font-weight:700;letter-spacing:8px;color:${BRAND.gold};">${code}</span>
      </div>
      ${p('This code expires in <strong>15 minutes</strong>.')}
      ${p('If you didn\'t request this, you can safely ignore this email. Your password will not change.')}
    `);

    return this.send(to, `${code} is your AYO password reset code`, html);
  }

  // ── Contact Form Confirmation ──────────────────────────────

  async sendContactConfirmation(to: string, name: string, subject: string) {
    if (!this.resend) {
      this.logger.warn('Email not sent — Resend not configured');
      return;
    }
    const html = layout('We received your message', `
      ${p(`Hi ${name},`)}
      ${p(`Thank you for reaching out. We received your inquiry regarding "<strong>${subject}</strong>" and will get back to you within <strong>2-3 business days</strong>.`)}
      ${p('In the meantime, feel free to explore our platform for data and insights on African youth development.')}
      <div style="text-align:center;margin:24px 0;">
        ${btn('Explore the Platform', process.env.FRONTEND_URL || 'https://africanyouthobservatory.org')}
      </div>
    `);

    return this.send(to, `We received your message: ${subject}`, html);
  }

  // ── Contact Form → Admin ───────────────────────────────────

  async sendContactToAdmin(data: {
    name: string;
    email: string;
    organization?: string;
    inquiryType: string;
    subject: string;
    message: string;
  }) {
    if (!this.resend) {
      this.logger.warn('Email not sent — Resend not configured');
      return;
    }
    const html = layout('New Contact Form Submission', `
      ${p('<strong>New contact form submission:</strong>')}
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="color:#888;padding:8px 12px;border-bottom:1px solid #222;width:120px;">Name</td>
            <td style="color:#ccc;padding:8px 12px;border-bottom:1px solid #222;">${data.name}</td></tr>
        <tr><td style="color:#888;padding:8px 12px;border-bottom:1px solid #222;">Email</td>
            <td style="color:#ccc;padding:8px 12px;border-bottom:1px solid #222;"><a href="mailto:${data.email}" style="color:${BRAND.gold};">${data.email}</a></td></tr>
        ${data.organization ? `<tr><td style="color:#888;padding:8px 12px;border-bottom:1px solid #222;">Organization</td>
            <td style="color:#ccc;padding:8px 12px;border-bottom:1px solid #222;">${data.organization}</td></tr>` : ''}
        <tr><td style="color:#888;padding:8px 12px;border-bottom:1px solid #222;">Type</td>
            <td style="color:#ccc;padding:8px 12px;border-bottom:1px solid #222;">${data.inquiryType}</td></tr>
        <tr><td style="color:#888;padding:8px 12px;border-bottom:1px solid #222;">Subject</td>
            <td style="color:#ccc;padding:8px 12px;border-bottom:1px solid #222;">${data.subject}</td></tr>
      </table>
      <div style="background:#1a1a1a;border-left:3px solid ${BRAND.gold};padding:16px;border-radius:0 8px 8px 0;margin:16px 0;">
        <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0;white-space:pre-wrap;">${data.message}</p>
      </div>
      <div style="text-align:center;margin:24px 0;">
        ${btn('Reply', `mailto:${data.email}?subject=Re: ${data.subject}`)}
      </div>
    `);

    return this.send(this.adminEmail, `[Contact] ${data.inquiryType}: ${data.subject}`, html);
  }

  // ── Admin: New User Notification ───────────────────────────

  async sendNewUserNotification(user: { email: string; name?: string; role: string }) {
    if (!this.resend) {
      this.logger.warn('Email not sent — Resend not configured');
      return;
    }
    const html = layout('New User Registration', `
      ${p('A new user has registered on the African Youth Observatory:')}
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="color:#888;padding:8px 12px;border-bottom:1px solid #222;width:120px;">Name</td>
            <td style="color:#ccc;padding:8px 12px;border-bottom:1px solid #222;">${user.name || '(not provided)'}</td></tr>
        <tr><td style="color:#888;padding:8px 12px;border-bottom:1px solid #222;">Email</td>
            <td style="color:#ccc;padding:8px 12px;border-bottom:1px solid #222;">${user.email}</td></tr>
        <tr><td style="color:#888;padding:8px 12px;border-bottom:1px solid #222;">Role</td>
            <td style="color:#ccc;padding:8px 12px;border-bottom:1px solid #222;">${user.role}</td></tr>
      </table>
      <div style="text-align:center;margin:24px 0;">
        ${btn('View Users', (process.env.FRONTEND_URL || 'https://africanyouthobservatory.org') + '/admin')}
      </div>
    `);

    return this.send(this.adminEmail, `New user: ${user.email}`, html);
  }

  // ── Newsletter: subscriber confirmation (transactional) ────
  // Sent immediately to the person who just opted in. This is a 1:1
  // transactional email, NOT a broadcast, so it does not require admin
  // approval — it only confirms an action the recipient just took.

  async sendNewsletterConfirmation(to: string, unsubscribeUrl: string) {
    if (!this.resend) {
      this.logger.warn('Email not sent — Resend not configured');
      return;
    }
    const html = layout('You\'re subscribed', `
      ${p('Thanks for subscribing to the <strong>African Youth Observatory</strong> monthly youth-data briefing.')}
      ${p('Once a month you\'ll get a concise digest of new data, country movements, and policy insights across all 54 African countries — nothing else.')}
      <div style="text-align:center;margin:24px 0;">
        ${btn('Explore the Platform', process.env.FRONTEND_URL || 'https://africanyouthobservatory.org')}
      </div>
      ${p(`Not what you expected? <a href="${unsubscribeUrl}" style="color:${BRAND.gold};">Unsubscribe instantly</a>.`)}
    `);
    return this.send(to, 'You\'re subscribed to the Youth Observatory briefing', html);
  }

  // ── Newsletter: notify admin of a new subscriber ───────────

  async sendNewSubscriberNotice(email: string, source?: string | null) {
    if (!this.resend) return; // silent — this is a low-value notice
    const html = layout('New newsletter subscriber', `
      ${p('Someone just subscribed to the monthly youth-data briefing:')}
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="color:#888;padding:8px 12px;border-bottom:1px solid #222;width:120px;">Email</td>
            <td style="color:#ccc;padding:8px 12px;border-bottom:1px solid #222;">${email}</td></tr>
        <tr><td style="color:#888;padding:8px 12px;border-bottom:1px solid #222;">Source</td>
            <td style="color:#ccc;padding:8px 12px;border-bottom:1px solid #222;">${source || '(unknown)'}</td></tr>
      </table>
    `);
    return this.send(this.adminEmail, `New subscriber: ${email}`, html);
  }

  // ── Newsletter: ask an admin to review a drafted briefing ──

  async sendBriefingApprovalRequest(campaign: { id: string; title: string; subject: string }) {
    if (!this.resend) {
      this.logger.warn('Approval request not sent — Resend not configured');
      return;
    }
    const reviewUrl = `${process.env.FRONTEND_URL || 'https://africanyouthobservatory.org'}/admin/newsletter`;
    const html = layout('A briefing is ready for review', `
      ${p('A monthly youth-data briefing has been drafted and is <strong>waiting for your approval</strong>. It will NOT be sent to subscribers until you review and approve it.')}
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="color:#888;padding:8px 12px;border-bottom:1px solid #222;width:120px;">Title</td>
            <td style="color:#ccc;padding:8px 12px;border-bottom:1px solid #222;">${campaign.title}</td></tr>
        <tr><td style="color:#888;padding:8px 12px;border-bottom:1px solid #222;">Subject</td>
            <td style="color:#ccc;padding:8px 12px;border-bottom:1px solid #222;">${campaign.subject}</td></tr>
      </table>
      <div style="text-align:center;margin:24px 0;">
        ${btn('Review &amp; Approve', reviewUrl)}
      </div>
    `);
    return this.send(this.adminEmail, `[Action needed] Approve briefing: ${campaign.title}`, html);
  }

  // ── Newsletter: render + send an approved briefing ─────────
  // renderBriefing is reused by the admin preview endpoint so what an admin
  // approves is byte-for-byte what subscribers receive.

  renderBriefing(opts: {
    subject: string;
    innerHtml: string;
    /** Per-recipient unsubscribe URL (subscribers). Pass null for USERS audience. */
    unsubscribeUrl?: string | null;
    /** Affects the footer wording. Defaults to 'subscriber'. */
    audienceKind?: 'subscriber' | 'user';
    attachments?: Array<{ label: string; url: string; sizeHint?: string }> | null;
  }): string {
    const kind = opts.audienceKind ?? 'subscriber';
    const platformUrl = process.env.FRONTEND_URL || 'https://africanyouthobservatory.org';
    const footer =
      kind === 'user'
        ? `<p style="color:#777;font-size:12px;line-height:1.7;margin:0;">
            You're receiving this because you're a registered user of the African Youth
            Observatory. Manage your account at
            <a href="${platformUrl}" style="color:${BRAND.gold};text-decoration:none;">africanyouthobservatory.org</a>.
          </p>`
        : `<p style="color:#777;font-size:12px;line-height:1.7;margin:0;">
            You're receiving this because you subscribed to African Youth Observatory
            monthly briefings.
            ${opts.unsubscribeUrl ? `<a href="${opts.unsubscribeUrl}" style="color:${BRAND.gold};text-decoration:none;">Unsubscribe</a>.` : ''}
          </p>`;

    return layout(opts.subject, `
      ${opts.innerHtml}
      ${attachmentsBlock(opts.attachments)}
      <div style="margin-top:32px;padding-top:20px;border-top:1px solid #222;">
        ${footer}
      </div>
    `);
  }

  async sendBriefing(opts: {
    to: string;
    subject: string;
    innerHtml: string;
    unsubscribeUrl?: string | null;
    audienceKind?: 'subscriber' | 'user';
    attachments?: Array<{ label: string; url: string; sizeHint?: string }> | null;
  }) {
    if (!this.resend) {
      this.logger.warn('Briefing not sent — Resend not configured');
      throw new Error('Email service not configured (RESEND_API_KEY missing)');
    }
    // RFC 8058 one-click unsubscribe — Gmail uses this as a strong signal
    // to keep the email out of Promotions and to show the native "Unsubscribe"
    // button next to the sender. We only set it for subscriber sends because
    // user-broadcast emails don't have a per-recipient token.
    const headers: Record<string, string> = {};
    if (opts.unsubscribeUrl) {
      headers['List-Unsubscribe'] = `<${opts.unsubscribeUrl}>`;
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }
    return this.send(opts.to, opts.subject, this.renderBriefing(opts), { headers });
  }

  /** True when Resend is wired up — lets callers fail fast before a broadcast. */
  get isConfigured(): boolean {
    return this.resend !== null;
  }

  // ── Core Send ──────────────────────────────────────────────
  // Every send goes through here so we can apply the deliverability defaults
  // (Reply-To, plain-text fallback, custom headers) in one place. The text
  // alternative is auto-derived from the HTML when not supplied.

  private async send(
    to: string,
    subject: string,
    html: string,
    extras: { headers?: Record<string, string>; text?: string; replyTo?: string } = {},
  ) {
    if (!this.resend) {
      this.logger.warn('Email not sent — Resend not configured');
      return;
    }
    try {
      const result = await this.resend.emails.send({
        from: this.from,
        to,
        subject,
        html,
        // Multipart/alternative text part — required for good deliverability.
        // Many anti-spam systems (and Gmail's Promotions classifier) downgrade
        // HTML-only emails.
        text: extras.text ?? htmlToText(html),
        // A monitored Reply-To improves trust signals. Falls back to the admin
        // inbox when REPLY_TO_EMAIL isn't set on Render.
        replyTo: extras.replyTo ?? process.env.REPLY_TO_EMAIL ?? this.adminEmail,
        headers: extras.headers,
      });
      this.logger.log(`Email sent to ${to}: ${subject}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error}`);
      throw error;
    }
  }
}
