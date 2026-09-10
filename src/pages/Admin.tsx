import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Shield, Users, Globe, Database, Activity, Search, ArrowRight,
  Upload, Trash2, FileText, CheckCircle, XCircle, Clock, UserCheck, Wrench, Mail, Eye,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { api, type DocumentSummary } from '@/lib/api-client';
import { useAdminPreviewMode } from '@/hooks/use-admin-preview-mode';
import { useNavigate } from 'react-router-dom';

type UserRole = 'PUBLIC' | 'REGISTERED' | 'RESEARCHER' | 'CONTRIBUTOR' | 'INSTITUTIONAL' | 'ADMIN';

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: string;
}

const ROLES: UserRole[] = ['PUBLIC', 'REGISTERED', 'RESEARCHER', 'CONTRIBUTOR', 'INSTITUTIONAL', 'ADMIN'];

const roleBadgeVariant: Record<UserRole, string> = {
  ADMIN: 'bg-red-500/20 text-red-400 border-red-500/30',
  CONTRIBUTOR: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  INSTITUTIONAL: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  RESEARCHER: 'bg-green-500/20 text-green-400 border-green-500/30',
  REGISTERED: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  PUBLIC: 'bg-gray-600/20 text-gray-500 border-gray-600/30',
};

// Shown only while the real platform stats are still loading. Every value is a
// placeholder -- nothing here asserts a count. The previous version hardcoded
// '54' countries and a literal 'Live' session figure, which are claims, not
// placeholders, and would keep reading as real if the stats request failed.
const loadingStats = [
  { label: 'Total Countries', value: '—', icon: Globe, change: '' },
  { label: 'Indicators', value: '—', icon: Database, change: '' },
  { label: 'Data Points', value: '—', icon: Activity, change: '' },
];

const Admin = () => {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { setPreviewMode } = useAdminPreviewMode();
  const startPreview = () => { setPreviewMode(true); navigate('/dashboard'); };
  const [pendingRoles, setPendingRoles] = useState<Record<string, UserRole>>({});

  // Platform stats
  const { data: platformStats } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: async () => {
      const token = getToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      return fetch(`${import.meta.env.VITE_API_URL || '/api'}/platform/stats`, { headers })
        .then(r => r.ok ? r.json() : null).catch(() => null);
    },
  });

  // All users from Supabase (admin RLS policy allows this)
  const { data: userRows, isLoading: usersLoading } = useQuery<UserRow[]>({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('User')
        .select('id, email, name, role, createdAt')
        .order('createdAt', { ascending: false });
      if (error) throw new Error(error.message);
      return data as UserRow[];
    },
  });

  // Update role mutation
  const updateRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      const { error } = await supabase
        .from('User')
        .update({ role })
        .eq('id', userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, { userId, role }) => {
      setPendingRoles(prev => { const n = { ...prev }; delete n[userId]; return n; });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Role updated', description: `Role changed to ${role}.` });
    },
    onError: (err) => {
      toast({ title: 'Failed to update role', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    },
  });

  const stats = platformStats ? [
    { label: 'Total Countries', value: String(platformStats.countries ?? 54), icon: Globe, change: 'Active' },
    { label: 'Indicators', value: String(platformStats.indicators ?? 59), icon: Database, change: `${platformStats.themes ?? 9} themes` },
    { label: 'Data Points', value: platformStats.indicatorValues ? `${(platformStats.indicatorValues / 1000).toFixed(1)}K` : '—', icon: Activity, change: 'Live' },
    { label: 'Registered Users', value: String(userRows?.length ?? '—'), icon: Users, change: '' },
  ] : [
    ...loadingStats,
    { label: 'Registered Users', value: String(userRows?.length ?? '—'), icon: Users, change: '' },
  ];

  const handleClearCache = async () => {
    const token = getToken();
    try {
      await fetch(`${import.meta.env.VITE_API_URL || '/api'}/platform/clear-cache`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      toast({ title: 'Cache cleared' });
    } catch {
      toast({ title: 'Could not clear cache', variant: 'destructive' });
    }
  };

  // Filter user list by search query
  const [userSearch, setUserSearch] = useState('');
  const filteredUsers = useMemo(() => {
    if (!userRows) return [];
    if (!userSearch.trim()) return userRows;
    const q = userSearch.toLowerCase();
    return userRows.filter((u) => (u.name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)));
  }, [userRows, userSearch]);

  // Real document count from the documents API (replaces the old localStorage store).
  const { data: docsForCount } = useQuery<DocumentSummary[]>({
    queryKey: ['public-documents'],
    queryFn: () => api.documents.list({ limit: 500 }),
    staleTime: 60_000,
  });
  const adminReportsCount = docsForCount?.length ?? 0;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-[#D4A017]" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tighter bg-gradient-to-br from-[#D4A017] from-10% via-white via-40% to-white/40 bg-clip-text text-transparent">
              Admin Console
            </h1>
            <p className="text-xs text-[#A89070] mt-0.5">Users, content, data, and platform operations.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start">
          {!platformStats && <Badge variant="secondary" className="text-[10px]">Offline mode</Badge>}
          {/* Let admins drop into the regular user dashboard for a sanity-check
              of what visitors see, without losing their way back. */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-xs"
            onClick={startPreview}
            title="Switch to the regular user view of the platform — a Back to admin button will be visible on every page"
          >
            <Eye className="h-3.5 w-3.5" /> Back to platform
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList className="grid w-full grid-cols-4 bg-white/[0.03] border border-gray-800/80 h-10 p-1">
          <TabsTrigger value="overview" className="gap-1.5 text-xs"><Activity className="h-3.5 w-3.5" /> Overview</TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" /> Users</TabsTrigger>
          <TabsTrigger value="experts" className="gap-1.5 text-xs"><UserCheck className="h-3.5 w-3.5" /> Experts</TabsTrigger>
          <TabsTrigger value="tools" className="gap-1.5 text-xs"><Wrench className="h-3.5 w-3.5" /> Tools</TabsTrigger>
        </TabsList>

        {/* ─── OVERVIEW ─── */}
        <TabsContent value="overview" className="space-y-5">
          {/* Quick-action tiles */}
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { to: '/admin/cms', icon: FileText, accent: '#D4A017', label: 'Content Manager', hint: 'Edit copy, labels, and CMS content site-wide.' },
              { to: '/admin/reports', icon: FileText, accent: '#A855F7', label: 'Reports & Files', hint: `Upload PDFs and briefs. ${adminReportsCount} on file.` },
              { to: '/admin/newsletter', icon: Mail, accent: '#3B82F6', label: 'Newsletter & Briefings', hint: 'Review and approve monthly youth-data briefings.' },
              { to: '/dashboard/data-upload', icon: Upload, accent: '#22C55E', label: 'Upload Data', hint: 'Bulk-import indicators, youth-index, and policy records.' },
            ].map(({ to, icon: Icon, accent, label, hint }) => (
              <Link
                key={to}
                to={to}
                className="group flex items-start gap-3 p-4 rounded-2xl border border-gray-800 bg-gradient-to-br from-white/[0.04] to-transparent hover:border-gray-700 transition-all"
                style={{ borderColor: undefined }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: accent + '20', color: accent }}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm group-hover:text-white transition-colors flex items-center gap-1">
                    {label} <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 -ml-0.5 group-hover:ml-0 transition-all" />
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{hint}</p>
                </div>
              </Link>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map((stat) => (
              <Card key={stat.label} className="bg-gradient-to-b from-white/[0.04] to-white/[0.01] border-gray-800/80 rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{stat.label}</p>
                    <stat.icon className="h-4 w-4 text-gray-500" />
                  </div>
                  <div className="text-2xl font-bold tabular-nums text-white">{stat.value}</div>
                  {stat.change && <p className="text-[11px] text-gray-500 mt-1">{stat.change}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ─── USERS ─── */}
        <TabsContent value="users" className="space-y-3">
          <Card className="bg-white/[0.03] border-gray-800/80 rounded-2xl">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#D4A017]" />
                  <h2 className="text-base font-semibold">User Management</h2>
                  <Badge className="bg-white/[0.05] text-gray-400 border-gray-700 text-[10px] tabular-nums">
                    {userRows?.length ?? 0}
                  </Badge>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
                  <Input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search by name or email"
                    className="pl-9 h-9 text-xs bg-white/[0.04] border-gray-800"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {userRows?.length ? 'No users match your search.' : 'No users found.'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 text-left text-gray-500">
                        <th className="pb-3 pr-4 text-[10px] uppercase tracking-wider font-semibold">Name</th>
                        <th className="pb-3 pr-4 text-[10px] uppercase tracking-wider font-semibold">Email</th>
                        <th className="pb-3 pr-4 text-[10px] uppercase tracking-wider font-semibold">Current role</th>
                        <th className="pb-3 pr-4 text-[10px] uppercase tracking-wider font-semibold">Change role</th>
                        <th className="pb-3 text-[10px] uppercase tracking-wider font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60">
                      {filteredUsers.map((u) => {
                        const pendingRole = pendingRoles[u.id];
                        const isDirty = pendingRole && pendingRole !== u.role;
                        return (
                          <tr key={u.id} className="hover:bg-white/[0.02]">
                            <td className="py-3 pr-4 font-medium text-xs">{u.name || '—'}</td>
                            <td className="py-3 pr-4 text-muted-foreground text-xs">{u.email}</td>
                            <td className="py-3 pr-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${roleBadgeVariant[u.role]}`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="py-3 pr-4">
                              <Select
                                value={pendingRole ?? u.role}
                                onValueChange={(val) =>
                                  setPendingRoles(prev => ({ ...prev, [u.id]: val as UserRole }))
                                }
                              >
                                <SelectTrigger className="w-36 h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ROLES.map(r => (
                                    <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="py-3">
                              <Button
                                size="sm"
                                variant={isDirty ? 'default' : 'ghost'}
                                disabled={!isDirty || updateRole.isPending}
                                className="h-8 gap-1 text-xs"
                                onClick={() => updateRole.mutate({ userId: u.id, role: pendingRole! })}
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                Save
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── EXPERTS ─── */}
        <TabsContent value="experts" className="space-y-3">
          <PendingExperts />
        </TabsContent>

        {/* ─── TOOLS ─── */}
        <TabsContent value="tools" className="space-y-3">
          <Card className="bg-white/[0.03] border-gray-800/80 rounded-2xl">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-[#D4A017]" />
                <h2 className="text-base font-semibold">Platform Tools</h2>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-gray-800">
                <div>
                  <p className="text-sm font-medium">Clear server cache</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Forces the API to recompute aggregates and indicator caches on next request.</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleClearCache} className="gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" /> Clear
                </Button>
              </div>
              <p className="text-[11px] text-gray-500 italic">
                More tooling (re-index, log viewer, audit trail) lands here as it ships.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

function PendingExperts() {
  const { toast } = useToast();
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const authHeaders = () => {
    const token = getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };
  const [rejectDialog, setRejectDialog] = useState<{ id: string; name: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const apiBase = import.meta.env.VITE_API_URL || '/api';

  const { data: experts, isLoading } = useQuery({
    queryKey: ['admin-pending-experts'],
    queryFn: async () => {
      try {
        const res = await fetch(`${apiBase}/experts?verified=false&pageSize=50`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.data || [];
      } catch {
        return [];
      }
    },
  });

  const handleApprove = async (id: string) => {
    try {
      await fetch(`${apiBase}/experts/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ status: 'APPROVED', verified: true }),
      });
      toast({ title: 'Expert approved', description: 'The expert has been notified.' });
      qc.invalidateQueries({ queryKey: ['admin-pending-experts'] });
    } catch {
      toast({ title: 'Failed to approve', variant: 'destructive' });
    }
  };

  const handleReject = async () => {
    if (!rejectDialog) return;
    try {
      await fetch(`${apiBase}/experts/${rejectDialog.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ status: 'REJECTED', rejectionReason }),
      });
      toast({ title: 'Expert rejected', description: 'The expert has been notified.' });
      qc.invalidateQueries({ queryKey: ['admin-pending-experts'] });
      setRejectDialog(null);
      setRejectionReason('');
    } catch {
      toast({ title: 'Failed to reject', variant: 'destructive' });
    }
  };

  const pendingExperts = (experts || []).filter((e: any) => !e.verified);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Pending Expert Registrations</h2>
            {pendingExperts.length > 0 && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 ml-2">
                {pendingExperts.length} pending
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : pendingExperts.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <CheckCircle className="h-4 w-4 text-green-500" />
              No pending expert registrations
            </div>
          ) : (
            <div className="space-y-3">
              {pendingExperts.map((expert: any) => (
                <div key={expert.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border bg-white/[0.02]">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{expert.name}</p>
                    <p className="text-xs text-muted-foreground">{expert.title} at {expert.organization}</p>
                    <p className="text-xs text-muted-foreground">{expert.email} · {expert.country?.name || 'Unknown'}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(expert.specializations || []).slice(0, 4).map((s: string) => (
                        <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0">{s}</Badge>
                      ))}
                      {(expert.specializations || []).length > 4 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">+{expert.specializations.length - 4}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Registered {new Date(expert.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" className="gap-1 h-8 text-xs" onClick={() => handleApprove(expert.id)}>
                      <CheckCircle className="h-3.5 w-3.5" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 h-8 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => setRejectDialog({ id: expert.id, name: expert.name })}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rejection Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Reject Expert Registration</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Rejecting registration for <strong>{rejectDialog?.name}</strong>. Please provide a reason.
          </p>
          <Textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Reason for rejection (will be sent to the applicant)..."
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejectDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject}>Confirm Rejection</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default Admin;
