import React, { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useEmblaCarousel from 'embla-carousel-react';
import AutoScroll from 'embla-carousel-auto-scroll';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Download, TrendingUp, TrendingDown, Minus, Info, Award, BarChart3, ArrowUpDown, X, Search } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';
import CountryFlag from '@/components/CountryFlag';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/lib/api-client';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useExportGuard } from '@/hooks/useExportGuard';
import { GuestInviteModal } from '@/components/GuestInviteModal';
import { Content } from '@/components/cms';

// The 54-row invented ranking table that used to sit here is gone. Its scores
// and ranks were never rendered -- only a country->region lookup was derived
// from it -- but it read exactly like live data to anyone opening this file,
// and the API already returns `region` on every ranking row.
// The seven AYO dimensions — match the slugs in apps/api Theme table.
const dimensions = [
  { key: "demography",       label: "Demography",      weight: "20%", color: "text-blue-400" },
  { key: "education",        label: "Education",       weight: "15%", color: "text-violet-400" },
  { key: "employment",       label: "Employment",      weight: "15%", color: "text-orange-400" },
  { key: "health",           label: "Health",          weight: "15%", color: "text-red-400" },
  { key: "entrepreneurship", label: "Entrepreneurship", weight: "15%", color: "text-cyan-400" },
  { key: "peaceSecurity",    label: "Peace",           weight: "10%", color: "text-green-400" },
  { key: "accessToJustice",  label: "Justice",         weight: "10%", color: "text-purple-400" },
];

type SortField = 'rank' | 'country' | 'score' | 'change' | 'demography' | 'education' | 'employment' | 'health' | 'entrepreneurship' | 'peaceSecurity' | 'accessToJustice';

const getTierBadge = (score: number) => {
  if (score >= 70) return <Badge className="ml-2 bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30 hover:bg-green-500/25">High</Badge>;
  if (score >= 60) return <Badge className="ml-2 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/25">Medium</Badge>;
  return <Badge className="ml-2 bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 hover:bg-red-500/25">Low</Badge>;
};

// Shared radar + per-dimension grid. Rendered both in the hover preview popover
// and in the click-to-keep dialog so the two stay perfectly in sync.
const BreakdownRadar = ({ c, height = 320 }: { c: any; height?: number }) => (
  <>
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart
        data={[
          { dimension: 'Demography',      value: c.demography,       fullMark: 100 },
          { dimension: 'Education',       value: c.education,        fullMark: 100 },
          { dimension: 'Employment',      value: c.employment,       fullMark: 100 },
          { dimension: 'Health',          value: c.health,           fullMark: 100 },
          { dimension: 'Entrepreneurship', value: c.entrepreneurship, fullMark: 100 },
          { dimension: 'Peace',           value: c.peaceSecurity,    fullMark: 100 },
          { dimension: 'Justice',         value: c.accessToJustice,  fullMark: 100 },
        ]}
        cx="50%" cy="50%" outerRadius="75%"
      >
        <PolarGrid strokeDasharray="3 3" />
        <PolarAngleAxis dataKey="dimension" tick={{ fontSize: height > 260 ? 13 : 11 }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
        <Radar
          name={c.country}
          dataKey="value"
          stroke="hsl(var(--chart-1))"
          fill="hsl(var(--chart-1))"
          fillOpacity={0.3}
        />
      </RadarChart>
    </ResponsiveContainer>
    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mt-2 w-full text-center">
      {dimensions.map((dim) => (
        <div key={dim.key}>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">{dim.label}</p>
          <p className={`font-bold text-sm ${dim.color}`}>
            {Math.round((c as any)[dim.key] ?? 0)}
          </p>
        </div>
      ))}
    </div>
  </>
);

const YouthIndex = () => {
  const { t } = useLanguage();
  const { preferences } = useUserPreferences();
  const [selectedYear, setSelectedYear] = useState("2024");
  const [selectedRegion, setSelectedRegion] = useState("All Regions");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const navigate = useNavigate();
  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const goToProfile = (countryName: string) => navigate(`/dashboard/profile/${slugify(countryName)}`);
  const [breakdownCountry, setBreakdownCountry] = useState<any>(null);
  // Transient hover preview of the dimension breakdown. Shown when the cursor
  // is over a score / dimension cell; clicking pins it open in the dialog.
  const [hovered, setHovered] = useState<{ item: any; top: number; left: number } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBreakdown = (item: any, el: HTMLElement) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    const r = el.getBoundingClientRect();
    const width = 340;
    const estHeight = 320;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    let top = r.bottom + 8;
    if (top + estHeight > window.innerHeight) top = Math.max(8, r.top - estHeight - 8);
    setHovered({ item, top, left });
  };
  const scheduleHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setHovered(null), 140);
  };
  // Spread onto every score / dimension cell so hovering anywhere on the right
  // side of a row reveals that country's breakdown.
  const hoverProps = (item: any) => ({
    onMouseEnter: (e: React.MouseEvent<HTMLTableCellElement>) => showBreakdown(item, e.currentTarget),
    onMouseLeave: scheduleHide,
  });

  const { toast } = useToast();
  const { guard, inviteOpen, setInviteOpen, inviteAction } = useExportGuard();

  // Auto-scrolling rankings strip (ranks 2–54). Loops infinitely, pauses on hover.
  const [topStripRef] = useEmblaCarousel(
    { loop: true, align: 'start', dragFree: true, containScroll: false },
    [AutoScroll({ playOnInit: true, speed: 0.8, stopOnMouseEnter: true, stopOnInteraction: false })],
  );

  const handleExport = () => {
    guard(
      () => toast({
        title: 'Export coming soon',
        description: 'Bulk export of the Youth Index will be available shortly.',
      }),
      'export',
    );
  };

  // Fetch rankings from the api-client at @/lib/api-client. This client
  // returns the raw wire response — typically `{ data: [...], meta: {...} }`
  // for paginated/grouped endpoints — so we unwrap `.data` below before
  // mapping. Calling it with `{ year }` is correct because the api-client
  // signature is `rankings(params?: { year?: number })`.
  const { data: apiRankings, isLoading, isError } = useQuery({
    queryKey: ['youth-index', selectedYear],
    queryFn: () => api.youthIndex.rankings({ year: parseInt(selectedYear) }),
  });

  // Transform API data to match UI format. The backend now returns
  // `dimensions` keyed by the 7 theme slugs alongside the legacy flat
  // score fields (back-compat shim). We prefer the new map but fall
  // through to legacy fields if a slug is missing.
  const indexData = useMemo(() => {
    // The api-client doesn't unwrap envelopes — both `T[]` (legacy shape)
    // and `{ data: T[], meta }` (paginated shape) need to be supported here.
    const apiData: any = (apiRankings as any)?.data ?? apiRankings;
    if (Array.isArray(apiData) && apiData.length > 0) {
      return apiData.map((r: any) => {
        const country = r.countryName || r.country?.name;
        const d = r.dimensions ?? {};
        return {
          rank: r.rank,
          country,
          region: r.region || 'Other',
          score: r.indexScore ?? r.overallScore,
          change: r.rankChange || 0,
          demography:       d['youth-demography-participation'] ?? r.civicScore     ?? 0,
          education:        d['education']        ?? r.educationScore  ?? 0,
          employment:       d['employment']       ?? r.employmentScore ?? 0,
          health:           d['health']           ?? r.healthScore     ?? 0,
          entrepreneurship: d['entrepreneurship'] ?? r.innovationScore ?? 0,
          peaceSecurity:    d['peace-security']   ?? 0,
          accessToJustice:  d['access-to-justice'] ?? 0,
          tier: r.tier,
        };
      });
    }
    // No mock fallback. If the API returns nothing, the empty-state below
    // explains why — don't silently substitute fabricated numbers.
    return [];
  }, [apiRankings]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'rank' ? 'asc' : 'desc');
    }
  };

  const filteredData = useMemo(() => {
    let rows = indexData as any[];
    if (selectedRegion !== 'All Regions') {
      rows = rows.filter((item) => item.region === selectedRegion);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      rows = rows.filter((item) => String(item.country || '').toLowerCase().includes(q));
    }
    return rows;
  }, [indexData, selectedRegion, searchQuery]);

  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const modifier = sortDirection === 'asc' ? 1 : -1;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal) * modifier;
      }
      return ((aVal as number) - (bVal as number)) * modifier;
    });
  }, [filteredData, sortField, sortDirection]);

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-pan-green-500" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-pan-red-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-pan-green-600";
    if (score >= 60) return "text-pan-gold-600";
    if (score >= 50) return "text-pan-blue-600";
    return "text-pan-red-600";
  };

  return (
    <>
      <GuestInviteModal open={inviteOpen} onOpenChange={setInviteOpen} action={inviteAction} />
      <header className="relative py-8 md:py-12 overflow-hidden">
        <div className="absolute inset-0 opacity-30 w-full bg-[linear-gradient(to_right,#333_1px,transparent_1px),linear-gradient(to_bottom,#333_1px,transparent_1px)] bg-[size:6rem_5rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
        <div className="container px-4 md:px-6 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Award className="h-8 w-8 text-[#D4A017]" />
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tighter bg-gradient-to-br from-[#D4A017] from-10% via-white via-40% to-white/40 bg-clip-text text-transparent">{t('youthIndex.title')}</h1>
              </div>
              <p className="text-sm sm:text-base text-[#A89070]">
                {t('youthIndex.subtitle')}
              </p>
            </div>
            <div className="flex gap-2">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2023">2023</SelectItem>
                  <SelectItem value="2022">2022</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="gap-2" onClick={handleExport}>
                <Download className="h-4 w-4" />
                <Content as="span" id="youth_index.export_button" fallback="Export" className="hidden sm:inline" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="py-6 md:py-8">
        <div className="container px-4 md:px-6">
          {/* Methodology Overview */}
          <div className="grid gap-4 md:grid-cols-4 mb-8">
            {dimensions.map((dim) => (
              <Card key={dim.key} className="bg-white/[0.03] border-gray-800 rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`font-semibold ${dim.color}`}>{dim.label}</span>
                    <Badge variant="secondary" className="text-xs">{dim.weight}</Badge>
                  </div>
                  <p className="text-xs text-gray-400">
                    Measures youth outcomes in {dim.label.toLowerCase()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Top Ranked (fixed) + scrollable strip of ranks 2–54 */}
          {indexData.length > 0 && (
            <div className="mb-8 flex gap-3">
              {/* Fixed #1 card */}
              {(() => {
                const top = indexData[0];
                return (
                  <Card
                    className="relative overflow-hidden bg-white/[0.03] border-2 border-pan-gold-400 rounded-2xl flex-shrink-0 w-64 cursor-pointer hover:bg-white/[0.05] transition-colors"
                    onClick={() => goToProfile(top.country)}
                  >
                    <div className="absolute top-0 right-0 bg-pan-gold-400 text-white px-2 py-0.5 text-[10px] font-medium">
                      <Content as="span" id="youth_index.top_ranked_badge" fallback="Top Ranked" />
                    </div>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl font-bold text-pan-gold-500">#{top.rank}</div>
                        <div className="flex-grow min-w-0">
                          <h3 className="font-semibold text-sm flex items-center gap-1.5 truncate">
                            <CountryFlag country={top.country} size="sm" />
                            <span className="truncate">{top.country}</span>
                          </h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-lg font-bold ${getScoreColor(top.score)}`}>{top.score}</span>
                            <span className="text-[10px] text-gray-500">/100</span>
                            {getTrendIcon(top.change)}
                            <span className={`text-[10px] ${top.change > 0 ? 'text-pan-green-500' : top.change < 0 ? 'text-pan-red-500' : 'text-gray-500'}`}>
                              {top.change > 0 ? '+' : ''}{top.change}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-1 mt-3 text-center">
                        <div>
                          <p className="text-[9px] text-gray-400">Edu</p>
                          <p className="font-semibold text-xs">{top.education}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-gray-400">Emp</p>
                          <p className="font-semibold text-xs">{top.employment}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-gray-400">Hlth</p>
                          <p className="font-semibold text-xs">{top.health}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-gray-400">Civic</p>
                          <p className="font-semibold text-xs">{top.civic}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Auto-scrolling ranks 2–end (loops, pauses on hover) */}
              <div className="flex-1 min-w-0 relative">
                <div className="overflow-hidden" ref={topStripRef}>
                  <div className="flex gap-3 pb-2">
                    {indexData.slice(1).map((item: any) => (
                      <Card
                        key={item.country}
                        className="relative overflow-hidden bg-white/[0.03] border-gray-800 rounded-2xl flex-shrink-0 w-44 cursor-pointer hover:bg-white/[0.05] transition-colors"
                        onClick={() => goToProfile(item.country)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-lg font-bold text-gray-300">#{item.rank}</span>
                            <span className="flex items-center gap-0.5 text-[10px]">
                              {getTrendIcon(item.change)}
                              <span className={item.change > 0 ? 'text-pan-green-500' : item.change < 0 ? 'text-pan-red-500' : 'text-gray-500'}>
                                {item.change > 0 ? '+' : ''}{item.change}
                              </span>
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-2 min-w-0">
                            <CountryFlag country={item.country} size="sm" />
                            <h3 className="font-semibold text-xs truncate">{item.country}</h3>
                          </div>
                          <div className="flex items-baseline gap-1 mt-1">
                            <span className={`text-base font-bold ${getScoreColor(item.score)}`}>{item.score}</span>
                            <span className="text-[10px] text-gray-500">/100</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
                {/* Edge fades */}
                <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent pointer-events-none" />
                <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none" />
              </div>
            </div>
          )}

          {/* Dimension breakdown dialog — opens from the score / change / indicator cells in the table */}
          <Dialog open={!!breakdownCountry} onOpenChange={(open) => { if (!open) setBreakdownCountry(null); }}>
            <DialogContent className="sm:max-w-[500px] bg-black/95 border-gray-800">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {breakdownCountry && <CountryFlag country={breakdownCountry.country} size="lg" />}
                  {breakdownCountry?.country} — Dimension Breakdown
                  {breakdownCountry && getTierBadge(breakdownCountry.score)}
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center">
                {breakdownCountry && <BreakdownRadar c={breakdownCountry} height={320} />}
                {breakdownCountry && (
                  <button
                    type="button"
                    onClick={() => {
                      const c = breakdownCountry.country;
                      setBreakdownCountry(null);
                      goToProfile(c);
                    }}
                    className="mt-6 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#D4A017]/40 bg-[#D4A017]/10 text-[#D4A017] text-sm font-medium hover:bg-[#D4A017]/20 hover:border-[#D4A017] transition-colors"
                  >
                    Click to see {breakdownCountry.country}'s youth profile overview
                    <span aria-hidden>→</span>
                  </button>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Hover preview of the dimension breakdown — appears when the cursor
              is over a score / dimension cell. Click it (or the cell) to pin it
              open in the dialog above. */}
          {hovered && (
            <div
              className="fixed z-50 w-[340px] rounded-2xl border border-gray-800 bg-black/95 p-4 shadow-2xl cursor-pointer"
              style={{ top: hovered.top, left: hovered.left }}
              onMouseEnter={() => { if (hideTimer.current) clearTimeout(hideTimer.current); }}
              onMouseLeave={scheduleHide}
              onClick={() => { setBreakdownCountry(hovered.item); setHovered(null); }}
            >
              <div className="flex items-center gap-2 mb-1">
                <CountryFlag country={hovered.item.country} size="sm" />
                <span className="font-semibold text-sm">{hovered.item.country} — Dimension Breakdown</span>
                {getTierBadge(hovered.item.score)}
              </div>
              <BreakdownRadar c={hovered.item} height={200} />
              <p className="mt-2 text-center text-[11px] text-[#FFC83D]">
                Click to keep open & see {hovered.item.country}'s youth profile →
              </p>
            </div>
          )}

          {/* Full Rankings Table */}
          <Card className="bg-white/[0.03] border-gray-800 rounded-2xl">
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    {t('youthIndex.fullRankings')}
                    <span className="text-xs font-normal text-gray-500">
                      ({filteredData.length} of {indexData.length})
                    </span>
                  </CardTitle>
                  <p className="text-sm text-white mt-1.5">
                    Click a country name to open its <span className="text-[#FFC83D] font-semibold">youth profile overview</span> · <span className="text-white">hover or click a score / dimension to see the breakdown</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Country search — type any AU country name */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Search country..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-8 h-9 w-[200px] rounded-md border border-gray-800/60 bg-white/[0.03] text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#D4A017]/40 focus:border-[#D4A017]/40"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                        aria-label="Clear search"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                    <SelectTrigger className="w-[160px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All Regions">All Regions</SelectItem>
                      <SelectItem value="North Africa">North Africa</SelectItem>
                      <SelectItem value="West Africa">West Africa</SelectItem>
                      <SelectItem value="East Africa">East Africa</SelectItem>
                      <SelectItem value="Central Africa">Central Africa</SelectItem>
                      <SelectItem value="Southern Africa">Southern Africa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800/50">
                      {([
                        { field: 'rank' as SortField, label: 'Rank', align: 'text-left', color: '' },
                        { field: 'country' as SortField, label: 'Country', align: 'text-left', color: '' },
                        { field: 'score' as SortField, label: 'Overall', align: 'text-left', color: '', hasTooltip: true },
                        { field: 'change' as SortField, label: 'Change', align: 'text-left', color: '' },
                        { field: 'demography' as SortField,       label: 'Demo',  align: 'text-center', color: 'text-blue-400' },
                        { field: 'education' as SortField,        label: 'Edu',   align: 'text-center', color: 'text-violet-400' },
                        { field: 'employment' as SortField,       label: 'Emp',   align: 'text-center', color: 'text-orange-400' },
                        { field: 'health' as SortField,           label: 'Hlth',  align: 'text-center', color: 'text-red-400' },
                        { field: 'entrepreneurship' as SortField, label: 'Entr',  align: 'text-center', color: 'text-cyan-400' },
                        { field: 'peaceSecurity' as SortField,    label: 'Peace', align: 'text-center', color: 'text-green-400' },
                        { field: 'accessToJustice' as SortField,  label: 'Just',  align: 'text-center', color: 'text-purple-400' },
                      ]).map((col) => (
                        <th
                          key={col.field}
                          className={`${col.align} py-3 px-2 text-xs font-medium text-gray-400 ${col.color} cursor-pointer select-none hover:text-foreground transition-colors`}
                          onClick={() => handleSort(col.field)}
                        >
                          <span className="inline-flex items-center gap-1">
                            {col.label}
                            {col.hasTooltip && (
                              <Tooltip>
                                <TooltipTrigger><Info className="h-3 w-3" /></TooltipTrigger>
                                <TooltipContent>Weighted composite of all dimensions</TooltipContent>
                              </Tooltip>
                            )}
                            <ArrowUpDown className={`h-3 w-3 ${sortField === col.field ? 'opacity-100' : 'opacity-30'}`} />
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedData.map((item) => {
                      const isMyCountry = preferences.myCountry && item.country.toLowerCase() === preferences.myCountry.toLowerCase();
                      return (
                      <tr
                        key={item.country}
                        className={`border-b border-gray-800/50 hover:bg-white/[0.04] transition-colors ${isMyCountry ? 'bg-[#D4A017]/10 border-l-2 border-l-[#D4A017]' : ''}`}
                      >
                        {/* Rank + Country → navigate to profile */}
                        <td
                          className="py-3 px-2 font-bold cursor-pointer"
                          onClick={() => goToProfile(item.country)}
                        >
                          {item.rank}
                        </td>
                        <td
                          className="py-3 px-2 font-medium cursor-pointer hover:text-[#D4A017] transition-colors"
                          onClick={() => goToProfile(item.country)}
                        >
                          <span className="inline-flex items-center gap-2">
                            <CountryFlag country={item.country} size="sm" />
                            {item.country}
                            {isMyCountry && (
                              <Badge className="ml-1 bg-primary/15 text-primary border-primary/30 text-[10px] px-1.5 py-0">
                                <Content as="span" id="youth_index.your_country_badge" fallback="Your Country" />
                              </Badge>
                            )}
                          </span>
                        </td>
                        {/* Score / Change / dimension columns → open dimension breakdown */}
                        <td
                          className={`py-3 px-2 font-bold cursor-pointer ${getScoreColor(item.score)}`}
                          onClick={() => setBreakdownCountry(item)}
                          {...hoverProps(item)}
                        >
                          <span className="inline-flex items-center">
                            {item.score}
                            {getTierBadge(item.score)}
                          </span>
                        </td>
                        <td className="py-3 px-2 cursor-pointer" onClick={() => setBreakdownCountry(item)} {...hoverProps(item)}>
                          <span className="flex items-center gap-1">
                            {getTrendIcon(item.change)}
                            <span className={`text-xs ${item.change > 0 ? 'text-pan-green-500' : item.change < 0 ? 'text-pan-red-500' : 'text-gray-500'}`}>
                              {item.change > 0 ? '+' : ''}{item.change}
                            </span>
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center text-sm cursor-pointer" onClick={() => setBreakdownCountry(item)} {...hoverProps(item)}>{Math.round(item.demography ?? 0)}</td>
                        <td className="py-3 px-2 text-center text-sm cursor-pointer" onClick={() => setBreakdownCountry(item)} {...hoverProps(item)}>{Math.round(item.education ?? 0)}</td>
                        <td className="py-3 px-2 text-center text-sm cursor-pointer" onClick={() => setBreakdownCountry(item)} {...hoverProps(item)}>{Math.round(item.employment ?? 0)}</td>
                        <td className="py-3 px-2 text-center text-sm cursor-pointer" onClick={() => setBreakdownCountry(item)} {...hoverProps(item)}>{Math.round(item.health ?? 0)}</td>
                        <td className="py-3 px-2 text-center text-sm cursor-pointer" onClick={() => setBreakdownCountry(item)} {...hoverProps(item)}>{Math.round(item.entrepreneurship ?? 0)}</td>
                        <td className="py-3 px-2 text-center text-sm cursor-pointer" onClick={() => setBreakdownCountry(item)} {...hoverProps(item)}>{Math.round(item.peaceSecurity ?? 0)}</td>
                        <td className="py-3 px-2 text-center text-sm cursor-pointer" onClick={() => setBreakdownCountry(item)} {...hoverProps(item)}>{Math.round(item.accessToJustice ?? 0)}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Empty state when search/region filter excludes everything */}
                {sortedData.length === 0 && indexData.length > 0 && (
                  <div className="text-center py-10">
                    <Search className="h-7 w-7 text-gray-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">
                      No country matches{searchQuery ? <> "<span className="text-white">{searchQuery}</span>"</> : ''}{selectedRegion !== 'All Regions' ? <> in <span className="text-white">{selectedRegion}</span></> : ''}.
                    </p>
                    <button
                      type="button"
                      onClick={() => { setSearchQuery(''); setSelectedRegion('All Regions'); }}
                      className="mt-3 text-xs text-[#D4A017] hover:underline"
                    >
                      Clear filters
                    </button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Methodology Note */}
          <div className="mt-8 p-4 bg-white/[0.03] border border-gray-800 rounded-2xl">
            <Content as="h3" id="youth_index.about.title" fallback="About the African Youth Index" className="font-bold mb-2" />
            <p className="text-sm text-gray-400">
              <Content
                as="span"
                id="youth_index.about.body"
                fallback="The African Youth Index is a composite indicator that ranks all 54 African Union member states by youth development outcomes. Scores range from 0–100 and are computed each year across seven weighted thematic dimensions: Youth Demography & Participation (20%), Education (15%), Employment (15%), Health (15%), Entrepreneurship (15%), Peace & Security (10%), and Access to Justice (10%). Indicator values are min–max normalized per year, then combined with these weights into the overall score. Missing indicators have their weight redistributed within the same theme; missing themes fall back to the regional average."
              />
              <a href="/resources/methodology" className="text-primary hover:underline ml-1">
                <Content as="span" id="youth_index.about.methodology_link" fallback="View full methodology" />
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default YouthIndex;
