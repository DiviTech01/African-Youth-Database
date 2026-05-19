import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Mail, Plus, Send, Eye, Pencil, CheckCircle2, XCircle, Loader2, Sparkles,
  AlertTriangle, Users, Paperclip, Download, Search, Trash2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { useAuth } from '@/contexts/AuthContext';
import { RichTextEditor } from '@/components/admin/cms/RichTextEditor';

const API = (import.meta.env.VITE_API_URL as string) || '/api';

type CampaignStatus =
  | 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED';

type Audience = 'SUBSCRIBERS' | 'USERS' | 'BOTH';

type SubscriberStatus = 'SUBSCRIBED' | 'UNSUBSCRIBED' | 'BOUNCED';

interface AttachmentLink {
  label: string;
  url: string;
  sizeHint?: string;
}

interface Campaign {
  id: string;
  periodKey: string | null;
  title: string;
  subject: string;
  bodyHtml: string;
  status: CampaignStatus;
  audience: Audience;
  attachments: AttachmentLink[] | null;
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

interface SubscriberRow {
  id: string;
  email: string;
  source: string | null;
  status: SubscriberStatus;
  createdAt: string;
  updatedAt: string;
  unsubscribedAt: string | null;
}

interface SubscribersPage {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  rows: SubscriberRow[];
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

const SUB_STATUS_STYLE: Record<SubscriberStatus, string> = {
  SUBSCRIBED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  UNSUBSCRIBED: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  BOUNCED: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const AUDIENCE_LABEL: Record<Audience, string> = {
  SUBSCRIBERS: 'Subscribers',
  USERS: 'All users',
  BOTH: 'Subscribers + users',
};

// Tiny CSV builder. Quotes fields containing comma / quote / newline per RFC 4180.
function toCsv(rows: SubscriberRow[]): string {
  const header = ['email', 'source', 'status', 'subscribed_at', 'unsubscribed_at'];
  const quote = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((r) =>
    [r.email, r.source ?? '', r.status, r.createdAt, r.unsubscribedAt ?? ''].map(quote).join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

const NewsletterManager: React.FC = () => {
  const { toast } = useToast();
  const { getToken, user } = useAuth();
  const qc = useQueryClient();

  const [editing, setEditing] = useState<Campaign | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<{
    title: string;
    subject: string;
    bodyHtml: string;
    audience: Audience;
    attachments: AttachmentLink[];
  }>({ title: '', subject: '', bodyHtml: '', audience: 'SUBSCRIBERS', attachments: [] });
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [testFor, setTestFor] = useState<Campaign | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [approveFor, setApproveFor] = useState<Campaign | null>(null);
  const [cancelFor, setCancelFor] = useState<Campaign | null>(null);
  const [deleteFor, setDeleteFor] = useState<Campaign | null>(null);

  // Subscriber tab state
  const [subSearch, setSubSearch] = useState('');
  const [subStatus, setSubStatus] = useState<SubscriberStatus | 'ALL'>('ALL');
  const [subPage, setSubPage] = useState(1);

  // Attachment upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

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
    refetchInterval: (q) => {
      const list = (q.state.data as Campaign[] | undefined) || [];
      return list.some((c) => c.status === 'APPROVED' || c.status === 'SENDING') ? 4000 : false;
    },
  });

  const subscribersQ = useQuery<SubscribersPage>({
    queryKey: ['nl-subscribers', subSearch, subStatus, subPage],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(subPage));
      params.set('pageSize', '50');
      if (subSearch.trim()) params.set('search', subSearch.trim());
      if (subStatus !== 'ALL') params.set('status', subStatus);
      return authFetch(`/subscribers?${params.toString()}`);
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
    qc.invalidateQueries({ queryKey: ['nl-subscribers'] });
  };

  const mutate = (fn: () => Promise<unknown>, ok: string) =>
    fn()
      .then(() => { toast({ title: ok }); refresh(); })
      .catch((e: Error) => toast({ title: 'Action failed', description: e.message, variant: 'destructive' }));

  const saveMut = useMutation({
    mutationFn: async () => {
      // Strip empty attachments before sending so the body is clean.
      const cleanedAttachments = form.attachments
        .map((a) => ({
          label: a.label.trim(),
          url: a.url.trim(),
          sizeHint: a.sizeHint?.trim() || undefined,
        }))
        .filter((a) => a.label && a.url);
      const payload = {
        title: form.title,
        subject: form.subject,
        bodyHtml: form.bodyHtml,
        audience: form.audience,
        attachments: cleanedAttachments,
      };
      if (editing) {
        return authFetch(`/campaigns/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      }
      return authFetch('/campaigns', { method: 'POST', body: JSON.stringify(payload) });
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
    setForm({
      title: '',
      subject: '',
      bodyHtml: '<p>Write your briefing here…</p>',
      audience: 'SUBSCRIBERS',
      attachments: [],
    });
    setEditorOpen(true);
  };
  const openEdit = (c: Campaign) => {
    setEditing(c);
    setForm({
      title: c.title,
      subject: c.subject,
      bodyHtml: c.bodyHtml,
      audience: c.audience,
      attachments: c.attachments ?? [],
    });
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
      'Approved — sending now',
    );
    setApproveFor(null);
  };

  // Generate this month — distinguish "newly created" from "already existed".
  // The API returns { campaign, isNew } so the toast is honest.
  const generateMonthly = async () => {
    try {
      const r: { campaign: Campaign; isNew: boolean } = await authFetch(
        '/campaigns/generate-monthly',
        { method: 'POST' },
      );
      refresh();
      if (r.isNew) {
        toast({
          title: 'New monthly draft created',
          description: `"${r.campaign.title}" is now Pending Approval. Scroll the list below to review and approve.`,
        });
      } else {
        toast({
          title: 'Draft already exists for this month',
          description: `"${r.campaign.title}" is in the list below — keep editing or approve when ready.`,
        });
      }
    } catch (e) {
      toast({ title: 'Generate failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  // Cancel = soft (sets CANCELLED). We surface a 10-second Undo so a misclick
  // is recoverable — clicking Undo flips the campaign back to DRAFT.
  const doCancel = async () => {
    if (!cancelFor) return;
    const id = cancelFor.id;
    const title = cancelFor.title;
    setCancelFor(null);
    try {
      await authFetch(`/campaigns/${id}/cancel`, { method: 'POST' });
      refresh();
      toast({
        title: 'Cancelled',
        description: `"${title}" was moved to Cancelled. Undo within 10s or delete it permanently below.`,
        duration: 10000,
        action: (
          <ToastAction
            altText="Undo cancel"
            onClick={async () => {
              try {
                await authFetch(`/campaigns/${id}/restore`, { method: 'POST' });
                refresh();
                toast({ title: 'Restored — back to Draft' });
              } catch (e) {
                toast({ title: 'Undo failed', description: (e as Error).message, variant: 'destructive' });
              }
            }}
          >
            Undo
          </ToastAction>
        ),
      });
    } catch (e) {
      toast({ title: 'Cancel failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  // Hard delete — only allowed on DRAFT or CANCELLED on the server, so the UI
  // shows the button only for CANCELLED campaigns. Two-step (confirm → delete).
  const doDelete = async () => {
    if (!deleteFor) return;
    const id = deleteFor.id;
    const title = deleteFor.title;
    setDeleteFor(null);
    try {
      await authFetch(`/campaigns/${id}`, { method: 'DELETE' });
      refresh();
      toast({ title: 'Deleted', description: `"${title}" is gone for good.` });
    } catch (e) {
      toast({ title: 'Delete failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const downloadCsv = () => {
    const rows = subscribersQ.data?.rows ?? [];
    if (!rows.length) {
      toast({ title: 'No rows to export', variant: 'destructive' });
      return;
    }
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const subscriberCount = statsQ.data?.SUBSCRIBED ?? 0;
  const statCards = [
    { label: 'Subscribers', value: subscriberCount, accent: '#22C55E' },
    { label: 'Unsubscribed', value: statsQ.data?.UNSUBSCRIBED ?? 0, accent: '#A89070' },
    { label: 'Campaigns', value: campaigns.length, accent: '#D4A017' },
    { label: 'Awaiting approval', value: pendingCount, accent: '#F59E0B' },
  ];

  // ── Attachment upload (Gmail-style) ──────────────────────
  // The file is sent as multipart/form-data; the server stores it (R2 in prod
  // or local disk in dev) and returns { label, url, sizeHint } which we drop
  // straight into the campaign's attachments[] array.
  const removeAttachment = (i: number) =>
    setForm((f) => ({ ...f, attachments: f.attachments.filter((_, idx) => idx !== i) }));

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const token = getToken();
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(`${API}/newsletter/admin/attachments/upload`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: fd,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.message || `Upload failed (${res.status})`);
        }
        const attachment: AttachmentLink = await res.json();
        setForm((f) => ({ ...f, attachments: [...f.attachments, attachment] }));
      }
      toast({ title: 'File attached' });
    } catch (e) {
      toast({ title: 'Upload failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Mail className="h-6 w-6 text-[#D4A017]" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tighter bg-gradient-to-br from-[#D4A017] from-10% via-white via-40% to-white/40 bg-clip-text text-transparent">
              Newsletter & Broadcasts
            </h1>
            <p className="text-xs text-[#A89070] mt-0.5">
              Briefings, bulk announcements, and the subscriber log. Nothing leaves until you approve it.
            </p>
          </div>
        </div>
        <div className="flex gap-2 self-start">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={generateMonthly}
          >
            <Sparkles className="h-4 w-4" /> Generate this month
          </Button>
          <Button onClick={openNew} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> New broadcast
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

      <Tabs defaultValue="campaigns" className="space-y-5">
        <TabsList className="grid w-full grid-cols-2 bg-white/[0.03] border border-gray-800/80 h-10 p-1">
          <TabsTrigger value="campaigns" className="gap-1.5 text-xs">
            <Mail className="h-3.5 w-3.5" /> Broadcasts
          </TabsTrigger>
          <TabsTrigger value="subscribers" className="gap-1.5 text-xs">
            <Users className="h-3.5 w-3.5" /> Subscribers
          </TabsTrigger>
        </TabsList>

        {/* ─── BROADCASTS ─── */}
        <TabsContent value="campaigns" className="space-y-3">
          {campaignsQ.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-dashed border-gray-800 bg-white/[0.02]">
              <Mail className="h-10 w-10 text-gray-500 mx-auto mb-3" />
              <p className="text-base font-medium text-gray-300">No broadcasts yet</p>
              <p className="text-xs text-gray-500 mt-1 mb-4">
                Create one manually, or generate this month's draft from the latest data.
              </p>
              <Button onClick={openNew} size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> New broadcast
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {campaigns.map((c) => {
                const sending = c.status === 'APPROVED' || c.status === 'SENDING';
                const editable = c.status === 'DRAFT' || c.status === 'PENDING_APPROVAL';
                const attachmentCount = c.attachments?.length ?? 0;
                return (
                  <Card key={c.id} className="bg-white/[0.03] border-gray-800/80 rounded-xl">
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row md:items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_STYLE[c.status]}`}>
                              {c.status.replace('_', ' ')}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-gray-300 bg-white/[0.04] border border-gray-700">
                              <Users className="h-3 w-3" /> {AUDIENCE_LABEL[c.audience]}
                            </span>
                            {attachmentCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-gray-300 bg-white/[0.04] border border-gray-700">
                                <Paperclip className="h-3 w-3" /> {attachmentCount}
                              </span>
                            )}
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
                              onClick={() => setCancelFor(c)}
                            >
                              <XCircle className="h-3.5 w-3.5" /> Cancel
                            </Button>
                          )}
                          {c.status === 'CANCELLED' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              onClick={() => setDeleteFor(c)}
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete permanently
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
        </TabsContent>

        {/* ─── SUBSCRIBERS ─── */}
        <TabsContent value="subscribers" className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
              <Input
                placeholder="Search by email…"
                value={subSearch}
                onChange={(e) => { setSubSearch(e.target.value); setSubPage(1); }}
                className="pl-9 h-9 text-xs bg-white/[0.03] border-gray-800"
              />
            </div>
            <Select value={subStatus} onValueChange={(v) => { setSubStatus(v as any); setSubPage(1); }}>
              <SelectTrigger className="w-full sm:w-[180px] h-9 text-xs bg-white/[0.03] border-gray-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">All statuses</SelectItem>
                <SelectItem value="SUBSCRIBED" className="text-xs">Subscribed</SelectItem>
                <SelectItem value="UNSUBSCRIBED" className="text-xs">Unsubscribed</SelectItem>
                <SelectItem value="BOUNCED" className="text-xs">Bounced</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadCsv}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>

          {subscribersQ.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
            </div>
          ) : !subscribersQ.data || subscribersQ.data.rows.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-dashed border-gray-800 bg-white/[0.02]">
              <Users className="h-10 w-10 text-gray-500 mx-auto mb-3" />
              <p className="text-base font-medium text-gray-300">
                {subSearch || subStatus !== 'ALL' ? 'No subscribers match your filters' : 'No subscribers yet'}
              </p>
            </div>
          ) : (
            <Card className="bg-white/[0.03] border-gray-800/80 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-left text-gray-500 bg-white/[0.02]">
                      <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold">Email</th>
                      <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold">Source</th>
                      <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold">Status</th>
                      <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold">Subscribed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {subscribersQ.data.rows.map((r) => (
                      <tr key={r.id} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-3 text-xs text-white">{r.email}</td>
                        <td className="px-4 py-3 text-[11px] text-gray-500">{r.source || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${SUB_STATUS_STYLE[r.status]}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-gray-500 tabular-nums">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800 text-[11px] text-gray-500">
                <span className="tabular-nums">
                  Showing {subscribersQ.data.rows.length} of {subscribersQ.data.total}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={subPage <= 1}
                    onClick={() => setSubPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="tabular-nums">
                    {subscribersQ.data.page} / {subscribersQ.data.totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={subPage >= subscribersQ.data.totalPages}
                    onClick={() => setSubPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Editor dialog */}
      <Dialog open={editorOpen} onOpenChange={(o) => { setEditorOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto bg-black/95 border-gray-800">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit broadcast' : 'New broadcast'}</DialogTitle>
            <DialogDescription className="text-xs">
              Body is HTML, wrapped in the branded layout on send. Attachments are rendered as a
              download list at the bottom of the email. Nothing reaches recipients until you
              submit and an admin approves.
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
                placeholder="What recipients see in their inbox"
                className="text-sm bg-white/[0.04] border-gray-800"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Audience *</Label>
              <Select value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v as Audience })}>
                <SelectTrigger className="h-9 text-xs bg-white/[0.04] border-gray-800"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUBSCRIBERS" className="text-xs">Newsletter subscribers</SelectItem>
                  <SelectItem value="USERS" className="text-xs">All registered users</SelectItem>
                  <SelectItem value="BOTH" className="text-xs">Both (deduped)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-gray-500">
                Subscribers get a one-click unsubscribe link. Users get a "manage your account" link instead.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Message *</Label>
              <RichTextEditor
                value={form.bodyHtml}
                onChange={(html) => setForm({ ...form, bodyHtml: html })}
                placeholder="Write your message — use the toolbar for headings, bold, links, lists…"
                className="bg-white/[0.04] border-gray-800"
              />
              <p className="text-[10px] text-gray-500">
                Type normally — formatting is rendered into the branded email layout on send.
                Open Preview to see exactly what recipients will see.
              </p>
            </div>

            {/* Attachments — Gmail-style file picker */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5" /> Attached files
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
                  {uploading ? 'Uploading…' : 'Attach file'}
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.png,.jpg,.jpeg"
                onChange={(e) => uploadFiles(e.target.files)}
              />
              {form.attachments.length === 0 ? (
                <p className="text-[11px] text-gray-500 italic">
                  No files attached. Click "Attach file" to upload a PDF, doc, or image — recipients
                  see a tidy download list at the bottom of the email. Up to 25 MB per file.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {form.attachments.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-800 bg-white/[0.02]">
                      <Paperclip className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-white truncate">{a.label}</p>
                        {a.sizeHint && <p className="text-[10px] text-gray-500">{a.sizeHint}</p>}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => removeAttachment(i)}
                        title="Remove attachment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
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
            <DialogDescription className="text-xs">Exactly what recipients receive.</DialogDescription>
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
              Sends "{testFor?.title}" to one address only. Recipients are not affected.
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

      {/* Cancel confirm */}
      <Dialog open={!!cancelFor} onOpenChange={(o) => !o && setCancelFor(null)}>
        <DialogContent className="sm:max-w-[440px] bg-black/95 border-gray-800">
          <DialogHeader>
            <DialogTitle>Cancel this broadcast?</DialogTitle>
            <DialogDescription className="text-xs">
              <strong>"{cancelFor?.title}"</strong> will move to Cancelled. Recipients are not
              affected. You'll see an <strong>Undo</strong> button for 10 seconds. To remove it
              for good, use "Delete permanently" afterwards.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCancelFor(null)}>Keep it</Button>
            <Button variant="destructive" size="sm" className="gap-1.5" onClick={doCancel}>
              <XCircle className="h-3.5 w-3.5" /> Cancel broadcast
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteFor} onOpenChange={(o) => !o && setDeleteFor(null)}>
        <DialogContent className="sm:max-w-[440px] bg-black/95 border-gray-800">
          <DialogHeader>
            <DialogTitle>Delete permanently?</DialogTitle>
            <DialogDescription className="text-xs">
              <strong>"{deleteFor?.title}"</strong> will be removed from the database. This
              can't be undone. Sent broadcasts are never deletable — only drafts and cancelled
              campaigns.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteFor(null)}>Keep it</Button>
            <Button variant="destructive" size="sm" className="gap-1.5" onClick={doDelete}>
              <Trash2 className="h-3.5 w-3.5" /> Delete forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve confirm */}
      <Dialog open={!!approveFor} onOpenChange={(o) => !o && setApproveFor(null)}>
        <DialogContent className="sm:max-w-[460px] bg-black/95 border-gray-800">
          <DialogHeader>
            <DialogTitle>Approve & send?</DialogTitle>
            <DialogDescription className="text-xs">
              This sends <strong>"{approveFor?.title}"</strong> to{' '}
              <strong className="text-white">{approveFor ? AUDIENCE_LABEL[approveFor.audience] : ''}</strong>
              {approveFor?.audience === 'SUBSCRIBERS' && (
                <> (~<strong className="text-white">{subscriberCount}</strong> people)</>
              )}
              . This can't be undone.
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
