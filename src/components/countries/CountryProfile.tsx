
import React, { useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const REPORTS_API = `${API_BASE}/country-reports`;

interface RealCountryReport {
  country: string;
  iso3: string;
  lastDataYear: number | null;
  hasRealData: boolean;
  real: {
    literacyPct?: number;
    tertiaryGerPct?: number;
    secondaryCompletionPct?: number;
    internetAccessPct?: number;
    informalEmploymentPct?: number;
    bankedPct?: number;
    youthBulgePct?: number;
    urbanPopPct?: number;
    totalPopMillions?: number;
    totalYouthMillions?: number;
    hivYouthSharePct?: number;
    ayemiScore?: number;
    ayemiTier?: string;
  };
}

interface CountryTimeseries {
  country: string;
  iso3: string;
  yearRange: { min: number | null; max: number | null };
  population: Array<{
    year: number;
    population: number | null;
    youth: number | null;
    male: number | null;
    female: number | null;
  }>;
  education: Array<{
    year: number;
    literacy: number | null;
    secondaryEnrollment: number | null;
    tertiaryEnrollment: number | null;
  }>;
  employment: Array<{
    year: number;
    employmentRate: number | null;
    formalSector: number | null;
    informalSector: number | null;
  }>;
  health: Array<{
    indicator: string;
    value: number | null;
    year: number | null;
    benchmark: number | null;
  }>;
  entrepreneurship: Array<{
    metric: string;
    value: number | null;
    year: number | null;
  }>;
}
import {
  Download,
  ExternalLink,
  Users,
  GraduationCap,
  Heart,
  Briefcase,
  Rocket,
  TrendingUp,
  Globe,
  Scale,
  Megaphone,
  Sparkles,
  Send,
  Loader2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import CountryFlag from '@/components/CountryFlag';
import { getCountryMeta } from '@/lib/country-flags';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface CountryProfileProps {
  country: string;
}

/* Simple deterministic hash from a string to seed mock data */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number, index: number): number {
  const x = Math.sin(seed + index) * 10000;
  return x - Math.floor(x);
}

/**
 * Build the chart-ready data for the country profile page.
 *
 * If a real `timeseries` is provided (from /api/country-profile/:slug/timeseries)
 * we walk every year it covers and use real values per cell, with parametric
 * fallback when a specific (year × metric) is missing. Without timeseries we
 * fall back to a 10-year parametric window — useful for countries that have
 * no uploaded data yet.
 */
function generateData(country: string, timeseries?: CountryTimeseries | null) {
  const seed = hashCode(country);

  // Parametric helpers, indexed by a year offset so re-rendering is stable.
  const idxFor = (year: number) => year - 2014;
  const paraLiteracy = (year: number) => +(68 + idxFor(year) * 1.6 + seededRandom(seed, idxFor(year) + 300) * 3).toFixed(1);
  const paraSecondary = (year: number) => +(55 + idxFor(year) * 1.8 + seededRandom(seed, idxFor(year) + 400) * 4).toFixed(1);
  const paraTertiary = (year: number) => +(10 + idxFor(year) * 1.0 + seededRandom(seed, idxFor(year) + 500) * 2).toFixed(1);
  const paraEmployment = (year: number) => +(32 + idxFor(year) * 1.2 + seededRandom(seed, idxFor(year) + 700) * 5).toFixed(1);
  const paraFormal = (year: number) => +(18 + idxFor(year) * 0.8 + seededRandom(seed, idxFor(year) + 800) * 3).toFixed(1);
  const paraInformal = (year: number) => +(14 + idxFor(year) * 0.4 + seededRandom(seed, idxFor(year) + 900) * 2).toFixed(1);
  const paraPopulation = (year: number) => +(8.5 + seededRandom(seed, idxFor(year)) * 4 + idxFor(year) * 0.42).toFixed(1);

  // ── Years covered ────────────────────────────────────────────────────
  // If we have real time-series, use those exact years. Otherwise default
  // to a stable 10-year parametric window (2014–2023) for legacy compat.
  const useReal = !!timeseries && timeseries.population.length > 0;
  const years: number[] = useReal
    ? timeseries!.population.map((p) => p.year)
    : Array.from({ length: 10 }, (_, i) => 2014 + i);

  // Build year-keyed lookups from the real timeseries for cell-level fallback.
  const popByYear = new Map<number, CountryTimeseries['population'][0]>();
  const eduByYear = new Map<number, CountryTimeseries['education'][0]>();
  const empByYear = new Map<number, CountryTimeseries['employment'][0]>();
  if (useReal) {
    for (const p of timeseries!.population) popByYear.set(p.year, p);
    for (const e of timeseries!.education) eduByYear.set(e.year, e);
    for (const e of timeseries!.employment) empByYear.set(e.year, e);
  }

  // ── Population ───────────────────────────────────────────────────────
  const populationData = years.map((year) => {
    const real = popByYear.get(year);
    const total = real?.population ?? paraPopulation(year);
    return {
      year: `${year}`,
      population: total,
      male: +(total * (0.49 + seededRandom(seed, idxFor(year) + 100) * 0.04)).toFixed(1),
      female: +(total * (0.47 + seededRandom(seed, idxFor(year) + 200) * 0.04)).toFixed(1),
    };
  });

  // ── Education ────────────────────────────────────────────────────────
  const educationData = years.map((year) => {
    const real = eduByYear.get(year);
    return {
      year: `${year}`,
      literacy: real?.literacy ?? paraLiteracy(year),
      secondaryEnrollment: real?.secondaryEnrollment ?? paraSecondary(year),
      tertiaryEnrollment: real?.tertiaryEnrollment ?? paraTertiary(year),
    };
  });

  // ── Employment ───────────────────────────────────────────────────────
  const employmentData = years.map((year) => {
    const real = empByYear.get(year);
    return {
      year: `${year}`,
      employmentRate: real?.employmentRate ?? paraEmployment(year),
      formalSector: real?.formalSector ?? paraFormal(year),
      informalSector: real?.informalSector ?? paraInformal(year),
    };
  });

  // ── Health snapshot ──────────────────────────────────────────────────
  // Uses the latest-value bag the timeseries endpoint returns. If a metric
  // has no real value, fall back to a single seeded number — these cards
  // aren't time-series so per-year fallback isn't needed.
  const healthByName = new Map<string, CountryTimeseries['health'][0]>();
  if (timeseries) for (const h of timeseries.health) healthByName.set(h.indicator, h);
  const healthData = [
    { indicator: 'Healthcare Access',  value: healthByName.get('Healthcare Access')?.value  ?? +(60 + seededRandom(seed, 600) * 20).toFixed(1), benchmark: 75 },
    { indicator: 'HIV Prev. (15-24)',  value: healthByName.get('HIV Prev. (15-24)')?.value  ?? +(1 + seededRandom(seed, 601) * 4).toFixed(1), benchmark: 2.5 },
    { indicator: 'Mental Health Cov.', value: healthByName.get('Mental Health Cov.')?.value ?? +(20 + seededRandom(seed, 602) * 25).toFixed(1), benchmark: 45 },
    { indicator: 'Physician Density',  value: healthByName.get('Physician Density')?.value  ?? +(30 + seededRandom(seed, 603) * 30).toFixed(1), benchmark: null as number | null },
    { indicator: 'Health Budget %',    value: healthByName.get('Health Budget %')?.value    ?? +(65 + seededRandom(seed, 604) * 25).toFixed(1), benchmark: null as number | null },
    { indicator: 'YPLWHA on ART',      value: healthByName.get('YPLWHA on ART')?.value      ?? +(45 + seededRandom(seed, 605) * 35).toFixed(1), benchmark: null as number | null },
  ];

  // ── Entrepreneurship snapshot ────────────────────────────────────────
  const entByName = new Map<string, CountryTimeseries['entrepreneurship'][0]>();
  if (timeseries) for (const e of timeseries.entrepreneurship) entByName.set(e.metric, e);
  const entrepreneurshipData = [
    { metric: 'Internet Access',           value: entByName.get('Internet Access')?.value           ?? +(8 + seededRandom(seed, 1000) * 10).toFixed(1) },
    { metric: 'Microcredit Recipients',    value: entByName.get('Microcredit Recipients')?.value    ?? +(2 + seededRandom(seed, 1001) * 5).toFixed(1) },
    { metric: 'Startup Survival (1y)',     value: entByName.get('Startup Survival (1y)')?.value     ?? +(15 + seededRandom(seed, 1002) * 15).toFixed(1) },
    { metric: 'Banked Population',         value: entByName.get('Banked Population')?.value         ?? +(25 + seededRandom(seed, 1003) * 20).toFixed(1) },
    { metric: 'Movable Collateral',        value: entByName.get('Movable Collateral Holders')?.value ?? +(5 + seededRandom(seed, 1004) * 12).toFixed(1) },
    { metric: 'IP Registrations (Youth)',  value: entByName.get('IP Registrations (Youth)')?.value  ?? +(3 + seededRandom(seed, 1005) * 8).toFixed(1) },
  ];

  return { populationData, educationData, healthData, employmentData, entrepreneurshipData };
}

/* Stat card with framer-motion fade-in */
function StatCard({
  label,
  value,
  sub,
  delay = 0,
}: {
  label: string;
  value: string;
  sub: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="border rounded-lg p-3 sm:p-4 bg-card shadow-sm hover:shadow-md transition-shadow min-w-0"
    >
      <p className="text-xs sm:text-sm text-muted-foreground truncate">{label}</p>
      <p className="text-lg sm:text-2xl font-bold mt-0.5 sm:mt-1">{value}</p>
      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 truncate">{sub}</p>
    </motion.div>
  );
}

const chartColors = {
  c1: 'hsl(var(--chart-1))',
  c2: 'hsl(var(--chart-2))',
  c3: 'hsl(var(--chart-3))',
  c4: 'hsl(var(--chart-4))',
  c5: 'hsl(var(--chart-5))',
};

const CountryProfile = ({ country }: CountryProfileProps) => {
  // Fetch real data from /api/country-reports/:slug. The latest year of every
  // chart series and the stat cards below override parametric placeholders
  // with real values when the API returns them. Older years stay parametric
  // until full time-series ingestion is wired.
  const slug = country.toLowerCase().replace(/\s+/g, '-');

  // Latest-value overlay (used for stat cards / display values).
  const { data: realReport } = useQuery<RealCountryReport | null>({
    queryKey: ['country-profile-real', slug],
    queryFn: async () => {
      const res = await fetch(`${REPORTS_API}/${encodeURIComponent(slug)}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });

  // Year-by-year time-series for the charts. When this lands, every chart
  // year for which we have real data uses the real number; gaps fall back
  // to parametric per cell so the charts stay smooth.
  const { data: timeseries } = useQuery<CountryTimeseries | null>({
    queryKey: ['country-profile-timeseries', slug],
    queryFn: async () => {
      const res = await fetch(`${REPORTS_API}/${encodeURIComponent(slug)}/timeseries`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });

  const overrides = realReport?.real;
  const data = useMemo(() => generateData(country, timeseries), [country, timeseries]);
  const seed = useMemo(() => hashCode(country), [country]);

  /* Display values — prefer real, fall back to seeded parametric */
  const latestPop = data.populationData[data.populationData.length - 1].population;
  const youthPct = overrides?.youthBulgePct != null
    ? overrides.youthBulgePct.toFixed(1)
    : (19 + seededRandom(seed, 50) * 5).toFixed(1);
  const urbanPct = overrides?.urbanPopPct != null
    ? overrides.urbanPopPct.toFixed(1)
    : (50 + seededRandom(seed, 51) * 18).toFixed(1);
  const genderRatio = (99 + Math.round(seededRandom(seed, 52) * 6)).toString();

  return (
    <div className="container px-2 sm:px-4 md:px-6 py-4 sm:py-6 max-w-full overflow-x-hidden">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6"
      >
        <div>
          <div className="flex items-center gap-3">
            <CountryFlag country={country} size="xl" />
            <h1 className="text-3xl font-bold">{country}</h1>
          </div>
          {(() => {
            const meta = getCountryMeta(country);
            return meta ? (
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                <span>{meta.capital}</span>
                <span className="text-border">|</span>
                <div className="flex items-center gap-1.5">
                  {meta.languages.map((lang) => (
                    <Badge key={lang} variant="secondary" className="text-xs px-1.5 py-0">
                      {lang}
                    </Badge>
                  ))}
                </div>
                <span className="text-border">|</span>
                <span>{meta.currency}</span>
              </div>
            ) : null;
          })()}
          <p className="text-muted-foreground mt-1">Youth Profile Overview</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1">
            <Download className="h-4 w-4" />
            Download Profile
          </Button>
          <Button variant="outline" size="sm" className="gap-1">
            <ExternalLink className="h-4 w-4" />
            Share
          </Button>
        </div>
      </motion.div>

      {/* Demographic overview card */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="col-span-1 md:col-span-3">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-4">Demographic Overview</h2>
                <div className="grid grid-cols-2 gap-4">
                  <StatCard
                    label="Total Youth Population"
                    value={`${latestPop}M`}
                    sub="Ages 15-35"
                    delay={0}
                  />
                  <StatCard
                    label="Youth as % of Population"
                    value={`${youthPct}%`}
                    sub="National average: 20.4%"
                    delay={0.1}
                  />
                  <StatCard
                    label="Urban Youth"
                    value={`${urbanPct}%`}
                    sub="+3.2% since 2018"
                    delay={0.2}
                  />
                  <StatCard
                    label="Gender Ratio"
                    value={`${genderRatio}:100`}
                    sub="Males to females"
                    delay={0.3}
                  />
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex-1"
              >
                <div className="h-[240px] rounded-lg overflow-hidden">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.populationData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} unit="M" />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '8px',
                          fontSize: '12px',
                          border: '1px solid hsl(var(--border))',
                          backgroundColor: 'hsl(var(--popover))',
                          color: 'hsl(var(--popover-foreground))',
                        }}
                      />
                      <Bar dataKey="male" name="Male" stackId="a" fill={chartColors.c1} radius={[0, 0, 0, 0]} />
                      <Bar dataKey="female" name="Female" stackId="a" fill={chartColors.c2} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Youth population by gender for {country}, 2014-2023
                </p>
              </motion.div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="mt-6">
        <TabsList className="flex overflow-x-auto h-auto gap-1 mb-6 w-full max-w-full pb-1 no-scrollbar">
          <TabsTrigger value="overview" className="gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="population" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Population
          </TabsTrigger>
          <TabsTrigger value="education" className="gap-1.5">
            <GraduationCap className="h-3.5 w-3.5" />
            Education
          </TabsTrigger>
          <TabsTrigger value="health" className="gap-1.5">
            <Heart className="h-3.5 w-3.5" />
            Health
          </TabsTrigger>
          <TabsTrigger value="employment" className="gap-1.5">
            <Briefcase className="h-3.5 w-3.5" />
            Employment
          </TabsTrigger>
          <TabsTrigger value="entrepreneurship" className="gap-1.5">
            <Rocket className="h-3.5 w-3.5" />
            Entrepreneurship
          </TabsTrigger>
          <TabsTrigger value="statistics" className="gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            Statistics
          </TabsTrigger>
          <TabsTrigger value="legal" className="gap-1.5">
            <Scale className="h-3.5 w-3.5" />
            Legal &amp; Policy
          </TabsTrigger>
          <TabsTrigger value="youth-action" className="gap-1.5">
            <Megaphone className="h-3.5 w-3.5" />
            Youth In Action
          </TabsTrigger>
        </TabsList>

        {/* ───── Overview Tab ───── */}
        <TabsContent value="overview" className="space-y-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
            <Card>
              <CardContent className="p-6">
                <h3 className="text-xl font-bold mb-4">Country Snapshot</h3>
                <p className="text-muted-foreground mb-6">
                  {country} presents a dynamic youth landscape with a population of {latestPop}M young
                  people aged 15-35. The country has experienced steady growth in youth education attainment
                  and rising digital entrepreneurship, while challenges persist in formal employment and
                  healthcare access across rural regions.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Youth Population" value={`${latestPop}M`} sub="Ages 15-35" delay={0} />
                  <StatCard
                    label="Literacy Rate"
                    value={`${data.educationData[data.educationData.length - 1].literacy}%`}
                    sub="Youth 15-35"
                    delay={0.1}
                  />
                  <StatCard
                    label="Employment Rate"
                    value={`${data.employmentData[data.employmentData.length - 1].employmentRate}%`}
                    sub="Formal + informal"
                    delay={0.2}
                  />
                  <StatCard
                    label="Healthcare Access"
                    value={`${data.healthData[0].value}%`}
                    sub="Youth coverage"
                    delay={0.3}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-xl font-bold mb-4">Youth Development Index Trends</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={data.educationData.map((d, i) => ({
                      year: d.year,
                      education: d.literacy,
                      employment: data.employmentData[i].employmentRate,
                      health: +(55 + i * 1.5 + seededRandom(seed, i + 1100) * 5).toFixed(1),
                    }))}
                    margin={{ top: 8, right: 24, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        fontSize: '12px',
                        border: '1px solid hsl(var(--border))',
                        backgroundColor: 'hsl(var(--popover))',
                        color: 'hsl(var(--popover-foreground))',
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="education" name="Education" stroke={chartColors.c1} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="employment" name="Employment" stroke={chartColors.c2} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="health" name="Health" stroke={chartColors.c3} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───── Population Tab ───── */}
        <TabsContent value="population" className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-xl font-bold mb-4">Youth Population Trends</h3>
              <div className="h-[320px] mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.populationData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit="M" />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        fontSize: '12px',
                        border: '1px solid hsl(var(--border))',
                        backgroundColor: 'hsl(var(--popover))',
                        color: 'hsl(var(--popover-foreground))',
                      }}
                      formatter={(val: number) => [`${val}M`, undefined]}
                    />
                    <Legend />
                    <Bar dataKey="male" name="Male" fill={chartColors.c1} radius={[0, 0, 0, 0]} stackId="pop" />
                    <Bar dataKey="female" name="Female" fill={chartColors.c2} radius={[4, 4, 0, 0]} stackId="pop" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2">Key Statistics</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Annual growth rate:</span>
                      <span className="font-medium">2.1%</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Projected youth population (2030):</span>
                      <span className="font-medium">{(latestPop * 1.27).toFixed(1)} million</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Youth dependency ratio:</span>
                      <span className="font-medium">43.2%</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Youth migration rate:</span>
                      <span className="font-medium">+1.3%</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Regional Distribution</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Central region:</span>
                      <span className="font-medium">32.4%</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Eastern region:</span>
                      <span className="font-medium">26.7%</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Northern region:</span>
                      <span className="font-medium">18.5%</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Southern region:</span>
                      <span className="font-medium">22.4%</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-xl font-bold mb-4">Population Analysis</h3>
              <p className="text-muted-foreground mb-4">
                The youth population in {country} has been growing steadily over the past decade, with a
                slight acceleration in urban areas. Migration from rural to urban centers continues to shape
                the youth demographic landscape, with education and employment opportunities being the
                primary drivers.
              </p>
              <p className="text-muted-foreground">
                Gender distribution remains relatively balanced, though regional variations exist. The
                central region has the highest concentration of youth, primarily due to educational
                institutions and economic opportunities in urban centers.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───── Education Tab ───── */}
        <TabsContent value="education" className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-xl font-bold mb-4">Education Indicators</h3>
              <div className="h-[320px] mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.educationData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        fontSize: '12px',
                        border: '1px solid hsl(var(--border))',
                        backgroundColor: 'hsl(var(--popover))',
                        color: 'hsl(var(--popover-foreground))',
                      }}
                      formatter={(val: number) => [`${val}%`, undefined]}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="literacy"
                      name="Literacy Rate"
                      stroke={chartColors.c1}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="secondaryEnrollment"
                      name="Secondary Enrollment"
                      stroke={chartColors.c2}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="tertiaryEnrollment"
                      name="Tertiary Enrollment"
                      stroke={chartColors.c3}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2">Key Statistics</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Youth literacy rate:</span>
                      <span className="font-medium">
                        {data.educationData[data.educationData.length - 1].literacy}%
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Secondary enrollment:</span>
                      <span className="font-medium">
                        {data.educationData[data.educationData.length - 1].secondaryEnrollment}%
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Tertiary enrollment:</span>
                      <span className="font-medium">
                        {data.educationData[data.educationData.length - 1].tertiaryEnrollment}%
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Secondary completion:</span>
                      <span className="font-medium">65.3%</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Gender Analysis</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Female literacy:</span>
                      <span className="font-medium">79.8%</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Male literacy:</span>
                      <span className="font-medium">85.1%</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Gender parity (secondary):</span>
                      <span className="font-medium">0.92</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Gender parity (tertiary):</span>
                      <span className="font-medium">0.87</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───── Health Tab ───── */}
        <TabsContent value="health" className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-xl font-bold mb-4">Health Indicators</h3>
              <div className="h-[320px] mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.healthData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis type="number" tick={{ fontSize: 11 }} domain={[0, 100]} />
                    <YAxis dataKey="indicator" type="category" tick={{ fontSize: 11 }} width={120} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        fontSize: '12px',
                        border: '1px solid hsl(var(--border))',
                        backgroundColor: 'hsl(var(--popover))',
                        color: 'hsl(var(--popover-foreground))',
                      }}
                    />
                    <Legend />
                    <Bar dataKey="value" name={country} fill={chartColors.c1} radius={[0, 4, 4, 0]} />
                    <Bar dataKey="benchmark" name="AU Benchmark" fill={chartColors.c4} radius={[0, 4, 4, 0]} opacity={0.6} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2">Key Statistics</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Access to healthcare:</span>
                      <span className="font-medium">{data.healthData[0].value}%</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">HIV prevalence (15-24):</span>
                      <span className="font-medium">{data.healthData[1].value}%</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Mental health coverage:</span>
                      <span className="font-medium">{data.healthData[2].value}%</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Youth health insurance:</span>
                      <span className="font-medium">{data.healthData[3].value}%</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Health Services</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Youth-friendly health centers:</span>
                      <span className="font-medium">{Math.round(120 + seededRandom(seed, 700) * 150)}</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Mental health facilities:</span>
                      <span className="font-medium">{Math.round(40 + seededRandom(seed, 701) * 80)}</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Reproductive health clinics:</span>
                      <span className="font-medium">{Math.round(180 + seededRandom(seed, 702) * 150)}</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Health expenditure per youth:</span>
                      <span className="font-medium">${Math.round(25 + seededRandom(seed, 703) * 50)} USD</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───── Employment Tab ───── */}
        <TabsContent value="employment" className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-xl font-bold mb-4">Employment Trends</h3>
              <div className="h-[320px] mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.employmentData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradFormal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartColors.c1} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={chartColors.c1} stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="gradInformal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartColors.c3} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={chartColors.c3} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        fontSize: '12px',
                        border: '1px solid hsl(var(--border))',
                        backgroundColor: 'hsl(var(--popover))',
                        color: 'hsl(var(--popover-foreground))',
                      }}
                      formatter={(val: number) => [`${val}%`, undefined]}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="formalSector"
                      name="Formal Sector"
                      stroke={chartColors.c1}
                      fill="url(#gradFormal)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="informalSector"
                      name="Informal Sector"
                      stroke={chartColors.c3}
                      fill="url(#gradInformal)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2">Key Statistics</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Youth unemployment rate:</span>
                      <span className="font-medium">
                        {(100 - data.employmentData[data.employmentData.length - 1].employmentRate).toFixed(1)}%
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Labor force participation:</span>
                      <span className="font-medium">
                        {data.employmentData[data.employmentData.length - 1].employmentRate}%
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Informal employment:</span>
                      <span className="font-medium">67.8%</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">NEET rate:</span>
                      <span className="font-medium">23.4%</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Industry Distribution</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Services:</span>
                      <span className="font-medium">41.2%</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Agriculture:</span>
                      <span className="font-medium">28.7%</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Manufacturing:</span>
                      <span className="font-medium">14.3%</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Technology/ICT:</span>
                      <span className="font-medium">9.8%</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───── Entrepreneurship Tab ───── */}
        <TabsContent value="entrepreneurship" className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-xl font-bold mb-4">Entrepreneurship Metrics</h3>
              <div className="h-[320px] mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.entrepreneurshipData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="metric" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        fontSize: '12px',
                        border: '1px solid hsl(var(--border))',
                        backgroundColor: 'hsl(var(--popover))',
                        color: 'hsl(var(--popover-foreground))',
                      }}
                      formatter={(val: number) => [`${val}%`, undefined]}
                    />
                    <Bar dataKey="value" name="Rate (%)" fill={chartColors.c5} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2">Key Statistics</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Youth business ownership:</span>
                      <span className="font-medium">{data.entrepreneurshipData[0].value}%</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Startup formation rate:</span>
                      <span className="font-medium">{data.entrepreneurshipData[1].value}%</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Access to startup capital:</span>
                      <span className="font-medium">{data.entrepreneurshipData[2].value}%</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">5-year business survival:</span>
                      <span className="font-medium">{data.entrepreneurshipData[3].value}%</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Entrepreneurship Support</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Incubators/accelerators:</span>
                      <span className="font-medium">{Math.round(15 + seededRandom(seed, 1100) * 30)}</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Youth innovation hubs:</span>
                      <span className="font-medium">{Math.round(25 + seededRandom(seed, 1101) * 40)}</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Entrepreneurship programs:</span>
                      <span className="font-medium">{Math.round(40 + seededRandom(seed, 1102) * 50)}</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Youth investment funds:</span>
                      <span className="font-medium">
                        ${(5 + seededRandom(seed, 1103) * 20).toFixed(1)}M USD
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───── Statistics Tab ───── */}
        <TabsContent value="statistics" className="space-y-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold">Comparative Statistics</h3>
                  <Badge variant="secondary">2023 Data</Badge>
                </div>
                <p className="text-muted-foreground mb-6">
                  A side-by-side view of key youth development indicators for {country} compared to
                  regional and continental averages.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <StatCard label="Youth HDI Score" value="0.58" sub="Regional avg: 0.52" delay={0} />
                  <StatCard label="Digital Literacy" value="38.2%" sub="Continental avg: 31.7%" delay={0.05} />
                  <StatCard label="Youth Poverty Rate" value="34.6%" sub="Target: <20% by 2030" delay={0.1} />
                  <StatCard label="STEM Enrollment" value="14.3%" sub="+2.1pp from 2020" delay={0.15} />
                  <StatCard label="Youth Civic Participation" value="27.8%" sub="Voter turnout 15-35" delay={0.2} />
                  <StatCard label="Internet Penetration" value="52.4%" sub="Youth 15-35" delay={0.25} />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-xl font-bold mb-4">Cross-Sector Trends</h3>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={data.educationData.map((d, i) => ({
                      year: d.year,
                      education: d.literacy,
                      employment: data.employmentData[i].employmentRate,
                      entrepreneurship: +(5 + i * 1.2 + seededRandom(seed, i + 1200) * 3).toFixed(1),
                    }))}
                    margin={{ top: 8, right: 24, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="gradEdu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartColors.c1} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={chartColors.c1} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradEmp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartColors.c2} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={chartColors.c2} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        fontSize: '12px',
                        border: '1px solid hsl(var(--border))',
                        backgroundColor: 'hsl(var(--popover))',
                        color: 'hsl(var(--popover-foreground))',
                      }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="education" name="Education Index" stroke={chartColors.c1} fill="url(#gradEdu)" strokeWidth={2} />
                    <Area type="monotone" dataKey="employment" name="Employment Rate" stroke={chartColors.c2} fill="url(#gradEmp)" strokeWidth={2} />
                    <Area type="monotone" dataKey="entrepreneurship" name="Entrepreneurship" stroke={chartColors.c5} fill="none" strokeWidth={2} strokeDasharray="5 5" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───── Legal & Policy Tab ───── */}
        <TabsContent value="legal" className="space-y-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold">Legal &amp; Policy Framework</h3>
                  <Badge variant="outline">Last Updated: 2023</Badge>
                </div>
                <p className="text-muted-foreground mb-6">
                  An overview of the legislative and policy environment affecting youth in {country},
                  including national youth policies, AU charter alignment, and sector-specific regulations.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium">National Youth Policy</h4>
                    <ul className="space-y-3 text-sm">
                      <li className="flex items-start gap-2">
                        <Badge className="mt-0.5 shrink-0" variant="secondary">Active</Badge>
                        <div>
                          <p className="font-medium">National Youth Policy &amp; Action Plan</p>
                          <p className="text-muted-foreground text-xs">Adopted 2019, revised 2022. Covers education, employment, health, and civic participation.</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <Badge className="mt-0.5 shrink-0" variant="secondary">Active</Badge>
                        <div>
                          <p className="font-medium">Youth Employment Strategy</p>
                          <p className="text-muted-foreground text-xs">2020-2030 framework targeting 40% reduction in youth unemployment.</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <Badge className="mt-0.5 shrink-0" variant="outline">Pending</Badge>
                        <div>
                          <p className="font-medium">Digital Youth Empowerment Act</p>
                          <p className="text-muted-foreground text-xs">Draft legislation on digital skills, online safety, and tech entrepreneurship support.</p>
                        </div>
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">AU Charter Alignment</h4>
                    <ul className="space-y-3 text-sm">
                      <li className="flex justify-between">
                        <span className="text-muted-foreground">African Youth Charter ratification:</span>
                        <Badge variant="secondary">Ratified</Badge>
                      </li>
                      <li className="flex justify-between">
                        <span className="text-muted-foreground">Agenda 2063 youth targets:</span>
                        <span className="font-medium">Partially aligned</span>
                      </li>
                      <li className="flex justify-between">
                        <span className="text-muted-foreground">Youth ministry established:</span>
                        <span className="font-medium">Yes</span>
                      </li>
                      <li className="flex justify-between">
                        <span className="text-muted-foreground">Youth budget allocation:</span>
                        <span className="font-medium">3.2% of GDP</span>
                      </li>
                      <li className="flex justify-between">
                        <span className="text-muted-foreground">Youth council/parliament:</span>
                        <span className="font-medium">Active since 2017</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ───── Youth In Action Tab ───── */}
        <TabsContent value="youth-action" className="space-y-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold">Youth In Action</h3>
                  <Badge>Spotlight</Badge>
                </div>
                <p className="text-muted-foreground mb-6">
                  Highlighting youth-led initiatives, organizations, and success stories from {country}
                  that are driving positive change across the continent.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {[
                    {
                      title: 'Youth Innovation Challenge',
                      desc: 'Annual tech competition with 2,400+ participants creating solutions for local challenges.',
                      badge: 'Innovation',
                    },
                    {
                      title: 'Green Youth Movement',
                      desc: 'Climate action network of 15,000 young people focused on sustainable agriculture and reforestation.',
                      badge: 'Climate',
                    },
                    {
                      title: 'Digital Skills Academy',
                      desc: 'Free coding bootcamp that has trained 8,000 youth in software development and digital marketing.',
                      badge: 'Education',
                    },
                  ].map((item, i) => (
                    <motion.div
                      key={item.title}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: i * 0.1 }}
                    >
                      <Card className="h-full">
                        <CardContent className="p-4">
                          <Badge variant="outline" className="mb-2">{item.badge}</Badge>
                          <h4 className="font-semibold mb-1">{item.title}</h4>
                          <p className="text-sm text-muted-foreground">{item.desc}</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Active Youth Orgs" value={`${Math.round(200 + seededRandom(seed, 1300) * 300)}`} sub="Registered NGOs" delay={0} />
                  <StatCard label="Youth Volunteers" value={`${(50 + seededRandom(seed, 1301) * 100).toFixed(0)}K`} sub="Annual participants" delay={0.1} />
                  <StatCard label="Community Projects" value={`${Math.round(500 + seededRandom(seed, 1302) * 800)}`} sub="Youth-led initiatives" delay={0.2} />
                  <StatCard label="Int'l Programs" value={`${Math.round(20 + seededRandom(seed, 1303) * 40)}`} sub="Exchange & fellowship" delay={0.3} />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* AI Chat — Ask about this country */}
      <CountryAiChat country={country} />
    </div>
  );
};

function CountryAiChat({ country }: { country: string }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<'ai' | 'rule-based' | null>(null);

  const handleAsk = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || loading) return;

    setLoading(true);
    setAnswer('');
    setSource(null);

    const apiBase = (import.meta as any).env?.VITE_API_URL || '/api';
    const fullQuestion = `About ${country}: ${question.trim()}`;

    // Try the AI chat endpoint first, then NLQ, then fallback
    let success = false;

    // Attempt 1: AI chat endpoint
    try {
      const res = await fetch(`${apiBase}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: fullQuestion, context: `Country: ${country}` }),
      });
      if (res.ok) {
        const data = await res.json();
        setAnswer(data.answer || 'No answer available.');
        setSource(data.source || 'ai');
        success = true;
      }
    } catch { /* try next */ }

    // Attempt 2: NLQ endpoint
    if (!success) {
      try {
        const res = await fetch(`${apiBase}/nlq/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: fullQuestion, countryId: country }),
        });
        if (res.ok) {
          const data = await res.json();
          setAnswer(data.answer || 'No answer available.');
          setSource(data.source || 'rule-based');
          success = true;
        }
      } catch { /* try next */ }
    }

    // Attempt 3: Intelligent fallback with country context
    if (!success) {
      const q = question.trim().toLowerCase();
      let fallbackAnswer = `Here's what we know about ${country} based on our dataset:\n\n`;

      if (q.includes('challenge') || q.includes('problem') || q.includes('issue')) {
        fallbackAnswer += `Key challenges facing youth in ${country} include:\n• Youth unemployment remains above the continental average\n• Access to quality education varies significantly between urban and rural areas\n• Healthcare coverage for young people needs expansion\n• Digital literacy gaps persist despite growing internet penetration\n\nFor detailed statistics, explore the tabs above or use the Data Explorer.`;
      } else if (q.includes('strength') || q.includes('progress') || q.includes('achievement')) {
        fallbackAnswer += `Notable progress in ${country}:\n• Youth literacy rates have been steadily improving\n• Growing entrepreneurship ecosystem with increasing startup formation\n• Active youth civic participation and volunteer movements\n• Investments in digital skills training programs\n\nView the Statistics tab for detailed trends.`;
      } else if (q.includes('employment') || q.includes('job') || q.includes('work')) {
        fallbackAnswer += `Youth employment in ${country}:\n• Labor force participation has shown gradual improvement\n• The formal sector is growing but informal employment remains dominant\n• Services and agriculture are the largest employers of youth\n• Technology/ICT sector is emerging as a key growth area\n\nSee the Employment tab for detailed data.`;
      } else if (q.includes('education') || q.includes('school') || q.includes('literacy')) {
        fallbackAnswer += `Education in ${country}:\n• Youth literacy rates have been trending upward over the past decade\n• Secondary enrollment is increasing but completion rates need attention\n• Tertiary education enrollment remains relatively low\n• Gender parity in education continues to improve\n\nSee the Education tab for detailed indicators.`;
      } else {
        fallbackAnswer += `${country} has a dynamic youth population with ongoing developments across education, health, employment, and entrepreneurship. Use the tabs above to explore specific areas, or ask about a specific topic like education, employment, health, or challenges.`;
      }

      setAnswer(fallbackAnswer);
      setSource('rule-based');
    }

    setLoading(false);
  }, [question, loading, country]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="mt-6"
    >
      <Card>
        <CardContent className="pt-5 pb-4 px-3 sm:px-5">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            Ask about {country}
          </h3>
          <form onSubmit={handleAsk} className="flex gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={`e.g., "What are ${country}'s biggest challenges?"`}
              className="flex-1 rounded-lg border bg-background/60 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary min-w-0"
              disabled={loading}
            />
            <Button type="submit" size="sm" disabled={loading || !question.trim()} className="gap-1.5 shrink-0">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="hidden sm:inline">Ask</span>
            </Button>
          </form>
          {answer && (
            <div className="mt-4">
              {source && (
                <Badge variant="secondary" className="text-xs mb-2">
                  {source === 'ai' ? 'AI-powered' : 'Based on platform data'}
                </Badge>
              )}
              <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {answer}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default CountryProfile;
