
import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Content } from '@/components/cms';
import { NewsletterSignup } from '@/components/NewsletterSignup';
// Theme toggle removed - dark mode only
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Globe,
  Database,
  Users,
  BarChart3,
  ArrowRight,
  Sparkles,
  MapPin,
  BookOpen
} from 'lucide-react';

function useCountUp(target: number, duration = 2000, suffix = '') {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLParagraphElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const start = performance.now();
          const step = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);

  return { ref, display: `${count}${suffix}` };
}

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay, ease: 'easeOut' },
  }),
};

const AnimatedStat = ({
  target,
  suffix,
  labelKey,
  fallbackLabel,
  icon: Icon,
  delay,
}: {
  target: number;
  suffix: string;
  labelKey: string;
  fallbackLabel: string;
  icon: React.ElementType;
  delay: number;
}) => {
  const { ref, display } = useCountUp(target, 2000, suffix);
  return (
    <motion.div
      className="text-center space-y-2"
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      custom={delay}
    >
      <Icon className="h-8 w-8 mx-auto text-primary" />
      <p ref={ref} className="text-3xl md:text-4xl font-display font-bold text-foreground">{display}</p>
      <Content as="p" id={labelKey} fallback={fallbackLabel} className="text-sm text-muted-foreground" />
    </motion.div>
  );
};

const FEATURES = [
  {
    slug: 'card1',
    icon: Globe,
    title: 'Interactive Maps',
    description: 'Visualize data across Africa with our dynamic, interactive mapping tools.',
  },
  {
    slug: 'card2',
    icon: BarChart3,
    title: 'Advanced Analytics',
    description: 'Deep dive into trends with powerful charts and comparative analysis.',
  },
  {
    slug: 'card3',
    icon: Database,
    title: 'Data Export',
    description: 'Download datasets in multiple formats for your research needs.',
  },
  {
    slug: 'card4',
    icon: Users,
    title: 'Youth Index (AYI)',
    description: 'Track country rankings across education, health, and economic dimensions.',
  },
  {
    slug: 'card5',
    icon: TrendingUp,
    title: 'Trend Analysis',
    description: 'Monitor changes over time with historical data spanning over a decade.',
  },
  {
    slug: 'card6',
    icon: BookOpen,
    title: 'Reports & Insights',
    description: 'Access curated reports and policy briefs from leading researchers.',
  },
];

// Pull headline numbers from the same /platform/stats endpoint QuickStats uses.
// Response shape: { totalCountries, totalIndicators, totalDataPoints,
// dataYearRange: { earliest, latest } }. Earlier code read shorter key names
// that don't exist on the server, so the numbers always fell through to the
// hardcoded defaults — that's why /landing kept showing the same values.
function useLandingStats() {
  const { data } = useQuery<{
    totalCountries?: number;
    totalIndicators?: number;
    totalDataPoints?: number;
    countriesWithData?: number;
    dataYearRange?: { earliest?: number; latest?: number };
  } | null>({
    queryKey: ['landing-platform-stats'],
    queryFn: () => fetch(`${import.meta.env.VITE_API_URL || '/api'}/platform/stats`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    staleTime: 60_000,
  });

  const countries = data?.totalCountries ?? 54;
  const indicators = data?.totalIndicators ?? 500;
  const dataPoints = data?.totalDataPoints ?? 0;
  const earliest = data?.dataYearRange?.earliest;
  const latest = data?.dataYearRange?.latest;
  const yearsCovered = earliest && latest ? Math.max(1, latest - earliest + 1) : 10;

  return { countries, indicators, dataPoints, yearsCovered };
}

const Landing = () => {
  const stats = useLandingStats();
  return (
    <div className="min-h-screen bg-background">
      {/* Animated Background — `blur-3xl animate-pulse` is GPU-heavy on phones, so the
          pulse animation is disabled below lg; only the gradient + static blobs render. */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
        <div className="absolute top-0 left-1/4 w-72 h-72 lg:w-96 lg:h-96 bg-primary/10 rounded-full blur-3xl lg:animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-72 h-72 lg:w-96 lg:h-96 bg-accent/10 rounded-full blur-3xl lg:animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="hidden lg:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-secondary/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b border-border/50">
        <div className="container px-3 sm:px-4 md:px-6 h-16 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shrink-0">
              AYD
            </div>
            <Content as="span" id="landing.brand.name" fallback="African Youth Observatory" className="font-display font-bold text-lg hidden sm:block truncate" />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link to="/auth/signin">
              <Button variant="ghost" size="sm" className="px-2 sm:px-3">
                <Content as="span" id="landing.header.signin" fallback="Sign In" />
              </Button>
            </Link>
            <Link to="/auth/signup">
              <Button size="sm" className="gap-1 sm:gap-2 px-2 sm:px-3">
                <Content as="span" id="landing.header.get_started" fallback="Get Started" />
                <ArrowRight className="h-4 w-4 hidden sm:inline" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-24 pb-12 sm:pt-32 sm:pb-20 md:pt-40 md:pb-32">
        <div className="container px-4 md:px-6">
          <div className="max-w-4xl mx-auto text-center space-y-6 sm:space-y-8">
            {/* Badge */}
            <motion.div
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-primary/10 text-primary text-[11px] sm:text-sm font-medium"
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={0}
            >
              <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <Content as="span" id="landing.hero.badge" fallback="Africa's Premier Youth Data Intelligence Platform" />
            </motion.div>

            {/* Main Title */}
            <motion.h1
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-bold tracking-tight leading-tight"
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={0.15}
            >
              <Content as="span" id="landing.hero.title_line1" fallback="Empowering Africa's" />
              <Content as="span" id="landing.hero.title_line2" fallback="Youth Through Data" className="block gradient-text" />
            </motion.h1>

            {/* Description */}
            <Content
              as="p"
              id="landing.hero.description"
              fallback="Access comprehensive youth statistics across all 54 African nations. Power your research, policy decisions, and investments with trusted, real-time data."
              className="max-w-2xl mx-auto text-sm sm:text-lg md:text-xl text-muted-foreground"
            />

            {/* CTA Buttons */}
            <motion.div
              className="flex flex-col sm:flex-row gap-4 justify-center"
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={0.45}
            >
              <Link to="/dashboard">
                <Button size="lg" className="w-full sm:w-auto text-base gap-2 px-8">
                  <Database className="h-5 w-5" />
                  <Content as="span" id="landing.hero.cta_primary" fallback="Start Exploring Data" />
                </Button>
              </Link>
              <Link to="/youth-index">
                <Button variant="outline" size="lg" className="w-full sm:w-auto text-base gap-2 px-8">
                  <Content as="span" id="landing.hero.cta_secondary" fallback="View Youth Index" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 sm:py-16 border-y border-border/50 bg-muted/30 backdrop-blur-sm">
        <div className="container px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            <AnimatedStat target={stats.countries} suffix="" labelKey="landing.stats.countries.label" fallbackLabel="African Countries" icon={MapPin} delay={0} />
            <AnimatedStat target={stats.indicators} suffix="+" labelKey="landing.stats.indicators.label" fallbackLabel="Data Indicators" icon={BarChart3} delay={0.1} />
            <AnimatedStat target={stats.dataPoints > 0 ? Math.round(stats.dataPoints / 1000) : 226} suffix={stats.dataPoints > 0 ? 'K' : 'M'} labelKey="landing.stats.youth.label" fallbackLabel={stats.dataPoints > 0 ? 'Data Points' : 'Youth Covered'} icon={Users} delay={0.2} />
            <AnimatedStat target={stats.yearsCovered} suffix="+" labelKey="landing.stats.years.label" fallbackLabel="Years of Data" icon={TrendingUp} delay={0.3} />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-14 sm:py-20 md:py-32">
        <div className="container px-4 md:px-6">
          <div className="text-center mb-10 sm:mb-16">
            <Content
              as="h2"
              id="landing.features.title"
              fallback="Comprehensive Data Solutions"
              className="text-2xl sm:text-3xl md:text-4xl font-display font-bold mb-3 sm:mb-4 animate-fade-in"
            />
            <Content
              as="p"
              id="landing.features.subtitle"
              fallback="Everything you need to understand Africa's youth demographics and drive impactful decisions."
              className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto animate-fade-in"
              style={{ animationDelay: '0.1s' }}
            />
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {FEATURES.map((feature, index) => (
              <div
                key={feature.slug}
                className="group p-6 rounded-xl border border-border bg-card hover:bg-card/80 hover:border-primary/50 transition-all duration-300 hover-lift animate-fade-in"
                style={{ animationDelay: `${0.2 + index * 0.1}s` }}
              >
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <Content
                  as="h3"
                  id={`landing.features.${feature.slug}.title`}
                  fallback={feature.title}
                  className="text-lg font-semibold mb-2"
                />
                <Content
                  as="p"
                  id={`landing.features.${feature.slug}.description`}
                  fallback={feature.description}
                  className="text-muted-foreground text-sm"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-14 sm:py-20 md:py-32 bg-primary/5">
        <div className="container px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center space-y-6 sm:space-y-8">
            <Content
              as="h2"
              id="landing.bottom_cta.title"
              fallback="Ready to Unlock Africa's Youth Data?"
              className="text-2xl sm:text-3xl md:text-4xl font-display font-bold"
            />
            <Content
              as="p"
              id="landing.bottom_cta.description"
              fallback="Join researchers, policymakers, and organizations using AYD to drive meaningful change across the continent."
              className="text-sm sm:text-lg text-muted-foreground"
            />
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth/signup">
                <Button size="lg" className="w-full sm:w-auto text-base gap-2 px-8">
                  <Content as="span" id="landing.bottom_cta.primary" fallback="Create Free Account" />
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link to="/about">
                <Button variant="outline" size="lg" className="w-full sm:w-auto text-base px-8">
                  <Content as="span" id="landing.bottom_cta.secondary" fallback="Learn More About AYD" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="py-12 sm:py-16 border-t border-border/50">
        <div className="container px-4 md:px-6">
          <div className="max-w-xl mx-auto">
            <NewsletterSignup
              source="landing-page"
              heading="Get monthly youth-data briefings"
              subtitle="Be the first to know when new countries publish AYIMS reports, when the Youth Index updates, and when policy monitor flags new reforms across the continent."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border/50">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                AYD
              </div>
              <Content
                as="span"
                id="landing.footer.copyright"
                fallback="© 2026 African Youth Observatory. Powered by PACSDA & ZeroUp Next."
                className="text-sm text-muted-foreground"
              />
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link to="/about" className="hover:text-foreground transition-colors">
                <Content as="span" id="landing.footer.link_about" fallback="About" />
              </Link>
              <Link to="/contact" className="hover:text-foreground transition-colors">
                <Content as="span" id="landing.footer.link_contact" fallback="Contact" />
              </Link>
              <a href="#" className="hover:text-foreground transition-colors">
                <Content as="span" id="landing.footer.link_privacy" fallback="Privacy" />
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                <Content as="span" id="landing.footer.link_terms" fallback="Terms" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
