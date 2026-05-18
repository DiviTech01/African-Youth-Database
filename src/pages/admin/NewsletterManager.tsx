import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Mail, Plus, Send, Eye, Pencil, CheckCircle2, XCircle, Loader2, Sparkles, AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const API = (import.meta.env.VITE_API_URL as string) || '/api';

type CampaignStatus =
  | 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED';

interface Campaign {
  id: string;
  periodKey: string | null;
  title: string;
  subject: string;
  bodyHtml: string;
  status: CampaignStatus;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  testSentTo: string | null;
  error: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

const STATUS_STYLE: Record<CampaignStatus, string> = {
  DRAFT: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  PENDING_APPROVAL: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  APPROVED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  SENDING: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  SENT: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  FAILED: 'bg-red-500/20 text-red-400 border-red-500/30',
  CANCELLED: 'bg-gray-600/20 text-gray-500 border-gray-600/30',
};

const NewsletterManager: React.FC = () => {
  const { toast } = useToast();
  const { getToken, user } = useAuth();
  const qc = useQueryClient();

  const [editing, setEditing] = useState<Campaign | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState({ title: '', subject: '', bodyHtml: '' });
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [testFor, setTestFor] = useState<Campaign | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [approveFor, setApproveFor] = useState<Campaign | null>(null);

  const authFetch = async (path: string, opts: RequestInit = {}) => {
    const token = getToken();
    const res = await fetch(`${API}/newsletter/admin${path}`, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...opts.headers,
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.message || `Request failed (${res.status})`);
    }
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
  };

  const statsQ = useQuery({
    queryKey: ['nl-stats'],
    queryFn: () => authFetch('/subscribers/stats'),
  });

  const campaignsQ = useQuery<Campaign[]>({
    queryKey: ['nl-campaigns'],
    queryFn: () => authFetch('/campaigns'),
    // Poll while a send is in flight so progress updates live.
    refetchInterval: (q) => {
      const list = (q.state.data as Campaign[] | undefined) || [];
      return list.some((c) => c.status === 'APPROVED' || c.status === 'SENDING') ? 4000 : false;
    },
  });

  const campaigns = campaignsQ.data || [];
  const pendingCount = useMemo(
    () => campaigns.filter((c) => c.status === 'PENDING_APPROVAL').length,
    [campaigns],
  );

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['nl-campaigns'] });
    qc.invalidateQueries({ queryKey: ['nl-stats'] });
  };

  const mutate = (fn: () => Promise<unknown>, ok: string) =>
    fn()
      .then(() => { toast({ title: ok }); refresh(); })
      .catch((e: Error) => toast({ title: 'Action failed', description: e.message, variant: 'destructive' }));

  const saveMut = useMutation({
    mutationFn: async () => {
      if (editing) {
        return authFetch(`/campaigns/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) });
      }
      return authFetch('/campaigns', { method: 'POST', body: JSON.stringify(form) });
    },
    onSuccess: () => {
      toast({ title: editing ? 'Draft updated' : 'Draft created' });
      setEditorOpen(false);
      setEditing(null);
      refresh();
    },
    onError: (e: Error) =>
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });

  const openNew = () => {
    setEditing(null);
    setForm({ title: '', subject: '', bodyHtml: '<p>Write your briefing here…</p>' });
    setEditorOpen(true);
  };
  const openEdit = (c: Campaign) => {
    setEditing(c);
    setForm({ title: c.title, subject: c.subject, bodyHtml: c.bodyHtml });
    setEditorOpen(true);
  };

  const openPreview = async (c: Campaign) => {
    try {
      const html = await authFetch(`/campaigns/${c.id}/preview`);
      setPreviewHtml(typeof html === 'string' ? html : JSON.stringify(html));
    } catch (e) {
      toast({ title: 'Preview failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const sendTest = async () => {
    if (!testFor || !testEmail.trim()) return;
    try {
      await authFetch(`/campaigns/${testFor.id}/test`, {
        method: 'POST',
        body: JSON.stringify({ email: testEmail.trim() }),
      });
      toast({ title: 'Test sent', description: `Check ${testEmail}` });
      setTestFor(null);
      setTestEmail('');
    } catch (e) {
      toast({ title: 'Test failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const doApprove = async () => {
    if (!approveFor) return;
    await mutate(
      () => authFetch(`/campaigns/${approveFor.id}/approve`, { method: 'POST' }),
      'Approved — sending to subscribers',
    );
    setApproveFor(null);
  };

  const subscriberCount = statsQ.data?.SUBSCRIBED ?? 0;

  const statCards = [
    { label: 'Subscribers', value: subscriberCount, accent: '#22C55E' },
    { label: 'Unsubscribed', value: statsQ.data?.UNSUBSCRIBED ?? 0, accent: '#A89070' },
    { label: 'Campaigns', value: campaigns.length, accent: '#D4A017' },
    { label: 'Awaiting approval', value: pendingCount, accent: '#F59E0B' },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Mail className="h-6 w-6 text-[#D4A017]" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tighter bg-gradient-to-br from-[#D4A017] from-10% via-white via-40% to-white/40 bg-clip-text text-transparent">
              Newsletter & Briefings
            </h1>
            <p className="text-xs text-[#A89070] mt-0.5">
              Monthly youth-data briefings. Nothing reaches subscribers until you approve it.
            </p>
          </div>
        </div>
        <div className="flex gap-2 self-start">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() =>
              mutate(() => authFetch('/campaigns/generate-monthly', { method: 'POST' }), 'Monthly draft ready')
            }
          >
            <Sparkles className="h-4 w-4" /> Generate this month
          </Button>
          <Button onClick={openNew} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> New briefing
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-2xl p-4 bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-gray-800/80">
            <p className="text-2xl font-bold tabular-nums leading-none" style={{ color: s.accent }}>
              {statsQ.isLoading ? '—' : s.value}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {statsQ.isError && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          <AlertTriangle className="h-4 w-4" />
          Couldn't load newsletter data. Make sure you're signed in as an admin and the API is reachable.
        </div>
      )}

      {/* Campaign list */}
      {campaignsQ.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-gray-800 bg-white/[0.02]">
          <Mail className="h-10 w-10 text-gray-500 mx-auto mb-3" />
          <p className="text-base font-medium text-gray-300">No briefings yet</p>
          <p className="text-xs text-gray-500 mt-1 mb-4">
            Create one manually, or generate this month's draft from the latest data.
          </p>
          <Button onClick={openNew} size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> New briefing
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {campaigns.map((c) => {
            const sending = c.status === 'APPROVED' || c.status === 'SENDING';
            const editable = c.status === 'DRAFT' || c.status === 'PENDING_APPROVAL';
            return (
              <Card key={c.id} className="bg-white/[0.03] border-gray-800/80 rounded-xl">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_STYLE[c.status]}`}>
                          {c.status.replace('_', ' ')}
                        </span>
                        {c.periodKey && (
                          <span className="text-[10px] text-gray-500 uppercase tracking-wider">{c.periodKey}</span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-white">{c.title}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">{c.subject}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-gray-500">
                        <span className="tabular-nums">
                          {c.status === 'SENT' || sending
                            ? `${c.sentCount}/${c.recipientCount} sent${c.failedCount ? ` · ${c.failedCount} failed` : ''}`
                            : `Created ${new Date(c.createdAt).toLocaleDateString()}`}
                        </span>
                        {c.testSentTo && <span>· tested → {c.testSentTo}</span>}
                      </div>
                      {c.error && (
                        <p className="text-[11px] text-red-400 mt-1.5 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> {c.error}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 self-start">
                      <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => openPreview(c)}>
                        <Eye className="h-3.5 w-3.5" /> Preview
                      </Button>
                      {editable && (
                        <>
                          <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => openEdit(c)}>
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 text-xs"
                            onClick={() => { setTestFor(c); setTestEmail(user?.email || ''); }}
                          >
                            <Send className="h-3.5 w-3.5" /> Test
                          </Button>
                        </>
                      )}
                      {c.status === 'DRAFT' && (
                        <Button
                          size="sm"
                          className="h-8 gap-1 text-xs"
                          onClick={() => mutate(() => authFetch(`/campaigns/${c.id}/submit`, { method: 'POST' }), 'Submitted for approval')}
                        >
                          Submit
                        </Button>
                      )}
                      {c.status === 'PENDING_APPROVAL' && (
                        <Button
                          size="sm"
                          className="h-8 gap-1 text-xs bg-emerald-600 hover:bg-emerald-500"
                          onClick={() => setApproveFor(c)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve & send
                        </Button>
                      )}
                      {editable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={() => mutate(() => authFetch(`/campaigns/${c.id}/cancel`, { method: 'POST' }), 'Campaign cancelled')}
                        >
                          <XCircle className="h-3.5 w-3.5" /> Cancel
                        </Button>
                      )}
                      {sending && <Loader2 className="h-4 w-4 animate-spin text-blue-400" />}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Editor dialog */}
      <Dialog open={editorOpen} onOpenChange={(o) => { setEditorOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto bg-black/95 border-gray-800">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit briefing' : 'New briefing'}</DialogTitle>
            <DialogDescription className="text-xs">
              The body is HTML, wrapped in the branded email layout on send. Submit it for approval when ready —
              it won't reach subscribers until an admin approves.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Internal title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. May 2026 Youth Briefing"
                className="text-sm bg-white/[0.04] border-gray-800"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email subject *</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="What subscribers see in their inbox"
                className="text-sm bg-white/[0.04] border-gray-800"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Body (HTML) *</Label>
              <Textarea
                value={form.bodyHtml}
                onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })}
                rows={12}
                className="text-xs font-mono bg-white/[0.04] border-gray-800"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={saveMut.isPending || !form.title.trim() || !form.subject.trim() || !form.bodyHtml.trim()}
              onClick={() => saveMut.mutate()}
            >
              {saveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {editing ? 'Save draft' : 'Create draft'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={!!previewHtml} onOpenChange={(o) => !o && setPreviewHtml(null)}>
        <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-hidden bg-black/95 border-gray-800">
          <DialogHeader>
            <DialogTitle>Email preview</DialogTitle>
            <DialogDescription className="text-xs">Exactly what subscribers receive.</DialogDescription>
          </DialogHeader>
          <iframe
            title="email-preview"
            srcDoc={previewHtml || ''}
            className="w-full h-[60vh] rounded-lg border border-gray-800 bg-white"
          />
        </DialogContent>
      </Dialog>

      {/* Send test dialog */}
      <Dialog open={!!testFor} onOpenChange={(o) => !o && setTestFor(null)}>
        <DialogContent className="sm:max-w-[420px] bg-black/95 border-gray-800">
          <DialogHeader>
            <DialogTitle>Send a test</DialogTitle>
            <DialogDescription className="text-xs">
              Sends "{testFor?.title}" to one address only. Subscribers are not affected.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="you@example.com"
            className="text-sm bg-white/[0.04] border-gray-800"
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setTestFor(null)}>Cancel</Button>
            <Button size="sm" className="gap-1.5" onClick={sendTest} disabled={!testEmail.trim()}>
              <Send className="h-3.5 w-3.5" /> Send test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve confirm */}
      <Dialog open={!!approveFor} onOpenChange={(o) => !o && setApproveFor(null)}>
        <DialogContent className="sm:max-w-[440px] bg-black/95 border-gray-800">
          <DialogHeader>
            <DialogTitle>Approve & send?</DialogTitle>
            <DialogDescription className="text-xs">
              This sends <strong>"{approveFor?.title}"</strong> to{' '}
              <strong className="text-white">{subscriberCount}</strong> subscriber
              {subscriberCount === 1 ? '' : 's'}. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setApproveFor(null)}>Cancel</Button>
            <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-500" onClick={doApprove}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Approve & send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NewsletterManager;
