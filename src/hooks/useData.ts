// ============================================
// AFRICAN YOUTH OBSERVATORY - REACT QUERY HOOKS
// Custom hooks for data fetching with caching
// ============================================

import { useQuery, useQueries } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { DataFilters, RegionType } from '@/types';

// ============================================
// QUERY KEYS
// ============================================

export const queryKeys = {
  // Countries
  countries: ['countries'] as const,
  country: (id: string) => ['countries', id] as const,
  countryStats: (id: string, year?: number) => ['countries', id, 'stats', year] as const,
  countriesByRegion: (region: RegionType) => ['countries', 'region', region] as const,
  regions: ['regions'] as const,

  // Themes
  themes: ['themes'] as const,
  theme: (id: string) => ['themes', id] as const,
  themeStats: (id: string, year?: number) => ['themes', id, 'stats', year] as const,

  // Indicators
  indicators: ['indicators'] as const,
  indicator: (id: string) => ['indicators', id] as const,
  indicatorsByTheme: (themeId: string) => ['indicators', 'theme', themeId] as const,

  // Data
  indicatorValues: (filters: DataFilters) => ['data', 'values', filters] as const,
  timeSeries: (countryId: string, indicatorId: string, yearRange?: [number, number]) => 
    ['data', 'timeSeries', countryId, indicatorId, yearRange] as const,
  mapData: (indicatorId: string, year?: number) => ['data', 'map', indicatorId, year] as const,

  // Youth Index
  youthIndexRankings: (year?: number) => ['youthIndex', 'rankings', year] as const,
  youthIndexByCountry: (countryId: string, year?: number) => ['youthIndex', 'country', countryId, year] as const,
  youthIndexHistory: (countryId: string) => ['youthIndex', 'history', countryId] as const,

  // Platform
  platformStats: ['platform', 'stats'] as const,
};

// ============================================
// COUNTRY HOOKS
// ============================================

export const useCountries = () => {
  return useQuery({
    queryKey: queryKeys.countries,
    queryFn: () => api.countries.getAll(),
    staleTime: 1000 * 60 * 60, // 1 hour
  });
};

export const useCountry = (id: string) => {
  return useQuery({
    queryKey: queryKeys.country(id),
    queryFn: () => api.countries.getById(id),
    enabled: !!id,
  });
};

export const useCountryStats = (countryId: string, year?: number) => {
  return useQuery({
    queryKey: queryKeys.countryStats(countryId, year),
    queryFn: () => api.countries.getStats(countryId, year),
    enabled: !!countryId,
  });
};

export const useCountriesByRegion = (region: RegionType) => {
  return useQuery({
    queryKey: queryKeys.countriesByRegion(region),
    queryFn: () => api.countries.getByRegion(region),
    enabled: !!region,
  });
};

export const useRegions = () => {
  return useQuery({
    queryKey: queryKeys.regions,
    queryFn: () => api.countries.getRegions(),
    staleTime: 1000 * 60 * 60, // 1 hour
  });
};

// ============================================
// THEME HOOKS
// ============================================

export const useThemes = () => {
  return useQuery({
    queryKey: queryKeys.themes,
    queryFn: () => api.themes.getAll(),
    staleTime: 1000 * 60 * 60, // 1 hour
  });
};

export const useTheme = (id: string) => {
  return useQuery({
    queryKey: queryKeys.theme(id),
    queryFn: () => api.themes.getById(id),
    enabled: !!id,
  });
};

export const useThemeStats = (themeId: string, year?: number) => {
  return useQuery({
    queryKey: queryKeys.themeStats(themeId, year),
    queryFn: () => api.themes.getStats(themeId, year),
    enabled: !!themeId,
  });
};

// ============================================
// INDICATOR HOOKS
// ============================================

export const useIndicators = () => {
  return useQuery({
    queryKey: queryKeys.indicators,
    queryFn: () => api.indicators.getAll(),
    staleTime: 1000 * 60 * 60, // 1 hour
  });
};

export const useIndicator = (id: string) => {
  return useQuery({
    queryKey: queryKeys.indicator(id),
    queryFn: () => api.indicators.getById(id),
    enabled: !!id,
  });
};

export const useIndicatorsByTheme = (themeId: string) => {
  return useQuery({
    queryKey: queryKeys.indicatorsByTheme(themeId),
    queryFn: () => api.indicators.getByTheme(themeId),
    enabled: !!themeId,
  });
};

// ============================================
// DATA HOOKS
// ============================================

export const useIndicatorValues = (filters: DataFilters) => {
  return useQuery({
    queryKey: queryKeys.indicatorValues(filters),
    queryFn: () => api.data.getIndicatorValues(filters),
  });
};

export const useTimeSeries = (
  countryId: string, 
  indicatorId: string,
  yearRange?: [number, number]
) => {
  return useQuery({
    queryKey: queryKeys.timeSeries(countryId, indicatorId, yearRange),
    queryFn: () => api.data.getTimeSeries(countryId, indicatorId, yearRange),
    enabled: !!countryId && !!indicatorId,
  });
};

export const useMapData = (indicatorId: string, year?: number) => {
  return useQuery({
    queryKey: queryKeys.mapData(indicatorId, year),
    queryFn: () => api.data.getMapData(indicatorId, year),
    enabled: !!indicatorId,
  });
};

// ============================================
// YOUTH INDEX HOOKS
// ============================================

export const useYouthIndexRankings = (year?: number) => {
  return useQuery({
    queryKey: queryKeys.youthIndexRankings(year),
    queryFn: () => api.youthIndex.getRankings(year),
  });
};

export const useYouthIndexByCountry = (countryId: string, year?: number) => {
  return useQuery({
    queryKey: queryKeys.youthIndexByCountry(countryId, year),
    queryFn: () => api.youthIndex.getByCountry(countryId, year),
    enabled: !!countryId,
  });
};

export const useYouthIndexHistory = (countryId: string) => {
  return useQuery({
    queryKey: queryKeys.youthIndexHistory(countryId),
    queryFn: () => api.youthIndex.getHistory(countryId),
    enabled: !!countryId,
  });
};

// ============================================
// PLATFORM HOOKS
// ============================================

export const usePlatformStats = () => {
  return useQuery({
    queryKey: queryKeys.platformStats,
    queryFn: () => api.platform.getStats(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

// ============================================
// MULTIPLE QUERIES HOOK
// ============================================

export const useMultipleCountryStats = (countryIds: string[], year?: number) => {
  return useQueries({
    queries: countryIds.map(id => ({
      queryKey: queryKeys.countryStats(id, year),
      queryFn: () => api.countries.getStats(id, year),
    })),
  });
};

export const useMultipleTimeSeries = (
  countryIds: string[],
  indicatorId: string,
  yearRange?: [number, number]
) => {
  return useQueries({
    queries: countryIds.map(countryId => ({
      queryKey: queryKeys.timeSeries(countryId, indicatorId, yearRange),
      queryFn: () => api.data.getTimeSeries(countryId, indicatorId, yearRange),
      enabled: !!indicatorId,
    })),
  });
};
