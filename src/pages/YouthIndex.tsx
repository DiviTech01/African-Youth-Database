import React, { useState, useMemo } from 'react';
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

const mockIndexData = [
  { rank: 1, country: "Mauritius", region: "East Africa", score: 78.4, change: 2, education: 85.2, employment: 71.3, health: 82.1, civic: 74.8 },
  { rank: 2, country: "Seychelles", region: "East Africa", score: 76.2, change: 0, education: 82.4, employment: 69.8, health: 79.5, civic: 73.2 },
  { rank: 3, country: "Tunisia", region: "North Africa", score: 72.8, change: 1, education: 79.1, employment: 62.4, health: 78.3, civic: 71.5 },
  { rank: 4, country: "Botswana", region: "Southern Africa", score: 71.5, change: -1, education: 76.8, employment: 65.7, health: 74.2, civic: 69.4 },
  { rank: 5, country: "South Africa", region: "Southern Africa", score: 70.2, change: 2, education: 74.5, employment: 58.9, health: 76.8, civic: 70.6 },
  { rank: 6, country: "Cape Verde", region: "West Africa", score: 69.8, change: 0, education: 75.2, employment: 61.4, health: 73.5, civic: 69.1 },
  { rank: 7, country: "Rwanda", region: "East Africa", score: 68.4, change: 3, education: 72.1, employment: 64.8, health: 69.7, civic: 67.0 },
  { rank: 8, country: "Morocco", region: "North Africa", score: 67.9, change: -1, education: 73.4, employment: 59.2, health: 71.8, civic: 67.2 },
  { rank: 9, country: "Ghana", region: "West Africa", score: 66.5, change: 1, education: 71.8, employment: 58.4, health: 68.9, civic: 66.8 },
  { rank: 10, country: "Kenya", region: "East Africa", score: 65.8, change: 0, education: 70.5, employment: 56.7, health: 69.2, civic: 66.9 },
  { rank: 11, country: "Egypt", region: "North Africa", score: 64.2, change: -2, education: 71.2, employment: 52.8, health: 68.4, civic: 64.5 },
  { rank: 12, country: "Namibia", region: "Southern Africa", score: 63.9, change: 1, education: 69.8, employment: 54.3, health: 67.5, civic: 64.0 },
  { rank: 13, country: "Senegal", region: "West Africa", score: 62.1, change: 2, education: 65.4, employment: 57.2, health: 64.8, civic: 61.0 },
  { rank: 14, country: "Tanzania", region: "East Africa", score: 61.5, change: 0, education: 64.8, employment: 58.1, health: 63.2, civic: 59.8 },
  { rank: 15, country: "Ethiopia", region: "East Africa", score: 58.4, change: 1, education: 59.2, employment: 54.6, health: 61.8, civic: 58.0 },
  { rank: 16, country: "Algeria", region: "North Africa", score: 57.8, change: -1, education: 63.5, employment: 49.2, health: 62.7, civic: 55.8 },
  { rank: 17, country: "Côte d'Ivoire", region: "West Africa", score: 56.9, change: 2, education: 59.8, employment: 55.4, health: 57.6, civic: 54.8 },
  { rank: 18, country: "Gabon", region: "Central Africa", score: 55.7, change: 0, education: 58.9, employment: 51.2, health: 60.4, civic: 52.3 },
  { rank: 19, country: "Eswatini", region: "Southern Africa", score: 54.6, change: 1, education: 57.2, employment: 48.8, health: 58.1, civic: 54.3 },
  { rank: 20, country: "Lesotho", region: "Southern Africa", score: 53.8, change: -1, education: 56.4, employment: 47.5, health: 57.8, civic: 53.5 },
  { rank: 21, country: "Uganda", region: "East Africa", score: 52.9, change: 1, education: 54.7, employment: 51.3, health: 55.2, civic: 50.4 },
  { rank: 22, country: "Zambia", region: "East Africa", score: 52.1, change: 0, education: 53.8, employment: 50.6, health: 54.9, civic: 49.1 },
  { rank: 23, country: "Cameroon", region: "Central Africa", score: 51.4, change: -2, education: 54.2, employment: 47.8, health: 53.6, civic: 50.0 },
  { rank: 24, country: "Zimbabwe", region: "East Africa", score: 50.7, change: 2, education: 56.3, employment: 44.2, health: 52.4, civic: 50.0 },
  { rank: 25, country: "Benin", region: "West Africa", score: 50.2, change: 0, education: 50.4, employment: 50.8, health: 51.6, civic: 47.9 },
  { rank: 26, country: "São Tomé and Príncipe", region: "Central Africa", score: 49.6, change: 1, education: 53.1, employment: 45.7, health: 52.0, civic: 47.6 },
  { rank: 27, country: "Togo", region: "West Africa", score: 49.1, change: -1, education: 50.8, employment: 48.4, health: 49.7, civic: 47.4 },
  { rank: 28, country: "Madagascar", region: "East Africa", score: 48.5, change: 0, education: 49.6, employment: 47.9, health: 50.3, civic: 46.1 },
  { rank: 29, country: "Mozambique", region: "East Africa", score: 47.8, change: 1, education: 47.2, employment: 49.1, health: 48.6, civic: 46.3 },
  { rank: 30, country: "Comoros", region: "East Africa", score: 47.2, change: 0, education: 49.8, employment: 44.6, health: 48.3, civic: 46.1 },
  { rank: 31, country: "Malawi", region: "East Africa", score: 46.5, change: -1, education: 47.4, employment: 45.9, health: 47.8, civic: 44.9 },
  { rank: 32, country: "Djibouti", region: "East Africa", score: 45.9, change: 1, education: 46.7, employment: 44.5, health: 47.2, civic: 45.2 },
  { rank: 33, country: "Republic of the Congo", region: "Central Africa", score: 45.3, change: 0, education: 47.1, employment: 43.2, health: 46.8, civic: 44.1 },
  { rank: 34, country: "Equatorial Guinea", region: "Central Africa", score: 44.7, change: -2, education: 46.9, employment: 42.4, health: 45.7, civic: 43.8 },
  { rank: 35, country: "Mauritania", region: "West Africa", score: 44.0, change: 1, education: 43.6, employment: 45.1, health: 44.8, civic: 42.5 },
  { rank: 36, country: "Liberia", region: "West Africa", score: 43.4, change: 2, education: 44.1, employment: 43.6, health: 43.9, civic: 41.9 },
  { rank: 37, country: "Sierra Leone", region: "West Africa", score: 42.7, change: 0, education: 43.5, employment: 42.0, health: 43.6, civic: 41.7 },
  { rank: 38, country: "Gambia", region: "West Africa", score: 42.1, change: -1, education: 42.8, employment: 41.4, health: 42.9, civic: 41.3 },
  { rank: 39, country: "Angola", region: "Central Africa", score: 41.5, change: 1, education: 42.0, employment: 41.2, health: 42.4, civic: 40.4 },
  { rank: 40, country: "Nigeria", region: "West Africa", score: 41.0, change: 0, education: 43.2, employment: 38.7, health: 42.6, civic: 39.7 },
  { rank: 41, country: "Burundi", region: "East Africa", score: 40.3, change: -1, education: 41.4, employment: 39.5, health: 40.8, civic: 39.6 },
  { rank: 42, country: "Burkina Faso", region: "West Africa", score: 39.7, change: 1, education: 39.8, employment: 40.4, health: 39.6, civic: 38.9 },
  { rank: 43, country: "Niger", region: "West Africa", score: 39.0, change: 0, education: 38.4, employment: 40.6, health: 39.1, civic: 37.8 },
  { rank: 44, country: "Mali", region: "West Africa", score: 38.4, change: -2, education: 39.2, employment: 37.6, health: 38.7, civic: 37.9 },
  { rank: 45, country: "Eritrea", region: "East Africa", score: 37.8, change: 1, education: 38.5, employment: 36.7, health: 38.2, civic: 37.6 },
  { rank: 46, country: "Guinea", region: "West Africa", score: 37.1, change: 0, education: 37.6, employment: 36.4, health: 37.5, civic: 36.6 },
  { rank: 47, country: "Sudan", region: "North Africa", score: 36.4, change: -2, education: 38.2, employment: 33.5, health: 37.1, civic: 36.4 },
  { rank: 48, country: "Libya", region: "North Africa", score: 35.7, change: -1, education: 37.6, employment: 32.4, health: 36.4, civic: 35.7 },
  { rank: 49, country: "Democratic Republic of the Congo", region: "Central Africa", score: 35.0, change: 0, education: 35.6, employment: 33.8, health: 35.2, civic: 35.1 },
  { rank: 50, country: "Guinea-Bissau", region: "West Africa", score: 34.3, change: 1, education: 34.8, employment: 33.4, health: 34.6, civic: 34.2 },
  { rank: 51, country: "Chad", region: "Central Africa", score: 33.5, change: -1, education: 33.9, employment: 32.8, health: 33.7, civic: 33.4 },
  { rank: 52, country: "Central African Republic", region: "Central Africa", score: 32.7, change: 0, education: 33.2, employment: 32.0, health: 33.0, civic: 32.4 },
  { rank: 53, country: "Somalia", region: "East Africa", score: 31.8, change: -1, education: 32.4, employment: 30.8, health: 32.1, civic: 31.6 },
  { rank: 54, country: "South Sudan", region: "East Africa", score: 30.5, change: 0, education: 31.2, employment: 29.4, health: 30.8, civic: 30.3 },
];

const REGION_BY_COUNTRY: Record<string, string> = Object.fromEntries(
  mockIndexData.map((c) => [c.country, c.region]),
);

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
          region: r.region || REGION_BY_COUNTRY[country] || 'Other',
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
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart
                    data={breakdownCountry ? [
                      { dimension: 'Demography',      value: breakdownCountry.demography,       fullMark: 100 },
                      { dimension: 'Education',       value: breakdownCountry.education,        fullMark: 100 },
                      { dimension: 'Employment',      value: breakdownCountry.employment,       fullMark: 100 },
                      { dimension: 'Health',          value: breakdownCountry.health,           fullMark: 100 },
                      { dimension: 'Entrepreneurship', value: breakdownCountry.entrepreneurship, fullMark: 100 },
                      { dimension: 'Peace',           value: breakdownCountry.peaceSecurity,    fullMark: 100 },
                      { dimension: 'Justice',         value: breakdownCountry.accessToJustice,  fullMark: 100 },
                    ] : []}
                    cx="50%" cy="50%" outerRadius="75%"
                  >
                    <PolarGrid strokeDasharray="3 3" />
                    <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 13 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Radar
                      name={breakdownCountry?.country}
                      dataKey="value"
                      stroke="hsl(var(--chart-1))"
                      fill="hsl(var(--chart-1))"
                      fillOpacity={0.3}
                    />
                  </RadarChart>
                </ResponsiveContainer>
                {breakdownCountry && (
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-3 mt-2 w-full text-center">
                    {dimensions.map((dim) => (
                      <div key={dim.key}>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">{dim.label}</p>
                        <p className={`font-bold text-sm ${dim.color}`}>
                          {Math.round((breakdownCountry as any)[dim.key] ?? 0)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
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
                  <p className="text-xs text-gray-500 mt-1.5">
                    Click a country name to open its <span className="text-[#D4A017]">youth profile overview</span> · click a score or dimension to see the breakdown
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
                        >
                          <span className="inline-flex items-center">
                            {item.score}
                            {getTierBadge(item.score)}
                          </span>
                        </td>
                        <td className="py-3 px-2 cursor-pointer" onClick={() => setBreakdownCountry(item)}>
                          <span className="flex items-center gap-1">
                            {getTrendIcon(item.change)}
                            <span className={`text-xs ${item.change > 0 ? 'text-pan-green-500' : item.change < 0 ? 'text-pan-red-500' : 'text-gray-500'}`}>
                              {item.change > 0 ? '+' : ''}{item.change}
                            </span>
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center text-sm cursor-pointer" onClick={() => setBreakdownCountry(item)}>{Math.round(item.demography ?? 0)}</td>
                        <td className="py-3 px-2 text-center text-sm cursor-pointer" onClick={() => setBreakdownCountry(item)}>{Math.round(item.education ?? 0)}</td>
                        <td className="py-3 px-2 text-center text-sm cursor-pointer" onClick={() => setBreakdownCountry(item)}>{Math.round(item.employment ?? 0)}</td>
                        <td className="py-3 px-2 text-center text-sm cursor-pointer" onClick={() => setBreakdownCountry(item)}>{Math.round(item.health ?? 0)}</td>
                        <td className="py-3 px-2 text-center text-sm cursor-pointer" onClick={() => setBreakdownCountry(item)}>{Math.round(item.entrepreneurship ?? 0)}</td>
                        <td className="py-3 px-2 text-center text-sm cursor-pointer" onClick={() => setBreakdownCountry(item)}>{Math.round(item.peaceSecurity ?? 0)}</td>
                        <td className="py-3 px-2 text-center text-sm cursor-pointer" onClick={() => setBreakdownCountry(item)}>{Math.round(item.accessToJustice ?? 0)}</td>
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
