import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Download, Share, ExternalLink, BarChart3, CircleDot, Footprints, ArrowLeftRight, Activity, Loader2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  Scatter,
  Area,
} from 'recharts';
import { useCountries, useThemes, useIndicatorsByTheme } from '@/hooks/useData';
import { api } from '@/services/api';

type ChartType = 'bar' | 'lollipop' | 'step-trend' | 'yoy';

const COLORS = {
  green: '#22C55E',
  greenLight: '#4ADE80',
  greenDark: '#15803D',
  gold: '#F59E0B',
  goldLight: '#FBBF24',
  blue: '#3B82F6',
  blueLight: '#60A5FA',
  teal: '#14B8A6',
  red: '#EF4444',
  redLight: '#F87171',
  purple: '#8B5CF6',
};

// Live API-backed time series. Resolves country/theme/indicator NAMES to the
// real cuids in the database and calls /api/data/timeseries to pull
// year × value rows for the selected country + indicator.
function useChartData(
  country: string,
  theme: string,
  indicator: string,
  yearRange: [number, number],
): { data: { year: string; value: number }[]; isLoading: boolean; error: Error | null; indicatorRow: { id?: string; unit?: string; source?: string } | null; countryRow: { id?: string } | null; needsCountry: boolean } {
  const countriesQ = useCountries();
  const themesQ = useThemes();

  const themeRow = useMemo(() => {
    if (!themesQ.data || theme === 'All Themes') return null;
    return themesQ.data.find((t) => t.name === theme || t.slug === theme) ?? null;
  }, [themesQ.data, theme]);

  const indicatorsQ = useIndicatorsByTheme(themeRow?.id ?? '');
  const indicatorRow = useMemo(() => {
    if (!indicatorsQ.data || indicator === 'Select an indicator') return null;
    return indicatorsQ.data.find((i) => i.name === indicator || i.slug === indicator) ?? null;
  }, [indicatorsQ.data, indicator]);

  const countryRow = useMemo(() => {
    if (!countriesQ.data || country === 'All Countries') return null;
    return countriesQ.data.find((c) => c.name === country) ?? null;
  }, [countriesQ.data, country]);

  const timeseriesQ = useQuery({
    queryKey: ['data', 'timeseries', countryRow?.id, indicatorRow?.id, yearRange[0], yearRange[1]],
    queryFn: () => api.data.getTimeSeries(countryRow!.id, indicatorRow!.id, yearRange),
    enabled: !!countryRow?.id && !!indicatorRow?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Probe: if the year-filtered query returned 0 rows, fire a second query
  // without a year window to see what years ARE available for this combo.
  // Lets the empty state suggest a concrete "widen to 2018–2024" rather
  // than a vague "try widening the range".
  const allYearsQ = useQuery({
    queryKey: ['data', 'timeseries-all-years', countryRow?.id, indicatorRow?.id],
    queryFn: () => api.data.getTimeSeries(countryRow!.id, indicatorRow!.id),
    enabled:
      !!countryRow?.id &&
      !!indicatorRow?.id &&
      !timeseriesQ.isLoading &&
      (timeseriesQ.data?.data?.length ?? 0) === 0,
    staleTime: 5 * 60 * 1000,
  });

  const rawRows = timeseriesQ.data?.data ?? [];
  const data = rawRows.map((d: any) => ({ year: String(d.year), value: d.value }));

  // Derive the age-band label from the rows the API actually returned.
  // The AYIMS template stores each indicator under a fixed band (15-35 for
  // most youth metrics, 18-35 for adult-justice/mortality, 18-30 for
  // trafficking/IDPs, or empty for country-level policy markers).
  const distinctAgeGroups = Array.from(new Set(rawRows.map((r: any) => r.ageGroup ?? '').filter(Boolean) as string[]));
  let ageBandLabel: string | null = null;
  if (rawRows.length > 0) {
    if (distinctAgeGroups.length === 0) {
      ageBandLabel = 'National value (no youth disaggregation)';
    } else if (distinctAgeGroups.length === 1) {
      ageBandLabel = `Ages ${distinctAgeGroups[0]}`;
    } else {
      ageBandLabel = `Mixed bands (${distinctAgeGroups.join(', ')})`;
    }
  }

  // Years available for this country+indicator across the FULL DB (no year filter).
  // Used to power the smart empty-state hint.
  const availableYears: number[] = (allYearsQ.data?.data ?? [])
    .map((d: any) => d.year as number)
    .sort((a: number, b: number) => a - b);

  return {
    data,
    isLoading: timeseriesQ.isLoading,
    error: (timeseriesQ.error as Error) ?? null,
    indicatorRow: timeseriesQ.data?.indicator ?? indicatorRow,
    countryRow,
    ageBandLabel,
    availableYears,
    isProbingYears: allYearsQ.isLoading,
    // Flag the "you picked an indicator but no country" state so the chart
    // can render a "pick a country" prompt instead of just an empty graph.
    needsCountry: !countryRow && indicator !== 'Select an indicator' && theme !== 'All Themes',
  };
}

// Linear regression for the trend line
function linearRegression(data: { year: string; value: number }[]) {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: 0, r2: 0 };
  const xs = data.map((_, i) => i);
  const ys = data.map((d) => d.value);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    denX += (xs[i] - meanX) ** 2;
    denY += (ys[i] - meanY) ** 2;
  }
  const slope = denX === 0 ? 0 : num / denX;
  const intercept = meanY - slope * meanX;
  const r2 = denX === 0 || denY === 0 ? 0 : (num * num) / (denX * denY);
  return { slope, intercept, r2 };
}

/* ---------- Custom Tooltip ---------- */
const ChartTooltip = ({ active, payload, label, indicator, kind }: any) => {
  if (!active || !payload?.length) return null;
  const main = payload.find((p: any) => p.dataKey === 'value' || p.dataKey === 'delta') ?? payload[0];
  const val = main.value;
  return (
    <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-700/50 rounded-xl shadow-2xl px-4 py-3 min-w-[170px]">
      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold ${kind === 'yoy' && val < 0 ? 'text-red-400' : 'text-white'}`}>
          {kind === 'yoy' ? (val > 0 ? '+' : '') : ''}{typeof val === 'number' ? val.toFixed(1) : val}
        </span>
        <span className="text-xs text-gray-400">{kind === 'yoy' ? 'change vs. prev year' : indicator}</span>
      </div>
      <div className="mt-1.5 h-[2px] rounded-full bg-gradient-to-r from-[#22C55E] via-[#F59E0B] to-transparent" />
    </div>
  );
};

/* ---------- Summary Stats ---------- */
const SummaryStats = ({ data }: { data: { year: string; value: number }[] }) => {
  if (!data.length) return null;
  const values = data.map((d) => d.value);
  const latest = values[values.length - 1];
  const earliest = values[0];
  const change = latest - earliest;
  const changePercent = earliest !== 0 ? ((change / earliest) * 100).toFixed(1) : '0';
  const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
  const max = Math.max(...values);
  const min = Math.min(...values);

  const stats = [
    { label: 'Latest', value: latest.toFixed(1), color: 'text-white' },
    { label: 'Change', value: `${change > 0 ? '+' : ''}${change.toFixed(1)} (${change > 0 ? '+' : ''}${changePercent}%)`, color: change >= 0 ? 'text-emerald-400' : 'text-red-400' },
    { label: 'Average', value: avg, color: 'text-gray-300' },
    { label: 'Range', value: `${min.toFixed(1)} – ${max.toFixed(1)}`, color: 'text-gray-300' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
      {stats.map((s) => (
        <div key={s.label} className="rounded-lg bg-white/[0.04] border border-gray-800/60 px-3 py-2.5">
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{s.label}</p>
          <p className={`text-sm font-semibold mt-0.5 ${s.color}`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
};

const DataChart = ({
  country,
  theme,
  indicator,
  yearRange,
}: {
  country: string;
  theme: string;
  indicator: string;
  yearRange: [number, number];
}) => {
  const [chartType, setChartType] = useState<ChartType>('bar');

  const hasSelection = theme !== 'All Themes' && indicator !== 'Select an indicator';

  // Real API-backed data. Resolves name → cuid lookups internally and pulls
  // from /api/data/timeseries. Returns an empty array when no country is
  // selected — that's a distinct state, surfaced via `needsCountry`.
  const {
    data: liveData,
    isLoading: isDataLoading,
    error: dataError,
    indicatorRow,
    needsCountry,
    ageBandLabel,
    availableYears,
    isProbingYears,
  } = useChartData(country, theme, indicator, yearRange);
  const data = hasSelection ? liveData : [];

  const avgValue = useMemo(() => {
    if (!data.length) return 0;
    return data.reduce((a, b) => a + b.value, 0) / data.length;
  }, [data]);

  // Lollipop = scatter dots + bars with tiny width.
  // Step+Trend = step area + regression line.
  // YoY = diverging bars of (year_n - year_n-1).
  const lollipopData = useMemo(() => data, [data]);
  const stepTrendData = useMemo(() => {
    if (!data.length) return [];
    const { slope, intercept } = linearRegression(data);
    return data.map((d, i) => ({ ...d, trend: +(intercept + slope * i).toFixed(2) }));
  }, [data]);
  const yoyData = useMemo(() => {
    if (data.length < 2) return [];
    return data.slice(1).map((d, i) => ({
      year: d.year,
      delta: +(d.value - data[i].value).toFixed(2),
    }));
  }, [data]);

  const renderChart = () => {
    const gridStyle = { stroke: 'rgba(255,255,255,0.04)', strokeDasharray: '0' };
    const xAxisStyle = { fontSize: 11, fill: 'rgba(255,255,255,0.4)', fontWeight: 500 };
    const yAxisStyle = { fontSize: 11, fill: 'rgba(255,255,255,0.3)' };

    switch (chartType) {
      // ─── 1. BAR (kept) ───
      default: {
        const maxVal = Math.max(...data.map((d) => d.value));
        return (
          <BarChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.green} stopOpacity={0.95} />
                <stop offset="100%" stopColor={COLORS.teal} stopOpacity={0.7} />
              </linearGradient>
              <linearGradient id="barGradientGold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.gold} stopOpacity={0.95} />
                <stop offset="100%" stopColor={COLORS.goldLight} stopOpacity={0.6} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridStyle} vertical={false} />
            <XAxis dataKey="year" tick={xAxisStyle} tickLine={false} axisLine={false} />
            <YAxis tick={yAxisStyle} tickLine={false} axisLine={false} width={45} />
            <Tooltip content={<ChartTooltip indicator={indicator} />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <ReferenceLine y={avgValue} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" label={{ value: `avg ${avgValue.toFixed(1)}`, position: 'right', fill: 'rgba(255,255,255,0.2)', fontSize: 10 }} />
            <Bar dataKey="value" name={indicator} radius={[6, 6, 0, 0]} maxBarSize={40} animationDuration={1200} animationEasing="ease-out">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.value === maxVal ? 'url(#barGradientGold)' : 'url(#barGradient)'} />
              ))}
            </Bar>
          </BarChart>
        );
      }

      // ─── 2. LOLLIPOP — Cleveland-style discrete value plot ───
      case 'lollipop': {
        const maxVal = Math.max(...data.map((d) => d.value));
        return (
          <ComposedChart data={lollipopData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="lollipopStem" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.green} stopOpacity={0.6} />
                <stop offset="100%" stopColor={COLORS.green} stopOpacity={0.15} />
              </linearGradient>
              <radialGradient id="lollipopHead">
                <stop offset="0%" stopColor={COLORS.greenLight} />
                <stop offset="100%" stopColor={COLORS.green} />
              </radialGradient>
              <filter id="lollipopGlow"><feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={COLORS.green} floodOpacity="0.5" /></filter>
            </defs>
            <CartesianGrid {...gridStyle} vertical={false} />
            <XAxis dataKey="year" tick={xAxisStyle} tickLine={false} axisLine={false} />
            <YAxis tick={yAxisStyle} tickLine={false} axisLine={false} width={45} />
            <Tooltip content={<ChartTooltip indicator={indicator} />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
            <ReferenceLine y={avgValue} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" label={{ value: `avg ${avgValue.toFixed(1)}`, position: 'right', fill: 'rgba(255,255,255,0.2)', fontSize: 10 }} />
            {/* Stems */}
            <Bar dataKey="value" maxBarSize={3} fill="url(#lollipopStem)" animationDuration={900} isAnimationActive />
            {/* Heads */}
            <Scatter dataKey="value" shape={(props: any) => {
              const { cx, cy, payload } = props;
              const isMax = payload.value === maxVal;
              return (
                <g>
                  <circle cx={cx} cy={cy} r={9} fill={isMax ? COLORS.gold : 'url(#lollipopHead)'} stroke="#0a0e14" strokeWidth={2} filter="url(#lollipopGlow)" />
                  <circle cx={cx} cy={cy} r={3} fill="white" opacity={0.85} />
                </g>
              );
            }} />
          </ComposedChart>
        );
      }

      // ─── 3. STEP + TREND — step series with linear regression overlay ───
      case 'step-trend': {
        const reg = linearRegression(data);
        const slopeLabel = reg.slope > 0 ? `↑ +${reg.slope.toFixed(2)}/yr` : `↓ ${reg.slope.toFixed(2)}/yr`;
        const r2Label = `R² = ${reg.r2.toFixed(2)}`;
        return (
          <ComposedChart data={stepTrendData} margin={{ top: 20, right: 90, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="stepFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.green} stopOpacity={0.25} />
                <stop offset="100%" stopColor={COLORS.green} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridStyle} vertical={false} />
            <XAxis dataKey="year" tick={xAxisStyle} tickLine={false} axisLine={false} />
            <YAxis tick={yAxisStyle} tickLine={false} axisLine={false} width={45} />
            <Tooltip content={<ChartTooltip indicator={indicator} />} cursor={{ stroke: 'rgba(255,255,255,0.06)', strokeWidth: 1 }} />
            <ReferenceLine y={avgValue} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
            {/* Step area showing actual values */}
            <Area type="stepAfter" dataKey="value" stroke={COLORS.green} strokeWidth={2.5} fill="url(#stepFill)" dot={{ r: 4, fill: '#0a0e14', stroke: COLORS.green, strokeWidth: 2 }} activeDot={{ r: 6, fill: COLORS.green, stroke: '#0a0e14', strokeWidth: 2 }} animationDuration={1100} />
            {/* Linear regression trend line */}
            <Line type="linear" dataKey="trend" stroke={COLORS.gold} strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={false} animationDuration={1100} />
            {/* Slope + R² annotation */}
            <ReferenceLine
              y={stepTrendData[stepTrendData.length - 1]?.trend ?? 0}
              stroke="transparent"
              label={{
                value: `${slopeLabel}  ·  ${r2Label}`,
                position: 'right',
                fill: COLORS.gold,
                fontSize: 11,
                fontWeight: 600,
              }}
            />
          </ComposedChart>
        );
      }

      // ─── 4. YEAR-OVER-YEAR CHANGE — diverging bars showing deltas ───
      case 'yoy': {
        if (yoyData.length === 0) {
          return (
            <BarChart data={[]}><XAxis dataKey="year" tick={xAxisStyle} /><YAxis tick={yAxisStyle} /></BarChart>
          );
        }
        const maxAbs = Math.max(...yoyData.map((d) => Math.abs(d.delta)));
        return (
          <BarChart data={yoyData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="yoyPositive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.green} stopOpacity={0.95} />
                <stop offset="100%" stopColor={COLORS.greenDark} stopOpacity={0.6} />
              </linearGradient>
              <linearGradient id="yoyNegative" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={COLORS.red} stopOpacity={0.95} />
                <stop offset="100%" stopColor="#7F1D1D" stopOpacity={0.6} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridStyle} vertical={false} />
            <XAxis dataKey="year" tick={xAxisStyle} tickLine={false} axisLine={false} />
            <YAxis tick={yAxisStyle} tickLine={false} axisLine={false} width={45} domain={[-maxAbs * 1.2, maxAbs * 1.2]} />
            <Tooltip content={<ChartTooltip indicator={indicator} kind="yoy" />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
            <Bar dataKey="delta" radius={[4, 4, 0, 0]} maxBarSize={50} animationDuration={1100}>
              {yoyData.map((entry, index) => (
                <Cell key={`yoy-${index}`} fill={entry.delta >= 0 ? 'url(#yoyPositive)' : 'url(#yoyNegative)'} />
              ))}
            </Bar>
          </BarChart>
        );
      }
    }
  };

  const chartTypeButtons: { type: ChartType; icon: React.ElementType; label: string; hint: string }[] = [
    { type: 'bar', icon: BarChart3, label: 'Bar', hint: 'Compare values across years' },
    { type: 'lollipop', icon: CircleDot, label: 'Lollipop', hint: 'Discrete points, less ink than bars' },
    { type: 'step-trend', icon: Footprints, label: 'Step + Trend', hint: 'Annual steps + regression line' },
    { type: 'yoy', icon: ArrowLeftRight, label: 'Year-over-Year', hint: 'Diverging bars: delta vs. prev year' },
  ];

  return (
    <div className="rounded-2xl border border-gray-800/60 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Activity className="h-4 w-4 text-emerald-400" />
            <h3 className="text-xl font-bold text-white">{indicator}</h3>
            {ageBandLabel && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-semibold text-emerald-300 uppercase tracking-wider">
                {ageBandLabel}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {country !== 'All Countries' ? country : 'All African Countries'}
            <span className="mx-1.5 text-gray-700">·</span>
            {yearRange[0]}–{yearRange[1]}
          </p>
        </div>
        <div className="flex gap-1.5">
          <Button variant="ghost" size="sm" className="gap-1.5 text-gray-400 hover:text-white hover:bg-white/[0.06] h-8 px-2.5 text-xs">
            <Download className="h-3.5 w-3.5" /><span className="hidden sm:inline">Export</span>
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5 text-gray-400 hover:text-white hover:bg-white/[0.06] h-8 px-2.5 text-xs">
            <Share className="h-3.5 w-3.5" /><span className="hidden sm:inline">Share</span>
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5 text-gray-400 hover:text-white hover:bg-white/[0.06] h-8 px-2.5 text-xs">
            <ExternalLink className="h-3.5 w-3.5" /><span className="hidden sm:inline">Embed</span>
          </Button>
        </div>
      </div>

      {/* Chart type selector */}
      {hasSelection && (
        <div className="flex flex-wrap gap-1 mb-5 p-1 rounded-lg bg-white/[0.03] border border-gray-800/40 w-fit">
          {chartTypeButtons.map(({ type, icon: Icon, label, hint }) => (
            <button
              key={type}
              onClick={() => setChartType(type)}
              title={hint}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                chartType === type
                  ? 'bg-emerald-500/15 text-emerald-400 shadow-sm shadow-emerald-500/10'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Summary stats */}
      {hasSelection && <SummaryStats data={data} />}

      {/* Chart area */}
      <div className="min-h-[360px] rounded-xl bg-black/20 border border-gray-800/30 p-4 flex items-center justify-center">
        {!hasSelection ? (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.03] border border-gray-800/40 flex items-center justify-center">
              <BarChart3 className="h-7 w-7 text-gray-600" />
            </div>
            <p className="text-gray-500 text-sm">Select a theme and indicator to visualize data</p>
          </div>
        ) : needsCountry ? (
          <div className="text-center max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <BarChart3 className="h-7 w-7 text-emerald-400" />
            </div>
            <p className="text-emerald-300 text-sm font-medium">Pick a country to chart this indicator</p>
            <p className="text-gray-500 text-xs mt-2">
              "{indicator}" has values for every African Union member state. Choose one in the filter sidebar or click on the Africa map above to see its time series.
            </p>
          </div>
        ) : isDataLoading ? (
          <div className="text-center">
            <Loader2 className="h-7 w-7 text-emerald-400 animate-spin mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Loading data from the AYO database…</p>
          </div>
        ) : dataError ? (
          <div className="text-center max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <BarChart3 className="h-7 w-7 text-red-400" />
            </div>
            <p className="text-red-300 text-sm font-medium">Could not load data</p>
            <p className="text-gray-500 text-xs mt-1">{dataError.message}</p>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center max-w-md">
            {isProbingYears ? (
              <>
                <Loader2 className="h-7 w-7 text-amber-400 animate-spin mx-auto mb-3" />
                <p className="text-amber-300 text-sm font-medium">Checking what's available…</p>
              </>
            ) : availableYears.length > 0 ? (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                  <BarChart3 className="h-7 w-7 text-amber-400" />
                </div>
                <p className="text-amber-300 text-sm font-medium">
                  No data in {yearRange[0]}–{yearRange[1]}
                </p>
                <p className="text-gray-500 text-xs mt-2 leading-relaxed">
                  <strong className="text-gray-300">{country}</strong> has{' '}
                  <strong className="text-amber-300">
                    {availableYears.length} value{availableYears.length === 1 ? '' : 's'}
                  </strong>{' '}
                  for "{indicator}" — but only in{' '}
                  <strong className="text-emerald-300">
                    {availableYears.length === 1
                      ? availableYears[0]
                      : availableYears.length <= 4
                      ? availableYears.join(', ')
                      : `${availableYears[0]}, ${availableYears[1]}, …, ${availableYears[availableYears.length - 1]}`}
                  </strong>
                  . Widen your year range above to include {availableYears[0]}–{availableYears[availableYears.length - 1]}.
                </p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                  <BarChart3 className="h-7 w-7 text-amber-400" />
                </div>
                <p className="text-amber-300 text-sm font-medium">No values uploaded for this country</p>
                <p className="text-gray-500 text-xs mt-2 leading-relaxed">
                  <strong className="text-gray-300">{country}</strong> has no rows for "{indicator}"
                  in the AYO database (any year). The AYIMS template for this country may not have
                  populated this indicator. Try another country, or pick a different indicator from the same theme.
                </p>
              </>
            )}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            {renderChart()}
          </ResponsiveContainer>
        )}
      </div>

      {/* Per-chart explainer (so a researcher knows what they're looking at) */}
      {hasSelection && (
        <div className="mt-4 px-3 py-2 rounded-lg bg-emerald-500/[0.04] border border-emerald-500/10 text-[11px] text-emerald-300/70 leading-relaxed">
          {chartType === 'bar' && 'Discrete annual values. Tallest bar (gold) marks the peak year.'}
          {chartType === 'lollipop' && 'Cleveland-style lollipop: dot at the actual value, thin stem to baseline. Less visual weight than bars; easier to compare exact points.'}
          {chartType === 'step-trend' && 'Step-after series (annual measurement, constant between observations) with overlaid linear regression. Slope and R² shown to the right.'}
          {chartType === 'yoy' && 'Year-over-year change: bars above zero are gains vs. the previous year, bars below are declines. Use to scan for inflection points.'}
        </div>
      )}

      {/* Data source note */}
      <div className="mt-3 flex items-start gap-2 px-3 py-2.5 bg-white/[0.02] border border-gray-800/30 rounded-lg">
        <div className="w-1 h-full min-h-[20px] rounded-full bg-gradient-to-b from-emerald-500/40 to-transparent flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-gray-500 leading-relaxed">
          {hasSelection
            ? `${indicator} for ${country !== 'All Countries' ? country : 'all 54 African countries (continental average)'}, ${yearRange[0]}–${yearRange[1]}. Source: ${(indicatorRow as any)?.source || 'African Youth Index Measurement System (AYIMS)'} via the AYO database. Values are pulled live from /api/data/timeseries — no estimates or synthesised numbers.`
            : 'Select data filters to view source attribution and methodology notes.'}
        </p>
      </div>
    </div>
  );
};

export default DataChart;
