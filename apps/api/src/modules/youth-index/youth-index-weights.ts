// Single source of truth for the African Youth Index sub-weights.
// Theme weights themselves live on Theme.weight in the DB (seeded to user-mandated
// 20/15/15/15/15/10/10). This file defines which indicators feed each theme score
// and how they're weighted within the theme.
//
// Indicators not listed here are "display-only" — visible in explorer/theme pages
// but excluded from the index score.

export type Direction = 'higher-is-better' | 'lower-is-better';

export interface SubIndicator {
  slug: string;
  direction: Direction;
  weight: number; // within-theme weight, sums to 1.0 per theme
}

export const SUB_WEIGHTS: Record<string, SubIndicator[]> = {
  'youth-demography-participation': [
    { slug: 'youth-voter-turnout',                  direction: 'higher-is-better', weight: 0.35 },
    { slug: 'youth-share-of-population',            direction: 'higher-is-better', weight: 0.20 },
    { slug: 'youth-political-participation-index',  direction: 'higher-is-better', weight: 0.15 },
    { slug: 'youth-seats-in-parliament',            direction: 'higher-is-better', weight: 0.10 },
    { slug: 'youth-trust-in-government-index',      direction: 'higher-is-better', weight: 0.10 },
    { slug: 'freedom-of-association-score',         direction: 'higher-is-better', weight: 0.10 },
  ],
  'education': [
    { slug: 'youth-literacy-rate',                       direction: 'higher-is-better', weight: 0.25 },
    { slug: 'secondary-school-net-enrollment-rate',      direction: 'higher-is-better', weight: 0.20 },
    { slug: 'tertiary-education-gross-enrollment-rate',  direction: 'higher-is-better', weight: 0.15 },
    { slug: 'school-dropout-rate',                       direction: 'lower-is-better',  weight: 0.15 },
    { slug: 'primary-enrollment-rate',                   direction: 'higher-is-better', weight: 0.10 },
    { slug: 'education-budget-share-gdp',                direction: 'higher-is-better', weight: 0.10 },
    { slug: 'teacher-student-ratio',                     direction: 'lower-is-better',  weight: 0.05 },
  ],
  'employment': [
    { slug: 'youth-unemployment-rate',                 direction: 'lower-is-better',  weight: 0.35 },
    { slug: 'youth-labor-force-participation-rate',    direction: 'higher-is-better', weight: 0.25 },
    { slug: 'youth-employment-to-population-ratio',    direction: 'higher-is-better', weight: 0.20 },
    { slug: 'youth-adult-unemployment-ratio',          direction: 'lower-is-better',  weight: 0.10 },
    { slug: 'informal-employment-rate',                direction: 'lower-is-better',  weight: 0.10 },
  ],
  'health': [
    { slug: 'births-by-skilled-staff',             direction: 'higher-is-better', weight: 0.15 },
    { slug: 'physician-density',                   direction: 'higher-is-better', weight: 0.15 },
    { slug: 'hiv-prevalence-rate-youth',           direction: 'lower-is-better',  weight: 0.15 },
    { slug: 'yplwha-treatment-rate',               direction: 'higher-is-better', weight: 0.10 },
    { slug: 'youth-suicide-rate',                  direction: 'lower-is-better',  weight: 0.10 },
    { slug: 'contraceptive-prevalence-rate-youth', direction: 'higher-is-better', weight: 0.10 },
    { slug: 'maternal-mortality-ratio',            direction: 'lower-is-better',  weight: 0.10 },
    { slug: 'health-budget-share',                 direction: 'higher-is-better', weight: 0.05 },
    { slug: 'youth-aids-deaths',                   direction: 'lower-is-better',  weight: 0.05 },
    { slug: 'youth-substance-abuse-deaths',        direction: 'lower-is-better',  weight: 0.05 },
  ],
  'entrepreneurship': [
    { slug: 'youth-startup-survival-rate',         direction: 'higher-is-better', weight: 0.20 },
    { slug: 'youth-microcredit-recipients',        direction: 'higher-is-better', weight: 0.15 },
    { slug: 'internet-access-households',          direction: 'higher-is-better', weight: 0.15 },
    { slug: 'getting-credit-rank',                 direction: 'lower-is-better',  weight: 0.10 },
    { slug: 'protecting-investors-rank',           direction: 'lower-is-better',  weight: 0.10 },
    { slug: 'youth-ip-registrations',              direction: 'higher-is-better', weight: 0.10 },
    { slug: 'youth-entrepreneurship-rate',         direction: 'higher-is-better', weight: 0.10 },
    { slug: 'mobile-money-account-penetration',    direction: 'higher-is-better', weight: 0.05 },
    { slug: 'financial-literacy-rate',             direction: 'higher-is-better', weight: 0.05 },
  ],
  'peace-security': [
    { slug: 'youth-idps',                  direction: 'lower-is-better', weight: 0.40 },
    { slug: 'youth-trafficking-victims',   direction: 'lower-is-better', weight: 0.35 },
    { slug: 'youth-extremism-deaths',      direction: 'lower-is-better', weight: 0.25 },
  ],
  'access-to-justice': [
    { slug: 'youth-awaiting-trial',  direction: 'lower-is-better', weight: 0.45 },
    { slug: 'youth-imprisoned',      direction: 'lower-is-better', weight: 0.40 },
    { slug: 'juvenile-detentions',   direction: 'lower-is-better', weight: 0.15 },
  ],
};

export const THEME_SLUGS = Object.keys(SUB_WEIGHTS);

export const ALL_INDEX_INDICATOR_SLUGS = Object.values(SUB_WEIGHTS).flatMap((arr) =>
  arr.map((s) => s.slug),
);
