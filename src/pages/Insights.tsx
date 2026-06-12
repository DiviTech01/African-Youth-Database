import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sparkles, TrendingUp, TrendingDown, AlertTriangle, BarChart3,
  Globe, Activity, FileText, Download, Send, Loader2, Link2,
} from 'lucide-react';
import CountryFlag from '@/components/CountryFlag';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { api, type InsightReportDetail } from '@/lib/api-client';

// ── Real-data types (runtime shapes from the insights backend) ─────────────────

type AnomalySeverity = 'positive' | 'warning' | 'critical';

interface Anomaly {
  countryId: string;
  countryName: string;
  indicatorId: string;
  indicatorName: string;
  value: number;
  mean: number;
  stdDev: number;
  deviations: number;
  direction: 'above' | 'below';
  severity: AnomalySeverity;
  year: number;
}

interface Correlation {
  indicator1: { id: string; name: string; theme?: string };
  indicator2: { id: string; name: string; theme?: string };
  correlation: number;
  strength: 'strong' | 'moderate';
  direction: 'positive' | 'negative';
  sampleSize: number;
  interpretation: string;
}

type CountryInsightSeverity = 'info' | 'positive' | 'warning' | 'critical';

interface CountryInsight {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: CountryInsightSeverity;
  confidence?: number;
  relatedCountryName?: string;
  relatedIndicatorName?: string;
  dataPoints?: unknown;
  recommendations?: string[];
  generatedAt: string;
  source: 'ai' | 'rule-based';
}

type ReportScope = 'continental' | 'country' | 'theme';

// ── Styling maps ───────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<CountryInsightSeverity, { bg: string; text: string; border: string }> = {
  info:     { bg: 'bg-blue-500/10',    text: 'text-blue-600 dark:text-blue-400',       border: 'border-blue-500/20' },
  warning:  { bg: 'bg-amber-500/10',   text: 'text-amber-600 dark:text-amber-400',     border: 'border-amber-500/20' },
  critical: { bg: 'bg-red-500/10',     text: 'text-red-600 dark:text-red-400',         border: 'border-red-500/20' },
  positive: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20' },
};

function fmtNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(2).replace(/\.00$/, '');
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Empty state ────────────────────────────────────────────────────────────────

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <Activity className="h-10 w-10 text-gray-400/40 mb-3" />
    <p className="text-gray-400 text-sm">{message}</p>
  </div>
);

const Loading: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center justify-center gap-2 py-16 text-gray-400 text-sm">
    <Loader2 className="h-4 w-4 animate-spin" />
    {label}
  </div>
);

// ── Component ──────────────────────────────────────────────────────────────────

type FeedTab = 'anomalies' | 'correlations' | 'country';

const Insights: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  // ── Real insights feed ──────────────────────────────────────────────
  const [feedTab, setFeedTab] = useState<FeedTab>('anomalies');
  const [selectedCountryId, setSelectedCountryId] = useState<string>('');

  const countriesQuery = useQuery({
    queryKey: ['countries'],
    queryFn: () => api.countries.list(),
    staleTime: 1000 * 60 * 60,
  });
  const themesQuery = useQuery({
    queryKey: ['themes'],
    queryFn: () => api.themes.list(),
    staleTime: 1000 * 60 * 60,
  });

  const anomaliesQuery = useQuery({
    queryKey: ['insights', 'anomalies'],
    queryFn: () => api.insights.anomalies() as unknown as Promise<Anomaly[]>,
    staleTime: 1000 * 60 * 10,
  });
  const correlationsQuery = useQuery({
    queryKey: ['insights', 'correlations'],
    queryFn: () => api.insights.correlations() as unknown as Promise<Correlation[]>,
    staleTime: 1000 * 60 * 10,
  });
  const countryInsightsQuery = useQuery({
    queryKey: ['insights', 'country', selectedCountryId],
    queryFn: () => api.insights.forCountry(selectedCountryId) as unknown as Promise<CountryInsight[]>,
    enabled: feedTab === 'country' && !!selectedCountryId,
    staleTime: 1000 * 60 * 10,
  });

  // ── Report generator ────────────────────────────────────────────────
  const [scope, setScope] = useState<ReportScope>('continental');
  const [reportCountryId, setReportCountryId] = useState<string>('');
  const [reportThemeId, setReportThemeId] = useState<string>('');
  const [report, setReport] = useState<InsightReportDetail | null>(null);

  const generateMutation = useMutation({
    mutationFn: () => api.insightReports.generate({
      scope,
      countryId: scope === 'country' ? reportCountryId : undefined,
      themeId: scope === 'theme' ? reportThemeId : undefined,
    }),
    onSuccess: (data) => {
      setReport(data);
      toast.success('Report generated');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to generate report. Please try again.');
    },
  });

  const canGenerate =
    scope === 'continental' ||
    (scope === 'country' && !!reportCountryId) ||
    (scope === 'theme' && !!reportThemeId);

  // ── Admin send ──────────────────────────────────────────────────────
  const [audience, setAudience] = useState<'subscribers' | 'users' | 'all'>('subscribers');
  const sendMutation = useMutation({
    mutationFn: () => {
      if (!report) throw new Error('No report to send');
      return api.insightReports.send(report.id, { audience });
    },
    onSuccess: (res) => {
      toast.success(`Report sent to ${res.recipientCount} recipient${res.recipientCount === 1 ? '' : 's'}.`);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to send report.');
    },
  });

  const sanitizedSections = useMemo(() => {
    if (!report) return [];
    return report.sections.map((s) => ({
      heading: s.heading,
      body: DOMPurify.sanitize(s.body || ''),
    }));
  }, [report]);

  const handleDownload = () => {
    if (!report) return;
    window.open(api.insightReports.downloadUrl(report.id), '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="relative pt-6 pb-3 md:pt-8 md:pb-4 overflow-hidden">
        <div className="absolute inset-0 opacity-30 w-full bg-[linear-gradient(to_right,#333_1px,transparent_1px),linear-gradient(to_bottom,#333_1px,transparent_1px)] bg-[size:6rem_5rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tighter bg-gradient-to-br from-[#D4A017] from-10% via-white via-40% to-white/40 bg-clip-text text-transparent">
                {t('insights.title')}
              </h1>
            </div>
            <p className="text-[#A89070] max-w-2xl">
              {t('insights.subtitle')}
            </p>
          </motion.div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pt-2 pb-10 md:pt-3 sm:px-6 lg:px-8 space-y-10">

        {/* ── Report Generator ─────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
        >
          <Card className="border border-gray-800 bg-white/[0.03] rounded-2xl">
            <CardContent className="p-5 sm:p-6 space-y-5">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Generate AI Report</h2>
              </div>
              <p className="text-sm text-gray-400 -mt-2">
                Produce a downloadable, Claude-authored analysis of the live database. Generation can take several seconds.
              </p>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
                {/* Scope */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-gray-400">Scope</span>
                  <Select value={scope} onValueChange={(v) => setScope(v as ReportScope)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Scope" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="continental">Continental</SelectItem>
                      <SelectItem value="country">Country</SelectItem>
                      <SelectItem value="theme">Theme</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Country picker */}
                {scope === 'country' && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-gray-400">Country</span>
                    <Select value={reportCountryId} onValueChange={setReportCountryId}>
                      <SelectTrigger className="w-[220px]">
                        <Globe className="mr-2 h-4 w-4 text-gray-400" />
                        <SelectValue placeholder="Select a country" />
                      </SelectTrigger>
                      <SelectContent>
                        {(countriesQuery.data ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Theme picker */}
                {scope === 'theme' && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-gray-400">Theme</span>
                    <Select value={reportThemeId} onValueChange={setReportThemeId}>
                      <SelectTrigger className="w-[220px]">
                        <BarChart3 className="mr-2 h-4 w-4 text-gray-400" />
                        <SelectValue placeholder="Select a theme" />
                      </SelectTrigger>
                      <SelectContent>
                        {(themesQuery.data ?? []).map((th) => (
                          <SelectItem key={th.id} value={th.id}>{th.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Button
                  onClick={() => generateMutation.mutate()}
                  disabled={!canGenerate || generateMutation.isPending}
                  className="gap-2"
                >
                  {generateMutation.isPending
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
                    : <><Sparkles className="h-4 w-4" /> Generate</>}
                </Button>
              </div>

              {generateMutation.isPending && (
                <Loading label="Claude is analysing the live data and writing your report…" />
              )}

              {/* ── Generated report ─────────────────────────────── */}
              {report && !generateMutation.isPending && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className="mt-2 rounded-xl border border-gray-800 bg-black/30 p-5 sm:p-6 space-y-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Badge className="bg-primary/10 text-primary border-0 capitalize mb-2">{report.scope}</Badge>
                      <h3 className="text-xl font-semibold text-foreground leading-snug">{report.title}</h3>
                      {report.createdAt && (
                        <p className="text-xs text-gray-400 mt-1">Generated {fmtDate(report.createdAt)}</p>
                      )}
                    </div>
                    <Button variant="outline" size="sm" className="gap-2" onClick={handleDownload}>
                      <Download className="h-4 w-4" /> Download
                    </Button>
                  </div>

                  {report.summary && (
                    <p className="text-sm text-gray-300 leading-relaxed">{report.summary}</p>
                  )}

                  <div className="space-y-5">
                    {sanitizedSections.map((s, i) => (
                      <div key={i}>
                        {s.heading && (
                          <h4 className="text-base font-semibold text-foreground mb-1.5">{s.heading}</h4>
                        )}
                        <div
                          className="prose prose-sm prose-invert max-w-none text-gray-300 prose-headings:text-foreground prose-strong:text-foreground prose-li:marker:text-primary"
                          dangerouslySetInnerHTML={{ __html: s.body }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* ── Admin-only send ──────────────────────────── */}
                  {isAdmin && (
                    <div className="border-t border-gray-800 pt-4 mt-2">
                      <div className="flex items-center gap-2 mb-3">
                        <Send className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-foreground">Send this report</span>
                        <Badge className="bg-amber-500/10 text-amber-500 border-0 text-[10px]">Admin</Badge>
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs text-gray-400">Audience</span>
                          <Select value={audience} onValueChange={(v) => setAudience(v as typeof audience)}>
                            <SelectTrigger className="w-[240px]">
                              <SelectValue placeholder="Audience" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="subscribers">All newsletter subscribers</SelectItem>
                              <SelectItem value="users">Just registered users</SelectItem>
                              <SelectItem value="all">Everyone</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          variant="secondary"
                          className="gap-2"
                          onClick={() => sendMutation.mutate()}
                          disabled={sendMutation.isPending}
                        >
                          {sendMutation.isPending
                            ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                            : <><Send className="h-4 w-4" /> Send report</>}
                        </Button>
                      </div>
                      {report.lastSentAt && (
                        <p className="text-xs text-gray-400 mt-2">Last sent {fmtDate(report.lastSentAt)}</p>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.section>

        {/* ── Real Insights Feed ───────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="space-y-5"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {([
                { value: 'anomalies', label: t('insights.anomalies') },
                { value: 'correlations', label: 'Correlations' },
                { value: 'country', label: 'By Country' },
              ] as { value: FeedTab; label: string }[]).map((tab) => (
                <Button
                  key={tab.value}
                  variant={feedTab === tab.value ? 'default' : 'outline'}
                  size="sm"
                  className="rounded-full"
                  onClick={() => setFeedTab(tab.value)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>

            {feedTab === 'country' && (
              <Select value={selectedCountryId} onValueChange={setSelectedCountryId}>
                <SelectTrigger className="w-[220px]">
                  <Globe className="mr-2 h-4 w-4 text-gray-400" />
                  <SelectValue placeholder="Select a country" />
                </SelectTrigger>
                <SelectContent>
                  {(countriesQuery.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* ── Anomalies ─────────────────────────────────────── */}
          {feedTab === 'anomalies' && (
            anomaliesQuery.isLoading ? (
              <Loading label="Detecting anomalies across the latest year…" />
            ) : anomaliesQuery.isError ? (
              <EmptyState message="Could not load anomalies. Please try again later." />
            ) : (anomaliesQuery.data ?? []).length === 0 ? (
              <EmptyState message="No anomalies detected for the latest year." />
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {(anomaliesQuery.data ?? []).map((a, i) => {
                  const sev = SEVERITY_STYLES[a.severity] ?? SEVERITY_STYLES.info;
                  const TrendIcon = a.direction === 'above' ? TrendingUp : TrendingDown;
                  return (
                    <motion.div
                      key={`${a.countryId}-${a.indicatorId}-${i}`}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.04 }}
                    >
                      <Card className={`border ${sev.border} bg-white/[0.03] border-gray-800 rounded-2xl h-full`}>
                        <CardContent className="p-5 flex flex-col gap-3 h-full">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={`${sev.bg} ${sev.text} border-0 capitalize`}>{a.severity}</Badge>
                            <Badge className="bg-orange-500/10 text-orange-500 border-0">
                              <AlertTriangle className="mr-1 h-3 w-3" /> Anomaly
                            </Badge>
                            <span className="ml-auto text-xs text-gray-400">{a.year}</span>
                          </div>
                          <h3 className="font-semibold text-foreground leading-snug">{a.indicatorName}</h3>
                          <p className="text-sm text-gray-400 leading-relaxed">
                            <span className="font-medium text-foreground">{a.countryName}</span> recorded{' '}
                            <span className="font-medium text-foreground">{fmtNumber(a.value)}</span>,{' '}
                            {fmtNumber(Math.abs(a.deviations))} std dev {a.direction} the continental mean of{' '}
                            {fmtNumber(a.mean)}.
                          </p>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-400 mt-auto pt-2">
                            <span className="flex items-center gap-1">
                              <CountryFlag country={a.countryName} size="xs" />
                              {a.countryName}
                            </span>
                            <span className={`flex items-center gap-1 font-medium ${a.direction === 'above' ? 'text-emerald-500' : 'text-red-500'}`}>
                              <TrendIcon className="h-3.5 w-3.5" />
                              {a.direction === 'above' ? 'Above average' : 'Below average'}
                            </span>
                            <span className="flex items-center gap-1">
                              σ {fmtNumber(a.stdDev)}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )
          )}

          {/* ── Correlations ──────────────────────────────────── */}
          {feedTab === 'correlations' && (
            correlationsQuery.isLoading ? (
              <Loading label="Computing indicator correlations…" />
            ) : correlationsQuery.isError ? (
              <EmptyState message="Could not load correlations. Please try again later." />
            ) : (correlationsQuery.data ?? []).length === 0 ? (
              <EmptyState message="No significant correlations found." />
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {(correlationsQuery.data ?? []).map((c, i) => {
                  const positive = c.direction === 'positive';
                  return (
                    <motion.div
                      key={`${c.indicator1.id}-${c.indicator2.id}-${i}`}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.04 }}
                    >
                      <Card className="border border-gray-800 bg-white/[0.03] rounded-2xl h-full">
                        <CardContent className="p-5 flex flex-col gap-3 h-full">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="bg-sky-500/10 text-sky-500 border-0 capitalize">{c.strength}</Badge>
                            <Badge className={`border-0 ${positive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                              {positive ? <TrendingUp className="mr-1 h-3 w-3" /> : <TrendingDown className="mr-1 h-3 w-3" />}
                              {positive ? 'Positive' : 'Negative'}
                            </Badge>
                            <span className="ml-auto text-xs font-mono text-gray-300">r = {c.correlation.toFixed(2)}</span>
                          </div>
                          <h3 className="font-semibold text-foreground leading-snug flex items-center gap-1.5">
                            {c.indicator1.name}
                            <Link2 className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                            {c.indicator2.name}
                          </h3>
                          <p className="text-sm text-gray-400 leading-relaxed">{c.interpretation}</p>
                          <div className="text-xs text-gray-400 mt-auto pt-2">
                            Based on {c.sampleSize} paired observation{c.sampleSize === 1 ? '' : 's'}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )
          )}

          {/* ── By Country ────────────────────────────────────── */}
          {feedTab === 'country' && (
            !selectedCountryId ? (
              <EmptyState message="Select a country to see its AI-generated insights." />
            ) : countryInsightsQuery.isLoading ? (
              <Loading label="Generating country insights…" />
            ) : countryInsightsQuery.isError ? (
              <EmptyState message="Could not load insights for this country." />
            ) : (countryInsightsQuery.data ?? []).length === 0 ? (
              <EmptyState message="No insights available for this country yet." />
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {(countryInsightsQuery.data ?? []).map((ins, i) => {
                  const sev = SEVERITY_STYLES[ins.severity] ?? SEVERITY_STYLES.info;
                  return (
                    <motion.div
                      key={ins.id}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.04 }}
                    >
                      <Card className={`border ${sev.border} bg-white/[0.03] border-gray-800 rounded-2xl h-full`}>
                        <CardContent className="p-5 flex flex-col gap-3 h-full">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={`${sev.bg} ${sev.text} border-0 capitalize`}>{ins.severity}</Badge>
                            <Badge className="bg-violet-500/10 text-violet-400 border-0 capitalize">{ins.type}</Badge>
                            <Badge className="bg-white/5 text-gray-400 border-0 uppercase text-[10px]">
                              {ins.source === 'ai' ? 'AI' : 'Rule-based'}
                            </Badge>
                          </div>
                          <h3 className="font-semibold text-foreground leading-snug">{ins.title}</h3>
                          <p className="text-sm text-gray-400 leading-relaxed">{ins.description}</p>
                          {ins.recommendations && ins.recommendations.length > 0 && (
                            <ul className="text-sm text-gray-400 list-disc list-inside space-y-1">
                              {ins.recommendations.map((r, ri) => <li key={ri}>{r}</li>)}
                            </ul>
                          )}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-400 mt-auto pt-2">
                            {ins.relatedIndicatorName && (
                              <span className="flex items-center gap-1">
                                <BarChart3 className="h-3 w-3" />
                                {ins.relatedIndicatorName}
                              </span>
                            )}
                            {typeof ins.confidence === 'number' && (
                              <span>Confidence {Math.round(ins.confidence * 100)}%</span>
                            )}
                            {ins.generatedAt && <span>{fmtDate(ins.generatedAt)}</span>}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )
          )}
        </motion.section>
      </div>
    </div>
  );
};

export default Insights;
