// ============================================================
// AYO Shared Constants
// ============================================================

import type { Region } from './types';

export const REGIONS: { value: Region; label: string }[] = [
  { value: 'NORTH_AFRICA', label: 'North Africa' },
  { value: 'WEST_AFRICA', label: 'West Africa' },
  { value: 'CENTRAL_AFRICA', label: 'Central Africa' },
  { value: 'EAST_AFRICA', label: 'East Africa' },
  { value: 'SOUTHERN_AFRICA', label: 'Southern Africa' },
];

// AYO Youth Index — seven user-mandated weights, summing to 1.0.
// The DB is the source of truth (Theme.weight); this constant exists for
// places that need the weights without a Prisma round-trip.
export const YOUTH_INDEX_WEIGHTS = {
  'youth-demography-participation': 0.20,
  'education':                       0.15,
  'employment':                      0.15,
  'health':                          0.15,
  'entrepreneurship':                0.15,
  'peace-security':                  0.10,
  'access-to-justice':               0.10,
} as const;

export const AGE_GROUPS = [
  '15-19',
  '20-24',
  '25-29',
  '30-35',
  '15-24',
  '15-35',
  'all',
] as const;

/**
 * The platform's canonical youth age band. Aligns with the African Union
 * definition (15–35) and the Prisma schema default for `IndicatorValue.ageGroup`.
 *
 * **Rule of thumb**: every query that aggregates indicator values for display
 * (landing-page Key Statistics, Themes totals, Compare, Explore charts,
 * country profile stats) MUST filter to this constant unless the caller
 * explicitly passes a different ageGroup. Anything that doesn't filter ends
 * up mixing 15-35 AU data with 15-24 UN data, and the totals lie.
 */
export const DEFAULT_AGE_GROUP = '15-35';

export const DEFAULT_YEAR_RANGE = {
  min: 2010,
  max: 2024,
} as const;

// Colours and icons for the 7 AYO themes. Match Theme.color / Theme.icon in the DB.
export const THEME_COLORS: Record<string, string> = {
  'youth-demography-participation': '#2563EB',
  'education':                       '#7C3AED',
  'employment':                      '#EA580C',
  'health':                          '#DC2626',
  'entrepreneurship':                '#0891B2',
  'peace-security':                  '#16A34A',
  'access-to-justice':               '#9333EA',
};

export const THEME_ICONS: Record<string, string> = {
  'youth-demography-participation': 'Users',
  'education':                       'GraduationCap',
  'employment':                      'Briefcase',
  'health':                          'HeartPulse',
  'entrepreneurship':                'Rocket',
  'peace-security':                  'Shield',
  'access-to-justice':               'Scale',
};
