import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileText, Calendar, Tag, Search, Filter, Code, Check, ExternalLink, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useExportGuard } from '@/hooks/useExportGuard';
import { GuestInviteModal } from '@/components/GuestInviteModal';
import { Content } from '@/components/cms';
import { useContentText } from '@/contexts/ContentContext';
import { api, type DocumentSummary } from '@/lib/api-client';

// ─── Real document wiring ────────────────────────────────────────────────────
// This page now reads PUBLISHED documents from the real documents API
// (`api.documents.list()`), replacing the old localStorage/base64 store. Files
// download/preview through the backend stream via `api.documents.downloadUrl()`,
// so uploads made by admins/contributors (via the Contributor Hub → POST
// /documents) are visible to everyone, not just the device that uploaded them.

const DOC_TYPES = ['PKPB_REPORT', 'COUNTRY_REPORT', 'POLICY_DOCUMENT', 'RESEARCH_PAPER', 'OTHER'] as const;
type DocType = (typeof DOC_TYPES)[number];

const TYPE_LABELS: Record<string, string> = {
  PKPB_REPORT: 'Promise Kept · Broken',
  COUNTRY_REPORT: 'Country Report',
  POLICY_DOCUMENT: 'Policy Document',
  RESEARCH_PAPER: 'Research Paper',
  OTHER: 'Document',
};

const TYPE_ACCENT: Record<string, { bg: string; text: string; hex: string }> = {
  PKPB_REPORT:     { bg: 'bg-amber-500/15',  text: 'text-amber-400',  hex: '#D4A017' },
  COUNTRY_REPORT:  { bg: 'bg-blue-500/15',   text: 'text-blue-400',   hex: '#3B82F6' },
  POLICY_DOCUMENT: { bg: 'bg-purple-500/15', text: 'text-purple-400', hex: '#A855F7' },
  RESEARCH_PAPER:  { bg: 'bg-emerald-500/15', text: 'text-emerald-400', hex: '#22C55E' },
  OTHER:           { bg: 'bg-gray-500/15',   text: 'text-gray-400',   hex: '#6B7280' },
};

const accentFor = (type: string) => TYPE_ACCENT[type] ?? TYPE_ACCENT.OTHER;
const labelFor = (type: string) => TYPE_LABELS[type] ?? TYPE_LABELS.OTHER;

const bytesToReadable = (bytes: number | null): string => {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const inferExt = (filename: string): string => filename.split('.').pop()?.toUpperCase() || 'FILE';
const isHtmlDoc = (d: DocumentSummary) =>
  /\.(html?|xhtml)$/i.test(d.originalFilename || '') || (d.mimeType || '').includes('html');

const Reports = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | DocType>('all');
  const [selectedYear, setSelectedYear] = useState('All Years');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast } = useToast();
  const { guard, inviteOpen, setInviteOpen, inviteAction } = useExportGuard();

  // Real documents from the API. Only PUBLISHED docs come back. We pull a
  // generous page so the public list is complete without pagination UI.
  const { data, isLoading, isError, refetch } = useQuery<DocumentSummary[]>({
    queryKey: ['public-documents'],
    queryFn: () => api.documents.list({ limit: 500 }),
    staleTime: 60_000,
    retry: 2,
  });

  // Reports & Publications surfaces latest reports, thematic briefs, and data
  // publications — NOT the Promise-Kept-Promise-Broken (PKPB) country reports,
  // which have their own dedicated pages (/pkpb). Excluding them here keeps this
  // page focused; the upload → show → download piping is identical for every
  // other type, so newly uploaded country reports / policy docs / research
  // papers / data publications appear here automatically.
  const allDocs = useMemo(
    () => (data ?? []).filter((d) => d.type !== 'PKPB_REPORT'),
    [data],
  );

  const toastTitle = useContentText('reports.toast.embed_copied_title', 'Embed code copied!');
  const toastDescTemplate = useContentText(
    'reports.toast.embed_copied_description',
    'Embed code for "{title}" has been copied to your clipboard.',
  );
  const searchPlaceholder = useContentText('reports.search.placeholder', 'Search reports...');

  // Year filter options derived from the real data.
  const years = useMemo(() => {
    const set = new Set<number>();
    allDocs.forEach((d) => { if (d.year) set.add(d.year); });
    return ['All Years', ...Array.from(set).sort((a, b) => b - a).map(String)];
  }, [allDocs]);

  const handleDownload = (doc: DocumentSummary) => {
    guard(
      () => {
        // Real backend stream — attachment disposition triggers a browser download.
        window.open(api.documents.downloadUrl(doc.id, 'attachment'), '_blank', 'noopener,noreferrer');
      },
      'download',
    );
  };

  const handlePreview = (doc: DocumentSummary) => {
    // HTML reports (incl. PKPB with animations) render inline from the backend.
    window.open(api.documents.downloadUrl(doc.id, 'inline'), '_blank', 'noopener,noreferrer');
  };

  const handleCopyEmbed = (doc: DocumentSummary) => {
    // Embed the REAL inline document URL (not the old broken /embed/report/:id).
    const inlineUrl = api.documents.downloadUrl(doc.id, 'inline');
    const embedCode = `<iframe src="${inlineUrl}" width="600" height="400" frameborder="0" title="${doc.title}"></iframe>`;
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopiedId(doc.id);
      toast({
        title: toastTitle,
        description: toastDescTemplate.replace('{title}', doc.title),
      });
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const filteredDocs = allDocs.filter((doc) => {
    const haystack = `${doc.title} ${doc.description ?? ''} ${doc.country?.name ?? ''} ${doc.source ?? ''}`.toLowerCase();
    const matchesSearch = haystack.includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || doc.type === selectedType;
    const matchesYear = selectedYear === 'All Years' || String(doc.year ?? '') === selectedYear;
    return matchesSearch && matchesType && matchesYear;
  });

  return (
    <>
      <GuestInviteModal open={inviteOpen} onOpenChange={setInviteOpen} action={inviteAction} />
      <header className="relative pt-6 pb-3 md:pt-8 md:pb-4 overflow-hidden">
        <div className="absolute inset-0 opacity-30 w-full bg-[linear-gradient(to_right,#333_1px,transparent_1px),linear-gradient(to_bottom,#333_1px,transparent_1px)] bg-[size:6rem_5rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
        <div className="container px-4 md:px-6 relative z-10">
          <Content
            as="h1"
            id="reports.header.title"
            fallback="Reports & Publications"
            className="text-2xl sm:text-3xl font-semibold tracking-tighter mb-2 bg-gradient-to-br from-[#D4A017] from-10% via-white via-40% to-white/40 bg-clip-text text-transparent"
          />
          <Content
            as="p"
            id="reports.header.subtitle"
            fallback="Access our latest reports, thematic briefs, and data publications on African youth development."
            className="text-sm sm:text-base text-[#A89070]"
          />
        </div>
      </header>

      <div className="pt-2 md:pt-3 pb-6 md:pb-8">
        <div className="container px-4 md:px-6">
          {/* Hero stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {(() => {
              const countries = new Set(allDocs.map((d) => d.country?.id).filter(Boolean)).size;
              const typeCount = new Set(allDocs.map((d) => d.type)).size;
              const latestYear = allDocs.reduce((m, d) => Math.max(m, d.year ?? 0), 0);
              const stats = [
                { icon: FileText, label: 'Publications', value: allDocs.length.toString(), accent: '#D4A017' },
                { icon: Tag, label: 'Document types', value: typeCount.toString(), accent: '#A855F7' },
                { icon: Filter, label: 'Countries covered', value: countries.toString(), accent: '#22C55E' },
                { icon: Calendar, label: 'Latest edition', value: latestYear ? latestYear.toString() : '—', accent: '#3B82F6' },
              ];
              return stats.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="rounded-2xl p-4 bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-gray-800/80 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: s.accent + '20', color: s.accent }}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-2xl font-bold tabular-nums leading-none truncate" style={{ color: s.accent }}>{s.value}</p>
                      <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mt-1">{s.label}</p>
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          {/* Compact filter bar */}
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
              <Input
                type="search"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs bg-white/[0.03] border-gray-800"
              />
            </div>
            <Select value={selectedType} onValueChange={(v) => setSelectedType(v as 'all' | DocType)}>
              <SelectTrigger className="w-full sm:w-[210px] h-9 text-xs bg-white/[0.03] border-gray-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All types</SelectItem>
                {DOC_TYPES.filter((t) => t !== 'PKPB_REPORT').map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">{TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-full sm:w-[110px] h-9 text-xs bg-white/[0.03] border-gray-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year} className="text-xs">{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Result count */}
          <p className="text-xs text-gray-500 mb-4 inline-flex items-center gap-1">
            <Filter className="h-3 w-3" />
            <span className="text-gray-300 font-semibold tabular-nums">{filteredDocs.length}</span>
            of <span className="text-gray-300 font-semibold tabular-nums">{allDocs.length}</span>
            <Content as="span" id="reports.all.heading_inline" fallback="publications" />
          </p>

          {/* States: loading / error / empty / grid */}
          {isLoading ? (
            <div className="text-center py-16 rounded-2xl border border-dashed border-gray-800 bg-white/[0.02]">
              <Loader2 className="h-8 w-8 text-gray-500 mx-auto mb-3 animate-spin" />
              <p className="text-sm text-gray-400">Loading publications…</p>
            </div>
          ) : isError ? (
            <div className="text-center py-16 rounded-2xl border border-dashed border-gray-800 bg-white/[0.02]">
              <FileText className="h-10 w-10 text-gray-500 mx-auto mb-3" />
              <p className="text-base font-medium text-gray-300">Couldn't load publications</p>
              <p className="text-xs text-gray-500 mt-1 mb-4">There was a problem reaching the documents service.</p>
              <Button size="sm" variant="outline" onClick={() => refetch()}>Try again</Button>
            </div>
          ) : allDocs.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-dashed border-gray-800 bg-white/[0.02]">
              <FileText className="h-10 w-10 text-gray-500 mx-auto mb-3" />
              <p className="text-base font-medium text-gray-300">No reports published yet.</p>
              <p className="text-xs text-gray-500 mt-1">Check back soon — new publications appear here as they're uploaded.</p>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-dashed border-gray-800 bg-white/[0.02]">
              <FileText className="h-10 w-10 text-gray-500 mx-auto mb-3" />
              <p className="text-base font-medium text-gray-300">No publications match your filters</p>
              <p className="text-xs text-gray-500 mt-1">Try clearing search or widening the filters above.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredDocs.map((doc) => {
                const accent = accentFor(doc.type);
                const html = isHtmlDoc(doc);
                const ext = inferExt(doc.originalFilename || '');
                const size = bytesToReadable(doc.fileSize);
                return (
                  <article
                    key={doc.id}
                    className="group relative rounded-2xl bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-gray-800/80 hover:border-gray-700 transition-all flex flex-col overflow-hidden"
                  >
                    {/* Type accent stripe */}
                    <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${accent.hex}aa, transparent)` }} />
                    <div className="p-4 flex flex-col flex-grow">
                      <div className="flex items-start gap-2 mb-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: accent.hex + '20', color: accent.hex }}>
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${accent.bg} ${accent.text}`}>
                            {labelFor(doc.type)}
                          </span>
                          {doc.country && (
                            <p className="text-[10px] text-gray-500 mt-1 truncate">{doc.country.name}</p>
                          )}
                        </div>
                      </div>

                      <h3 className="font-bold text-sm text-white mb-1.5 line-clamp-2 leading-tight">{doc.title}</h3>
                      {doc.description && (
                        <p className="text-[11px] text-gray-400 mb-3 line-clamp-2 leading-relaxed flex-grow">{doc.description}</p>
                      )}
                      {!doc.description && <div className="flex-grow" />}

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-500 mb-3">
                        {doc.year && (
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Calendar className="h-3 w-3" />
                            {doc.year}
                          </span>
                        )}
                        {doc.source && (
                          <span className="inline-flex items-center gap-1 truncate max-w-[120px]">
                            <Tag className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{doc.source}</span>
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          {ext}{size ? ` · ${size}` : ''}
                        </span>
                      </div>

                      {/* Action row — download + (HTML) preview + embed */}
                      <div className="flex items-center gap-1.5 mt-auto pt-3 border-t border-white/[0.04]">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 text-[10px] h-7 px-2 flex-1 min-w-0 border-gray-800 bg-white/[0.02]"
                          onClick={() => handleDownload(doc)}
                        >
                          <Download className="h-3 w-3 flex-shrink-0" />
                          <Content as="span" id="reports.download_button" fallback="Download" />
                        </Button>
                        {html && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-gray-500 hover:text-[#D4A017]"
                            onClick={() => handlePreview(doc)}
                            title="Preview report"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-500 hover:text-[#D4A017]"
                          onClick={() => handleCopyEmbed(doc)}
                          title="Copy embed code"
                        >
                          {copiedId === doc.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Code className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Reports;
