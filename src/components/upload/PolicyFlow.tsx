import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Clock, Shield, Database, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { authHeader } from '@/lib/supabase-token';
import { xhrUpload, formatBytes, formatEta, type UploadProgress } from '@/lib/xhrUpload';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const DATA_API = `${API_BASE}/data-upload`;

interface PolicyFlowProps {
  file: File;
  onDone: () => void;
}

/**
 * African National Youth Policies Database upload flow.
 *
 * The server applies the AYC Composite Policy Index scoring rules
 * (status × recency, with a legal-anchoring bonus) to each policy column,
 * resolves countries against the AYO database, and produces one
 * CountryPolicy record per (country × policy type).
 */
const PolicyFlow: React.FC<PolicyFlowProps> = ({ file, onDone }) => {
  const [source, setSource] = useState('African National Youth Policies Database (PACSDA)');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [parseProgress, setParseProgress] = useState<UploadProgress | null>(null);
  const [serverProcessing, setServerProcessing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [job, setJob] = useState<any>(null);
  const [commitResult, setCommitResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleParse = async () => {
    setUploading(true);
    setJob(null);
    setError(null);
    setCommitResult(null);
    setParseProgress({ loaded: 0, total: file.size, percent: 0, elapsedMs: 0, bytesPerSec: 0, etaMs: null });
    setServerProcessing(false);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (source) fd.append('source', source);
      if (notes) fd.append('notes', notes);
      const res = await xhrUpload<any>({
        url: `${DATA_API}/policies-database`,
        body: fd,
        headers: authHeader(),
        onProgress: (p) => {
          setParseProgress(p);
          if (p.percent >= 100) setServerProcessing(true);
        },
      });
      setJob(res);
    } catch (err: any) {
      setError(err.message || 'Parse failed');
    } finally {
      setUploading(false);
      setServerProcessing(false);
    }
  };

  const handleCommit = async () => {
    if (!job?.id) return;
    setCommitting(true);
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
      setCommitting(false);
    }
  };

  if (commitResult) {
    return (
      <Card className="bg-green-500/5 border-green-500/30 rounded-2xl">
        <CardContent className="p-6 text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
          <p className="text-xl font-bold">Policies database committed</p>
          <p className="text-gray-400 mt-1">
            {commitResult.inserted} new · {commitResult.updated} updated · {commitResult.skipped} skipped · {commitResult.errors} errors
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Duration: {commitResult.duration}ms — Policy Monitor and country profile policy sections now reflect the new scores.
          </p>
          <Button variant="outline" className="mt-4" onClick={onDone}>Upload another file</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Banner */}
      <Card className="bg-violet-500/[0.06] border-violet-500/30 rounded-2xl">
        <CardContent className="p-4 flex gap-3">
          <Shield className="h-5 w-5 text-violet-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-violet-300">Detected: African National Youth Policies Database</p>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              Each row covers one country × <strong>30 policy instruments</strong>. We score every cell using the
              AYC Composite Policy Index rules: <strong>0</strong> for missing, <strong>0.5</strong> for "in development", <strong>1.0</strong> if in place
              (+0.1 bonus for Act/Law/Constitution markers, capped at 1.0), then multiplied by a recency factor
              based on the latest year mentioned in the cell.
            </p>
          </div>
        </CardContent>
      </Card>

      {!job && (
        <Card className="bg-white/[0.03] border-gray-800 rounded-2xl">
          <CardHeader><CardTitle className="text-base">Confirm details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Source attribution *</Label>
              <p className="text-[11px] text-gray-500">
                Where this dataset comes from. Shown next to compliance scores on /policy-monitor and country profiles.
              </p>
              <Input value={source} onChange={(e) => setSource(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <p className="text-[11px] text-gray-500">
                Internal note — version of the database, who collected it, known caveats.
              </p>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. v3 — adds 6 new countries from SADC" />
            </div>
            {uploading && parseProgress && (
              <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-gray-400 tabular-nums">
                  <span>
                    {serverProcessing ? (
                      <>Server scoring policies — extracting years, applying recency bands…</>
                    ) : (
                      <>Uploading <span className="text-white">{formatBytes(parseProgress.loaded)}</span> / {formatBytes(parseProgress.total)}</>
                    )}
                  </span>
                  <span>{serverProcessing ? '—' : `${parseProgress.percent}% · ETA ${formatEta(parseProgress.etaMs)}`}</span>
                </div>
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${serverProcessing ? 'bg-emerald-400 animate-pulse' : 'bg-violet-400'}`}
                    style={{ width: `${parseProgress.percent}%` }}
                  />
                </div>
              </div>
            )}

            <Button onClick={handleParse} disabled={uploading || !source.trim()} className="gap-2">
              {uploading ? <Clock className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
              {uploading ? (serverProcessing ? 'Scoring…' : 'Uploading…') : 'Parse + score policies'}
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

      {job && (
        <Card className="bg-white/[0.03] border-gray-800 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-5 w-5 text-violet-400" />
              Preview — {job.summary?.policiesParsed || 0} policy records across {job.summary?.countriesMatched || 0} countries
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-center">
                <p className="text-2xl font-bold text-emerald-400">{job.summary?.inPlace || 0}</p>
                <p className="text-xs text-gray-400">In place</p>
              </div>
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-center">
                <p className="text-2xl font-bold text-amber-400">{job.summary?.drafts || 0}</p>
                <p className="text-xs text-gray-400">Draft</p>
              </div>
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-center">
                <p className="text-2xl font-bold text-red-400">{job.summary?.missing || 0}</p>
                <p className="text-xs text-gray-400">Missing</p>
              </div>
              <div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-lg text-center">
                <p className="text-2xl font-bold text-violet-400">{Math.round((job.summary?.averageScore || 0) * 100)}</p>
                <p className="text-xs text-gray-400">Avg score (/100)</p>
              </div>
              <div className="p-3 bg-white/[0.05] rounded-lg text-center">
                <p className="text-2xl font-bold">{job.summary?.countriesMatched || 0}</p>
                <p className="text-xs text-gray-400">Countries</p>
              </div>
            </div>

            {job.summary?.countriesUnmatched?.length > 0 && (
              <div className="text-xs">
                <p className="text-amber-400 font-medium mb-1 flex items-center gap-1">
                  <Info className="h-3 w-3" /> Unmatched countries:
                </p>
                <p className="text-gray-400">{job.summary.countriesUnmatched.join(' · ')}</p>
              </div>
            )}

            {job.records?.length > 0 && (
              <div className="overflow-x-auto">
                <p className="text-xs text-gray-500 mb-1">Sample (first 12 of {job.recordCount}):</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-1.5 px-2">Country</th>
                      <th className="text-left py-1.5 px-2">Policy type</th>
                      <th className="text-left py-1.5 px-2">Year</th>
                      <th className="text-left py-1.5 px-2">Status</th>
                      <th className="text-right py-1.5 px-2">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {job.records.slice(0, 12).map((r: any, i: number) => (
                      <tr key={i} className="border-b border-gray-800/50">
                        <td className="py-1 px-2 text-gray-300">{r.countryName}</td>
                        <td className="py-1 px-2 text-gray-400">{r.policyType}</td>
                        <td className="py-1 px-2 text-gray-500">{r.yearAdopted ?? '—'}</td>
                        <td className="py-1 px-2">
                          <Badge
                            variant={r.status === 'active' ? 'default' : r.status === 'draft' ? 'secondary' : 'destructive'}
                            className="text-[10px]"
                          >
                            {r.status}
                          </Badge>
                        </td>
                        <td className="py-1 px-2 text-right font-mono">{(r.complianceScore * 100).toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Button onClick={handleCommit} disabled={committing || !job.summary?.policiesParsed} className="gap-2">
              {committing ? <Clock className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              {committing ? 'Committing…' : `Commit ${job.summary?.policiesParsed || 0} policy records`}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PolicyFlow;
