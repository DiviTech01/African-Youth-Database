// ============================================
// AFRICAN YOUTH OBSERVATORY — REAL API SERVICE
// ============================================
//
// Every method here makes a live HTTP call to the NestJS backend at
// /api/... and returns the response with no synthesised values, no
// fallbacks, and no mock data. If a record doesn't exist for a country,
// indicator, or year, the API returns null/empty and consumers render a
// "—" placeholder. This is by admin command: the platform must surface
// only data that contributors have actually uploaded.
//
// Method signatures preserve the legacy mock layer's shape (`getAll`,
// `getById`, etc.) so every consumer in `src/hooks/useData.ts` and the
// pages it powers picks up real data automatically with no edits.

import { authHeader } from '@/lib/supabase-token';
import type {
  Country,
  Theme,
  Indicator,
  IndicatorValue,
  YouthIndex,
  CountryStats,
  ThemeStats,
  PlatformStats,
  DataFilters,
  IndicatorTimeSeries,
  CountryComparison,
  ChartDataPoint,
  TimeSeriesDataPoint,
  MapDataPoint,
  RegionType,
} from '@/types';

// ─── Base URL resolution ─────────────────────────────────────────────────
// In dev the Vite proxy forwards /api → http://localhost:3001. On Cloudflare
// Pages there's no proxy, so we resolve to the Render-hosted production API
// when the build is served from anywhere other than localhost.
const RENDER_API_URL = 'https://african-youth-observatory.onrender.com/api';

function resolveApiBase(): string {
  const viteUrl = (import.meta as any).env?.VITE_API_URL as string | undefined;
  if (viteUrl && /^https?:\/\//i.test(viteUrl)) return viteUrl;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
    if (!isLocal) return RENDER_API_URL;
  }
  return '/api';
}

const API_BASE = resolveApiBase();

// ─── Tiny fetch helper ───────────────────────────────────────────────────
// Returns parsed JSON on 2xx, the typed `fallback` on 404 (so consumers can
// render a "—" without try/catch boilerplate), and throws on every other
// failure so React Query surfaces the error state.
async function http<T>(path: string, opts: RequestInit = {}, fallback?: T): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...authHeader(),
      ...(opts.headers ?? {}),
    },
  });
  if (res.status === 404 && fallback !== undefined) return fallback;
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${path} → ${res.status}${body ? ` · ${body.slice(0, 120)}` : ''}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

// Many list endpoints respond as either `T[]` directly or `{ data: T[] }`
// depending on whether they're paginated. Normalise to a flat array.
function unwrapList<T>(payload: any): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (Array.isArray(payload?.data)) return payload.data as T[];
  return [];
}

function toQuery(params?: Record<string, unknown>): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!entries.length) return '';
  const qs = new URLSearchParams();
  for (const [k, v] of entries) {
    if (Array.isArray(v)) qs.set(k, v.join(','));
    else qs.set(k, String(v));
  }
  return `?${qs.toString()}`;
}

// ─── Country API ─────────────────────────────────────────────────────────

export const countryApi = {
  async getAll(): Promise<Country[]> {
    return unwrapList<Country>(await http(`/countries`));
  },

  async getById(id: string): Promise<Country | null> {
    return http<Country | null>(`/countries/${encodeURIComponent(id)}`, {}, null);
  },

  /** Resolved server-side via the same alias map (DRC, Cameroun, etc.). */
  async getByIsoCode(isoCode: string): Promise<Country | null> {
    return http<Country | null>(`/countries/${encodeURIComponent(isoCode)}`, {}, null);
  },

  async getByRegion(region: RegionType): Promise<Country[]> {
    return unwrapList<Country>(await http(`/countries${toQuery({ region })}`));
  },

  async getStats(countryId: string, year?: number): Promise<CountryStats> {
    return http<CountryStats>(`/countries/${encodeURIComponent(countryId)}/stats${toQuery({ year })}`);
  },

  async getRegions(): Promise<{ name: string; countryCount: number }[]> {
    return unwrapList(await http(`/countries/regions`));
  },

  async search(query: string): Promise<Country[]> {
    return unwrapList<Country>(await http(`/countries${toQuery({ search: query })}`));
  },
};

// ─── Theme API ───────────────────────────────────────────────────────────

export const themeApi = {
  async getAll(): Promise<Theme[]> {
    return unwrapList<Theme>(await http(`/themes`));
  },

  async getById(id: string): Promise<Theme | null> {
    return http<Theme | null>(`/themes/${encodeURIComponent(id)}`, {}, null);
  },

  async getStats(themeId: string, year?: number): Promise<ThemeStats> {
    return http<ThemeStats>(`/themes/${encodeURIComponent(themeId)}/stats${toQuery({ year })}`);
  },
};

// ─── Indicator API ───────────────────────────────────────────────────────

export const indicatorApi = {
  async getAll(): Promise<Indicator[]> {
    return unwrapList<Indicator>(await http(`/indicators`));
  },

  async getById(id: string): Promise<Indicator | null> {
    return http<Indicator | null>(`/indicators/${encodeURIComponent(id)}`, {}, null);
  },

  async getByTheme(themeId: string): Promise<Indicator[]> {
    return unwrapList<Indicator>(await http(`/indicators${toQuery({ themeId })}`));
  },

  async search(query: string): Promise<Indicator[]> {
    return unwrapList<Indicator>(await http(`/indicators${toQuery({ search: query })}`));
  },
};

// ─── Data API ────────────────────────────────────────────────────────────

export const dataApi = {
  async getIndicatorValues(filters: DataFilters): Promise<IndicatorValue[]> {
    return unwrapList<IndicatorValue>(await http(`/data/values${toQuery(filters as Record<string, unknown>)}`));
  },

  async getTimeSeries(
    countryId: string,
    indicatorId: string,
    yearRange?: [number, number],
  ): Promise<IndicatorTimeSeries> {
    const params: Record<string, unknown> = { countryId, indicatorId };
    if (yearRange) {
      params.yearStart = yearRange[0];
      params.yearEnd = yearRange[1];
    }
    return http<IndicatorTimeSeries>(`/data/timeseries${toQuery(params)}`);
  },

  async getComparisonData(
    countryIds: string[],
    indicatorId: string,
    year?: number,
  ): Promise<ChartDataPoint[]> {
    return unwrapList<ChartDataPoint>(
      await http(`/data/comparison${toQuery({ countryIds, indicatorId, year })}`),
    );
  },

  async getMapData(indicatorId: string, year?: number): Promise<MapDataPoint[]> {
    return unwrapList<MapDataPoint>(await http(`/data/map${toQuery({ indicatorId, year })}`));
  },

  async getChartTimeSeries(
    countryIds: string[],
    indicatorId: string,
    yearRange?: [number, number],
  ): Promise<TimeSeriesDataPoint[]> {
    const params: Record<string, unknown> = { countryIds, indicatorId };
    if (yearRange) {
      params.yearStart = yearRange[0];
      params.yearEnd = yearRange[1];
    }
    return unwrapList<TimeSeriesDataPoint>(await http(`/data/chart-timeseries${toQuery(params)}`));
  },

  async getBarChartData(
    indicatorId: string,
    year?: number,
    limit?: number,
    sortOrder?: 'asc' | 'desc',
  ): Promise<ChartDataPoint[]> {
    return unwrapList<ChartDataPoint>(
      await http(`/data/bar-chart${toQuery({ indicatorId, year, limit, sortOrder })}`),
    );
  },

  async getRegionalData(indicatorId: string, year?: number): Promise<ChartDataPoint[]> {
    return unwrapList<ChartDataPoint>(
      await http(`/data/regional-averages${toQuery({ indicatorId, year })}`),
    );
  },
};

// ─── Youth Index API ─────────────────────────────────────────────────────
// All scores come from the `YouthIndexScore` table — populated by the calculator
// that runs canonical min-max normalisation over real `IndicatorValue` rows.
// The backend stores per-theme scores in `dimensionScores: Json` keyed by theme
// slug; the normalizer below also populates legacy flat fields (educationScore
// etc.) so pages not yet migrated to the 7-theme shape keep working.

function normalizeYouthIndex(r: any): YouthIndex {
  const d: Record<string, number> =
    (r && r.dimensions && typeof r.dimensions === 'object') ? r.dimensions : {};
  const demography      = d['youth-demography-participation'] ?? 50;
  const education       = d['education']        ?? r?.educationScore  ?? 50;
  const employment      = d['employment']       ?? r?.employmentScore ?? 50;
  const health          = d['health']           ?? r?.healthScore     ?? 50;
  const entrepreneurship = d['entrepreneurship'] ?? r?.innovationScore ?? 50;
  const peaceSecurity   = d['peace-security']   ?? 50;
  const accessToJustice = d['access-to-justice'] ?? 50;
  return {
    ...r,
    indexScore: r?.indexScore ?? r?.overallScore ?? 0,
    dimensions: {
      'youth-demography-participation': demography,
      'education':                       education,
      'employment':                      employment,
      'health':                          health,
      'entrepreneurship':                entrepreneurship,
      'peace-security':                  peaceSecurity,
      'access-to-justice':               accessToJustice,
    },
    educationScore: education,
    employmentScore: employment,
    healthScore: health,
    civicScore: demography,           // legacy: civic folded into demography & participation
    innovationScore: entrepreneurship, // legacy: innovation folded into entrepreneurship
  } as YouthIndex;
}

export const youthIndexApi = {
  async getRankings(year?: number): Promise<YouthIndex[]> {
    const payload = await http<any>(`/youth-index/rankings${toQuery({ year })}`);
    return unwrapList<any>(payload).map(normalizeYouthIndex);
  },

  async getByCountry(countryId: string, year?: number): Promise<YouthIndex | null> {
    const payload = await http<any>(
      `/youth-index/${encodeURIComponent(countryId)}${toQuery({ year })}`,
      {},
      null,
    );
    if (!payload) return null;
    if (Array.isArray(payload?.scores)) {
      const target = year
        ? payload.scores.find((s: any) => s.year === year)
        : payload.scores[0];
      return target ? normalizeYouthIndex(target) : null;
    }
    return normalizeYouthIndex(payload);
  },

  async getHistory(countryId: string): Promise<YouthIndex[]> {
    const payload = await http<any>(`/youth-index/${encodeURIComponent(countryId)}`);
    return unwrapList<any>(payload?.scores ?? payload).map(normalizeYouthIndex);
  },

  async getTopPerformers(limit: number = 10, year?: number): Promise<YouthIndex[]> {
    return unwrapList<any>(await http(`/youth-index/top/${limit}${toQuery({ year })}`)).map(normalizeYouthIndex);
  },

  async getMostImproved(limit: number = 10, year?: number): Promise<YouthIndex[]> {
    return unwrapList<any>(
      await http(`/youth-index/most-improved/${limit}${toQuery({ year })}`),
    ).map(normalizeYouthIndex);
  },
};

// ─── Comparison API ──────────────────────────────────────────────────────

export const comparisonApi = {
  async compareCountries(
    countryIds: string[],
    indicatorIds: string[],
    year?: number,
  ): Promise<CountryComparison> {
    return http<CountryComparison>(
      `/data/comparison${toQuery({ countryIds, indicatorIds, year })}`,
    );
  },
};

// ─── Platform API ────────────────────────────────────────────────────────

export const platformApi = {
  async getStats(): Promise<PlatformStats> {
    return http<PlatformStats>(`/platform/stats`);
  },
};

// ─── Unified API export ──────────────────────────────────────────────────

export const api = {
  countries: countryApi,
  themes: themeApi,
  indicators: indicatorApi,
  data: dataApi,
  youthIndex: youthIndexApi,
  comparison: comparisonApi,
  platform: platformApi,
};

export default api;
