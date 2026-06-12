import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  FileText, Plus, Upload, Search, Trash2, Download, ExternalLink, Loader2, Calendar, Tag,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { authHeader } from '@/lib/supabase-token';
import { api, type DocumentSummary } from '@/lib/api-client';

// ─── Real documents API (replaces the old localStorage base64 store) ──────────
// Admin-uploaded reports now persist server-side via the documents API
// (POST /documents — multipart, CONTRIBUTOR/ADMIN), the SAME endpoint the public
// Reports page and the Contributor Hub read from. Uploads therefore appear for
// everyone, not just the device that uploaded them. The actual upload form lives
// at /dashboard/data-upload (DataUpload.tsx); this manager lists + deletes the
// real records. The old adminContent/localStorage store has been removed.

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const DOCS_API = `${API_BASE}/documents`;

const DOC_TYPES = ['PKPB_REPORT', 'COUNTRY_REPORT', 'POLICY_DOCUMENT', 'RESEARCH_PAPER', 'OTHER'] as const;
type DocType = (typeof DOC_TYPES)[number];

const TYPE_LABELS: Record<string, string> = {
  PKPB_REPORT: 'Promise Kept · Broken',
  COUNTRY_REPORT: 'Country Report',
  POLICY_DOCUMENT: 'Policy Document',
  RESEARCH_PAPER: 'Research Paper',
  OTHER: 'Document',
};

const TYPE_ACCENT: Record<string, string> = {
  PKPB_REPORT: '#D4A017',
  COUNTRY_REPORT: '#3B82F6',
  POLICY_DOCUMENT: '#A855F7',
  RESEARCH_PAPER: '#22C55E',
  OTHER: '#6B7280',
};

const bytesToReadable = (bytes: number | null): string => {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const inferExt = (filename: string): string => filename.split('.').pop()?.toUpperCase() || 'FILE';
const slugify = (s: string) => s.toLowerCase().replace(/\s+/g, '-');

const ReportsManager: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | DocType>('all');
  const [confirmDelete, setConfirmDelete] = useState<DocumentSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Real, server-side document records. Shares the cache key with the
  // Contributor "Reports & Files" page so a delete/upload in either place
  // keeps both in sync.
  const { data, isLoading } = useQuery<DocumentSummary[]>({
    queryKey: ['contributor-documents'],
    queryFn: () => api.documents.list({ limit: 500 }),
    refetchOnMount: 'always',
    staleTime: 0,
    retry: 2,
  });

  const reports = data ?? [];

  const visibleReports = useMemo(() => {
    let arr = reports;
    if (filterType !== 'all') arr = arr.filter((r) => r.type === filterType);
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          (r.description ?? '').toLowerCase().includes(q) ||
          (r.country?.name ?? '').toLowerCase().includes(q) ||
          (r.source ?? '').toLowerCase().includes(q),
      );
    }
    return arr;
  }, [reports, search, filterType]);

  const totalSize = useMemo(() => reports.reduce((sum, r) => sum + (r.fileSize ?? 0), 0), [reports]);
  const typeCount = useMemo(() => new Set(reports.map((r) => r.type)).size, [reports]);

  const confirmDeleteNow = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`${DOCS_API}/${confirmDelete.id}`, { method: 'DELETE', headers: authHeader() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({ title: 'Report deleted', description: confirmDelete.title });
      queryClient.invalidateQueries({ queryKey: ['contributor-documents'] });
      queryClient.invalidateQueries({ queryKey: ['public-documents'] });
      setConfirmDelete(null);
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e?.message || 'Try again', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-[#D4A017]" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tighter bg-gradient-to-br from-[#D4A017] from-10% via-white via-40% to-white/40 bg-clip-text text-transparent">
              Reports & Documents
            </h1>
            <p className="text-xs text-[#A89070] mt-0.5">
              These are the real, server-side documents shown on the public Reports page. Upload new ones from the Contributor Hub.
            </p>
          </div>
        </div>
        <Link to="/dashboard/data-upload">
          <Button size="sm" className="gap-1.5 self-start">
            <Plus className="h-4 w-4" /> New report
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Reports', value: reports.length.toString(), accent: '#D4A017' },
          { label: 'Document types', value: typeCount.toString(), accent: '#22C55E' },
          { label: 'Countries', value: new Set(reports.map((r) => r.country?.id).filter(Boolean)).size.toString(), accent: '#3B82F6' },
          { label: 'Storage used', value: bytesToReadable(totalSize), accent: '#A855F7' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-4 bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-gray-800/80">
            <p className="text-2xl font-bold tabular-nums leading-none" style={{ color: s.accent }}>{s.value}</p>
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
          <Input
            placeholder="Search reports…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs bg-white/[0.03] border-gray-800"
          />
        </div>
        <Select value={filterType} onValueChange={(v) => setFilterType(v as 'all' | DocType)}>
          <SelectTrigger className="w-full sm:w-[210px] h-9 text-xs bg-white/[0.03] border-gray-800">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All types</SelectItem>
            {DOC_TYPES.map((t) => (
              <SelectItem key={t} value={t} className="text-xs">{TYPE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        </div>
      ) : visibleReports.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-gray-800 bg-white/[0.02]">
          <FileText className="h-10 w-10 text-gray-500 mx-auto mb-3" />
          <p className="text-base font-medium text-gray-300">
            {reports.length === 0 ? 'No reports uploaded yet' : 'No reports match your filters'}
          </p>
          <p className="text-xs text-gray-500 mt-1 mb-4">
            {reports.length === 0
              ? 'Upload PDFs, briefs, or data sheets from the Contributor Hub — they appear on the public Reports page.'
              : 'Try clearing the search or type filter.'}
          </p>
          {reports.length === 0 && (
            <Link to="/dashboard/data-upload">
              <Button size="sm" className="gap-1.5">
                <Upload className="h-3.5 w-3.5" /> Upload your first report
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {visibleReports.map((r) => {
            const accent = TYPE_ACCENT[r.type] ?? TYPE_ACCENT.OTHER;
            const countrySlug = r.country?.name ? slugify(r.country.name) : null;
            return (
              <Card key={r.id} className="bg-white/[0.03] border-gray-800/80 rounded-xl overflow-hidden hover:border-gray-700 transition-colors">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-start gap-3">
                    {/* Type icon medallion */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: accent + '20', color: accent }}>
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider" style={{ background: accent + '20', color: accent }}>
                          {TYPE_LABELS[r.type] ?? TYPE_LABELS.OTHER}
                        </span>
                        {r.country && (
                          <span className="text-[10px] text-gray-500 uppercase tracking-wider">{r.country.name}</span>
                        )}
                        {r.edition && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">{r.edition}</Badge>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-white">{r.title}</h3>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                        {r.description || <span className="italic text-gray-600">No description</span>}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-gray-500">
                        {r.year && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {r.year}</span>}
                        {r.source && <span className="inline-flex items-center gap-1"><Tag className="h-3 w-3" /> {r.source}</span>}
                        <span className="text-gray-700">·</span>
                        <span className="tabular-nums">{inferExt(r.originalFilename || '')} · {bytesToReadable(r.fileSize)}</span>
                        <span className="text-gray-700">·</span>
                        <span className="truncate text-gray-600">{r.originalFilename}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 self-start">
                      {r.type === 'PKPB_REPORT' && countrySlug && (
                        <Link to={`/dashboard/pkpb/${countrySlug}`} title="View PKPB page">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      )}
                      <a
                        href={api.documents.downloadUrl(r.id, 'attachment')}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Download"
                      >
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        onClick={() => setConfirmDelete(r)}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="bg-black/95 border-gray-800">
          <DialogHeader>
            <DialogTitle>Delete this report?</DialogTitle>
            <DialogDescription>
              "{confirmDelete?.title}" will be removed permanently — both the database record and the file in storage.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={confirmDeleteNow} disabled={deleting} className="gap-1.5">
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReportsManager;
