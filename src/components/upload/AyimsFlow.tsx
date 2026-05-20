import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, BarChart3, Database, CheckCircle, AlertTriangle, Info, FileSpreadsheet } from 'lucide-react';
import { authHeader } from '@/lib/supabase-token';
import { useCountries } from '@/hooks/useData';
import { xhrUpload, formatBytes, formatEta, type UploadProgress } from '@/lib/xhrUpload';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const DATA_API = `${API_BASE}/data-upload`;

interface AyimsFlowProps {
  file: File;
  onDone: () => void;
}

/**
 * AYIMS Data Entry Template upload flow.
 *
 * The server detects the country from the filename or sheet metadata, parses
 * the wide-format template, and produces an UploadJob. We then surface a
 * preview and commit button. The UI is intentionally minimal — most settings
 * are inferred from the template structure.
 */
const AyimsFlow: React.FC<AyimsFlowProps> = ({ file, onDone }) => {
  const { data: countriesData } = useCountries();
  const countries: any[] = useMemo(() => {
    if (!countriesData) return [];
    if (Array.isArray(countriesData)) return countriesData;
    if (Array.isArray((countriesData as any).data)) return (countriesData as any).data;
    return [];
  }, [countriesData]);

  // Radix Select rejects empty-string item values, so we use a sentinel for "auto-detect"
  // and only forward a real country id to the API when one is selected.
  const AUTO = '__auto__';
  const [overrideCountryId, setOverrideCountryId] = useState<string>(AUTO);
  const [source, setSource] = useState('AYIMS / AU Commission');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [parseProgress, setParseProgress] = useState<UploadProgress | null>(null);
  const [parseProcessing, setParseProcessing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitProgress, setCommitProgress] = useState<{
    current: number;
    total: number;
    percent: number;
    etaMs: number | null;
  } | null>(null);
  const [job, setJob] = useState<any>(null);
  const [commitResult, setCommitResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleParse = async () => {
    setUploading(true);
    setJob(null);
    setError(null);
    setCommitResult(null);
    setParseProgress({ loaded: 0, total: file.size, percent: 0, elapsedMs: 0, bytesPerSec: 0, etaMs: null });
    setParseProcessing(false);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (overrideCountryId && overrideCountryId !== AUTO) fd.append('countryId', overrideCountryId);
      if (source) fd.append('source', source);
      if (notes) fd.append('notes', notes);
      const res = await xhrUpload<any>({
        url: `${DATA_API}/ayims-template`,
        body: fd,
        headers: authHeader(),
        onProgress: (p) => {
          setParseProgress(p);
          if (p.percent >= 100) setParseProcessing(true);
        },
      });
      setJob(res);
    } catch (err: any) {
      setError(err.message || 'Parse failed');
    } finally {
      setUploading(false);
      setParseProcessing(false);
    }
  };

  const handleCommit = async () => {
    if (!job?.id) return;
    setCommitting(true);
    setCommitProgress({ current: 0, total: job.summary?.valuesTotal ?? 0, percent: 0, etaMs: null });

    // Poll commit-status while the commit fetch is in-flight so the user sees
    // progress + ETA. The poll hits the same in-memory job the commit is updating.
    const poll = setInterval(async () => {
      try {
        const r = await fetch(`${DATA_API}/commit-status/${job.id}`, { headers: authHeader() });
        if (!r.ok) return;
        const s = await r.json();
        if (s?.progress) setCommitProgress(s.progress);
      } catch {
        /* transient — keep polling */
      }
    }, 600);

    try {
      const res = await fetch(`${DATA_API}/commit/${job.id}`, {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCommitResult(await res.json());
    } catch (err: any) {
      setError(err.message || 'Commit failed');
    } finally {
      clearInterval(poll);
      setCommitting(false);
    }
  };

  const fmtEta = (ms: number | null | undefined): string => {
    if (!ms || ms < 0) return '—';
    const sec = Math.ceil(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${min}m ${rem}s`;
  };

  if (commitResult) {
    return (
      <Card className="bg-green-500/5 border-green-500/30 rounded-2xl">
        <CardContent className="p-6 text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
          <p className="text-xl font-bold">AYIMS template committed for {job?.ayims?.detectedCountry}</p>
          <p className="text-gray-400 mt-1">
            {commitResult.inserted} values inserted · {commitResult.skipped} skipped · {commitResult.errors} errors
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Duration: {commitResult.duration}ms — every page tied to these indicators (Themes, Compare, Youth Index, country profile) now reflects the new data.
          </p>
          <Button variant="outline" className="mt-4" onClick={onDone}>Upload another file</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Banner — explains what's happening */}
      <Card className="bg-[#D4A017]/[0.06] border-[#D4A017]/30 rounded-2xl">
        <CardContent className="p-4 flex gap-3">
          <FileSpreadsheet className="h-5 w-5 text-[#D4A017] flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-[#D4A017]">Detected: AYIMS Data Entry Template</p>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              This template covers <strong>54 indicators × 20 years</strong> for one country. The country
              is auto-detected from the filename. We'll extract every cell, map each column to an AYO
              indicator (with gender / age-group splits where applicable), and insert one IndicatorValue
              row per (year × indicator). After commit, every page tied to these indicators updates live.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Config — only the fields the contributor really needs to fill */}
      {!job && (
        <Card className="bg-white/[0.03] border-gray-800 rounded-2xl">
          <CardHeader><CardTitle className="text-base">Confirm details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Country override (optional)</Label>
              <p className="text-[11px] text-gray-500">
                Leave blank to let the parser detect the country from the filename — e.g.{' '}
                <code className="text-gray-400">{file.name}</code> would be parsed as the country before the
                first underscore. Pick a country here only if the filename is non-standard.
              </p>
              <Select value={overrideCountryId} onValueChange={setOverrideCountryId}>
                <SelectTrigger><SelectValue placeholder="Auto-detect from filename" /></SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value={AUTO}>Auto-detect from filename</SelectItem>
                  {countries.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.flagEmoji ? `${c.flagEmoji} ` : ''}{c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Source attribution *</Label>
              <p className="text-[11px] text-gray-500">
                Where this data comes from. Used as the citation on every chart and table that shows
                these values. Default is fine for AYIMS templates.
              </p>
              <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. AYIMS / AU Commission" />
            </div>

            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <p className="text-[11px] text-gray-500">
                Internal note — visible in upload history. Useful for tracking which iteration of the
                template this was, who collected the data, or known caveats.
              </p>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Rev 2 — fixes for INE Censo 2024 release" />
            </div>

            {uploading && parseProgress && (
              <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-gray-400 tabular-nums">
                  <span>
                    {parseProcessing ? (
                      <>Server parsing — reading sheet, mapping indicators, checking countries…</>
                    ) : (
                      <>Uploading <span className="text-white">{formatBytes(parseProgress.loaded)}</span> / {formatBytes(parseProgress.total)}</>
                    )}
                  </span>
                  <span>{parseProcessing ? '—' : `${parseProgress.percent}% · ETA ${formatEta(parseProgress.etaMs)}`}</span>
                </div>
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${parseProcessing ? 'bg-emerald-400 animate-pulse' : 'bg-[#D4A017]'}`}
                    style={{ width: `${parseProgress.percent}%` }}
                  />
                </div>
              </div>
            )}

            <Button onClick={handleParse} disabled={uploading || !source.trim()} className="gap-2">
              {uploading ? <Clock className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
              {uploading ? (parseProcessing ? 'Parsing…' : 'Uploading…') : 'Parse template'}
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="bg-red-500/5 border-red-500/30 rounded-2xl">
          <CardContent className="p-4 text-sm text-red-400 flex gap-2 items-start">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>{error}</div>
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {job && (
        <Card className="bg-white/[0.03] border-gray-800 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[#D4A017]" />
              Preview — {job.summary?.valuesTotal || 0} values for {job.ayims?.detectedCountry}
            </CardTitle>
            <p className="text-xs text-gray-500">
              {job.ayims?.yearsCovered?.length} years covered · {job.summary?.indicatorsMapped} indicators mapped
              {job.ayims?.skippedColumns?.length ? ` · ${job.ayims.skippedColumns.length} columns skipped` : ''}
              {job.ayims?.unmappedColumns?.length ? ` · ${job.ayims.unmappedColumns.length} unrecognized` : ''}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-white/[0.05] rounded-lg text-center">
                <p className="text-2xl font-bold text-[#D4A017]">{job.summary?.valuesTotal || 0}</p>
                <p className="text-xs text-gray-400">Values to insert</p>
              </div>
              <div className="p-3 bg-white/[0.05] rounded-lg text-center">
                <p className="text-2xl font-bold">{job.summary?.indicatorsMapped || 0}</p>
                <p className="text-xs text-gray-400">Indicators</p>
              </div>
              <div className="p-3 bg-white/[0.05] rounded-lg text-center">
                <p className="text-2xl font-bold">{job.ayims?.yearsCovered?.length || 0}</p>
                <p className="text-xs text-gray-400">Years</p>
              </div>
              <div className="p-3 bg-white/[0.05] rounded-lg text-center">
                <p className="text-2xl font-bold">{job.errors?.length || 0}</p>
                <p className="text-xs text-gray-400">Issues</p>
              </div>
            </div>

            {job.ayims?.unmappedColumns?.length > 0 && (
              <div className="text-xs">
                <p className="text-amber-400 font-medium mb-1 flex items-center gap-1">
                  <Info className="h-3 w-3" /> Unrecognized columns (no destination):
                </p>
                <p className="text-gray-400 leading-relaxed">{job.ayims.unmappedColumns.join(' · ')}</p>
                <p className="text-gray-500 mt-1 italic">These cells will be ignored on commit. Update <code>ayims-template-mapping.json</code> to add them.</p>
              </div>
            )}

            {job.ayims?.skippedColumns?.length > 0 && (
              <div className="text-xs">
                <p className="text-gray-400 font-medium mb-1">Intentionally skipped columns (text/categorical):</p>
                <p className="text-gray-500 leading-relaxed">{job.ayims.skippedColumns.join(' · ')}</p>
              </div>
            )}

            {job.errors?.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" /> {job.errors.length} issues
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {job.errors.slice(0, 12).map((err: any, i: number) => (
                    <p key={i} className={`text-xs px-2 py-1 rounded ${err.severity === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
                      Row {err.row} · {err.column}: {err.message}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {job.preview?.mappedPreview?.length > 0 && (
              <div className="overflow-x-auto">
                <p className="text-xs text-gray-500 mb-1">Sample of values to be inserted:</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-1.5 px-2">Indicator</th>
                      <th className="text-left py-1.5 px-2">Year</th>
                      <th className="text-right py-1.5 px-2">Value</th>
                      <th className="text-left py-1.5 px-2">Gender</th>
                    </tr>
                  </thead>
                  <tbody>
                    {job.preview.mappedPreview.slice(0, 12).map((r: any, i: number) => (
                      <tr key={i} className="border-b border-gray-800/50">
                        <td className="py-1 px-2 text-gray-300">{r.indicator}</td>
                        <td className="py-1 px-2 text-gray-400">{r.year}</td>
                        <td className="py-1 px-2 text-right font-mono">{Number(r.value).toLocaleString()}</td>
                        <td className="py-1 px-2"><Badge variant="secondary" className="text-[10px]">{r.gender}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {committing && commitProgress && (
              <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-gray-400 tabular-nums">
                  <span>
                    Inserting <span className="text-white">{commitProgress.current.toLocaleString()}</span> / {commitProgress.total.toLocaleString()} values
                  </span>
                  <span>
                    {commitProgress.percent}% · ETA {fmtEta(commitProgress.etaMs)}
                  </span>
                </div>
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#D4A017] transition-all"
                    style={{ width: `${commitProgress.percent}%` }}
                  />
                </div>
              </div>
            )}

            <Button onClick={handleCommit} disabled={committing || !job.summary?.valuesTotal} className="gap-2">
              {committing ? <Clock className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              {committing ? 'Importing…' : `Commit ${job.summary?.valuesTotal || 0} values for ${job.ayims?.detectedCountry}`}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AyimsFlow;
