import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link } from 'react-router-dom';
import { Content } from '@/components/cms';
import {
  Users,
  GraduationCap,
  HeartPulse,
  Briefcase,
  Rocket,
  Shield,
  Scale,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

// ── Per-theme accent palette + secondary icon (the "decoration") ──
// The seven AYO core themes. IDs match the canonical theme slugs in the DB
// and in src/types/constants.ts.
type ThemeKey =
  | 'youth-demography-participation'
  | 'education'
  | 'employment'
  | 'health'
  | 'entrepreneurship'
  | 'peace-security'
  | 'access-to-justice';

interface ThemeStat { slug: string; label: string; value: number; suffix?: string; prefix?: string; decimals?: number; }
interface ThemeDef {
  id: ThemeKey;
  title: string;
  description: string;
  icon: React.ElementType;
  accent: { from: string; to: string; ring: string; glow: string; tint: string };
  stats: ThemeStat[];
}

// The seven AYO core themes. Indicator counts and weights come from the DB
// (Theme.weight + Theme.indicators count). Stats shown here are metadata
// ("17 indicators · 20% weight · 54 countries") — not synthetic data points.
const themes: ThemeDef[] = [
  {
    id: 'youth-demography-participation',
    title: 'Youth Demography & Participation',
    description: 'Population structure, voter turnout, political representation, civic participation, and inclusion of youth with disabilities.',
    icon: Users,
    accent: { from: '#2563eb', to: '#60a5fa', ring: '#2563eb40', glow: 'rgba(37,99,235,0.25)', tint: 'rgba(37,99,235,0.08)' },
    stats: [
      { slug: 'weight',     label: 'Index weight', value: 20,  suffix: '%' },
      { slug: 'indicators', label: 'Indicators',   value: 17 },
      { slug: 'countries',  label: 'Countries',    value: 54 },
    ],
  },
  {
    id: 'education',
    title: 'Education',
    description: 'Youth literacy, enrolment across primary / secondary / tertiary, dropout, teacher–student ratio, and education spending.',
    icon: GraduationCap,
    accent: { from: '#7c3aed', to: '#a78bfa', ring: '#7c3aed40', glow: 'rgba(124,58,237,0.25)', tint: 'rgba(124,58,237,0.08)' },
    stats: [
      { slug: 'weight',     label: 'Index weight', value: 15,  suffix: '%' },
      { slug: 'indicators', label: 'Indicators',   value: 15 },
      { slug: 'countries',  label: 'Countries',    value: 54 },
    ],
  },
  {
    id: 'employment',
    title: 'Employment',
    description: 'Youth unemployment, labour-force participation, employment-to-population ratio, sectoral split, and informal-employment share.',
    icon: Briefcase,
    accent: { from: '#ea580c', to: '#fb923c', ring: '#ea580c40', glow: 'rgba(234,88,12,0.25)', tint: 'rgba(234,88,12,0.08)' },
    stats: [
      { slug: 'weight',     label: 'Index weight', value: 15,  suffix: '%' },
      { slug: 'indicators', label: 'Indicators',   value: 13 },
      { slug: 'countries',  label: 'Countries',    value: 54 },
    ],
  },
  {
    id: 'health',
    title: 'Health',
    description: 'Skilled births, contraceptive access, HIV prevalence and treatment, mortality (suicide, AIDS, accidents), mental health, and health spending.',
    icon: HeartPulse,
    accent: { from: '#dc2626', to: '#f87171', ring: '#dc262640', glow: 'rgba(220,38,38,0.25)', tint: 'rgba(220,38,38,0.08)' },
    stats: [
      { slug: 'weight',     label: 'Index weight', value: 15,  suffix: '%' },
      { slug: 'indicators', label: 'Indicators',   value: 20 },
      { slug: 'countries',  label: 'Countries',    value: 54 },
    ],
  },
  {
    id: 'entrepreneurship',
    title: 'Entrepreneurship',
    description: 'Startup survival, microcredit, IP registrations, credit access, mobile money, digital infrastructure, and financial-inclusion environment.',
    icon: Rocket,
    accent: { from: '#0891b2', to: '#22d3ee', ring: '#0891b240', glow: 'rgba(8,145,178,0.25)', tint: 'rgba(8,145,178,0.08)' },
    stats: [
      { slug: 'weight',     label: 'Index weight', value: 15,  suffix: '%' },
      { slug: 'indicators', label: 'Indicators',   value: 35 },
      { slug: 'countries',  label: 'Countries',    value: 54 },
    ],
  },
  {
    id: 'peace-security',
    title: 'Peace & Security',
    description: 'Internally displaced youth, victims of trafficking, and youth deaths from violent extremism (ages 18–35).',
    icon: Shield,
    accent: { from: '#16a34a', to: '#4ade80', ring: '#16a34a40', glow: 'rgba(22,163,74,0.25)', tint: 'rgba(22,163,74,0.08)' },
    stats: [
      { slug: 'weight',     label: 'Index weight', value: 10,  suffix: '%' },
      { slug: 'indicators', label: 'Indicators',   value: 3 },
      { slug: 'countries',  label: 'Countries',    value: 54 },
    ],
  },
  {
    id: 'access-to-justice',
    title: 'Access to Justice',
    description: 'Youth awaiting trial, youth imprisoned, and juvenile detentions — measures of how the justice system treats young people.',
    icon: Scale,
    accent: { from: '#9333ea', to: '#c084fc', ring: '#9333ea40', glow: 'rgba(147,51,234,0.25)', tint: 'rgba(147,51,234,0.08)' },
    stats: [
      { slug: 'weight',     label: 'Index weight', value: 10,  suffix: '%' },
      { slug: 'indicators', label: 'Indicators',   value: 4 },
      { slug: 'countries',  label: 'Countries',    value: 54 },
    ],
  },
];

const themeSlug = (id: string) => id.replace(/-/g, '_');

// ── Animation primitives ──
function useInView<T extends Element>(threshold = 0.2): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current || inView) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setInView(true); obs.disconnect(); }
    }, { threshold });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [inView, threshold]);
  return [ref, inView];
}

const AnimatedNum: React.FC<{
  value: number; active: boolean; duration?: number; decimals?: number; prefix?: string; suffix?: string;
}> = ({ value, active, duration = 1400, decimals = 0, prefix = '', suffix = '' }) => {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(eased * value);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, value, duration]);
  const formatted =
    decimals > 0
      ? n.toFixed(decimals)
      : Math.round(n).toLocaleString();
  return <>{prefix}{formatted}{suffix}</>;
};

// ── Card ──
const ThemeCard: React.FC<{ theme: ThemeDef; index: number }> = ({ theme, index }) => {
  const [ref, inView] = useInView<HTMLDivElement>(0.18);
  const Icon = theme.icon;
  const slug = themeSlug(theme.id);

  return (
    <Link
      to={`/explore?theme=${theme.id}`}
      ref={ref as any}
      className="group relative block rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.06] p-5 hover:-translate-y-1 transition-all duration-300"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 0.55s ease ${index * 60}ms, transform 0.55s cubic-bezier(0.22, 1, 0.36, 1) ${index * 60}ms, box-shadow 0.3s ease`,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = `0 12px 36px -8px ${theme.accent.glow}, 0 0 0 1px ${theme.accent.ring}`; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
    >
      {/* Soft gradient corner glow */}
      <div
        className="absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl opacity-40 group-hover:opacity-70 transition-opacity duration-500"
        style={{ background: `radial-gradient(circle, ${theme.accent.glow} 0%, transparent 70%)` }}
      />

      {/* Icon medallion */}
      <div className="relative inline-flex mb-4">
        {/* Animated rotating ring */}
        <svg width="60" height="60" viewBox="0 0 60 60" className="absolute inset-0 -m-1">
          <defs>
            <linearGradient id={`g-${theme.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={theme.accent.from} />
              <stop offset="100%" stopColor={theme.accent.to} />
            </linearGradient>
          </defs>
          <circle
            cx="30"
            cy="30"
            r="27"
            fill="none"
            stroke={`url(#g-${theme.id})`}
            strokeWidth="1.5"
            strokeDasharray="4 6"
            strokeLinecap="round"
            style={{
              transformOrigin: '30px 30px',
              animation: 'theme-ring-spin 14s linear infinite',
            }}
          />
        </svg>
        <div
          className="relative w-[52px] h-[52px] rounded-xl flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${theme.accent.from}, ${theme.accent.to})`,
            boxShadow: `0 8px 24px -6px ${theme.accent.glow}, inset 0 1px 0 rgba(255,255,255,0.18)`,
          }}
        >
          <Icon className="h-6 w-6 text-white drop-shadow" />
          <Sparkles
            className="absolute -top-1 -right-1 h-3 w-3 text-white/90 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.8))' }}
          />
        </div>
      </div>

      {/* Title + description */}
      <Content
        as="h3"
        id={`themes.${slug}.title`}
        fallback={theme.title}
        className="text-lg font-semibold text-white tracking-tight"
      />
      <Content
        as="p"
        id={`themes.${slug}.description`}
        fallback={theme.description}
        className="text-xs text-gray-400 mt-1 leading-relaxed line-clamp-2"
      />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mt-4">
        {theme.stats.map((stat) => (
          <div
            key={stat.slug}
            className="rounded-lg px-2 py-2 border border-white/[0.05]"
            style={{ background: theme.accent.tint }}
          >
            <div
              className="text-base font-bold tabular-nums leading-none"
              style={{
                background: `linear-gradient(135deg, ${theme.accent.from}, ${theme.accent.to})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              <AnimatedNum
                value={stat.value}
                active={inView}
                decimals={stat.decimals ?? 0}
                prefix={stat.prefix}
                suffix={stat.suffix}
              />
            </div>
            <Content
              as="div"
              id={`themes.${slug}.stat.${stat.slug}.label`}
              fallback={stat.label}
              className="text-[9px] uppercase tracking-wider text-gray-500 mt-1 truncate"
            />
          </div>
        ))}
      </div>

      {/* Footer CTA */}
      <div className="mt-4 flex items-center justify-between text-xs">
        <span className="text-gray-500 group-hover:text-white transition-colors">
          Explore data
        </span>
        <ArrowRight
          className="h-3.5 w-3.5 text-gray-500 group-hover:translate-x-1 transition-all"
          style={{ color: 'rgba(255,255,255,0.7)' }}
        />
      </div>

      {/* Bottom accent line that grows on hover */}
      <div
        className="absolute bottom-0 left-0 h-[2px] w-0 group-hover:w-full transition-all duration-500"
        style={{ background: `linear-gradient(90deg, ${theme.accent.from}, ${theme.accent.to})` }}
      />
    </Link>
  );
};

const Themes: React.FC = () => {
  const { t } = useLanguage();
  return (
    <>
      <style>{`
        @keyframes theme-ring-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>

      <div className="relative py-8 md:py-12 overflow-hidden">
        <div className="absolute inset-0 opacity-30 w-full bg-[linear-gradient(to_right,#333_1px,transparent_1px),linear-gradient(to_bottom,#333_1px,transparent_1px)] bg-[size:6rem_5rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
        <div className="container px-4 md:px-6 relative z-10">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tighter bg-gradient-to-br from-[#D4A017] from-10% via-white via-40% to-white/40 bg-clip-text text-transparent">
            {t('themes.title')}
          </h1>
          <p className="text-sm sm:text-base text-[#A89070] mt-1">{t('themes.subtitle')}</p>
        </div>
      </div>

      <div className="pb-10 md:pb-14">
        <div className="container px-4 md:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {themes.map((theme, i) => (
              <ThemeCard key={theme.id} theme={theme} index={i} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default Themes;
