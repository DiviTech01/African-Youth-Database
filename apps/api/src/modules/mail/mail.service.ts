import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

const BRAND = {
  gold: '#D4A017',
  dark: '#0A0A0A',
  gray: '#A89070',
  white: '#FFFFFF',
};

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title}</title></head>
<body style="margin:0;padding:0;background:${BRAND.dark};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.dark};padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#111;border-radius:12px;overflow:hidden;border:1px solid #222;">
  <!-- Header -->
  <tr><td style="padding:32px 40px 24px;border-bottom:1px solid #222;">
    <span style="font-size:22px;font-weight:700;color:${BRAND.gold};">African Youth Observatory</span>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:32px 40px;">
    ${body}
  </td></tr>
  <!-- Footer -->
  <tr><td style="padding:24px 40px;border-top:1px solid #222;text-align:center;">
    <p style="color:#666;font-size:12px;margin:0;">PACSDA &mdash; Pan-African Centre for Statistics and Data Analytics</p>
    <p style="color:#555;font-size:11px;margin:8px 0 0;">
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
  return `<p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 16px;">${text}</p>`;
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
    this.from = process.env.FROM_EMAIL || 'AYD Platform <noreply@pacsda.org>';
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

    return this.send(to, `${code} is your AYD password reset code`, html);
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

  renderBriefing(subject: string, innerHtml: string, unsubscribeUrl: string): string {
    return layout(subject, `
      ${innerHtml}
      <div style="margin-top:28px;padding-top:16px;border-top:1px solid #222;">
        <p style="color:#666;font-size:12px;line-height:1.6;margin:0;">
          You're receiving this because you subscribed to African Youth Observatory
          monthly briefings. <a href="${unsubscribeUrl}" style="color:${BRAND.gold};text-decoration:none;">Unsubscribe</a>.
        </p>
      </div>
    `);
  }

  async sendBriefing(to: string, subject: string, innerHtml: string, unsubscribeUrl: string) {
    if (!this.resend) {
      this.logger.warn('Briefing not sent — Resend not configured');
      throw new Error('Email service not configured (RESEND_API_KEY missing)');
    }
    return this.send(to, subject, this.renderBriefing(subject, innerHtml, unsubscribeUrl));
  }

  /** True when Resend is wired up — lets callers fail fast before a broadcast. */
  get isConfigured(): boolean {
    return this.resend !== null;
  }

  // ── Core Send ──────────────────────────────────────────────

  private async send(to: string, subject: string, html: string) {
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
      });
      this.logger.log(`Email sent to ${to}: ${subject}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error}`);
      throw error;
    }
  }
}
