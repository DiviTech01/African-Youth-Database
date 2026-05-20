import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Plus, Save, Share2, Pencil, Trash2, Check,
  BarChart3, TrendingUp, AreaChart as AreaChartIcon, Radar as RadarIcon, Hash,
  LayoutDashboard, Users, Star, Clock, Sparkles, ArrowRight, Shield, ArrowLeft,
} from 'lucide-react';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { useToast } from '@/hooks/use-toast';
import CountryFlag from '@/components/CountryFlag';
import { getCountryMeta } from '@/lib/country-flags';

// ── Types ──────────────────────────────────────────────────────────────────────

type ChartType = 'bar' | 'line' | 'area' | 'radar' | 'stat';

interface Widget {
  id: string;
  title: string;
  chartType: ChartType;
  indicator: string;
  countries: string[];
  data: Record<string, unknown>[];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const COUNTRIES = [
  'Nigeria', 'Kenya', 'South Africa', 'Ghana', 'Ethiopia',
  'Tanzania', 'Rwanda', 'Senegal', 'Egypt', 'Morocco',
];

const INDICATORS = [
  'Youth Literacy Rate',
  'Youth Unemployment Rate',
  'Health Access Index',
  'Digital Inclusion Score',
  'Secondary Enrollment Rate',
  'NEET Rate',
  'Skilled Employment Share',
  'Civic Participation Index',
];

const CHART_COLORS = [
  '#22C55E', // green
  '#F59E0B', // gold
  '#3B82F6', // blue
  '#A855F7', // purple
  '#F43F5E', // rose
];

const STORAGE_KEY = 'ayd_user_widgets_v4';
const LEGACY_STORAGE_KEYS = ['ayd_user_widgets_v1', 'ayd_user_widgets_v2', 'ayd_user_widgets_v3'];

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ── Mock data generators ───────────────────────────────────────────────────────

function generateTimeSeriesData(countries: string[]) {
  const years = [2018, 2019, 2020, 2021, 2022, 2023];
  return years.map((year) => {
    const entry: Record<string, unknown> = { year: year.toString() };
    countries.forEach((c) => {
      entry[c] = Math.round(40 + Math.random() * 50);
    });
    return entry;
  });
}

function generateRadarData(countries: string[]) {
  const dimensions = ['Education', 'Health', 'Employment', 'Digital', 'Civic', 'Environment'];
  return dimensions.map((dim) => {
    const entry: Record<string, unknown> = { dimension: dim };
    countries.forEach((c) => {
      entry[c] = Math.round(30 + Math.random() * 70);
    });
    return entry;
  });
}

function generateStatData() {
  return [{ value: Math.round(40 + Math.random() * 55), change: +(Math.random() * 10 - 3).toFixed(1) }];
}

function generateData(chartType: ChartType, countries: string[]) {
  if (chartType === 'stat') return generateStatData();
  if (chartType === 'radar') return generateRadarData(countries);
  return generateTimeSeriesData(countries);
}

// ── Default widgets ────────────────────────────────────────────────────────────

const EMPLOYMENT_COUNTRIES = ['Ghana', 'Rwanda', 'Senegal', 'Kenya', 'Morocco'];
const HEALTH_COUNTRIES = ['Ethiopia', 'Tanzania', 'Egypt', 'Nigeria'];
const RADAR_COUNTRIES = ['Nigeria', 'Kenya', 'South Africa', 'Egypt', 'Ghana'];

const defaultWidgets: Widget[] = [
  {
    id: 'w1',
    title: 'Youth Literacy Rates',
    chartType: 'bar',
    indicator: 'Youth Literacy Rate',
    countries: ['Nigeria', 'Kenya', 'South Africa'],
    data: generateTimeSeriesData(['Nigeria', 'Kenya', 'South Africa']),
  },
  {
    id: 'w2',
    title: 'Employment Trends',
    chartType: 'line',
    indicator: 'Youth Unemployment Rate',
    countries: EMPLOYMENT_COUNTRIES,
    data: generateTimeSeriesData(EMPLOYMENT_COUNTRIES),
  },
  {
    id: 'w3',
    title: 'Health Access Overview',
    chartType: 'area',
    indicator: 'Health Access Index',
    countries: HEALTH_COUNTRIES,
    data: generateTimeSeriesData(HEALTH_COUNTRIES),
  },
  {
    id: 'w4',
    title: 'Cross-Dimensional Profile',
    chartType: 'radar',
    indicator: 'Multi-dimension comparison',
    countries: RADAR_COUNTRIES,
    data: generateRadarData(RADAR_COUNTRIES),
  },
];

// Detects any prior default snapshot — 3-widget pre-radar (v1/v2) or
// 4-widget radar default (v3). When matched we discard so the user picks up
// the current defaults. Custom layouts (renamed/added/removed widgets) are
// preserved.
function isStaleDefaults(widgets: Widget[]): boolean {
  if (widgets.length !== 3 && widgets.length !== 4) return false;
  const [w1, w2, w3, w4] = widgets;
  const baseMatches =
    w1?.id === 'w1' && w1?.title === 'Youth Literacy Rates' &&
    w2?.id === 'w2' && w2?.title === 'Employment Trends' &&
    w3?.id === 'w3' && w3?.title === 'Health Access Overview';
  if (!baseMatches) return false;
  if (widgets.length === 3) return true;
  // 4-widget case: must match the v3 radar default
  return w4?.id === 'w4' && w4?.title === 'Cross-Dimensional Profile';
}

// ── Chart rendering ────────────────────────────────────────────────────────────

function WidgetChart({ widget }: { widget: Widget }) {
  const { chartType, countries, data } = widget;

  if (chartType === 'stat') {
    const stat = data[0] as { value: number; change: number };
    const positive = stat.change >= 0;
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <span className="text-5xl font-bold tabular-nums">{stat.value}%</span>
        <span className={`text-sm font-medium ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
          {positive ? '+' : ''}{stat.change}% from last year
        </span>
      </div>
    );
  }

  // Tighter margins so the chart spreads to the edges of the card
  const margin = { top: 8, right: 10, left: -10, bottom: 0 };
  const tickStyle = { fontSize: 10, fill: 'rgba(255,255,255,0.45)' };

  if (chartType === 'radar') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="72%">
          <PolarGrid stroke="rgba(255,255,255,0.08)" />
          <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.55)' }} />
          <PolarRadiusAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} />
          {countries.map((c, i) => (
            <Radar
              key={c}
              name={c}
              dataKey={c}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              fill={CHART_COLORS[i % CHART_COLORS.length]}
              fillOpacity={0.18}
            />
          ))}
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            iconType="circle"
            iconSize={8}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(10,14,20,0.92)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '6px',
              fontSize: '10px',
              padding: '4px 8px',
              lineHeight: '1.3',
            }}
            itemStyle={{ padding: '1px 0', fontSize: '10px' }}
            labelStyle={{ fontSize: '9px', marginBottom: '2px', color: 'rgba(255,255,255,0.55)' }}
            wrapperStyle={{ outline: 'none' }}
          />
        </RadarChart>
      </ResponsiveContainer>
    );
  }

  const ChartWrapper = chartType === 'line' ? LineChart : chartType === 'area' ? AreaChart : BarChart;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ChartWrapper data={data} margin={margin}>
        <CartesianGrid strokeDasharray="0" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis
          dataKey="year"
          tick={tickStyle}
          tickLine={false}
          axisLine={false}
          padding={{ left: 8, right: 8 }}
        />
        <YAxis tick={tickStyle} tickLine={false} axisLine={false} width={32} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(10,14,20,0.92)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '6px',
            fontSize: '10px',
            padding: '4px 8px',
            lineHeight: '1.3',
          }}
          itemStyle={{ padding: '1px 0', fontSize: '10px' }}
          labelStyle={{ fontSize: '9px', marginBottom: '2px', color: 'rgba(255,255,255,0.55)' }}
          wrapperStyle={{ outline: 'none' }}
          cursor={{ fill: 'rgba(255,255,255,0.03)' }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
          iconType="circle"
          iconSize={8}
        />
        {countries.map((c, i) => {
          const color = CHART_COLORS[i % CHART_COLORS.length];
          if (chartType === 'line') {
            return <Line key={c} type="monotone" dataKey={c} stroke={color} strokeWidth={2.2} dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} />;
          }
          if (chartType === 'area') {
            return <Area key={c} type="monotone" dataKey={c} stroke={color} fill={color} fillOpacity={0.2} strokeWidth={2} />;
          }
          return <Bar key={c} dataKey={c} fill={color} radius={[4, 4, 0, 0]} />;
        })}
      </ChartWrapper>
    </ResponsiveContainer>
  );
}

// ── Chart type selector config ─────────────────────────────────────────────────

const chartTypeOptions: { type: ChartType; label: string; icon: React.ReactNode }[] = [
  { type: 'bar', label: 'Bar', icon: <BarChart3 className="h-5 w-5" /> },
  { type: 'line', label: 'Line', icon: <TrendingUp className="h-5 w-5" /> },
  { type: 'area', label: 'Area', icon: <AreaChartIcon className="h-5 w-5" /> },
  { type: 'radar', label: 'Radar', icon: <RadarIcon className="h-5 w-5" /> },
  { type: 'stat', label: 'Stat', icon: <Hash className="h-5 w-5" /> },
];

// ── Main Dashboard component ───────────────────────────────────────────────────

const Dashboard = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { preferences, isPersonalized } = useUserPreferences();
  const [widgets, setWidgets] = useState<Widget[]>(defaultWidgets);
  const [hydrated, setHydrated] = useState(false);
  const [savedRecently, setSavedRecently] = useState(false);

  // Admins can view the dashboard like any other user — they reach /admin
  // via the sidebar's Administration section. (Previously we force-redirected
  // every admin away from /dashboard which left them with a flash of blank
  // screen and no way back to the dashboard view.)

  // Hydrate widgets from localStorage on mount.
  // - If v2 exists, use it (user's saved layout).
  // - Otherwise, look for legacy v1 data: if it's the previous fixed defaults
  //   we discard it (so new defaults load); if it's customised we migrate it
  //   into v2 unchanged. Legacy keys are then cleared.
  useEffect(() => {
    try {
      const v2 = localStorage.getItem(STORAGE_KEY);
      if (v2) {
        const parsed = JSON.parse(v2) as Widget[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setWidgets(parsed);
        }
      } else {
        for (const legacy of LEGACY_STORAGE_KEYS) {
          const raw = localStorage.getItem(legacy);
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw) as Widget[];
            if (Array.isArray(parsed) && parsed.length > 0 && !isStaleDefaults(parsed)) {
              // Customised legacy layout → preserve it under the new key
              setWidgets(parsed);
              localStorage.setItem(STORAGE_KEY, raw);
            }
          } catch { /* ignore */ }
          localStorage.removeItem(legacy);
        }
      }
    } catch {
      // ignore corrupted state
    } finally {
      setHydrated(true);
    }
  }, []);

  // Persist widgets to localStorage on every change (after hydration)
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
    } catch {
      // storage quota / private mode; non-fatal
    }
  }, [widgets, hydrated]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const countryMeta = isPersonalized && preferences.myCountry ? getCountryMeta(preferences.myCountry) : null;

  // Form state — used for both Add and Edit
  const [formChartType, setFormChartType] = useState<ChartType>('bar');
  const [formIndicator, setFormIndicator] = useState('');
  const [formCountries, setFormCountries] = useState<string[]>([]);
  const [formTitle, setFormTitle] = useState('');

  const resetForm = useCallback(() => {
    setFormChartType('bar');
    setFormIndicator('');
    setFormCountries([]);
    setFormTitle('');
    setEditingId(null);
  }, []);

  const openAddDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (w: Widget) => {
    setEditingId(w.id);
    setFormChartType(w.chartType);
    setFormIndicator(w.indicator);
    setFormCountries(w.countries);
    setFormTitle(w.title);
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formTitle.trim() || !formIndicator) return;
    const countries = formCountries.length > 0 ? formCountries : ['Nigeria'];

    if (editingId) {
      // Update existing widget — regenerate data only if shape-affecting fields changed
      setWidgets((prev) =>
        prev.map((w) => {
          if (w.id !== editingId) return w;
          const shapeChanged =
            w.chartType !== formChartType ||
            JSON.stringify(w.countries) !== JSON.stringify(countries);
          return {
            ...w,
            title: formTitle.trim(),
            chartType: formChartType,
            indicator: formIndicator,
            countries,
            data: shapeChanged ? generateData(formChartType, countries) : w.data,
          };
        }),
      );
      toast({ title: 'Widget updated' });
    } else {
      const widget: Widget = {
        id: `w-${Date.now()}`,
        title: formTitle.trim(),
        chartType: formChartType,
        indicator: formIndicator,
        countries,
        data: generateData(formChartType, countries),
      };
      setWidgets((prev) => [...prev, widget]);
      toast({ title: 'Widget added', description: `"${widget.title}" is on your dashboard.` });
    }
    resetForm();
    setDialogOpen(false);
  };

  const handleRemoveWidget = (id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
    toast({ title: 'Widget removed' });
  };

  const handleSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
      setSavedRecently(true);
      toast({ title: 'Dashboard saved', description: 'Your layout will be here next time you log in.' });
      setTimeout(() => setSavedRecently(false), 2200);
    } catch {
      toast({ title: 'Save failed', description: 'Browser storage is unavailable.', variant: 'destructive' });
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/dashboard`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Dashboard link copied', description: url });
    } catch {
      toast({ title: 'Could not copy link', description: url, variant: 'destructive' });
    }
  };

  const toggleCountry = (country: string) => {
    setFormCountries((prev) => {
      if (prev.includes(country)) return prev.filter((c) => c !== country);
      if (prev.length >= 5) return prev;
      return [...prev, country];
    });
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="space-y-6">
      {/* Admins land on /admin by default and reach this view via the
          "View as user" button. We surface a small banner so they always have
          a one-click route back to the admin console. */}
      {isAdmin && (
        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs">
          <span className="text-red-300 flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            You're viewing the dashboard as a regular user.
          </span>
          <Button asChild variant="outline" size="sm" className="h-7 gap-1.5 text-xs border-red-500/40 text-red-300 hover:bg-red-500/20 hover:text-red-200">
            <Link to="/admin">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to admin
            </Link>
          </Button>
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="h-6 w-6 text-[#D4A017]" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tighter bg-gradient-to-br from-[#D4A017] from-10% via-white via-40% to-white/40 bg-clip-text text-transparent">My Dashboard</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Build, persist, and share your data overview · {widgets.length} widget{widgets.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 h-8 text-xs px-3" onClick={openAddDialog}>
                <Plus className="h-3.5 w-3.5" />
                Add Widget
              </Button>
            </DialogTrigger>

            {/* ── Add/Edit Widget Dialog ──────────────────────────────────── */}
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-black/95 border-gray-800">
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit Widget' : 'Add Widget'}</DialogTitle>
                <DialogDescription>
                  {editingId ? 'Update this widget\'s configuration.' : 'Configure a new widget to add to your dashboard.'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 pt-2">
                {/* Chart type */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Chart Type</label>
                  <div className="flex gap-2 flex-wrap">
                    {chartTypeOptions.map((opt) => (
                      <button
                        key={opt.type}
                        type="button"
                        onClick={() => setFormChartType(opt.type)}
                        className={`flex flex-col items-center gap-1 rounded-lg border px-3 py-2 text-xs transition-colors
                          ${formChartType === opt.type
                            ? 'border-[#D4A017] bg-[#D4A017]/10 text-[#D4A017]'
                            : 'border-gray-800 hover:bg-white/[0.05]'}`}
                      >
                        {opt.icon}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Indicator */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Indicator</label>
                  <Select value={formIndicator} onValueChange={setFormIndicator}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an indicator" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDICATORS.map((ind) => (
                        <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Countries multi-select */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Countries <span className="text-gray-400 font-normal">(up to 5)</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {COUNTRIES.map((country) => (
                      <label
                        key={country}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <Checkbox
                          checked={formCountries.includes(country)}
                          onCheckedChange={() => toggleCountry(country)}
                          disabled={!formCountries.includes(country) && formCountries.length >= 5}
                        />
                        {country}
                      </label>
                    ))}
                  </div>
                  {formCountries.length > 0 && (
                    <div className="flex gap-1 flex-wrap pt-1">
                      {formCountries.map((c) => (
                        <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Widget Title</label>
                  <Input
                    placeholder="e.g. Youth Literacy Comparison"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                  />
                </div>

                {/* Submit */}
                <Button
                  className="w-full gap-2"
                  onClick={handleSubmit}
                  disabled={!formTitle.trim() || !formIndicator}
                >
                  {editingId ? <><Pencil className="h-4 w-4" /> Update widget</> : <><Plus className="h-4 w-4" /> Add Widget</>}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-xs px-3"
            onClick={handleSave}
          >
            {savedRecently ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Save className="h-3.5 w-3.5" />}
            {savedRecently ? 'Saved' : 'Save'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-xs px-3"
            onClick={handleShare}
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </Button>
        </div>
      </div>

      {/* ── Personalized Welcome Section ────────────────────────────────── */}
      <div>
        {isPersonalized && preferences.myCountry ? (
          <Card className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] border-gray-800 rounded-2xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl bg-[#D4A017]/10 pointer-events-none" />
            <CardContent className="p-5 space-y-4 relative">
              {/* Welcome row with country flag and stats */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <Link
                  to={`/dashboard/countries/${slugify(preferences.myCountry)}`}
                  className="hover:opacity-80 transition-opacity"
                >
                  <CountryFlag country={preferences.myCountry} size="lg" showName />
                </Link>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold">
                    Welcome back! Here's your overview for{' '}
                    <Link
                      to={`/dashboard/countries/${slugify(preferences.myCountry)}`}
                      className="text-[#D4A017] hover:underline"
                    >
                      {preferences.myCountry}
                    </Link>
                  </h2>
                  {countryMeta && (
                    <div className="flex flex-wrap gap-4 mt-1.5 text-sm text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        Population: {countryMeta.population}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <TrendingUp className="h-3.5 w-3.5" />
                        Youth Population: {countryMeta.youthPop}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Favorite Countries row — link to country report card */}
              {preferences.favoriteCountries.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-400 flex items-center gap-1">
                    <Star className="h-3 w-3 text-[#D4A017]" /> Favorite Countries
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {preferences.favoriteCountries.map((country) => (
                      <Link
                        key={country}
                        to={`/dashboard/countries/${slugify(country)}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-800 bg-white/[0.03] hover:bg-[#D4A017]/10 hover:border-[#D4A017]/40 transition-colors text-sm group"
                      >
                        <CountryFlag country={country} size="xs" />
                        <span>{country}</span>
                        <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 -ml-0.5 group-hover:ml-0 transition-all text-[#D4A017]" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Recently Viewed row — link to country report card */}
              {preferences.recentlyViewed.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Recently Viewed
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {preferences.recentlyViewed.map((country) => (
                      <Link
                        key={country}
                        to={`/dashboard/countries/${slugify(country)}`}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-gray-800 hover:bg-white/[0.06] hover:border-gray-600 transition-colors text-xs text-gray-400 hover:text-white"
                      >
                        <CountryFlag country={country} size="xs" />
                        {country}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed border-gray-800 bg-white/[0.03] rounded-2xl">
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Sparkles className="h-4 w-4 text-[#D4A017]" />
                <span>Personalize your experience to see country-specific insights and favorites.</span>
              </div>
              <Link to="/settings">
                <Button variant="outline" size="sm">
                  Personalize
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Widget Grid / Empty State ─────────────────────────────────────── */}
      <div>
        {widgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center rounded-2xl border border-dashed border-gray-800 bg-white/[0.02]">
            <LayoutDashboard className="h-16 w-16 text-gray-400/40 mb-4" />
            <h2 className="text-xl font-semibold mb-2">No widgets yet</h2>
            <p className="text-gray-400 mb-6 max-w-sm">
              Start building your custom dashboard by adding your first widget.
            </p>
            <Button className="gap-2" onClick={openAddDialog}>
              <Plus className="h-4 w-4" />
              Add your first widget
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {widgets.map((widget) => (
              <Card
                key={widget.id}
                className="group flex flex-col bg-gradient-to-b from-white/[0.04] to-white/[0.015] border-gray-800/80 rounded-2xl overflow-hidden hover:border-gray-700 transition-colors relative"
              >
                {/* Subtle accent line at top */}
                <div className="h-[2px] bg-gradient-to-r from-emerald-500/30 via-[#D4A017]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-3.5">
                  <div className="space-y-0.5 min-w-0">
                    <h3 className="font-semibold text-sm leading-tight truncate">{widget.title}</h3>
                    <p className="text-[11px] text-gray-500 truncate">{widget.indicator}</p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0 ml-2 opacity-50 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEditDialog(widget)}
                      title="Edit widget"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleRemoveWidget(widget.id)}
                      title="Remove widget"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 px-1.5 pb-3 pt-1">
                  <div className="h-60">
                    <WidgetChart widget={widget} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
