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

export const YOUTH_INDEX_WEIGHTS = {
  education: 0.25,
  employment: 0.30,
  health: 0.25,
  civicEngagement: 0.20,
  innovation: 0.20,
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

export const THEME_COLORS: Record<string, string> = {
  education: '#4CAF50',
  'employment-entrepreneurship': '#2196F3',
  health: '#F44336',
  'civic-engagement-governance': '#9C27B0',
  'innovation-technology': '#FF9800',
  agriculture: '#8BC34A',
  'gender-equality': '#E91E63',
  'financial-inclusion': '#00BCD4',
  'environment-climate': '#009688',
};

export const THEME_ICONS: Record<string, string> = {
  education: 'GraduationCap',
  'employment-entrepreneurship': 'Briefcase',
  health: 'Heart',
  'civic-engagement-governance': 'Vote',
  'innovation-technology': 'Lightbulb',
  agriculture: 'Wheat',
  'gender-equality': 'Users',
  'financial-inclusion': 'Wallet',
  'environment-climate': 'Leaf',
};
