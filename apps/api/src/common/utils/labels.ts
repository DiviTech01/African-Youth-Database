/**
 * Human-readable labels for machine values that reach a reader.
 *
 * These exist because published artefacts were printing raw database values:
 * a generated country report said "in the LOW tier" and listed its dimension
 * table as `peace-security` / `access-to-justice` / `youth-demography-participation`,
 * while `GET /api/youth-index/rankings` reported the same tier as "medium-high".
 * Two registers of the same fact from one platform reads as unreliability, and a
 * ministerial annex with a row labelled `youth-demography-participation` reads as
 * an unproofed database dump.
 *
 * Canonical home for these maps. `export.service.ts` (EXPORT_THEME_LABELS) and
 * `insights/ai-context.service.ts` (SHORT_THEME_LABELS) still carry their own
 * copies; fold them into this file when next touched rather than adding a fourth.
 */

/** Youth Index dimension slug -> display label. */
export const DIMENSION_LABELS: Record<string, string> = {
  'youth-demography-participation': 'Youth Demography & Participation',
  education: 'Education',
  employment: 'Employment',
  health: 'Health',
  entrepreneurship: 'Entrepreneurship',
  'peace-security': 'Peace & Security',
  'access-to-justice': 'Access to Justice',
};

/** Canonical dimension order, so tables read the same everywhere. */
export const DIMENSION_ORDER = Object.keys(DIMENSION_LABELS);

export function formatDimensionLabel(slug: string): string {
  return (
    DIMENSION_LABELS[slug] ??
    // Unknown slug: at least make it prose rather than a database key.
    slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

const TIER_LABELS: Record<string, string> = {
  HIGH: 'High',
  MEDIUM_HIGH: 'Medium-High',
  MEDIUM: 'Medium',
  MEDIUM_LOW: 'Medium-Low',
  LOW: 'Low',
};

/**
 * Tier label for prose and documents — title case, hyphenated.
 *
 * Distinct from `formatTier()` in ./format, which lower-cases for API payloads
 * ("medium-high"). Both derive from the same enum; this one is what a person
 * should read in a sentence.
 */
export function formatTierLabel(tier: string | null | undefined): string {
  if (!tier) return 'unrated';
  return TIER_LABELS[tier] ?? tier.replace(/_/g, '-').toLowerCase();
}

/**
 * Drop characters the built-in PDF fonts cannot encode.
 *
 * The PDF renderer uses only the standard Helvetica family, which is
 * WinAnsi-encoded. Anything outside that set — flag emoji in particular — is
 * written as raw UTF-16 bytes and read back as mojibake, which is how
 * `🇸🇳 Senegal` printed as `Ø<ÝøØ<Ýó Senegal` across every row of the headline
 * ranking table. Strip rather than substitute: a country name carries itself.
 */
export function stripNonWinAnsi(input: string): string {
  return input
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '') // regional indicators (flags)
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '') // emoji, dingbats, variation selectors
    .replace(/\s{2,}/g, ' ')
    .trim();
}
