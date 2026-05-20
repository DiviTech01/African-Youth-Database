// ============================================
// AFRICAN YOUTH OBSERVATORY - TYPE DEFINITIONS
// Based on Database Schema & ER Model
// ============================================

// ============================================
// 1. GEOGRAPHY & CLASSIFICATION
// ============================================

export type RegionType = 'North Africa' | 'West Africa' | 'Central Africa' | 'East Africa' | 'Southern Africa';
export type EconomicBlockType = 'ECOWAS' | 'SADC' | 'EAC' | 'CEMAC' | 'AMU' | 'COMESA' | 'IGAD';

export interface Country {
  id: string;
  name: string;
  isoCode: string; // ISO 3166-1 alpha-3
  iso2Code: string; // ISO 3166-1 alpha-2
  region: RegionType;
  capital: string;
  population: number;
  youthPopulation: number; // Ages 15-35
  youthPercentage: number;
  area: number; // km²
  currency: string;
  languages: string[];
  economicBlocks: EconomicBlockType[];
  flagEmoji: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Region {
  id: string;
  name: RegionType;
  type: 'geographic' | 'economic';
  countries: string[]; // Country IDs
  description: string;
}

// ============================================
// 2. USERS & ACCESS CONTROL
// ============================================

export type UserRole = 'public' | 'registered' | 'researcher' | 'contributor' | 'admin';
export type OrganizationType = 'government' | 'ngo' | 'university' | 'private' | 'international' | 'media';

export interface User {
  id: string;
  fullName: string;
  email: string;
  passwordHash?: string; // Not exposed in frontend
  role: UserRole;
  organizationId?: string;
  avatar?: string;
  bio?: string;
  isVerified: boolean;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  countryId: string;
  website?: string;
  logo?: string;
  description?: string;
  isVerified: boolean;
  contactEmail?: string;
  createdAt: Date;
}

// ============================================
// 3. THEMES & INDICATORS
// ============================================

export type ThemeSlug = 
  | 'education' 
  | 'employment' 
  | 'health' 
  | 'agriculture' 
  | 'gender' 
  | 'innovation' 
  | 'civic-engagement'
  | 'environment'
  | 'finance';

export interface Theme {
  id: string;
  name: string;
  slug: ThemeSlug;
  description: string;
  icon: string; // Lucide icon name
  color: string; // Hex color
  indicatorCount: number;
  order: number;
}

export type IndicatorUnit = 
  | 'percentage' 
  | 'number' 
  | 'index' 
  | 'ratio' 
  | 'rate_per_1000' 
  | 'rate_per_100000'
  | 'years'
  | 'currency_usd'
  | 'score';

export interface Indicator {
  id: string;
  name: string;
  shortName: string;
  code: string; // Unique code like "EDU001"
  unit: IndicatorUnit;
  description: string;
  themeId: string;
  methodology: string;
  sourceDefault?: string;
  minValue?: number;
  maxValue?: number;
  isHigherBetter: boolean; // For index calculations
  isPublic: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// 4. DATASETS
// ============================================

export type DatasetStatus = 'draft' | 'pending' | 'approved' | 'archived' | 'rejected';

export interface Dataset {
  id: string;
  title: string;
  description: string;
  sourceOrganizationId: string;
  sourceUrl?: string;
  methodology: string;
  yearStart: number;
  yearEnd: number;
  countryCount: number;
  indicatorCount: number;
  status: DatasetStatus;
  credibilityScore: number; // 0-100
  downloadCount: number;
  citationCount: number;
  license: string;
  createdById: string;
  approvedById?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatasetVersion {
  id: string;
  datasetId: string;
  version: string;
  changeLog: string;
  createdById: string;
  createdAt: Date;
}

// ============================================
// 5. DATA VALUES (FACT TABLE) - Core of AYO
// ============================================

export type GenderType = 'male' | 'female' | 'total';
export type AgeGroup = '15-19' | '20-24' | '25-29' | '30-35' | '15-24' | '15-35' | 'all';

export interface IndicatorValue {
  id: string;
  indicatorId: string;
  countryId: string;
  year: number;
  value: number;
  gender: GenderType;
  ageGroup: AgeGroup;
  datasetId: string;
  confidenceScore: number; // 0.00 - 1.00
  isEstimate: boolean;
  isProjected: boolean;
  notes?: string;
  createdAt: Date;
}

// Aggregated view for charts
export interface IndicatorTimeSeries {
  indicatorId: string;
  indicatorName: string;
  countryId: string;
  countryName: string;
  unit: IndicatorUnit;
  data: Array<{
    year: number;
    value: number;
    gender?: GenderType;
    ageGroup?: AgeGroup;
  }>;
}

// ============================================
// 6. AFRICAN YOUTH INDEX
// ============================================

export interface YouthIndex {
  id: string;
  countryId: string;
  year: number;
  indexScore: number; // 0-100
  rank: number;
  previousRank?: number;
  rankChange: number;
  percentile: number;
  tier: 'high' | 'medium-high' | 'medium' | 'medium-low' | 'low';
  // Dimension scores
  educationScore: number;
  healthScore: number;
  employmentScore: number;
  civicScore: number;
  innovationScore: number;
  createdAt: Date;
}

export interface YouthIndexComponent {
  id: string;
  youthIndexId: string;
  indicatorId: string;
  dimensionName: string; // Education, Employment, Health, Civic
  weight: number; // 0.00 - 1.00
  rawScore: number;
  normalizedScore: number; // 0-100
  contribution: number; // Contribution to final score
}

export interface YouthIndexDimension {
  name: string;
  weight: number;
  color: string;
  indicators: string[]; // Indicator IDs
  description: string;
}

// ============================================
// 7. DASHBOARDS & VISUALIZATIONS
// ============================================

export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'map' | 'scatter' | 'radar' | 'treemap';

export interface Dashboard {
  id: string;
  userId: string;
  title: string;
  description?: string;
  isPublic: boolean;
  isTemplate: boolean;
  slug: string;
  viewCount: number;
  widgets: DashboardWidget[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardWidget {
  id: string;
  dashboardId: string;
  chartType: ChartType;
  title: string;
  indicatorIds: string[];
  countryIds: string[];
  yearRange: [number, number];
  config: WidgetConfig;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface WidgetConfig {
  showLegend: boolean;
  showGrid: boolean;
  showTooltip: boolean;
  colorScheme: string;
  animated: boolean;
  stacked?: boolean;
  comparison?: 'absolute' | 'percentage';
}

// ============================================
// 8. AI INSIGHTS & REPORTS
// ============================================

export type InsightEntityType = 'country' | 'indicator' | 'dataset' | 'theme' | 'comparison';
export type InsightType = 'trend' | 'anomaly' | 'comparison' | 'prediction' | 'summary';

export interface AIInsight {
  id: string;
  entityType: InsightEntityType;
  entityId: string;
  insightType: InsightType;
  title: string;
  summary: string;
  details?: string;
  confidence: number; // 0-100
  isApproved: boolean;
  approvedById?: string;
  generatedAt: Date;
  expiresAt?: Date;
}

export interface Report {
  id: string;
  title: string;
  slug: string;
  content: string; // Rich text / MDX
  excerpt: string;
  coverImage?: string;
  year: number;
  type: 'annual' | 'thematic' | 'country' | 'brief';
  themeId?: string;
  countryIds: string[];
  isPublished: boolean;
  publishedAt?: Date;
  authorId: string;
  downloadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// 9. API & USAGE TRACKING
// ============================================

export type APITier = 'free' | 'basic' | 'premium' | 'enterprise';

export interface APIKey {
  id: string;
  userId: string;
  key: string;
  name: string;
  tier: APITier;
  rateLimit: number; // Requests per hour
  isActive: boolean;
  lastUsedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
}

export interface APIUsage {
  id: string;
  apiKeyId: string;
  endpoint: string;
  method: string;
  requestCount: number;
  responseTime: number; // ms
  statusCode: number;
  timestamp: Date;
}

// ============================================
// 10. AUDIT & LOGS
// ============================================

export type AuditAction = 
  | 'create' 
  | 'update' 
  | 'delete' 
  | 'approve' 
  | 'reject' 
  | 'download' 
  | 'export'
  | 'login'
  | 'logout';

export interface AuditLog {
  id: string;
  userId?: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

// ============================================
// 11. FILTER & QUERY TYPES
// ============================================

export interface DataFilters {
  countryIds?: string[];
  themeIds?: string[];
  indicatorIds?: string[];
  yearRange?: [number, number];
  gender?: GenderType;
  ageGroup?: AgeGroup;
  region?: RegionType;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ============================================
// 12. COMPARISON TYPES
// ============================================

export interface CountryComparison {
  countries: Country[];
  indicators: Indicator[];
  data: Array<{
    indicatorId: string;
    indicatorName: string;
    unit: IndicatorUnit;
    values: Array<{
      countryId: string;
      countryName: string;
      value: number;
      year: number;
      trend: 'up' | 'down' | 'stable';
    }>;
  }>;
}

// ============================================
// 13. CHART DATA TYPES
// ============================================

export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

export interface TimeSeriesDataPoint {
  year: number;
  [key: string]: number;
}

export interface MapDataPoint {
  countryId: string;
  countryName: string;
  isoCode: string;
  value: number;
  formattedValue: string;
}

// ============================================
// 14. STATISTICS & AGGREGATIONS
// ============================================

export interface CountryStats {
  countryId: string;
  countryName: string;
  youthIndexRank?: number;
  youthIndexScore?: number;
  topIndicators: Array<{
    indicatorId: string;
    indicatorName: string;
    value: number;
    unit: IndicatorUnit;
    trend: 'up' | 'down' | 'stable';
  }>;
  keyInsights: string[];
}

export interface ThemeStats {
  themeId: string;
  themeName: string;
  averageScore: number;
  topCountries: Array<{
    countryId: string;
    countryName: string;
    score: number;
  }>;
  indicatorCount: number;
  dataPointCount: number;
}

export interface PlatformStats {
  totalCountries: number;
  totalIndicators: number;
  totalDataPoints: number;
  totalDatasets: number;
  totalUsers: number;
  latestDataYear: number;
  coveragePercentage: number;
}
