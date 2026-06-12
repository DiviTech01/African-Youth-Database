// API Client utility for AYO Platform
// Wraps fetch with typed responses, error handling, and base URL configuration
import { getSupabaseAccessToken } from '@/lib/supabase-token';

// Resolve the API base URL:
//   1. If VITE_API_URL is an absolute URL (https://…), use it verbatim. Lets
//      a hosted build target a specific backend.
//   2. If running on localhost (vite dev), use the relative `/api` path so
//      vite.config.ts's proxy forwards calls to the local NestJS at :3001.
//      This keeps the browser same-origin and avoids CORS in dev.
//   3. Otherwise (production build served from Cloudflare Pages etc.), point
//      at the Render-deployed API.
const PROD_API_URL = 'https://african-youth-observatory.onrender.com/api';
function resolveApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (envUrl && /^https?:\/\//i.test(envUrl)) return envUrl;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
    if (isLocal) return '/api';
  }
  return envUrl || PROD_API_URL;
}
const API_BASE_URL = resolveApiBaseUrl();

// ─── Shared Types (API Contract) ─────────────────────────────────────────────

export interface Country {
  id: string;
  name: string;
  isoCode: string;
  iso3Code: string;
  flagEmoji: string;
  capital: string;
  region: 'North Africa' | 'West Africa' | 'East Africa' | 'Central Africa' | 'Southern Africa';
  population: number;
  youthPopulation: number;
  currency: string;
  languages: string[];
  economicBlocs: string[];
}

export interface Theme {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  indicatorCount: number;
  color: string;
}

export interface Indicator {
  id: string;
  name: string;
  slug: string;
  description: string;
  unit: string;
  themeId: string;
  source: string;
  methodology: string;
}

export interface IndicatorValue {
  id: string;
  indicatorId: string;
  countryId: string;
  year: number;
  value: number;
  gender?: 'male' | 'female' | 'total';
  ageGroup?: string;
  source: string;
}

export interface YouthIndexScore {
  countryId: string;
  country: Country;
  overallScore: number;
  rank: number;
  previousRank?: number;
  dimensions: {
    education: number;
    employment: number;
    health: number;
    civic: number;
    innovation: number;
  };
  tier: 'high' | 'medium' | 'low';
  year: number;
}

export interface PolicyMonitorEntry {
  countryId: string;
  country: Country;
  aycRatified: boolean;
  aycRatificationDate?: string;
  nationalYouthPolicy: boolean;
  policyName?: string;
  policyYear?: number;
  complianceScore: number;
  wpayCompliance: boolean;
  agenda2063Score: number;
}

export interface Expert {
  id: string;
  name: string;
  title: string;
  organization: string;
  country: string;
  specialization: string[];
  languages: string[];
  bio: string;
  photoUrl?: string;
  verified: boolean;
}

export interface InsightCard {
  id: string;
  countryId?: string;
  type: 'trend' | 'anomaly' | 'comparison' | 'recommendation';
  severity: 'info' | 'warning' | 'critical' | 'positive';
  title: string;
  summary: string;
  detail: string;
  indicator?: string;
  direction?: 'up' | 'down' | 'stable';
  generatedAt: string;
}

export interface DashboardConfig {
  id: string;
  userId: string;
  name: string;
  widgets: DashboardWidget[];
  isPublic: boolean;
  shareLink?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardWidget {
  id: string;
  type: 'bar' | 'line' | 'area' | 'radar' | 'scatter' | 'heatmap' | 'stat';
  title: string;
  indicatorId?: string;
  countryIds: string[];
  config: Record<string, unknown>;
  position: { x: number; y: number; w: number; h: number };
}

export interface DataFilters {
  countryIds?: string[];
  themeId?: string;
  indicatorId?: string;
  yearStart?: number;
  yearEnd?: number;
  gender?: 'male' | 'female' | 'total';
  region?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── API Error ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body?: unknown
  ) {
    super(`API Error ${status}: ${statusText}`);
    this.name = 'ApiError';
  }
}

// ─── Fetch Wrapper ───────────────────────────────────────────────────────────

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Attach Supabase auth token if available
  const token = getSupabaseAccessToken();
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, response.statusText, body);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// ─── API Methods ─────────────────────────────────────────────────────────────

export const api = {
  // Countries
  countries: {
    list: (params?: { region?: string; search?: string }) =>
      request<Country[]>(`/countries${toQuery(params)}`),
    get: (id: string) =>
      request<Country>(`/countries/${id}`),
  },

  // Themes
  themes: {
    list: () => request<Theme[]>('/themes'),
    get: (id: string) => request<Theme>(`/themes/${id}`),
  },

  // Indicators
  indicators: {
    list: (params?: { themeId?: string }) =>
      request<Indicator[]>(`/indicators${toQuery(params)}`),
    get: (id: string) =>
      request<Indicator>(`/indicators/${id}`),
    values: (id: string, filters?: DataFilters) =>
      request<IndicatorValue[]>(`/indicators/${id}/values${toQuery(filters)}`),
  },

  // Data
  data: {
    values: (filters: DataFilters) =>
      request<IndicatorValue[]>(`/data/values${toQuery(filters)}`),
    timeseries: (filters: DataFilters) =>
      request<IndicatorValue[]>(`/data/timeseries${toQuery(filters)}`),
    map: (indicatorId: string, year?: number) =>
      request<Array<{ countryId: string; value: number }>>(`/data/map${toQuery({ indicatorId, year })}`),
    comparison: (countryIds: string[], indicatorIds: string[]) =>
      request<Record<string, IndicatorValue[]>>(`/data/comparison${toQuery({ countryIds: countryIds.join(','), indicatorIds: indicatorIds.join(',') })}`),
    regionalAverages: (indicatorId: string) =>
      request<Array<{ region: string; value: number }>>(`/data/regional-averages${toQuery({ indicatorId })}`),
  },

  // Youth Index
  youthIndex: {
    rankings: (params?: { year?: number }) =>
      request<YouthIndexScore[]>(`/youth-index/rankings${toQuery(params)}`),
    get: (countryId: string) =>
      request<YouthIndexScore>(`/youth-index/${countryId}`),
  },

  // Policy Monitor
  policyMonitor: {
    rankings: () =>
      request<PolicyMonitorEntry[]>('/policy-monitor/rankings'),
    get: (countryId: string) =>
      request<PolicyMonitorEntry>(`/policy-monitor/${countryId}`),
  },

  // Insights (AI)
  insights: {
    forCountry: (countryId: string) =>
      request<InsightCard[]>(`/insights/${countryId}`),
    anomalies: () =>
      request<InsightCard[]>('/insights/anomalies'),
    correlations: () =>
      request<InsightCard[]>('/insights/correlations'),
  },

  // Experts
  experts: {
    list: (params?: { country?: string; specialization?: string; search?: string }) =>
      request<Expert[]>(`/experts${toQuery(params)}`),
    get: (id: string) =>
      request<Expert>(`/experts/${id}`),
    register: (data: Omit<Expert, 'id' | 'verified'>) =>
      request<Expert>('/experts', { method: 'POST', body: JSON.stringify(data) }),
  },

  // Dashboards
  dashboards: {
    list: () =>
      request<DashboardConfig[]>('/dashboards'),
    get: (id: string) =>
      request<DashboardConfig>(`/dashboards/${id}`),
    create: (data: Omit<DashboardConfig, 'id' | 'createdAt' | 'updatedAt'>) =>
      request<DashboardConfig>('/dashboards', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<DashboardConfig>) =>
      request<DashboardConfig>(`/dashboards/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<void>(`/dashboards/${id}`, { method: 'DELETE' }),
  },

  // Export
  export: {
    csv: (filters: DataFilters) =>
      request<Blob>(`/export/csv${toQuery(filters)}`),
    json: (filters: DataFilters) =>
      request<Blob>(`/export/json${toQuery(filters)}`),
    excel: (filters: DataFilters) =>
      request<Blob>(`/export/excel${toQuery(filters)}`),
  },

  // Compare (real backend — replaces the old fabricated comparison page)
  compare: {
    countries: (body: { countryIds: string[]; indicatorIds?: string[]; year?: number; includeRegionalAverage?: boolean }) =>
      request<CompareCountriesResult>('/compare/countries', { method: 'POST', body: JSON.stringify(body) }),
    themes: (countryId: string, year?: number) =>
      request<CompareThemesResult>(`/compare/themes${toQuery({ countryId, year })}`),
    regions: (indicatorId: string, year?: number) =>
      request<CompareRegionsResult>(`/compare/regions${toQuery({ indicatorId, year })}`),
  },

  // Platform stats (real headline numbers for landing/map counters)
  platform: {
    stats: () => request<PlatformStats>('/platform/stats'),
    health: () => request<{ status: string; database: string; uptime: number }>('/platform/health'),
  },

  // Documents (real uploaded reports — replaces localStorage Reports store)
  documents: {
    list: (params?: { countryId?: string; type?: string; limit?: number }) =>
      request<DocumentSummary[]>(`/documents${toQuery(params)}`),
    get: (id: string) => request<DocumentSummary>(`/documents/${id}`),
    downloadUrl: (id: string, disposition: 'attachment' | 'inline' = 'attachment') =>
      `${API_BASE_URL}/documents/${id}/download${toQuery({ disposition })}`,
  },

  // Generated insight reports (Claude-authored, cached 24h, downloadable, sendable)
  insightReports: {
    get: (id: string) => request<InsightReportDetail>(`/insight-reports/${id}`),
    generate: (body: { scope: 'continental' | 'country' | 'theme'; countryId?: string; themeId?: string; year?: number }) =>
      request<InsightReportDetail>('/insight-reports/generate', { method: 'POST', body: JSON.stringify(body) }),
    downloadUrl: (id: string) => `${API_BASE_URL}/insight-reports/${id}/download`,
    // Admin only — emails the report to an audience via the newsletter pipeline.
    send: (id: string, body: { audience: 'subscribers' | 'users' | 'all' }) =>
      request<{ campaignId: string; audience: string; recipientCount: number }>(`/insight-reports/${id}/send`, { method: 'POST', body: JSON.stringify(body) }),
  },

};

// ─── Additional response types for the real-data wiring ──────────────────────

export interface PlatformStats {
  totalCountries: number;
  totalIndicators: number;
  totalDataPoints: number;
  totalThemes: number;
  dataYearRange: { earliest: number | null; latest: number | null };
  countriesWithData: number;
  lastUpdated: string;
  dataCompleteness: number;
  topDataCountries: { name: string; dataPoints: number }[];
}

export interface CompareCountryIndicator {
  indicatorId: string;
  indicatorName: string;
  slug: string;
  unit: string;
  value: number | null;
  regionalAverage: number | null;
  continentalAverage: number | null;
  rank: number | null;
  percentile: number | null;
}

export interface CompareCountryResult {
  countryId: string;
  countryName: string;
  isoCode3: string;
  flagEmoji: string;
  region: string;
  youthIndexRank: number | null;
  youthIndexScore: number | null;
  indicators: CompareCountryIndicator[];
}

export interface CompareCountriesResult {
  year: number;
  countries: CompareCountryResult[];
  meta: { indicatorsRequested: number; indicatorsWithData: number; dataCompleteness: number };
}

export interface CompareThemeResult {
  themeId: string;
  themeName: string;
  slug: string;
  averageScore: number | null;
  indicatorCount: number;
  dataAvailability: number;
  rank: number | null;
  bestIndicator: { name: string; value: number; rank: number } | null;
  worstIndicator: { name: string; value: number; rank: number } | null;
}

export interface CompareThemesResult {
  country: { name: string; isoCode3: string; flagEmoji: string; region: string };
  year: number;
  themes: CompareThemeResult[];
}

export interface CompareRegionsResult {
  indicator: { name: string; unit: string };
  year: number;
  regions: {
    region: string;
    average: number | null;
    median: number | null;
    min: { country: string; value: number } | null;
    max: { country: string; value: number } | null;
    countryCount: number;
    dataAvailability: number;
  }[];
  continentalAverage: number | null;
}

export interface DocumentSummary {
  id: string;
  type: string;
  title: string;
  description: string | null;
  country: { id: string; name: string; isoCode3: string } | null;
  countryId: string | null;
  originalFilename: string;
  mimeType: string | null;
  fileSize: number | null;
  source: string | null;
  edition: string | null;
  year: number | null;
  status: string;
  createdAt: string;
  downloadUrl: string;
}

export interface InsightReportSummary {
  id: string;
  scope: 'continental' | 'country' | 'theme';
  title: string;
  summary: string | null;
  countryId: string | null;
  themeId: string | null;
  year: number | null;
  createdAt: string;
  lastSentAt: string | null;
}

export interface InsightReportDetail extends InsightReportSummary {
  html: string;
  sections: { heading: string; body: string }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toQuery(params?: Record<string, unknown>): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ''
  );
  if (entries.length === 0) return '';
  const searchParams = new URLSearchParams();
  entries.forEach(([key, value]) => searchParams.append(key, String(value)));
  return `?${searchParams.toString()}`;
}
