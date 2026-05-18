import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Upload, FileSpreadsheet, AlertTriangle, CheckCircle, Download,
  Clock, Database, BarChart3, FileText, X, Eye, FileType2, ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { authHeader } from '@/lib/supabase-token';
import { useCountries } from '@/hooks/useData';
import { Link, useSearchParams } from 'react-router-dom';
import AyimsFlow from '@/components/upload/AyimsFlow';
import PolicyFlow from '@/components/upload/PolicyFlow';
import PkpbGuidedForm, { type PkpbGuidedValue, emptyPkpbValue } from '@/components/upload/PkpbGuidedForm';
import { xhrUpload, formatBytes, formatEta, type UploadProgress } from '@/lib/xhrUpload';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const DATA_API = `${API_BASE}/data-upload`;
const DOCS_API = `${API_BASE}/documents`;

const authHeaders = (): Record<string, string> => authHeader();
const fetchAuth = (url: string) =>
  fetch(url, { headers: authHeaders() }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

// ── File-type detection — drives the auto-routing ───────────────────
type UploadKind = 'data' | 'document' | 'ayims' | 'policies';
type DocType = 'PKPB_REPORT' | 'COUNTRY_REPORT' | 'POLICY_DOCUMENT' | 'RESEARCH_PAPER' | 'OTHER';

const DATA_EXT = ['csv', 'xlsx', 'xls'] as const;
const DOC_EXT = ['pdf', 'docx', 'doc', 'pptx', 'ppt', 'txt', 'html', 'htm'] as const;

/**
 * Decide which upload pipeline a file belongs to. Detection is filename-based —
 * the contributor's filenames carry the convention ("Angola_AYIMS_Template_v1.xlsx",
 * "African_National_Youth_Policies_Database_v3.csv"), so we don't need to peek
 * inside the workbook on the client.
 */
function classify(file: File): UploadKind | 'unknown' {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const lowerName = file.name.toLowerCase();

  if ((DOC_EXT as readonly string[]).includes(ext)) return 'document';
  if (!(DATA_EXT as readonly string[]).includes(ext)) return 'unknown';

  if (/ayims/.test(lowerName)) return 'ayims';
  if (/_polic|policies_database|policy_database|youth.policies/.test(lowerName)) return 'policies';
  return 'data';
}

function suggestDocType(file: File, countryName: string | null): DocType {
  const name = file.name.toLowerCase();
  if (/promise[\s_-]*kept|promise[\s_-]*broken|pkpb|pacsda/.test(name)) return 'PKPB_REPORT';
  if (countryName && name.toLowerCase().includes(countryName.toLowerCase())) return 'COUNTRY_REPORT';
  if (/policy|policies|charter/.test(name)) return 'POLICY_DOCUMENT';
  if (/research|paper|study/.test(name)) return 'RESEARCH_PAPER';
  return 'OTHER';
}

const DOC_TYPE_LABELS: Record<DocType, { label: string; hint: string }> = {
  PKPB_REPORT:     { label: 'Promise Kept · Promise Broken Report', hint: 'Routes to /pkpb/<country> and feeds the country report card.' },
  COUNTRY_REPORT:  { label: 'Country Report',                       hint: 'General country-level report. Shows on the country profile.' },
  POLICY_DOCUMENT: { label: 'Policy Document',                      hint: 'National policies, charters, AYC instruments.' },
  RESEARCH_PAPER:  { label: 'Research Paper',                       hint: 'Academic or analytical paper.' },
  OTHER:           { label: 'Other Document',                       hint: 'Anything else.' },
};

// ── Universal upload tab — drops a file, the form follows ───────────

function UniversalUploadTab() {
  const [searchParams] = useSearchParams();
  const presetCountryId = searchParams.get('country') ?? undefined;
  const presetType = (searchParams.get('type') as DocType | null) ?? undefined;
  const presetMode: 'document' | null = presetType ? 'document' : null;

  const [file, setFile] = useState<File | null>(null);
  const kind = file ? classify(file) : null;

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }, []);

  const reset = () => setFile(null);

  return (
    <div className="space-y-6">
      {/* Pre-fill banner — set when navigating from PKPB index "Upload report" button */}
      {presetMode === 'document' && !file && (
        <div className="rounded-xl border border-[#D4A017]/30 bg-[#D4A017]/[0.06] p-4 text-sm">
          <p className="font-medium text-[#D4A017]">
            Ready to upload a {DOC_TYPE_LABELS[presetType!]?.label.toLowerCase()}.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            The country and document type will be pre-filled. Drop the PDF below.
          </p>
        </div>
      )}

      {/* Universal dropzone */}
      <Card className="bg-white/[0.03] border-gray-800 border-dashed rounded-2xl">
        <CardContent
          className="p-6 sm:p-8 text-center cursor-pointer"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
          onClick={() => document.getElementById('universal-file-input')?.click()}
        >
          <input
            id="universal-file-input"
            type="file"
            accept=".csv,.xlsx,.xls,.pdf,.docx,.doc,.pptx,.ppt,.txt,.html,.htm"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          {file ? (
            <div className="flex items-center justify-center gap-3">
              {kind === 'data' || kind === 'ayims' || kind === 'policies'
                ? <FileSpreadsheet className="h-8 w-8 text-[#D4A017]" />
                : <FileType2 className="h-8 w-8 text-[#D4A017]" />}
              <div className="text-left">
                <p className="font-semibold">{file.name}</p>
                <p className="text-sm text-gray-400">
                  {(file.size / 1024).toFixed(1)} KB ·{' '}
                  {kind === 'ayims' && <span className="text-[#D4A017]">AYIMS template → 54 indicators × years</span>}
                  {kind === 'policies' && <span className="text-violet-400">Policies database → CountryPolicy scoring</span>}
                  {kind === 'data' && <span className="text-emerald-400">Generic data file → manual mapping</span>}
                  {kind === 'document' && <span className="text-blue-400">Document → routing by country &amp; type</span>}
                  {kind === 'unknown' && <span className="text-amber-400">Unsupported file type</span>}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); reset(); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <Upload className="h-12 w-12 text-gray-500 mx-auto mb-3" />
              <p className="text-lg font-medium">Drop a file to upload</p>
              <p className="text-sm text-gray-400 mt-1">
                The form auto-routes by filename / type — you don't need to pick the destination yourself.
              </p>
              <div className="text-xs text-gray-500 mt-3 space-y-0.5 leading-relaxed">
                <p>• <span className="text-[#D4A017]">AYIMS template</span> (filename has "AYIMS") → fills 54 indicators × 20 years for one country</p>
                <p>• <span className="text-violet-400">Policies database</span> (filename has "Policies_Database") → scores 30 policy instruments per country</p>
                <p>• <span className="text-emerald-400">Generic CSV/XLSX</span> → manual column mapping</p>
                <p>• <span className="text-blue-400">PDF / DOCX / PPTX</span> → routed by country &amp; document type (PKPB report, country report, etc.)</p>
              </div>
              <p className="text-xs text-gray-600 mt-3">Max 25 MB for documents · 10 MB for data files · click to browse</p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Routes based on file type */}
      {file && kind === 'ayims' && <AyimsFlow file={file} onDone={reset} />}
      {file && kind === 'policies' && <PolicyFlow file={file} onDone={reset} />}
      {file && kind === 'data' && <DataFlow file={file} onDone={reset} />}
      {file && kind === 'document' && (
        <DocumentFlow
          file={file}
          onDone={reset}
          defaultCountryId={presetCountryId}
          defaultType={presetType}
        />
      )}
      {file && kind === 'unknown' && (
        <Card className="bg-amber-500/5 border-amber-500/30 rounded-2xl">
          <CardContent className="p-6">
            <p className="text-sm">
              <span className="font-semibold text-amber-400">Unsupported file type.</span>{' '}
              Use CSV/XLSX for indicator data, or PDF/DOCX/PPTX/TXT for reports and documents.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── DATA FLOW — original CSV/XLSX import path ───────────────────────

function DataFlow({ file, onDone }: { file: File; onDone: () => void }) {
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');
  const [countryColumn, setCountryColumn] = useState('Country');
  const [countryFormat, setCountryFormat] = useState<'name' | 'iso2' | 'iso3'>('name');
  const [year, setYear] = useState(2024);
  const [ageGroup, setAgeGroup] = useState('15-35');
  const [jobId, setJobId] = useState<string | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<any>(null);

  const handleUpload = async () => {
    if (!source) return;
    setUploading(true);
    setPreview(null);
    setCommitResult(null);
    try {
      const config = { countryColumn, countryFormat, mappings: [], source, notes: notes || undefined, year };
      const formData = new FormData();
      formData.append('file', file);
      formData.append('config', JSON.stringify(config));
      const res = await fetch(`${DATA_API}/file`, { method: 'POST', headers: authHeaders(), body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Upload failed');
      }
      const job = await res.json();
      setJobId(job.id);
      setPreview(job);
    } catch (err: any) {
      alert(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleCommit = async () => {
    if (!jobId) return;
    setCommitting(true);
    try {
      const res = await fetch(`${DATA_API}/commit/${jobId}`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Commit failed');
      setCommitResult(await res.json());
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCommitting(false);
    }
  };

  if (commitResult) {
    return (
      <Card className="bg-green-500/5 border-green-500/30 rounded-2xl">
        <CardContent className="p-6 text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
          <p className="text-xl font-bold">Import Complete</p>
          <p className="text-gray-400 mt-1">
            {commitResult.inserted} values inserted, {commitResult.skipped} skipped, {commitResult.errors} errors
          </p>
          <p className="text-xs text-gray-500 mt-2">Duration: {commitResult.duration}ms</p>
          <Button variant="outline" className="mt-4" onClick={onDone}>Upload Another File</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {!preview && (
        <Card className="bg-white/[0.03] border-gray-800 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Generic indicator import</CardTitle>
            <p className="text-xs text-gray-500 mt-1">
              For long-format CSV/XLSX files (one row per country with indicator columns). For AYIMS templates,
              drop the file again with "AYIMS" in the filename — the smart router will switch to the dedicated
              flow.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label>Source attribution *</Label>
                <p className="text-[11px] text-gray-500">
                  Cited under every chart that uses these values. Use the data publisher (e.g. World Bank,
                  UNESCO UIS, INE Angola).
                </p>
                <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. AYIMS / AU Commission" />
              </div>
              <div className="space-y-1.5">
                <Label>Country column name</Label>
                <p className="text-[11px] text-gray-500">
                  The header in your file that holds the country identifier. Case-insensitive.
                </p>
                <Input value={countryColumn} onChange={(e) => setCountryColumn(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Country format</Label>
                <p className="text-[11px] text-gray-500">
                  How country values are written in that column. ISO codes are most reliable.
                </p>
                <Select value={countryFormat} onValueChange={(v: any) => setCountryFormat(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Country name (e.g. "Nigeria")</SelectItem>
                    <SelectItem value="iso2">ISO 2-letter (e.g. "NG")</SelectItem>
                    <SelectItem value="iso3">ISO 3-letter (e.g. "NGA")</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Data year</Label>
                <p className="text-[11px] text-gray-500">
                  Year these values represent. Override on a per-column basis later if your file mixes years.
                </p>
                <Input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value) || 2024)} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Age group</Label>
                <p className="text-[11px] text-gray-500">
                  Age band the indicator covers. UN uses 15–24; AU youth statistics use 15–35.
                </p>
                <Select value={ageGroup} onValueChange={setAgeGroup}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15-24">15–24 (UN definition)</SelectItem>
                    <SelectItem value="15-35">15–35 (AU definition)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Notes (optional)</Label>
                <p className="text-[11px] text-gray-500">
                  Internal note — appears in upload history. Useful for data lineage.
                </p>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Q4 2025 refresh — World Bank WDI vintage Dec-2025" />
              </div>
            </div>
            <Button onClick={handleUpload} disabled={!source || uploading} className="gap-2">
              {uploading ? <Clock className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              {uploading ? 'Parsing…' : 'Preview import'}
            </Button>
          </CardContent>
        </Card>
      )}

      {preview && (
        <Card className="bg-white/[0.03] border-gray-800 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[#D4A017]" />
              Preview — {preview.summary?.valuesTotal || 0} values ready
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-white/[0.05] rounded-lg text-center">
                <p className="text-2xl font-bold text-[#D4A017]">{preview.summary?.validRows || 0}</p>
                <p className="text-xs text-gray-400">Valid Rows</p>
              </div>
              <div className="p-3 bg-white/[0.05] rounded-lg text-center">
                <p className="text-2xl font-bold">{preview.summary?.countriesMatched || 0}</p>
                <p className="text-xs text-gray-400">Countries Matched</p>
              </div>
              <div className="p-3 bg-white/[0.05] rounded-lg text-center">
                <p className="text-2xl font-bold">{preview.summary?.indicatorsMapped || 0}</p>
                <p className="text-xs text-gray-400">Indicators</p>
              </div>
              <div className="p-3 bg-white/[0.05] rounded-lg text-center">
                <p className="text-2xl font-bold">{preview.summary?.valuesTotal || 0}</p>
                <p className="text-xs text-gray-400">Total Values</p>
              </div>
            </div>

            {preview.errors?.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" /> {preview.errors.length} issues found
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {preview.errors.slice(0, 20).map((err: any, i: number) => (
                    <p key={i} className={`text-xs px-2 py-1 rounded ${err.severity === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
                      Row {err.row}: {err.message}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={handleCommit} disabled={committing || !preview.summary?.valuesTotal} className="gap-2">
              {committing ? <Clock className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              {committing ? 'Importing...' : `Commit ${preview.summary?.valuesTotal || 0} Values to Database`}
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}

// ── DOCUMENT FLOW — PKPB / report / policy / etc ────────────────────

function DocumentFlow({
  file,
  onDone,
  defaultCountryId,
  defaultType,
}: {
  file: File;
  onDone: () => void;
  defaultCountryId?: string;
  defaultType?: DocType;
}) {
  const queryClient = useQueryClient();
  const { data: countriesData } = useCountries();
  // useCountries returns either an array or a paginated wrapper depending on backend; normalize.
  const countries: any[] = useMemo(() => {
    if (!countriesData) return [];
    if (Array.isArray(countriesData)) return countriesData;
    if (Array.isArray((countriesData as any).data)) return (countriesData as any).data;
    return [];
  }, [countriesData]);

  // Auto-detect country from the filename: any African country whose name
  // appears as a token wins. We prefer the first whole-word match. Returns
  // the country.id (or undefined). The contributor can always override.
  // Real contributor filenames don't always use the official country name.
  // This alias map maps each common shorthand / French spelling / diacritic-
  // free variant → the ISO3 of the canonical country in our DB. Add new
  // entries as you encounter them. Keys must be lowercase and ASCII-only
  // (we ASCII-fold the filename before matching).
  const COUNTRY_ALIASES: Record<string, string> = {
    // Democratic Republic of the Congo
    'drc': 'COD', 'rdc': 'COD', 'dr congo': 'COD', 'drcongo': 'COD',
    'congo kinshasa': 'COD', 'congo drc': 'COD',
    // Republic of the Congo (Brazzaville) — distinct from DRC
    'congo brazzaville': 'COG',
    // Central African Republic
    'car': 'CAF', 'rca': 'CAF',
    // Cameroon — French spelling on the file is the most common case
    'cameroun': 'CMR',
    // São Tomé and Príncipe — diacritic-free variants
    'sao tome': 'STP', 'sao tome and principe': 'STP', 'stp': 'STP',
    // Eswatini (formerly Swaziland) — older docs still use the old name
    'swaziland': 'SWZ',
    // Côte d'Ivoire — English/diacritic-free variants
    'ivory coast': 'CIV', 'cote d ivoire': 'CIV', 'cote divoire': 'CIV',
    // Cape Verde alt spelling
    'cape verde': 'CPV',
    // Tanzania alt formal name
    'united republic of tanzania': 'TZA',
  };

  const stripDiacritics = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const normalize = (s: string) =>
    stripDiacritics(s).toLowerCase().replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();

  const detectCountryFromFilename = (
    fname: string,
    list: any[],
  ): string | undefined => {
    if (!list?.length) return undefined;
    const base = normalize(fname.replace(/\.[^.]+$/, ''));
    const padded = ` ${base} `;

    // 1. Alias match — try the longest aliases first so "sao tome and
    //    principe" wins over "sao tome", and a token must be surrounded by
    //    word boundaries (spaces) so "car" doesn't match "scarred".
    const aliasKeys = Object.keys(COUNTRY_ALIASES).sort((a, b) => b.length - a.length);
    for (const alias of aliasKeys) {
      if (padded.includes(` ${alias} `)) {
        const iso3 = COUNTRY_ALIASES[alias];
        // The hardcoded countries list uses `isoCode` for the 3-letter code;
        // API responses may use `isoCode3`. Try both.
        const found = list.find((c) => (c.isoCode === iso3) || (c.isoCode3 === iso3));
        if (found) return found.id;
      }
    }

    // 2. Whole-word name match — diacritics stripped on both sides so a
    //    file named "Sao_Tome_2026.html" matches the DB's "São Tomé and
    //    Príncipe", and longest names checked first so "South Africa" wins
    //    over "Africa" / "South".
    const sorted = [...list].sort((a, b) => b.name.length - a.name.length);
    for (const c of sorted) {
      const needle = ` ${normalize(c.name)} `;
      if (padded.includes(needle)) return c.id;
    }

    // 3. ISO3 / ISO2 token match (e.g. "AGO" or "AO" appearing as its own
    //    word in the original filename — case-insensitive).
    const upper = fname.replace(/\.[^.]+$/, '').toUpperCase();
    for (const c of sorted) {
      const iso3 = c.isoCode3 || c.isoCode;
      const iso2 = c.isoCode2;
      if (iso3 && new RegExp(`(^|[^A-Z])${iso3}([^A-Z]|$)`).test(upper)) return c.id;
      if (iso2 && new RegExp(`(^|[^A-Z])${iso2}([^A-Z]|$)`).test(upper)) return c.id;
    }
    return undefined;
  };

  const filenameYear = useMemo(() => {
    const m = file.name.match(/\b(20\d{2})\b/);
    return m ? parseInt(m[1], 10) : new Date().getFullYear();
  }, [file.name]);

  const suggestedEdition = useMemo(() => {
    // Common PKPB edition format: "Mon Year · Vol 01" — we only know the year, so
    // we suggest "{Year} · Vol 01" and let the contributor refine month/volume.
    return `${filenameYear} · Vol 01`;
  }, [filenameYear]);

  const [countryId, setCountryId] = useState<string>(defaultCountryId ?? '');
  // Once countries load, pre-fill from the filename if the contributor hasn't picked one yet.
  React.useEffect(() => {
    if (!countryId && countries.length) {
      const detected = detectCountryFromFilename(file.name, countries);
      if (detected) setCountryId(detected);
    }
    // Intentional: only run when countries arrive or file changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countries.length, file.name]);

  const selectedCountry = countries.find((c) => c.id === countryId);

  const [type, setType] = useState<DocType>(
    () => defaultType ?? suggestDocType(file, null),
  );
  // Once a country is picked, refine the suggestion (only when no explicit defaultType — don't override the user's intent).
  const refineType = (cid: string) => {
    if (defaultType) return;
    const c = countries.find((x) => x.id === cid);
    if (c) setType(suggestDocType(file, c.name));
  };

  const [title, setTitle] = useState(file.name.replace(/\.[^.]+$/, ''));
  const [description, setDescription] = useState('');
  // PKPB convention: PACSDA / AfriYouthStats Hub publishes most country reports.
  // Contributor can override on the form.
  const [source, setSource] = useState('PACSDA / AfriYouthStats Hub');
  const [edition, setEdition] = useState(suggestedEdition);
  const [year, setYear] = useState<number | ''>(filenameYear);

  // PKPB structured summary — guided form when type=PKPB_REPORT
  const [pkpbValue, setPkpbValue] = useState<PkpbGuidedValue>(emptyPkpbValue());
  const [showSummaryEditor, setShowSummaryEditor] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [serverProcessing, setServerProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const requiresCountry = type === 'PKPB_REPORT';
  const canSubmit = !!title && (!requiresCountry || !!countryId);

  const handleSubmit = async () => {
    setUploading(true);
    setError(null);
    setResult(null);
    setProgress({ loaded: 0, total: file.size, percent: 0, elapsedMs: 0, bytesPerSec: 0, etaMs: null });
    setServerProcessing(false);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', type);
      fd.append('title', title);
      if (description) fd.append('description', description);
      if (countryId) fd.append('countryId', countryId);
      if (source) fd.append('source', source);
      if (edition) fd.append('edition', edition);
      if (year) fd.append('year', String(year));

      // For PKPB uploads, serialize the guided form into the extractedSummary JSON
      // the API expects. Skip empty arrays so the merge logic falls back to the
      // parametric defaults for fields the contributor left blank.
      if (type === 'PKPB_REPORT' && showSummaryEditor) {
        const summary: any = {};
        if (pkpbValue.edition) summary.edition = pkpbValue.edition;
        if (pkpbValue.reviewedDate) summary.reviewedDate = pkpbValue.reviewedDate;
        if (pkpbValue.nextReview) summary.nextReview = pkpbValue.nextReview;
        if (typeof pkpbValue.ayemiScore === 'number') summary.ayemiScore = pkpbValue.ayemiScore;
        if (pkpbValue.ayemiTier) summary.ayemiTier = pkpbValue.ayemiTier;
        if (pkpbValue.executiveBrief) summary.executiveBrief = pkpbValue.executiveBrief;
        if (pkpbValue.pullQuote) summary.pullQuote = pkpbValue.pullQuote;
        if (pkpbValue.postQuote) summary.postQuote = pkpbValue.postQuote;
        if (pkpbValue.promiseKept.length) summary.promiseKept = pkpbValue.promiseKept;
        if (pkpbValue.promiseBroken.length) summary.promiseBroken = pkpbValue.promiseBroken;
        if (pkpbValue.recommendations.length) summary.recommendations = pkpbValue.recommendations;
        if (pkpbValue.legislation.length) summary.legislation = pkpbValue.legislation;
        if (Object.keys(summary).length > 0) fd.append('extractedSummary', JSON.stringify(summary));
      }

      const res = await xhrUpload<any>({
        url: DOCS_API,
        body: fd,
        headers: authHeaders(),
        onProgress: (p) => {
          setProgress(p);
          // Once the bytes are out the door, the server is doing PDF/HTML text
          // extraction + R2 upload + DB insert. Show that state until the response.
          if (p.percent >= 100) setServerProcessing(true);
        },
      });
      setResult(res);

      // Drop every cache that depends on the documents collection so the PKPB
      // index, contributor reports list, country list, and per-country PKPB
      // page all refetch the moment the contributor visits them. Without this
      // the user sees stale "Awaiting upload" badges right after a successful
      // upload.
      queryClient.invalidateQueries({ queryKey: ['pkpb-index'] });
      queryClient.invalidateQueries({ queryKey: ['contributor-documents'] });
      queryClient.invalidateQueries({ queryKey: ['pkpb-by-country'] });
      if (res?.country?.name) {
        const slug = res.country.name.toLowerCase().replace(/\s+/g, '-');
        queryClient.invalidateQueries({ queryKey: ['pkpb', slug] });
        queryClient.invalidateQueries({ queryKey: ['pkpb', res.country.id] });
      }
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      setServerProcessing(false);
    }
  };

  if (result) {
    const isPkpb = result.type === 'PKPB_REPORT';
    const countrySlug = result.country?.name?.toLowerCase().replace(/\s+/g, '-');
    return (
      <Card className="bg-green-500/5 border-green-500/30 rounded-2xl">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle className="h-6 w-6 text-green-500" />
            <p className="text-lg font-bold">Document uploaded</p>
          </div>
          <p className="text-sm text-gray-400">
            "{result.title}" routed as <Badge variant="secondary" className="ml-1">{DOC_TYPE_LABELS[result.type as DocType]?.label || result.type}</Badge>
            {result.country && <> &nbsp;→&nbsp; <span className="font-medium text-white">{result.country.name}</span></>}.
          </p>
          {result.extractedSummary && (
            <p className="text-xs text-emerald-300 mt-2">Structured summary saved · feeds the country report card.</p>
          )}
          <div className="flex flex-wrap gap-2 mt-4">
            <a href={`${DOCS_API}/${result.id}/download`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5"><Download className="h-3.5 w-3.5" /> Download original</Button>
            </a>
            {isPkpb && countrySlug && (
              <Link to={`/dashboard/pkpb/${countrySlug}`}>
                <Button size="sm" className="gap-1.5"><ExternalLink className="h-3.5 w-3.5" /> View PKPB page</Button>
              </Link>
            )}
            <Button variant="ghost" size="sm" onClick={onDone}>Upload another</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/[0.03] border-gray-800 rounded-2xl">
      <CardHeader>
        <CardTitle className="text-base">Document details</CardTitle>
        <p className="text-xs text-gray-400 mt-1">{DOC_TYPE_LABELS[type].hint}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Document type *</Label>
            <p className="text-[11px] text-gray-500">
              Determines where this file shows up. PKPB reports drive the Promise Kept · Promise Broken
              page; country reports show on the country profile; policy and research docs land in the
              public Reports library.
            </p>
            <Select value={type} onValueChange={(v: DocType) => setType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(DOC_TYPE_LABELS) as DocType[]).map((t) => (
                  <SelectItem key={t} value={t}>{DOC_TYPE_LABELS[t].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Country {requiresCountry && '*'}</Label>
            <p className="text-[11px] text-gray-500">
              Routes this document to the country's profile/PKPB page. Required for PKPB reports; optional
              for general research papers.
            </p>
            <Select
              value={countryId}
              onValueChange={(v) => { setCountryId(v); refineType(v); }}
            >
              <SelectTrigger><SelectValue placeholder="Select a country…" /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {countries.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.flagEmoji ? `${c.flagEmoji} ` : ''}{c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Title *</Label>
            <p className="text-[11px] text-gray-500">
              Public-facing title shown in lists and on the report page. Defaults to the filename without
              extension.
            </p>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Promise Kept · Promise Broken — Nigeria 2025" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Description</Label>
            <p className="text-[11px] text-gray-500">
              One- or two-sentence summary used on the document card and search results.
            </p>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Brief summary of the report's scope and findings." />
          </div>
          <div className="space-y-1.5">
            <Label>Source / publisher</Label>
            <p className="text-[11px] text-gray-500">
              The organisation that produced the document. Cited under the title.
            </p>
            <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="PACSDA / AfriYouthStats" />
          </div>
          <div className="space-y-1.5">
            <Label>Edition</Label>
            <p className="text-[11px] text-gray-500">
              Edition or version label. Shown as a small chip on the document.
            </p>
            <Input value={edition} onChange={(e) => setEdition(e.target.value)} placeholder="Dec 2025 · Vol 01" />
          </div>
          <div className="space-y-1.5">
            <Label>Year</Label>
            <p className="text-[11px] text-gray-500">
              Publication year. Used for sorting "latest report" lookups.
            </p>
            <Input type="number" value={year} onChange={(e) => setYear(e.target.value ? parseInt(e.target.value, 10) : '')} />
          </div>
        </div>

        {type === 'PKPB_REPORT' && (
          <div className="rounded-md border border-white/[0.08] p-4 bg-white/[0.02]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <button
                  type="button"
                  className="text-sm font-medium text-gray-200 hover:text-white flex items-center gap-2"
                  onClick={() => setShowSummaryEditor((s) => !s)}
                >
                  <FileText className="h-3.5 w-3.5 text-[#D4A017]" />
                  {showSummaryEditor ? 'Hide guided report-card editor' : 'Fill out report-card content (recommended)'}
                </button>
                <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                  Without this, the country PKPB page falls back to placeholder narrative + indicators (or
                  the parametric defaults from <code>countryReports.ts</code>). Filling these fields
                  populates the cover gauge, Promise Kept / Broken split, legislation table, and
                  recommendations — same layout as the Nigeria page. Each field has a hint underneath.
                </p>
              </div>
            </div>
            {showSummaryEditor && (
              <div className="mt-4">
                <PkpbGuidedForm value={pkpbValue} onChange={setPkpbValue} />
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">{error}</div>
        )}

        {uploading && progress && (
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-gray-400 tabular-nums">
              <span>
                {serverProcessing ? (
                  <>Server processing — extracting text, storing to R2, writing record…</>
                ) : (
                  <>
                    Uploading <span className="text-white">{formatBytes(progress.loaded)}</span> / {formatBytes(progress.total)}
                  </>
                )}
              </span>
              <span>
                {serverProcessing ? '—' : `${progress.percent}% · ETA ${formatEta(progress.etaMs)}`}
              </span>
            </div>
            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${serverProcessing ? 'bg-emerald-400 animate-pulse' : 'bg-[#D4A017]'}`}
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button onClick={handleSubmit} disabled={!canSubmit || uploading} className="gap-2">
            {uploading ? <Clock className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? (serverProcessing ? 'Processing…' : 'Uploading…') : 'Upload document'}
          </Button>
          {requiresCountry && !countryId && (
            <span className="text-xs text-amber-400">PKPB reports need a country selection.</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── REPORTS / DOCUMENTS LIST TAB ───────────────────────────────────

function ReportsTab() {
  const { data: docs, isLoading } = useQuery({
    queryKey: ['documents-list'],
    queryFn: () => fetchAuth(`${DOCS_API}?limit=100`),
    refetchInterval: 30000,
  });

  if (isLoading) return <Skeleton className="h-60 w-full" />;
  if (!docs?.length) {
    return (
      <div className="text-center py-16 text-gray-500">
        <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p className="text-lg font-medium">No documents uploaded yet</p>
        <p className="text-sm mt-1">Drop a PDF or DOCX in the Upload tab — it'll route by country and type.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="text-left py-3 px-2">Title</th>
            <th className="text-left py-3 px-2">Type</th>
            <th className="text-left py-3 px-2">Country</th>
            <th className="text-left py-3 px-2">Source</th>
            <th className="text-left py-3 px-2">Year</th>
            <th className="text-right py-3 px-2">Size</th>
            <th className="text-right py-3 px-2"></th>
          </tr>
        </thead>
        <tbody>
          {docs.map((d: any) => {
            const slug = d.country?.name?.toLowerCase().replace(/\s+/g, '-');
            return (
              <tr key={d.id} className="border-b border-gray-800/50 hover:bg-white/[0.03]">
                <td className="py-2 px-2 font-medium">{d.title}</td>
                <td className="py-2 px-2">
                  <Badge variant="secondary" className="text-[10px]">{DOC_TYPE_LABELS[d.type as DocType]?.label || d.type}</Badge>
                </td>
                <td className="py-2 px-2 text-gray-400">{d.country?.name || '—'}</td>
                <td className="py-2 px-2 text-gray-400">{d.source || '—'}</td>
                <td className="py-2 px-2 text-gray-400">{d.year || '—'}</td>
                <td className="py-2 px-2 text-right text-gray-500 font-mono text-xs">{(d.fileSize / 1024).toFixed(0)} KB</td>
                <td className="py-2 px-2 text-right space-x-2">
                  {d.type === 'PKPB_REPORT' && slug && (
                    <Link to={`/dashboard/pkpb/${slug}`} className="text-xs text-[#D4A017] hover:underline">View page</Link>
                  )}
                  <a
                    href={`${DOCS_API}/${d.id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-300 hover:text-white inline-flex items-center gap-1"
                  >
                    <Download className="h-3 w-3" /> Download
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Needs Tab (unchanged) ─────────────────────────────────────────

function NeedsTab() {
  const { data: needs, isLoading } = useQuery({
    queryKey: ['data-needs'],
    queryFn: () => fetchAuth(`${DATA_API}/needed`),
  });
  if (isLoading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  return (
    <div className="space-y-6">
      {needs?.summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Card className="bg-red-500/5 border-red-500/20 rounded-2xl">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-400">{needs.summary.byPriority.high}</p>
              <p className="text-xs text-gray-400">High Priority Gaps</p>
            </CardContent>
          </Card>
          <Card className="bg-amber-500/5 border-amber-500/20 rounded-2xl">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-400">{needs.summary.byPriority.medium}</p>
              <p className="text-xs text-gray-400">Medium Priority</p>
            </CardContent>
          </Card>
          <Card className="bg-green-500/5 border-green-500/20 rounded-2xl">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-400">{needs.summary.byPriority.low}</p>
              <p className="text-xs text-gray-400">Low Priority</p>
            </CardContent>
          </Card>
        </div>
      )}
      {needs?.byTheme?.map((theme: any) => (
        <Card key={theme.slug} className="bg-white/[0.03] border-gray-800 rounded-2xl">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{theme.theme}</CardTitle>
              <Badge variant={theme.completeness < 0.3 ? 'destructive' : theme.completeness < 0.7 ? 'secondary' : 'default'}>
                {Math.round(theme.completeness * 100)}% complete
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {theme.missingIndicators?.length > 0 ? (
              <div className="space-y-2">
                {theme.missingIndicators.slice(0, 5).map((ind: any) => (
                  <div key={ind.slug} className="flex items-center justify-between text-sm py-1 border-b border-gray-800/50 last:border-0">
                    <div>
                      <p className="font-medium">{ind.name}</p>
                      <p className="text-xs text-gray-500">{ind.countriesMissing} countries missing</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${ind.priority === 'high' ? 'text-red-400 border-red-400/30' : ind.priority === 'medium' ? 'text-amber-400 border-amber-400/30' : 'text-green-400 border-green-400/30'}`}>
                      {ind.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-500">All indicators have good coverage</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Templates Tab (unchanged shape) ───────────────────────────────

function TemplatesTab() {
  const { data: templates, isLoading } = useQuery({
    queryKey: ['upload-templates'],
    queryFn: () => fetchAuth(`${DATA_API}/templates`),
  });

  const handleDownload = (slug: string) => {
    fetch(`${DATA_API}/templates/${slug}`, { headers: authHeaders() })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${slug}-template.csv`;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  if (isLoading) return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1,2,3].map(i => <Skeleton key={i} className="h-40" />)}</div>;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {(templates || []).map((t: any) => (
        <Card key={t.slug} className={`bg-white/[0.03] border-gray-800 rounded-2xl ${t.slug === 'full-ayims' ? 'border-[#D4A017]/40' : ''}`}>
          <CardContent className="p-5 flex flex-col h-full">
            <div className="flex items-start justify-between mb-2">
              <FileText className="h-6 w-6 text-[#D4A017]" />
              {t.slug === 'full-ayims' && <Badge className="bg-[#D4A017]/15 text-[#D4A017] border-[#D4A017]/30 text-[10px]">Recommended</Badge>}
            </div>
            <h3 className="font-semibold text-sm mb-1">{t.name}</h3>
            <p className="text-xs text-gray-400 mb-3 flex-grow">{t.description || `${t.indicatorCount} indicators`}</p>
            <p className="text-[10px] text-gray-500 mb-3">{t.columns?.slice(0, 5).join(', ')}{t.columns?.length > 5 ? '...' : ''}</p>
            <Button variant="outline" size="sm" className="w-full gap-1" onClick={() => handleDownload(t.slug)}>
              <Download className="h-3 w-3" /> Download CSV
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── History Tab (unchanged) ────────────────────────────────────────

// Persistent history — pulls from /api/data-upload/history which now reads
// from the UploadAudit table (DB-backed), so the list survives API restarts
// and reflects every commit by every contributor.

const KIND_LABELS: Record<string, { label: string; color: string }> = {
  AYIMS_TEMPLATE:    { label: 'AYIMS template',    color: '#D4A017' },
  POLICIES_DATABASE: { label: 'Policies database', color: '#A855F7' },
  DOCUMENT:          { label: 'Document / PKPB',   color: '#3B82F6' },
  GENERIC_DATA:      { label: 'Generic data',      color: '#22C55E' },
};

function HistoryTab() {
  const { data: history, isLoading } = useQuery<any[]>({
    queryKey: ['upload-history'],
    queryFn: () => fetchAuth(`${DATA_API}/history`),
    refetchInterval: 30000,
  });

  if (isLoading) return <Skeleton className="h-60 w-full" />;
  if (!history?.length) {
    return (
      <div className="text-center py-16 text-gray-500">
        <Clock className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p className="text-lg font-medium">No uploads yet</p>
        <p className="text-sm mt-1">Your upload history will appear here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="text-left py-3 px-2">When</th>
            <th className="text-left py-3 px-2">Kind</th>
            <th className="text-left py-3 px-2">File</th>
            <th className="text-left py-3 px-2">Country</th>
            <th className="text-left py-3 px-2">Source</th>
            <th className="text-left py-3 px-2">By</th>
            <th className="text-center py-3 px-2">Status</th>
            <th className="text-right py-3 px-2">Rows</th>
          </tr>
        </thead>
        <tbody>
          {history.map((h: any) => {
            const k = KIND_LABELS[h.kind] ?? { label: h.kind, color: '#6B7280' };
            const when = new Date(h.uploadedAt);
            return (
              <tr key={h.id} className="border-b border-gray-800/50 hover:bg-white/[0.03]">
                <td className="py-2 px-2 text-gray-400 whitespace-nowrap">
                  {when.toLocaleDateString()} <span className="text-gray-600">{when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </td>
                <td className="py-2 px-2">
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider" style={{ background: `${k.color}20`, color: k.color }}>
                    {k.label}
                  </span>
                </td>
                <td className="py-2 px-2 font-medium max-w-[280px] truncate" title={h.fileName}>{h.fileName}</td>
                <td className="py-2 px-2 text-gray-400">{h.country?.name ?? '—'}</td>
                <td className="py-2 px-2 text-gray-400 max-w-[200px] truncate" title={h.source ?? ''}>{h.source ?? '—'}</td>
                <td className="py-2 px-2 text-gray-500">{h.uploadedBy?.name || h.uploadedBy?.email?.split('@')[0] || '—'}</td>
                <td className="py-2 px-2 text-center">
                  <Badge
                    variant={h.status === 'SUCCESS' ? 'default' : h.status === 'PARTIAL' ? 'secondary' : 'destructive'}
                    className="text-[10px]"
                  >
                    {h.status?.toLowerCase()}
                  </Badge>
                </td>
                <td className="py-2 px-2 text-right font-mono tabular-nums">{(h.rowsAffected ?? 0).toLocaleString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────

const VALID_TABS = ['upload', 'reports', 'needed', 'templates', 'history'] as const;
type TabKey = (typeof VALID_TABS)[number];

const DataUpload = () => {
  useAuth(); // gates the route via AuthRequired upstream
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as TabKey | null;
  const activeTab: TabKey = tabParam && (VALID_TABS as readonly string[]).includes(tabParam) ? tabParam : 'upload';

  const handleTabChange = (next: string) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'upload') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="min-h-screen">
      <div className="relative py-6 sm:py-8 md:py-12 overflow-hidden">
        <div className="absolute inset-0 opacity-30 w-full bg-[linear-gradient(to_right,#333_1px,transparent_1px),linear-gradient(to_bottom,#333_1px,transparent_1px)] bg-[size:6rem_5rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
        <div className="container px-4 md:px-6 relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Upload className="h-7 w-7 sm:h-8 sm:w-8 text-[#D4A017]" />
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tighter bg-gradient-to-br from-[#D4A017] from-10% via-white via-40% to-white/40 bg-clip-text text-transparent">
              Contributor Hub
            </h1>
          </div>
          <p className="text-sm sm:text-base text-[#A89070]">
            Upload indicator data, country reports, and policy documents. The form auto-routes by file type and country.
          </p>
        </div>
      </div>

      <div className="container px-4 md:px-6 pb-12">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
            <TabsList className="bg-white/[0.05] border border-gray-800 inline-flex w-max md:w-auto">
              <TabsTrigger value="upload" className="gap-1.5 whitespace-nowrap"><Upload className="h-3.5 w-3.5" /> Upload</TabsTrigger>
              <TabsTrigger value="reports" className="gap-1.5 whitespace-nowrap"><FileType2 className="h-3.5 w-3.5" /> Reports & Documents</TabsTrigger>
              <TabsTrigger value="needed" className="gap-1.5 whitespace-nowrap"><AlertTriangle className="h-3.5 w-3.5" /> What's Needed</TabsTrigger>
              <TabsTrigger value="templates" className="gap-1.5 whitespace-nowrap"><FileText className="h-3.5 w-3.5" /> Templates</TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5 whitespace-nowrap"><Clock className="h-3.5 w-3.5" /> History</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="upload"><UniversalUploadTab /></TabsContent>
          <TabsContent value="reports"><ReportsTab /></TabsContent>
          <TabsContent value="needed"><NeedsTab /></TabsContent>
          <TabsContent value="templates"><TemplatesTab /></TabsContent>
          <TabsContent value="history"><HistoryTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default DataUpload;
