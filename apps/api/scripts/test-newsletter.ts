/**
 * Standalone sanity test for the newsletter email layer — no DB, no network.
 * Run: npx ts-node -r tsconfig-paths/register scripts/test-newsletter.ts
 *
 * Covers the pure, deterministic bits we can verify offline:
 *  - MailService is "not configured" without RESEND_API_KEY (so a real send
 *    fails fast / no-ops instead of throwing somewhere random).
 *  - renderBriefing wraps the body in the branded layout, keeps the subject,
 *    and embeds the exact unsubscribe URL.
 *  - The monthly periodKey is stable & idempotent per calendar month.
 */
import { MailService } from '../src/modules/mail/mail.service';

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    console.error(`  ✗ ${name}`);
    failures++;
  }
}

// Ensure no key is present for this test regardless of local .env.
delete process.env.RESEND_API_KEY;

const mail = new MailService();

console.log('MailService — no API key:');
check('isConfigured is false without RESEND_API_KEY', mail.isConfigured === false);

console.log('renderBriefing (subscriber audience):');
const unsub = 'https://african-youth-observatory.onrender.com/api/newsletter/unsubscribe?token=abc123';
const subHtml = mail.renderBriefing({
  subject: 'May 2026 Briefing',
  innerHtml: '<p>Hello youth data</p>',
  unsubscribeUrl: unsub,
  audienceKind: 'subscriber',
  attachments: [{ label: 'Youth Index 2026', url: 'https://example.com/yi-2026.pdf', sizeHint: '4 MB · PDF' }],
});
check('returns a full HTML document', subHtml.startsWith('<!DOCTYPE html>'));
check('contains the subject', subHtml.includes('May 2026 Briefing'));
check('contains the body', subHtml.includes('<p>Hello youth data</p>'));
check('embeds the exact unsubscribe URL', subHtml.includes(unsub));
check('has an Unsubscribe link label', subHtml.includes('Unsubscribe'));
check('keeps the AYO brand header', subHtml.includes('African Youth Observatory'));
check('updated PACSDA expansion in footer', subHtml.includes('Pan African Centre for Social Development and Accountability'));
check('does not mention "AYD Platform"', !subHtml.includes('AYD Platform'));
check('renders attachment label', subHtml.includes('Youth Index 2026'));
check('renders attachment URL', subHtml.includes('https://example.com/yi-2026.pdf'));
check('mobile-responsive style block present', subHtml.includes('@media screen and (max-width: 480px)'));

console.log('renderBriefing (user audience):');
const userHtml = mail.renderBriefing({
  subject: 'Platform announcement',
  innerHtml: '<p>Big news</p>',
  audienceKind: 'user',
  unsubscribeUrl: null,
});
check('user-footer wording present', userHtml.includes("you're a registered user"));
check('no Unsubscribe link in user-audience footer', !userHtml.includes('Unsubscribe</a>'));

console.log('periodKey idempotency:');
const key = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
check('same month → same key', key(new Date('2026-05-01')) === key(new Date('2026-05-28')));
check('different month → different key', key(new Date('2026-05-31')) !== key(new Date('2026-06-01')));
check('zero-pads the month', key(new Date('2026-03-09')) === '2026-03');

if (failures) {
  console.error(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll newsletter email checks passed.');
