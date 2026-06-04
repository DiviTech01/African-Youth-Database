import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Users, GraduationCap, HeartPulse, Briefcase, Rocket, Shield, Scale } from 'lucide-react';
import { GlowCard } from '@/components/ui/spotlight-card';
import { Content } from '@/components/cms';

// Seven tiles — one per AYO theme — each backed by real API data. The
// numeric `value` is filled in from /api/youth-index/rankings at render
// time (continental average of that dimension across the 54 countries).
// Per admin directive: no synthesised numbers anywhere on the landing page.
const statsData = [
  { slug: 'demography',       title: 'Demography & Participation', weightPct: '20%', description: 'Voter turnout · participation',         glowColor: 'blue'   as const, icon: Users,         link: '/youth-index' },
  { slug: 'education',        title: 'Education',                  weightPct: '15%', description: 'Literacy · enrollment · dropout',       glowColor: 'purple' as const, icon: GraduationCap, link: '/youth-index' },
  { slug: 'employment',       title: 'Employment',                 weightPct: '15%', description: 'Unemployment · LFPR · sectoral',        glowColor: 'orange' as const, icon: Briefcase,     link: '/youth-index' },
  { slug: 'health',           title: 'Health',                     weightPct: '15%', description: 'Skilled births · HIV · mortality',      glowColor: 'red'    as const, icon: HeartPulse,    link: '/youth-index' },
  { slug: 'entrepreneurship', title: 'Entrepreneurship',           weightPct: '15%', description: 'Startups · credit · IP · digital',      glowColor: 'green'  as const, icon: Rocket,        link: '/youth-index' },
  { slug: 'peace-security',   title: 'Peace & Security',           weightPct: '10%', description: 'IDPs · trafficking · extremism',        glowColor: 'green'  as const, icon: Shield,        link: '/youth-index' },
  { slug: 'access-to-justice',title: 'Access to Justice',          weightPct: '10%', description: 'Pre-trial · prison · juvenile',         glowColor: 'purple' as const, icon: Scale,         link: '/youth-index' },
];

interface PlatformStats {
  totalCountries?: number;
  totalIndicators?: number;
  totalDataPoints?: number;
  totalThemes?: number;
  countriesWithData?: number;
  dataYearRange?: { earliest?: number; latest?: number };
}

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';
const RANKINGS_YEAR = 2025;

const QuickStats = () => {
  // Real platform counts — countries · indicators · data points · year range.
  const { data: platformStats } = useQuery<PlatformStats | null>({
    queryKey: ['platform-stats'],
    queryFn: () => fetch(`${API_BASE}/platform/stats`).then(r => r.ok ? r.json() : null).catch(() => null),
    staleTime: 60_000,
  });

  // Real Youth Index dimension averages — same source of truth the
  // Dashboard widgets use. Each tile shows the mean of its dimension's
  // score across the 54 countries that have a computed YouthIndexScore
  // for the latest year. If the rankings haven't been computed yet (API
  // returns []), every tile renders "—" instead of a fabricated number.
  const { data: rankings } = useQuery<any[] | null>({
    queryKey: ['platform-stats', 'rankings', RANKINGS_YEAR],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/youth-index/rankings?year=${RANKINGS_YEAR}`);
      if (!res.ok) return null;
      const j = await res.json();
      return Array.isArray(j) ? j : (j?.data ?? []);
    },
    staleTime: 5 * 60_000,
  });

  // Each tile maps to a theme slug in the new 7-theme model. The API returns
  // `dimensions` keyed by slug; we also accept the legacy flat fields as a fallback.
  const dimensionAvg = (themeSlug: string, legacyField?: string): number | null => {
    if (!Array.isArray(rankings) || rankings.length === 0) return null;
    const vals = rankings
      .map((r) => (r?.dimensions?.[themeSlug] ?? (legacyField ? r?.[legacyField] : undefined)))
      .filter((v) => typeof v === 'number');
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };
  const fmtScore = (v: number | null): string => (v == null ? '—' : v.toFixed(1));

  const latestYear = platformStats?.dataYearRange?.latest ?? RANKINGS_YEAR;

  // Compose every tile's `value` / `trend` from real numbers. Anything
  // unavailable falls through as "—" — never a guess. Tile `slug` matches
  // a theme slug (or a short alias that maps to one).
  const SLUG_TO_THEME: Record<string, { theme: string; legacy?: string }> = {
    demography:          { theme: 'youth-demography-participation', legacy: 'civicScore' },
    education:           { theme: 'education',                       legacy: 'educationScore' },
    employment:          { theme: 'employment',                      legacy: 'employmentScore' },
    health:              { theme: 'health',                          legacy: 'healthScore' },
    entrepreneurship:    { theme: 'entrepreneurship',                legacy: 'innovationScore' },
    'peace-security':    { theme: 'peace-security' },
    'access-to-justice': { theme: 'access-to-justice' },
  };

  const liveStats = statsData.map((s) => {
    const mapping = SLUG_TO_THEME[s.slug];
    if (!mapping) return { ...s, value: '—', trend: 'No data' };
    const v = dimensionAvg(mapping.theme, mapping.legacy);
    return v != null
      ? { ...s, value: fmtScore(v), trend: 'Live' }
      : { ...s, value: '—',         trend: 'No data' };
  });

  return (
    <section className="relative py-16 md:py-24 bg-black overflow-hidden">
      {/* Grid BG - matching hero */}
      <div
        className="absolute inset-0 opacity-40 h-full w-full
        bg-[linear-gradient(to_right,#333_1px,transparent_1px),linear-gradient(to_bottom,#333_1px,transparent_1px)]
        bg-[size:6rem_5rem]
        [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_40%,transparent_100%)]"
      />

      <div className="container px-4 md:px-6 relative z-10">
        <div className="flex flex-col items-center justify-center space-y-3 md:space-y-4 text-center mb-10 md:mb-14">
          <Content
            as="h2"
            id="home.quick_stats.title"
            fallback="Key Statistics"
            className="text-3xl sm:text-4xl font-semibold tracking-tighter md:text-5xl
            bg-gradient-to-br from-[#D4A017] from-10% via-white via-40% to-white/40
            bg-clip-text text-transparent"
          />
          <Content
            as="p"
            id="home.quick_stats.subtitle"
            fallback="Real youth data drawn from the AYIMS template, across our seven core thematic areas covering all 54 African countries."
            className="max-w-[700px] text-sm sm:text-base text-[#A89070] md:text-lg"
          />
        </div>

        {/* Flex-wrap layout: each card has a comfortable basis and can grow.
            On wide screens all 7 fit in one row; on narrower screens they
            wrap and the partial bottom row is centered automatically. */}
        <div className="flex flex-wrap justify-center gap-3 md:gap-4">
          {liveStats.map((stat, index) => {
            const isLive = stat.trend === 'Live';
            const trendClass = isLive
              ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30'
              : 'bg-gray-500/15 text-gray-400 ring-1 ring-gray-500/30';
            const trendLabel = isLive ? `Live · ${latestYear}` : 'Awaiting upload';
            return (
              <Link
                key={stat.slug}
                to={stat.link}
                className="block group basis-[150px] sm:basis-[180px] md:basis-[200px] flex-grow max-w-[260px]"
              >
                <GlowCard
                  glowColor={stat.glowColor}
                  customSize
                  className="w-full h-full !aspect-auto cursor-pointer transition-transform duration-300 group-hover:scale-[1.02]"
                >
                  <div className="relative z-10 flex flex-col justify-between h-full p-3 gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <Content
                          as="p"
                          id={`home.quick_stats.${stat.slug}.title`}
                          fallback={stat.title}
                          className="text-[11px] sm:text-xs font-medium text-gray-400 leading-snug line-clamp-2"
                        />
                        <h3 className="text-2xl sm:text-3xl font-bold text-white mt-1 tabular-nums">{stat.value}</h3>
                      </div>
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 shrink-0">
                        <stat.icon className="w-4 h-4 text-white/80" />
                      </div>
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider">weight</span>
                      <span className="text-xs font-semibold text-white/80">{stat.weightPct}</span>
                    </div>

                    <Content
                      as="p"
                      id={`home.quick_stats.${stat.slug}.description`}
                      fallback={stat.description}
                      className="text-[10px] sm:text-xs text-gray-500 leading-snug line-clamp-2"
                    />

                    <div className="flex items-center justify-between gap-2 mt-auto">
                      <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium ${trendClass}`}>
                        {trendLabel}
                      </span>
                    </div>

                    <div className="h-6 flex items-end gap-[2px]">
                      {[...Array(10)].map((_, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-t bg-white/15 group-hover:bg-white/25 transition-colors"
                          style={{ height: `${25 + Math.sin(i * 0.8 + index) * 30 + 25}%` }}
                        />
                      ))}
                    </div>
                  </div>
                </GlowCard>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default QuickStats;
