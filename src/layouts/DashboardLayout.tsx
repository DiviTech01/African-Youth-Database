import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import LiveDataTicker from '@/components/LiveDataTicker';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Search,
  Globe,
  Layers,
  BarChart3,
  ArrowLeftRight,
  Lightbulb,
  MessageSquare,
  Shield,
  Users,
  FileText,
  Settings,
  LogOut,
  Menu,
  ShieldCheck,
  Upload,
  ArrowUp,
  X,
  Mail,
  ArrowLeft,
  Maximize2,
  Minimize2,
  Command as CommandIcon,
  Eye,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminDensity } from '@/hooks/use-admin-density';
import { useAdminPreviewMode } from '@/hooks/use-admin-preview-mode';
import { AdminCommandPalette } from '@/components/admin/AdminCommandPalette';

/**
 * One-time hint that points mobile users at the "Menu" button. Stored in
 * localStorage so it disappears after the user opens the menu once or
 * dismisses it explicitly. Hidden on lg+ where the sidebar is always visible.
 */
const NAV_HINT_KEY = 'ayo_dashboard_nav_hint_dismissed_v1';
const NavHintBanner: React.FC<{ active: boolean }> = ({ active }) => {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem(NAV_HINT_KEY)) setShow(true);
  }, []);
  // When the user opens the sidebar, treat that as "they found it" and stop showing.
  React.useEffect(() => {
    if (!active && show) {
      localStorage.setItem(NAV_HINT_KEY, '1');
      setShow(false);
    }
  }, [active, show]);
  if (!show) return null;
  const dismiss = () => {
    localStorage.setItem(NAV_HINT_KEY, '1');
    setShow(false);
  };
  return (
    <div className="lg:hidden flex items-center justify-between gap-2 px-3 py-2 bg-primary/10 border-b border-primary/20 text-xs">
      <div className="flex items-center gap-2 text-primary min-w-0">
        <ArrowUp className="h-3.5 w-3.5 -rotate-45 shrink-0 animate-pulse" />
        <span className="truncate">Tap <strong className="font-semibold">Menu</strong> at the top to navigate.</span>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss hint"
        className="p-1 rounded hover:bg-primary/15 text-primary/70 hover:text-primary shrink-0"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

const adminLinks = [
  { to: '/admin', label: 'Admin Panel', icon: ShieldCheck },
  { to: '/admin/cms', label: 'Content Manager', icon: FileText },
  { to: '/admin/reports', label: 'Reports & Files', icon: FileText },
  { to: '/admin/newsletter', label: 'Newsletter & Broadcasts', icon: Mail },
  { to: '/dashboard/data-upload', label: 'Upload Data', icon: Upload },
];

const dataLinks = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/dashboard/explore', label: 'Data Explorer', icon: Search },
  { to: '/dashboard/countries', label: 'Report Cards', icon: Globe },
  { to: '/dashboard/themes', label: 'Themes', icon: Layers },
  { to: '/dashboard/youth-index', label: 'Youth Index', icon: BarChart3 },
  { to: '/dashboard/compare', label: 'Compare', icon: ArrowLeftRight },
  { to: '/dashboard/insights', label: 'AI Insights', icon: Lightbulb },
  { to: '/dashboard/ask', label: 'Ask AI', icon: MessageSquare },
  { to: '/dashboard/policy-monitor', label: 'Policy Monitor', icon: Shield },
  { to: '/dashboard/experts', label: 'Experts', icon: Users },
  { to: '/dashboard/reports', label: 'Reports', icon: FileText },
];

const contributorLinks = [
  { to: '/dashboard/data-upload', label: 'Contributor Hub', icon: Upload },
  { to: '/dashboard/contributor/reports', label: 'Reports & Files', icon: FileText },
  { to: '/dashboard/pkpb', label: 'Promise Kept · Promise Broken', icon: ShieldCheck },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  const [isDesktop, setIsDesktop] = React.useState(
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  // Desktop sidebar shows icons-only by default; expands on hover.
  // Existing render code is keyed off `collapsed`, so we derive it.
  const collapsed = !hovered;

  const isAdmin = user?.role === 'ADMIN';
  const isContributor = user?.role === 'CONTRIBUTOR';
  const isAdminRoute = location.pathname.startsWith('/admin');
  const { density, toggle: toggleDensity } = useAdminDensity();
  const { previewMode, setPreviewMode } = useAdminPreviewMode();

  // Admin sidebar mode: when an admin signs in, the sidebar is admin-only
  // (admin + contributor sections — NO mixed-in user nav). They can flip the
  // whole sidebar to the user-facing nav with "Preview as user" and flip it
  // back with "Exit preview". Hitting an /admin/* URL auto-exits preview so
  // the admin section can be shown again.
  const inAdminMode = !!isAdmin && !previewMode;
  const inPreviewMode = !!isAdmin && previewMode;
  React.useEffect(() => {
    if (previewMode && isAdminRoute) setPreviewMode(false);
  }, [previewMode, isAdminRoute, setPreviewMode]);

  const enterPreview = () => {
    setPreviewMode(true);
    setSidebarOpen(false);
    navigate('/dashboard');
  };
  const exitPreview = () => {
    setPreviewMode(false);
    setSidebarOpen(false);
    navigate('/admin');
  };

  const handleSignOut = () => {
    signOut();
    navigate('/auth/signin');
  };

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    const [linkPath, linkQuery] = path.split('?');
    if (!location.pathname.startsWith(linkPath)) return false;
    // For deep-linked tab variants, also require all query params on the link to match the URL.
    if (linkQuery) {
      const currentParams = new URLSearchParams(location.search);
      const linkParams = new URLSearchParams(linkQuery);
      for (const [k, v] of linkParams) {
        if (currentParams.get(k) !== v) return false;
      }
    }
    return true;
  };

  /* ── NavLink used in both mobile sheet and desktop sidebar ── */
  const NavLink = ({
    to,
    label,
    icon: Icon,
    accent = false,
    isCollapsed = false,
  }: {
    to: string;
    label: string;
    icon: React.ElementType;
    accent?: boolean;
    isCollapsed?: boolean;
  }) => (
    <Link
      to={to}
      onClick={() => setSidebarOpen(false)}
      title={isCollapsed ? label : undefined}
      className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-colors ${
        isCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
      } ${
        isActive(to)
          ? accent
            ? 'bg-red-500/15 text-red-400'
            : 'bg-primary/10 text-primary'
          : accent
          ? 'text-red-400/70 hover:bg-red-500/10 hover:text-red-400'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {!isCollapsed && <span className="truncate">{label}</span>}
    </Link>
  );

  /* ── Mobile sidebar content (always expanded) ── */
  const MobileSidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <Link to="/" className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg font-bold text-sm ${
              isAdmin ? 'bg-red-500 text-white' : 'bg-primary text-primary-foreground'
            }`}
          >
            AYO
          </div>
          <div>
            <span className="font-display font-bold text-sm block leading-tight">
              African Youth Observatory
            </span>
            {isAdmin && (
              <span className="text-[10px] text-red-400 font-semibold">Admin Access</span>
            )}
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-3 overflow-y-auto space-y-4">
        {inAdminMode ? (
          // Admin mode: admin + contributor sections only. No user nav.
          <>
            <div>
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-red-400/60">
                Administration
              </p>
              <div className="space-y-0.5">
                {adminLinks.map((link) => (
                  <NavLink key={link.to} {...link} accent />
                ))}
              </div>
            </div>
            <div>
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-blue-400/60">
                Contributor
              </p>
              <div className="space-y-0.5">
                {contributorLinks.map((link) => (
                  <NavLink key={link.to} {...link} />
                ))}
              </div>
            </div>
            <div className="mt-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={enterPreview}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="See the platform as a regular user"
              >
                <Eye className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">Preview as user</span>
              </button>
            </div>
          </>
        ) : inPreviewMode ? (
          // Preview mode: user-facing nav, no admin section.
          <>
            <div>
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-blue-400/60">
                Contributor
              </p>
              <div className="space-y-0.5">
                {contributorLinks.map((link) => (
                  <NavLink key={link.to} {...link} />
                ))}
              </div>
            </div>
            <div>
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                Data &amp; Analytics
              </p>
              <div className="space-y-0.5">
                {dataLinks.map((link) => (
                  <NavLink key={link.to} {...link} />
                ))}
              </div>
            </div>
            <div className="mt-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={exitPreview}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
              >
                <ArrowLeft className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">Exit preview</span>
              </button>
            </div>
          </>
        ) : (
          // Non-admin (regular user / contributor / guest): existing nav.
          <>
            {isContributor && (
              <div>
                <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-blue-400/60">
                  Contributor
                </p>
                <div className="space-y-0.5">
                  {contributorLinks.map((link) => (
                    <NavLink key={link.to} {...link} />
                  ))}
                </div>
              </div>
            )}
            <div>
              {isContributor && (
                <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  Data &amp; Analytics
                </p>
              )}
              <div className="space-y-0.5">
                {dataLinks.map((link) => (
                  <NavLink key={link.to} {...link} />
                ))}
              </div>
            </div>
          </>
        )}
      </nav>

      {/* User info + actions */}
      <div className="p-3 border-t border-border space-y-1">
        {user ? (
          <>
            <div className="px-3 py-2 mb-1 flex items-center gap-2">
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  isAdmin ? 'bg-red-500/20 text-red-400' : 'bg-primary/20 text-primary'
                }`}
              >
                {(user.name || user.email).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {user.name || user.email}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">{user.role}</p>
              </div>
            </div>
            <Link
              to="/settings"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </>
        ) : (
          <>
            <p className="px-3 pt-1 pb-2 text-[11px] text-muted-foreground leading-relaxed">
              Browsing as guest. Sign in to upload data, export reports, or manage content.
            </p>
            <Link
              to="/auth/signin"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/auth/signup"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              Create account
            </Link>
          </>
        )}
      </div>
    </div>
  );

  /* ── Desktop sidebar content (supports collapsed) ── */
  const DesktopSidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <Link
          to="/"
          className="flex items-center gap-2"
          title={collapsed ? 'African Youth Observatory' : undefined}
        >
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg font-bold text-sm flex-shrink-0 ${
              isAdmin ? 'bg-red-500 text-white' : 'bg-primary text-primary-foreground'
            }`}
          >
            AYO
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <span className="font-display font-bold text-sm block leading-tight truncate">
                African Youth Observatory
              </span>
              {isAdmin && (
                <span className="text-[10px] text-red-400 font-semibold">Admin Access</span>
              )}
            </div>
          )}
        </Link>
      </div>

      <nav className="flex-1 p-3 overflow-y-auto space-y-4">
        {inAdminMode ? (
          <>
            <div>
              {!collapsed && (
                <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-red-400/60">
                  Administration
                </p>
              )}
              <div className="space-y-0.5">
                {adminLinks.map((link) => (
                  <NavLink key={link.to} {...link} accent isCollapsed={collapsed} />
                ))}
              </div>
            </div>
            <div>
              {!collapsed && (
                <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-blue-400/60">
                  Contributor
                </p>
              )}
              <div className="space-y-0.5">
                {contributorLinks.map((link) => (
                  <NavLink key={link.to} {...link} isCollapsed={collapsed} />
                ))}
              </div>
            </div>
            <div className="mt-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={enterPreview}
                title={collapsed ? 'Preview as user' : undefined}
                className={`w-full flex items-center gap-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ${
                  collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
                }`}
              >
                <Eye className="h-4 w-4 flex-shrink-0" />
                {!collapsed && <span className="truncate">Preview as user</span>}
              </button>
            </div>
          </>
        ) : inPreviewMode ? (
          <>
            <div>
              {!collapsed && (
                <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-blue-400/60">
                  Contributor
                </p>
              )}
              <div className="space-y-0.5">
                {contributorLinks.map((link) => (
                  <NavLink key={link.to} {...link} isCollapsed={collapsed} />
                ))}
              </div>
            </div>
            <div>
              {!collapsed && (
                <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  Data &amp; Analytics
                </p>
              )}
              <div className="space-y-0.5">
                {dataLinks.map((link) => (
                  <NavLink key={link.to} {...link} isCollapsed={collapsed} />
                ))}
              </div>
            </div>
            <div className="mt-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={exitPreview}
                title={collapsed ? 'Exit preview' : undefined}
                className={`w-full flex items-center gap-3 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors ${
                  collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
                }`}
              >
                <ArrowLeft className="h-4 w-4 flex-shrink-0" />
                {!collapsed && <span className="truncate">Exit preview</span>}
              </button>
            </div>
          </>
        ) : (
          <>
            {isContributor && (
              <div>
                {!collapsed && (
                  <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-blue-400/60">
                    Contributor
                  </p>
                )}
                <div className="space-y-0.5">
                  {contributorLinks.map((link) => (
                    <NavLink key={link.to} {...link} isCollapsed={collapsed} />
                  ))}
                </div>
              </div>
            )}
            <div>
              {!collapsed && isContributor && (
                <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  Data &amp; Analytics
                </p>
              )}
              <div className="space-y-0.5">
                {dataLinks.map((link) => (
                  <NavLink key={link.to} {...link} isCollapsed={collapsed} />
                ))}
              </div>
            </div>
          </>
        )}
      </nav>

      {/* User info + actions */}
      <div className="p-3 border-t border-border space-y-1">
        {user ? (
          <>
            {!collapsed && (
              <div className="px-3 py-2 mb-1 flex items-center gap-2">
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    isAdmin ? 'bg-red-500/20 text-red-400' : 'bg-primary/20 text-primary'
                  }`}
                >
                  {(user.name || user.email).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {user.name || user.email}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">{user.role}</p>
                </div>
              </div>
            )}

            {collapsed && (
              <div className="flex justify-center py-2" title={user.name || user.email}>
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    isAdmin ? 'bg-red-500/20 text-red-400' : 'bg-primary/20 text-primary'
                  }`}
                >
                  {(user.name || user.email).charAt(0).toUpperCase()}
                </div>
              </div>
            )}

            <Link
              to="/settings"
              title={collapsed ? 'Settings' : undefined}
              className={`flex items-center gap-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ${
                collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
              }`}
            >
              <Settings className="h-4 w-4 flex-shrink-0" />
              {!collapsed && 'Settings'}
            </Link>
            <button
              onClick={handleSignOut}
              title={collapsed ? 'Sign Out' : undefined}
              className={`w-full flex items-center gap-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ${
                collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
              }`}
            >
              <LogOut className="h-4 w-4 flex-shrink-0" />
              {!collapsed && 'Sign Out'}
            </button>
          </>
        ) : (
          <>
            {!collapsed && (
              <p className="px-3 pt-1 pb-2 text-[11px] text-muted-foreground leading-relaxed">
                Browsing as guest. Sign in to upload data or export reports.
              </p>
            )}
            <Link
              to="/auth/signin"
              title={collapsed ? 'Sign In' : undefined}
              className={`flex items-center gap-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors ${
                collapsed ? 'justify-center px-2 py-2.5' : 'justify-center px-3 py-2.5'
              }`}
            >
              <LogOut className="h-4 w-4 flex-shrink-0 rotate-180" />
              {!collapsed && 'Sign In'}
            </Link>
            {!collapsed && (
              <Link
                to="/auth/signup"
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                Create account
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );

  // Derive topbar title from current path
  const pageTitle = (() => {
    const p = location.pathname;
    if (p === '/admin/cms') return 'Content Manager';
    if (p === '/admin/reports') return 'Reports & Files';
    if (p === '/admin') return 'Admin Panel';
    if (p === '/dashboard') return 'Overview';
    if (p.includes('explore')) return 'Data Explorer';
    if (p.includes('countries')) return 'Report Cards';
    if (p.includes('themes')) return 'Themes';
    if (p.includes('youth-index')) return 'Youth Index';
    if (p.includes('compare')) return 'Compare';
    if (p.includes('insights')) return 'AI Insights';
    if (p.includes('ask')) return 'Ask AI';
    if (p.includes('policy-monitor')) return 'Policy Monitor';
    if (p.includes('experts')) return 'Experts';
    if (p.includes('contributor/reports')) return 'Reports & Files';
    if (p.includes('/pkpb')) return 'Promise Kept · Promise Broken';
    if (p.includes('reports')) return 'Reports';
    if (p.includes('data-upload')) return 'Contributor Hub';
    if (p.includes('settings')) return 'Settings';
    return 'Dashboard';
  })();

  const userInitial = user ? (user.name || user.email).charAt(0).toUpperCase() : '?';

  return (
    <div className="min-h-screen flex">
      {/* Desktop Sidebar — fixed, hover-to-expand. Main content shifts right to match. */}
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="hidden lg:flex flex-col border-r border-border bg-sidebar-background fixed top-0 left-0 h-screen z-50 transition-[width] duration-200 ease-in-out overflow-hidden shadow-lg shadow-black/20"
        style={{ width: hovered ? 240 : 64 }}
      >
        <DesktopSidebarContent />
      </aside>

      {/* Main Content — left margin tracks the sidebar width so content shifts on hover.
          We deliberately let the page (body) be the scroll container instead of nesting
          an `overflow-y-auto` <main>. Nested scroll feels stiff on mobile (no native
          momentum on iOS, double-scroll glitches), and sticky/fixed elements still work
          because the sidebar is fixed and the topbar uses `sticky top-0`. */}
      <div
        className="flex-1 flex flex-col min-w-0 transition-[margin-left] duration-200 ease-in-out"
        style={{ marginLeft: isDesktop ? (hovered ? 240 : 64) : 0 }}
      >
        <LiveDataTicker />

        {/* Top Bar */}
        <header
          className={`sticky top-0 z-40 h-14 border-b border-border backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-3 sm:px-4 ${
            isAdmin && location.pathname === '/admin'
              ? 'bg-red-950/30'
              : 'bg-background/95'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                {/* Labeled trigger — first-time mobile users find the nav at a glance. */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden h-9 px-2 gap-1.5 text-foreground hover:bg-muted -ml-1"
                  aria-label="Open navigation menu"
                >
                  <Menu className="h-5 w-5" />
                  <span className="text-xs font-medium">Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <MobileSidebarContent />
              </SheetContent>
            </Sheet>
            <div className="flex items-center gap-2 min-w-0">
              {location.pathname === '/admin' && (
                <ShieldCheck className="h-4 w-4 text-red-400 shrink-0" />
              )}
              <h1
                className={`text-sm font-semibold truncate ${
                  location.pathname === '/admin' ? 'text-red-400' : 'text-foreground'
                }`}
              >
                {pageTitle}
              </h1>
            </div>
          </div>

          {/* Right side: admin shortcuts + avatar (signed in) or Sign-in CTA. */}
          <div className="flex items-center gap-2 shrink-0">
            {isAdminRoute && isAdmin && (
              <>
                {/* Command palette pill — also opens on ⌘K / Ctrl-K. */}
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new Event('admin-palette:open'))}
                  className="hidden sm:inline-flex items-center gap-1.5 h-8 px-2 rounded-md border border-border bg-white/[0.04] text-[11px] text-muted-foreground hover:text-foreground hover:bg-white/[0.08] transition-colors"
                  title="Open command palette (⌘K)"
                >
                  <CommandIcon className="h-3.5 w-3.5" />
                  Jump to…
                  <kbd className="ml-1 hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-black/40 border border-border text-[10px] font-mono">
                    ⌘K
                  </kbd>
                </button>
                {/* Density toggle. */}
                <button
                  type="button"
                  onClick={toggleDensity}
                  className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border bg-white/[0.04] text-muted-foreground hover:text-foreground hover:bg-white/[0.08] transition-colors"
                  title={density === 'compact' ? 'Switch to comfortable layout' : 'Switch to compact layout'}
                >
                  {density === 'compact' ? (
                    <Maximize2 className="h-3.5 w-3.5" />
                  ) : (
                    <Minimize2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </>
            )}
            {user ? (
              <Link
                to="/settings#profile"
                title="Open profile"
                className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-opacity hover:opacity-80 ${
                    isAdmin
                      ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30'
                      : 'bg-primary/20 text-primary ring-1 ring-primary/30'
                  }`}
                >
                  {userInitial}
                </div>
              </Link>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs hidden sm:inline-flex">
                  <Link to="/auth/signin">Sign in</Link>
                </Button>
                <Button asChild size="sm" className="h-8 px-3 text-xs">
                  <Link to="/auth/signup">Sign up</Link>
                </Button>
              </>
            )}
          </div>
        </header>

        {/* First-visit nav hint — subtle banner that helps mobile users discover the
            menu trigger. Auto-dismisses after one menu open or via the X button. */}
        <NavHintBanner active={!sidebarOpen} />

        {/* Preview-mode banner: always visible across every page when an
            admin is browsing as a regular user. Gives them an unmissable
            one-click route back to the admin console. */}
        {inPreviewMode && (
          <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2 bg-red-500/15 border-b border-red-500/40 text-xs">
            <span className="text-red-300 flex items-center gap-1.5 min-w-0">
              <Eye className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Preview mode — you're viewing the platform as a regular user.</span>
            </span>
            <button
              type="button"
              onClick={exitPreview}
              className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/25 hover:bg-red-500/35 text-red-200 hover:text-red-100 font-medium transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Exit preview
            </button>
          </div>
        )}

        {/* Page Content — admin pages honour the density preference. */}
        <main
          data-density={isAdminRoute ? density : 'comfortable'}
          className={
            isAdminRoute && density === 'compact'
              ? 'flex-1 p-2 sm:p-3 md:p-4'
              : 'flex-1 p-3 sm:p-4 md:p-6'
          }
        >
          {children}
        </main>
        {/* Command palette — mounted only on admin pages so it doesn't intercept
            ⌘K elsewhere (and so the bundle is tree-shakable on the public app). */}
        {isAdminRoute && isAdmin && <AdminCommandPalette />}
      </div>
    </div>
  );
};

export default DashboardLayout;
