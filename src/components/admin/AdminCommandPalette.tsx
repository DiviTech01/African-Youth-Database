import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  ShieldCheck, FileText, Mail, Upload, Users, Activity, Wrench, ExternalLink, Sparkles, Trash2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const API = (import.meta.env.VITE_API_URL as string) || '/api';

interface Item {
  label: string;
  icon: React.ElementType;
  onSelect: () => void | Promise<void>;
  hint?: string;
}

/**
 * Admin Command Palette — Cmd/Ctrl+K from anywhere in /admin/* opens this
 * fuzzy-search launcher. Lists every admin page plus a small set of one-click
 * actions ("Generate this month's draft", "Clear server cache"). Designed to
 * shave clicks off the most-common admin tasks without bloating the sidebar.
 */
export const AdminCommandPalette: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getToken } = useAuth();
  const [open, setOpen] = useState(false);

  // Cmd/Ctrl+K toggles. Keep it cheap and global — one listener per mount.
  // The topbar also fires a synthetic `admin-palette:open` event so the kbd
  // pill is mouse-clickable too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpenEvent = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('admin-palette:open', onOpenEvent);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('admin-palette:open', onOpenEvent);
    };
  }, []);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const authFetch = useCallback(
    async (path: string, init?: RequestInit) => {
      const token = getToken();
      const res = await fetch(`${API}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(init?.headers || {}),
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `Request failed (${res.status})`);
      }
      return res.headers.get('content-type')?.includes('json') ? res.json() : res.text();
    },
    [getToken],
  );

  const generateMonthlyDraft = async () => {
    setOpen(false);
    try {
      const r = await authFetch('/newsletter/admin/campaigns/generate-monthly', { method: 'POST' });
      toast({
        title: r?.isNew ? 'New monthly draft created' : 'Draft already exists for this month',
        description: `"${r?.campaign?.title ?? 'Briefing'}" — open Newsletter to review.`,
      });
      navigate('/admin/newsletter');
    } catch (e) {
      toast({ title: 'Generate failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const clearServerCache = async () => {
    setOpen(false);
    try {
      await authFetch('/platform/clear-cache', { method: 'POST' });
      toast({ title: 'Server cache cleared' });
    } catch (e) {
      toast({ title: 'Clear cache failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const pages: Item[] = [
    { label: 'Admin Panel', icon: ShieldCheck, onSelect: () => go('/admin'), hint: 'Overview, users, tools' },
    { label: 'Newsletter & Broadcasts', icon: Mail, onSelect: () => go('/admin/newsletter'), hint: 'Briefings, subscribers, send' },
    { label: 'Content Manager (CMS)', icon: FileText, onSelect: () => go('/admin/cms'), hint: 'Edit site copy' },
    { label: 'Reports & Files', icon: FileText, onSelect: () => go('/admin/reports'), hint: 'PDFs, briefs, downloads' },
    { label: 'Upload Data', icon: Upload, onSelect: () => go('/dashboard/data-upload'), hint: 'Bulk import indicators' },
  ];

  const actions: Item[] = [
    {
      label: 'Generate this month\'s briefing draft',
      icon: Sparkles,
      onSelect: generateMonthlyDraft,
      hint: 'AI-drafted, awaiting approval',
    },
    {
      label: 'Clear server cache',
      icon: Trash2,
      onSelect: clearServerCache,
      hint: 'Force recompute of aggregates',
    },
    {
      label: 'Open Subscribers tab',
      icon: Users,
      onSelect: () => go('/admin/newsletter'),
      hint: 'Newsletter list + export',
    },
  ];

  const elsewhere: Item[] = [
    { label: 'Open the public site', icon: ExternalLink, onSelect: () => go('/'), hint: 'See what visitors see' },
    { label: 'My Dashboard', icon: Activity, onSelect: () => go('/dashboard'), hint: 'Personal overview' },
    { label: 'Settings', icon: Wrench, onSelect: () => go('/settings'), hint: 'Account preferences' },
  ];

  const renderItem = ({ label, icon: Icon, onSelect, hint }: Item) => (
    <CommandItem key={label} onSelect={() => void onSelect()} className="gap-2">
      <Icon className="h-4 w-4 text-[#D4A017]" />
      <span className="flex-1">{label}</span>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </CommandItem>
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to a page or run an action…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        <CommandGroup heading="Admin pages">{pages.map(renderItem)}</CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Quick actions">{actions.map(renderItem)}</CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Elsewhere">{elsewhere.map(renderItem)}</CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};

export default AdminCommandPalette;
