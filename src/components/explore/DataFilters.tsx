// Data Explorer — filter sidebar.
// All dropdown options are API-driven against the live AYO database:
//   - Countries        ← /api/countries
//   - Themes           ← /api/themes  (7 canonical themes with weights)
//   - Indicators       ← /api/indicators?themeId=<id>
// No hardcoded theme or indicator names — the source of truth is Supabase.

import React, { useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCountries, useThemes, useIndicatorsByTheme } from '@/hooks/useData';

const YEAR_RANGES: { label: string; range: [number, number] }[] = [
  { label: '2000-2005', range: [2000, 2005] },
  { label: '2006-2010', range: [2006, 2010] },
  { label: '2011-2015', range: [2011, 2015] },
  { label: '2016-2020', range: [2016, 2020] },
  { label: '2021-2025', range: [2021, 2025] },
  { label: 'All Years', range: [2000, 2025] },
];

const ALL_COUNTRIES = 'All Countries';
const ALL_THEMES = 'All Themes';
const NO_INDICATOR = 'Select an indicator';

const THEME_WEIGHT_DISPLAY: Record<string, string> = {
  'youth-demography-participation': '20%',
  'education': '15%',
  'employment': '15%',
  'health': '15%',
  'entrepreneurship': '15%',
  'peace-security': '10%',
  'access-to-justice': '10%',
};

interface Props {
  selectedCountry: string;
  setSelectedCountry: (country: string) => void;
  selectedTheme: string;
  setSelectedTheme: (theme: string) => void;
  selectedIndicator: string;
  setSelectedIndicator: (indicator: string) => void;
  yearRange: [number, number];
  setYearRange: (range: [number, number]) => void;
}

const DataFilters: React.FC<Props> = ({
  selectedCountry,
  setSelectedCountry,
  selectedTheme,
  setSelectedTheme,
  selectedIndicator,
  setSelectedIndicator,
  yearRange,
  setYearRange,
}) => {
  const [gender, setGender] = useState<string>('all');

  const countriesQ = useCountries();
  const themesQ = useThemes();

  // Resolve the selected theme's NAME -> the real cuid in the DB so we can
  // ask the API for the indicators that belong to it.
  const selectedThemeRow = useMemo(() => {
    if (!themesQ.data || selectedTheme === ALL_THEMES) return null;
    return themesQ.data.find((t) => t.name === selectedTheme || t.slug === selectedTheme) ?? null;
  }, [themesQ.data, selectedTheme]);

  const indicatorsQ = useIndicatorsByTheme(selectedThemeRow?.id ?? '');

  const countries = useMemo(() => {
    const names = (countriesQ.data ?? []).map((c) => c.name).sort((a, b) => a.localeCompare(b));
    return [ALL_COUNTRIES, ...names];
  }, [countriesQ.data]);

  const themes = useMemo(() => {
    const sorted = [...(themesQ.data ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    return [ALL_THEMES, ...sorted.map((t) => t.name)];
  }, [themesQ.data]);

  const availableIndicators = useMemo(() => {
    if (selectedTheme === ALL_THEMES) return [];
    return (indicatorsQ.data ?? []).map((i) => i.name).sort((a, b) => a.localeCompare(b));
  }, [indicatorsQ.data, selectedTheme]);

  const isYearRangeActive = (r: [number, number]) =>
    yearRange[0] === r[0] && yearRange[1] === r[1];

  const handleThemeChange = (value: string) => {
    setSelectedTheme(value);
    setSelectedIndicator(NO_INDICATOR);
  };

  const handleResetFilters = () => {
    setSelectedCountry(ALL_COUNTRIES);
    setSelectedTheme(ALL_THEMES);
    setSelectedIndicator(NO_INDICATOR);
    setYearRange([2000, 2025]);
    setGender('all');
  };

  const activeFilterCount =
    (selectedCountry !== ALL_COUNTRIES ? 1 : 0) +
    (selectedTheme !== ALL_THEMES ? 1 : 0) +
    (selectedIndicator !== NO_INDICATOR ? 1 : 0) +
    (gender !== 'all' ? 1 : 0) +
    (yearRange[0] !== 2000 || yearRange[1] !== 2025 ? 1 : 0);

  return (
    <div className="space-y-5 p-4 rounded-2xl border border-gray-800 bg-white/[0.03]">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold bg-gradient-to-br from-[#D4A017] from-10% via-white via-40% to-white/40 bg-clip-text text-transparent">
          Data Filters
        </h3>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="text-[10px] uppercase tracking-wider text-gray-400 hover:text-white transition-colors"
          >
            Reset ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Country */}
      <div className="space-y-2">
        <Label htmlFor="country" className="text-gray-300">Country</Label>
        <Select value={selectedCountry} onValueChange={setSelectedCountry}>
          <SelectTrigger id="country">
            <SelectValue placeholder={countriesQ.isLoading ? 'Loading…' : 'Select a country'} />
          </SelectTrigger>
          <SelectContent>
            {countries.map((country) => (
              <SelectItem key={country} value={country}>{country}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-gray-500">
          {countriesQ.data?.length ?? 54} African Union member states · live
        </p>
      </div>

      {/* Theme */}
      <div className="space-y-2">
        <Label htmlFor="theme" className="text-gray-300">Theme</Label>
        <Select value={selectedTheme} onValueChange={handleThemeChange}>
          <SelectTrigger id="theme">
            <SelectValue placeholder={themesQ.isLoading ? 'Loading…' : 'Select a theme'} />
          </SelectTrigger>
          <SelectContent>
            {themes.map((theme) => {
              const row = themesQ.data?.find((t) => t.name === theme);
              const weight = row ? THEME_WEIGHT_DISPLAY[row.slug] : null;
              return (
                <SelectItem key={theme} value={theme}>
                  <span className="flex items-center gap-2">
                    {theme}
                    {weight && (
                      <span className="text-[10px] text-gray-500 tabular-nums">{weight}</span>
                    )}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {selectedThemeRow && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Badge variant="secondary" className="text-[10px] font-medium">
              Index weight: {THEME_WEIGHT_DISPLAY[selectedThemeRow.slug] ?? '—'}
            </Badge>
            <Badge variant="outline" className="text-[10px] font-medium">
              {selectedThemeRow.indicatorCount ?? availableIndicators.length} indicators
            </Badge>
          </div>
        )}
      </div>

      {/* Indicator */}
      <div className="space-y-2">
        <Label htmlFor="indicator" className="text-gray-300">Indicator</Label>
        <Select
          value={selectedIndicator}
          onValueChange={setSelectedIndicator}
          disabled={selectedTheme === ALL_THEMES || indicatorsQ.isLoading}
        >
          <SelectTrigger id="indicator">
            <SelectValue
              placeholder={
                selectedTheme === ALL_THEMES
                  ? 'Pick a theme first'
                  : indicatorsQ.isLoading
                  ? 'Loading indicators…'
                  : availableIndicators.length === 0
                  ? 'No indicators in this theme'
                  : 'Select an indicator'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {availableIndicators.map((indicator) => (
              <SelectItem key={indicator} value={indicator}>{indicator}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Year range */}
      <div className="space-y-2 pt-1">
        <Label className="text-gray-300">Year Range</Label>
        <div className="grid grid-cols-2 gap-2">
          {YEAR_RANGES.map((opt) => (
            <Button
              key={opt.label}
              type="button"
              size="sm"
              variant={isYearRangeActive(opt.range) ? 'default' : 'outline'}
              onClick={() => setYearRange(opt.range)}
              className="text-xs"
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Gender */}
      <div className="space-y-2 pt-1">
        <Label htmlFor="gender" className="text-gray-300">Gender</Label>
        <Select value={gender} onValueChange={setGender}>
          <SelectTrigger id="gender">
            <SelectValue placeholder="Select gender" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="male">Male</SelectItem>
            <SelectItem value="female">Female</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Age band is intrinsic to each indicator (baked into the AYIMS
          template definition: e.g. "Literacy Rate 15-35", "Trafficking
          Victims 18-30", "Top Cause of Death 15-35"). Users don't pick
          it — the chart surfaces the actual stored band as a badge once
          you select an indicator. So no age-group selector here. */}
      <div className="space-y-1 pt-1 border-t border-gray-800/40 pt-3">
        <p className="text-[10px] text-gray-500 leading-relaxed">
          <strong className="text-gray-400">Age band</strong> is defined by the
          indicator itself (AU 15–35 for most, 18–30 / 18–35 for justice and
          mortality metrics). The chart shows which band a given indicator was
          uploaded with.
        </p>
      </div>
    </div>
  );
};

export default DataFilters;
