// ============================================================
// AYO Shared Types — The API Contract
// Both frontend (@ayd/web) and backend (@ayd/api) import from here
// ============================================================

// ---- Enums as union types (no Prisma dependency) ----

export type Region =
  | 'NORTH_AFRICA'
  | 'WEST_AFRICA'
  | 'CENTRAL_AFRICA'
  | 'EAST_AFRICA'
  | 'SOUTHERN_AFRICA';

export type GenderType = 'MALE' | 'FEMALE' | 'TOTAL';

export type IndicatorUnit =
  | 'PERCENTAGE'
  | 'NUMBER'
  | 'INDEX'
  | 'RATIO'
  | 'RATE'
  | 'CURRENCY'
  | 'SCORE'
  | 'YEARS';

export type IndexTier =
  | 'HIGH'
  | 'MEDIUM_HIGH'
  | 'MEDIUM'
  | 'MEDIUM_LOW'
  | 'LOW';

export type UserRole =
  | 'PUBLIC'
  | 'REGISTERED'
  | 'RESEARCHER'
  | 'CONTRIBUTOR'
  | 'INSTITUTIONAL'
  | 'ADMIN';

// ---- Core Entities ----

export interface Country {
  id: string;
  name: string;
  isoCode2: string;
  isoCode3: string;
  region: Region;
  capital: string;
  population: number;
  youthPopulation: number;
  area?: number;
  currency?: string;
  languages: string[];
  economicBlocs: string[];
  latitude: number;
  longitude: number;
  flagEmoji?: string;
}

export interface Theme {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: number;
  indicatorCount?: number;
}

export interface Indicator {
  id: string;
  name: string;
  slug: string;
  description: string;
  unit: IndicatorUnit;
  source: string;
  methodology?: string;
  frequency?: string;
  themeId: string;
  themeName?: string;
}

export interface IndicatorValue {
  id: string;
  value: number;
  year: number;
  gender: GenderType;
  ageGroup: string;
  source: string;
  confidence: number;
  isEstimate: boolean;
  countryId: string;
  indicatorId: string;
  countryName?: string;
  indicatorName?: string;
}

export type ThemeSlug =
  | 'youth-demography-participation'
  | 'education'
  | 'employment'
  | 'health'
  | 'entrepreneurship'
  | 'peace-security'
  | 'access-to-justice';

export type DimensionScores = Record<ThemeSlug, number>;

export interface YouthIndexScore {
  id: string;
  year: number;
  overallScore: number;
  dimensionScores: DimensionScores;
  rank: number;
  previousRank?: number;
  rankChange?: number;
  percentile: number;
  tier: IndexTier;
  countryId: string;
  countryName?: string;
}

export interface CountryPolicy {
  id: string;
  countryId: string;
  policyName: string;
  policyType: string;
  yearAdopted?: number;
  yearRevised?: number;
  aycRatified: boolean;
  aycRatifiedYear?: number;
  wpayCompliant: boolean;
  complianceScore?: number;
  status: string;
}

export interface Expert {
  id: string;
  name: string;
  email?: string;
  title: string;
  organization?: string;
  countryId: string;
  specializations: string[];
  languages: string[];
  bio?: string;
  verified: boolean;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  organization?: string;
  avatar?: string;
  lastLogin?: string;
  createdAt: string;
}

export interface Dashboard {
  id: string;
  title: string;
  description?: string;
  layout: Record<string, unknown>;
  widgets: DashboardWidget[];
  isPublic: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardWidget {
  id: string;
  type: ChartType;
  title: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

export type ChartType =
  | 'bar'
  | 'line'
  | 'area'
  | 'pie'
  | 'donut'
  | 'map'
  | 'scatter'
  | 'radar'
  | 'treemap';

export interface DataSource {
  id: string;
  name: string;
  url?: string;
  description?: string;
  type: string;
  lastSync?: string;
}

// ---- API Response Wrappers ----

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

// ---- Query Parameter Types ----

export interface DataFilters {
  countryId?: string;
  countryIds?: string[];
  indicatorId?: string;
  themeId?: string;
  yearStart?: number;
  yearEnd?: number;
  gender?: GenderType;
  region?: Region;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ---- Derived / Computed Types (for API responses) ----

export interface MapDataPoint {
  countryId: string;
  countryName: string;
  isoCode3: string;
  value: number;
  year: number;
}

export interface TimeSeriesPoint {
  year: number;
  value: number;
  gender?: GenderType;
}

export interface ComparisonData {
  countryId: string;
  countryName: string;
  isoCode3: string;
  flagEmoji?: string;
  values: {
    indicatorId: string;
    indicatorName: string;
    value: number;
    year: number;
  }[];
}

export interface RegionalAverage {
  region: Region;
  indicatorId: string;
  indicatorName: string;
  averageValue: number;
  countryCount: number;
  year: number;
}

export interface CountryStats {
  country: Country;
  indicatorCount: number;
  latestYear: number;
  youthIndexScore?: YouthIndexScore;
  highlights: {
    indicatorName: string;
    value: number;
    unit: IndicatorUnit;
    trend: 'up' | 'down' | 'stable';
  }[];
}

export interface RegionSummary {
  region: Region;
  countryCount: number;
  totalPopulation: number;
  totalYouthPopulation: number;
  countries: Pick<Country, 'id' | 'name' | 'isoCode3' | 'flagEmoji'>[];
}

export interface PlatformStats {
  totalCountries: number;
  totalIndicators: number;
  totalDataPoints: number;
  totalThemes: number;
  yearRange: { min: number; max: number };
  lastUpdated: string;
}

// ---- Youth Index Computation Types ----

export interface YouthIndexRankingResponse {
  data: YouthIndexRankedCountry[];
  meta: {
    year: number;
    totalCountries: number;
    averageScore: number;
    methodology: string;
  };
}

export interface YouthIndexRankedCountry {
  rank: number;
  countryId: string;
  countryName: string;
  isoCode3: string;
  flagEmoji?: string;
  region: Region;
  overallScore: number;
  dimensions: DimensionScores;
  previousRank?: number;
  rankChange?: number;
  percentile: number;
  tier: IndexTier;
}

export interface YouthIndexCountryDetail {
  country: {
    id: string;
    name: string;
    isoCode3: string;
    region: Region;
    flagEmoji?: string;
  };
  scores: Omit<YouthIndexRankedCountry, 'countryId' | 'countryName' | 'isoCode3' | 'flagEmoji' | 'region'>[];
  rankHistory: { year: number; rank: number; overallScore: number }[];
}

// ---- Comparison Types ----

export interface CompareCountriesResponse {
  year: number;
  countries: {
    countryId: string;
    countryName: string;
    isoCode3: string;
    flagEmoji?: string;
    region: Region;
    youthIndexRank: number | null;
    youthIndexScore: number | null;
    indicators: CompareIndicatorValue[];
  }[];
  meta: {
    indicatorsRequested: number;
    indicatorsWithData: number;
    dataCompleteness: number;
  };
}

export interface CompareIndicatorValue {
  indicatorId: string;
  indicatorName: string;
  slug: string;
  unit: IndicatorUnit;
  value: number | null;
  regionalAverage: number | null;
  continentalAverage: number | null;
  rank: number | null;
  percentile: number | null;
}

export interface CompareRegionsResponse {
  indicator: { name: string; unit: IndicatorUnit };
  year: number;
  regions: {
    region: Region;
    average: number | null;
    median: number | null;
    min: { country: string; value: number } | null;
    max: { country: string; value: number } | null;
    countryCount: number;
    dataAvailability: number;
  }[];
  continentalAverage: number | null;
}

export interface CompareThemesResponse {
  country: { name: string; isoCode3: string; flagEmoji?: string };
  year: number;
  themes: {
    themeId: string;
    themeName: string;
    slug: string;
    averageScore: number | null;
    indicatorCount: number;
    dataAvailability: number;
    rank: number | null;
    bestIndicator: { name: string; value: number; rank: number } | null;
    worstIndicator: { name: string; value: number; rank: number } | null;
  }[];
}

// ---- Authentication Types ----

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
    organization: string | null;
    avatar: string | null;
  };
  tokens: AuthTokens;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  organization: string | null;
  avatar: string | null;
  createdAt: string;
  lastLogin: string | null;
  dashboardCount?: number;
}

// ---- Dashboard Types ----

export interface DashboardSummary {
  id: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  widgetCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardDetail {
  id: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  layout: Record<string, unknown>;
  widgets: DashboardWidget[];
  userId: string;
  creatorName?: string | null;
  creatorOrganization?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---- Export Types ----

export interface ExportMetadata {
  platform: string;
  exportDate: string;
  filters: Record<string, string>;
  recordCount: number;
  source: string;
  license: string;
}

// ---- AI Insights Types ----

export interface Insight {
  id: string;
  type: 'trend' | 'anomaly' | 'comparison' | 'achievement' | 'concern' | 'opportunity';
  title: string;
  description: string;
  severity: 'info' | 'positive' | 'warning' | 'critical';
  confidence: number;
  relatedCountryId?: string;
  relatedCountryName?: string;
  relatedIndicatorId?: string;
  relatedIndicatorName?: string;
  dataPoints?: { label: string; value: number; year: number }[];
  recommendations?: string[];
  generatedAt: string;
  source: 'ai' | 'rule-based';
}

export interface Anomaly {
  countryId: string;
  countryName: string;
  indicatorId: string;
  indicatorName: string;
  value: number;
  mean: number;
  stdDev: number;
  deviations: number;
  direction: 'above' | 'below';
  severity: 'positive' | 'warning' | 'critical';
  year: number;
}

export interface IndicatorCorrelation {
  indicator1: { id: string; name: string; theme: string };
  indicator2: { id: string; name: string; theme: string };
  correlation: number;
  strength: 'strong' | 'moderate';
  direction: 'positive' | 'negative';
  sampleSize: number;
  interpretation: string;
}

// ---- Natural Language Query Types ----

export interface NlqRequest {
  question: string;
  language?: string;
}

export interface NlqResponse {
  question: string;
  answer: string;
  data: Record<string, unknown>[];
  visualization: {
    type: 'bar_chart' | 'line_chart' | 'stat_card' | 'scatter_plot' | 'grouped_bar' | 'radar';
    title: string;
    xAxis?: string;
    yAxis?: string;
  };
  followUpQuestions: string[];
  intent: string;
  source: 'ai' | 'rule-based';
  processingTime: number;
}

// ---- Country Narrative Types ----

export interface CountryNarrative {
  countryId: string;
  countryName: string;
  narrative: string;
  keyStrengths: string[];
  keyChallenges: string[];
  outlook: string;
  generatedAt: string;
  source: 'ai' | 'rule-based';
}

// ---- Policy Monitor Types ----

export type ComplianceTier =
  | 'EXEMPLARY'
  | 'STRONG'
  | 'MODERATE'
  | 'DEVELOPING'
  | 'MINIMAL';

export interface ComplianceComponents {
  aycRatification: number;
  nationalYouthPolicy: number;
  policyCurrency: number;
  wpayCompliance: number;
  policyStatus: number;
  youthIndexPerformance: number;
  dataAvailability: number;
}

export interface PolicyRankingEntry {
  rank: number;
  countryId: string;
  countryName: string;
  isoCode3: string;
  region: Region;
  flagEmoji?: string;
  policyName: string;
  aycRatified: boolean;
  aycRatifiedYear: number | null;
  wpayCompliant: boolean;
  yearAdopted: number | null;
  yearRevised: number | null;
  status: string;
  complianceScore: number;
  tier: ComplianceTier;
  components: ComplianceComponents;
}

export interface PolicyRankingsResponse {
  data: PolicyRankingEntry[];
  meta: {
    year: number;
    totalCountries: number;
    averageScore: number;
    aycRatificationRate: number;
    wpayComplianceRate: number;
    tierDistribution: Record<ComplianceTier, number>;
    region: string;
  };
}

export interface PolicyCountryDetail {
  country: {
    id: string;
    name: string;
    isoCode3: string;
    region: Region;
    flagEmoji?: string;
  };
  policy: {
    policyName: string;
    policyType: string;
    yearAdopted: number | null;
    yearRevised: number | null;
    aycRatified: boolean;
    aycRatifiedYear: number | null;
    wpayCompliant: boolean;
    status: string;
  };
  compliance: {
    overallScore: number;
    tier: ComplianceTier;
    components: ComplianceComponents;
    recommendations: string[];
  };
  context: {
    youthIndexScore: number | null;
    youthIndexRank: number | null;
    youthIndexYear: number | null;
    dataAvailability: number;
  };
}

export interface PolicySummaryResponse {
  continental: {
    totalCountries: number;
    aycRatified: number;
    aycRatificationRate: number;
    wpayCompliant: number;
    wpayComplianceRate: number;
    hasNationalPolicy: number;
    activePolicies: number;
  };
  regions: {
    region: Region;
    totalCountries: number;
    aycRatified: number;
    aycRatificationRate: number;
    wpayCompliant: number;
    wpayComplianceRate: number;
    hasNationalPolicy: number;
    averageComplianceScore: number | null;
  }[];
  recentRatifications: {
    country: string;
    year: number | null;
  }[];
}

// ---- Expert Directory Types ----

export interface ExpertProfile {
  id: string;
  name: string;
  email: string | null;
  title: string;
  organization: string | null;
  country: Pick<Country, 'id' | 'name' | 'isoCode3' | 'flagEmoji'> & { region: Region };
  specializations: string[];
  languages: string[];
  bio: string | null;
  verified: boolean;
  createdAt: string;
}

export interface ExpertSearchResponse {
  data: ExpertProfile[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ExpertStatsResponse {
  totalExperts: number;
  verifiedExperts: number;
  verificationRate: number;
  uniqueOrganizations: number;
  byRegion: Record<string, number>;
  topSpecializations: { name: string; count: number }[];
  topLanguages: { name: string; count: number }[];
  availableSpecializations: string[];
}

// ---- Live Feed / WebSocket Types ----

export interface LiveFeedEvent<T = unknown> {
  event: string;
  timestamp: string;
  data: T;
}

export interface PlatformPulseData {
  totalCountries: number;
  totalIndicators: number;
  totalDataPoints: number;
  totalThemes: number;
  totalExperts: number;
  totalPolicies: number;
  countriesWithIndex: number;
  latestDataYear: number | null;
  uptime: number;
}

export interface DataTickerData {
  indicator: string;
  unit: IndicatorUnit;
  year: number;
  countriesReporting: number;
  continentalAverage: number;
  highest: {
    country: string;
    isoCode3: string;
    flagEmoji?: string;
    value: number;
  } | null;
  lowest: {
    country: string;
    isoCode3: string;
    flagEmoji?: string;
    value: number;
  } | null;
}

export interface SpotlightData {
  country: {
    name: string;
    isoCode3: string;
    region: Region;
    flagEmoji?: string;
    youthPopulation: number;
  };
  youthIndex: {
    score: number;
    rank: number;
    tier: IndexTier;
    year: number;
  } | null;
  policy: {
    aycRatified: boolean;
    complianceScore: number | null;
    status: string;
  } | null;
  dataPoints: number;
  highlight: {
    indicator: string;
    value: number;
    unit: IndicatorUnit;
    year: number;
  } | null;
}

// ---- Search Types ----

export interface SearchResults {
  query: string;
  totalResults: number;
  results: {
    countries: SearchHit[];
    indicators: SearchHit[];
    themes: SearchHit[];
    experts: SearchHit[];
    dashboards: SearchHit[];
  };
  processingTime: number;
}

export interface SearchHit {
  id: string;
  type: 'country' | 'indicator' | 'theme' | 'expert' | 'dashboard';
  title: string;
  subtitle?: string;
  description?: string;
  url: string;
  relevance: number;
  icon?: string;
}

// ---- Admin Types ----

export interface DataGaps {
  year: number;
  totalPossible: number;
  totalAvailable: number;
  completeness: number;
  gapsByCountry: { country: string; isoCode3: string; available: number; missing: number; completeness: number }[];
  gapsByIndicator: { indicator: string; slug: string; available: number; missing: number; completeness: number }[];
  gapsByTheme: { theme: string; completeness: number }[];
}

export interface SystemInfo {
  version: string;
  uptime: number;
  nodeVersion: string;
  modules: number;
  database: { connected: boolean; totalRows: Record<string, number> };
  cache: { entries: number; hitRate: number };
  ai: { available: boolean; model: string };
}

// ---- Embed Types ----

export interface EmbedConfig {
  baseUrl: string;
  examples: Record<string, string>;
  parameters: Record<string, string>;
  notes: string[];
}
