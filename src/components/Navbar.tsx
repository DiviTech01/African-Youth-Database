import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Search, Menu, X, LogOut, LayoutDashboard, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';
// Theme toggle removed - dark mode only
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useLanguage } from '@/contexts/LanguageContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { WhatsNew } from '@/components/WhatsNew';
import { Content } from '@/components/cms';

const Navbar = () => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);

  // Search API
  const { data: searchResults } = useQuery({
    queryKey: ['search', searchQuery],
    queryFn: () => fetch(`${import.meta.env.VITE_API_URL || '/api'}/search?q=${encodeURIComponent(searchQuery)}&limit=5`).then(r => r.ok ? r.json() : null).catch(() => null),
    enabled: searchQuery.length >= 2,
  });

  const hasResults = searchResults && searchResults.totalResults > 0;

  // Close search dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, signOut } = useAuth();
  const { t } = useLanguage();

  const navLinks: { to: string; label: string }[] = [];

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const handleSignOut = () => {
    signOut();
    navigate('/');
  };

  const toggleSearch = () => setIsSearchOpen(!isSearchOpen);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearchQuery('');
    setIsSearchOpen(false);
    setIsSheetOpen(false);
    navigate(`/explore?q=${encodeURIComponent(q)}`);
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 sm:h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-center space-x-2">
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-md bg-primary">
              <span className="font-bold text-primary-foreground text-sm sm:text-base">AYO</span>
            </div>
            <Content
              as="span"
              id="navbar.brand.name"
              fallback="African Youth Observatory"
              className="hidden font-display font-bold sm:inline-block text-sm md:text-base text-foreground"
            />
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-4 xl:gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`text-sm font-medium transition-colors hover:text-primary ${
                isActive(link.to) ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          {isSearchOpen ? (
            <div ref={searchRef} className="flex items-center relative animate-fade-in">
              <form onSubmit={handleSearchSubmit} className="contents">
                <Input
                  type="search"
                  placeholder={t('nav.search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-[160px] sm:w-[200px] lg:w-[250px] text-sm"
                  autoFocus
                />
              </form>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { toggleSearch(); setSearchQuery(''); }}
                className="absolute right-0 h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
              {/* Search Results Dropdown */}
              {hasResults && (
                <div className="absolute top-full right-0 mt-1 w-[280px] sm:w-[320px] max-h-[400px] overflow-y-auto rounded-lg border border-gray-700 bg-black/95 backdrop-blur-md shadow-lg z-50">
                  {(['countries', 'indicators', 'themes', 'experts', 'dashboards'] as const).map((type) => {
                    const items = searchResults?.results?.[type];
                    if (!items?.length) return null;
                    return (
                      <div key={type}>
                        <p className="text-[10px] uppercase text-gray-500 px-3 pt-2 pb-1 font-medium">{type}</p>
                        {items.map((hit: any) => (
                          <Link
                            key={hit.id}
                            to={hit.url}
                            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/[0.06] transition-colors"
                            onClick={() => { setSearchQuery(''); setIsSearchOpen(false); }}
                          >
                            {hit.icon && <span>{hit.icon}</span>}
                            <div className="min-w-0">
                              <p className="truncate font-medium">{hit.title}</p>
                              {hit.subtitle && <p className="text-xs text-gray-500 truncate">{hit.subtitle}</p>}
                            </div>
                          </Link>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSearch}
              className="h-8 w-8 sm:h-9 sm:w-9"
            >
              <Search className="h-4 w-4" />
            </Button>
          )}
          
          <WhatsNew />
          <LanguageSwitcher />
          
          {isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="hidden sm:flex items-center gap-2 h-8 sm:h-9 px-1 sm:px-2"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5 text-sm font-medium">{user.name}</div>
                <div className="px-2 pb-1.5 text-xs text-muted-foreground">{user.email}</div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/dashboard" className="flex items-center gap-2 cursor-pointer">
                    <LayoutDashboard className="h-4 w-4" />
                    <Content as="span" id="navbar.user_menu.dashboard" fallback="Dashboard" />
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex items-center gap-2 cursor-pointer">
                    <Settings className="h-4 w-4" />
                    <Content as="span" id="navbar.user_menu.settings" fallback="Settings" />
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  <Content as="span" id="navbar.user_menu.sign_out" fallback="Sign Out" />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:flex text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
              asChild
            >
              <Link to="/auth/signin">{t('nav.signIn')}</Link>
            </Button>
          )}
          
          {/* Mobile Menu */}
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden h-8 w-8 sm:h-9 sm:w-9"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] sm:w-[320px]">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                    <span className="font-bold text-primary-foreground">AYO</span>
                  </div>
                  <Content as="span" id="navbar.brand.name" fallback="African Youth Observatory" className="text-foreground" />
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 mt-6">
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setIsSheetOpen(false)}
                    className={`flex items-center gap-2 px-3 py-3 rounded-lg text-base font-medium transition-colors ${
                      isActive(link.to)
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
              
              <div className="mt-6 pt-6 border-t border-border space-y-4">
                <form onSubmit={handleSearchSubmit} className="relative">
                  <Input
                    type="search"
                    placeholder={t('nav.search')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pr-10"
                  />
                  <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    <Search className="h-4 w-4" />
                  </button>
                </form>
                {isAuthenticated && user ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 px-1">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{user.name}</span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      </div>
                    </div>
                    <Link
                      to="/dashboard"
                      onClick={() => setIsSheetOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      <Content as="span" id="navbar.user_menu.dashboard" fallback="Dashboard" />
                    </Link>
                    <Link
                      to="/settings"
                      onClick={() => setIsSheetOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Settings className="h-4 w-4" />
                      <Content as="span" id="navbar.user_menu.settings" fallback="Settings" />
                    </Link>
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => {
                        handleSignOut();
                        setIsSheetOpen(false);
                      }}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      <Content as="span" id="navbar.user_menu.sign_out" fallback="Sign Out" />
                    </Button>
                  </div>
                ) : (
                  <Button className="w-full" variant="outline" asChild>
                    <Link to="/auth/signin" onClick={() => setIsSheetOpen(false)}>
                      {t('nav.signIn')}
                    </Link>
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
