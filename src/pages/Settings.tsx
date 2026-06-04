import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import CountryFlag from '@/components/CountryFlag';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import {
  X, Trash2, RotateCcw, Settings as SettingsIcon, Globe, User as UserIcon, Lock,
  Sliders, Mail, Shield, Star, Save, Eye, EyeOff, LogOut, Building2, Loader2, Check,
} from 'lucide-react';
import { useLanguage, LANGUAGES } from '@/contexts/LanguageContext';

const AFRICAN_COUNTRIES = [
  'Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi',
  'Cabo Verde', 'Cameroon', 'Central African Republic', 'Chad', 'Comoros',
  'Congo', "Côte d'Ivoire", 'DRC', 'Djibouti', 'Egypt',
  'Equatorial Guinea', 'Eritrea', 'Eswatini', 'Ethiopia', 'Gabon', 'Gambia',
  'Ghana', 'Guinea', 'Guinea-Bissau', 'Kenya', 'Lesotho', 'Liberia',
  'Libya', 'Madagascar', 'Malawi', 'Mali', 'Mauritania', 'Mauritius',
  'Morocco', 'Mozambique', 'Namibia', 'Niger', 'Nigeria', 'Rwanda',
  'São Tomé and Príncipe', 'Senegal', 'Seychelles', 'Sierra Leone',
  'Somalia', 'South Africa', 'South Sudan', 'Sudan', 'Tanzania', 'Togo',
  'Tunisia', 'Uganda', 'Zambia', 'Zimbabwe',
];

const REGIONS = ['North Africa', 'West Africa', 'Central Africa', 'East Africa', 'Southern Africa'];

const getInitials = (name: string) =>
  name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

type SettingsTab = 'profile' | 'security' | 'preferences';
const isValidTab = (s: string | null): s is SettingsTab =>
  s === 'profile' || s === 'security' || s === 'preferences';

const Settings = () => {
  const { language, setLanguage, t } = useLanguage();
  const { user, signOut } = useAuth();
  // Tab is driven by the URL hash so /settings#profile, /settings#security, etc.
  // open the matching tab. Falls back to "profile" when no hash is present.
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    if (typeof window === 'undefined') return 'profile';
    const h = window.location.hash.replace('#', '');
    return isValidTab(h) ? (h as SettingsTab) : 'profile';
  });
  React.useEffect(() => {
    const onHashChange = () => {
      const h = window.location.hash.replace('#', '');
      if (isValidTab(h)) setActiveTab(h as SettingsTab);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  const handleTabChange = (v: string) => {
    if (isValidTab(v)) {
      setActiveTab(v);
      // Reflect the active tab in the URL so refreshing or sharing the link works
      if (typeof window !== 'undefined' && window.location.hash !== `#${v}`) {
        window.history.replaceState(null, '', `#${v}`);
      }
    }
  };
  const {
    preferences, setMyCountry, addFavoriteCountry, removeFavoriteCountry, setPreferredRegion, resetPreferences,
  } = useUserPreferences();
  const { toast } = useToast();
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  // ─── Profile editing ───────────────────────────────────────────
  const [editName, setEditName] = useState(user?.name ?? '');
  const [editOrganization, setEditOrganization] = useState(user?.organization ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  React.useEffect(() => {
    setEditName(user?.name ?? '');
    setEditOrganization(user?.organization ?? '');
  }, [user?.id, user?.name, user?.organization]);

  const profileDirty =
    (user?.name ?? '') !== editName.trim() ||
    (user?.organization ?? '') !== editOrganization.trim();

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      // 1) update Supabase auth user_metadata (so AuthContext gets the new name)
      await supabase.auth.updateUser({ data: { name: editName.trim() } });
      // 2) update User table row used by fetchProfile
      const { error } = await supabase
        .from('User')
        .update({ name: editName.trim(), organization: editOrganization.trim() || null })
        .eq('id', user.id);
      if (error) throw error;
      toast({ title: 'Profile updated', description: 'Your changes have been saved.' });
    } catch (e: any) {
      toast({ title: 'Update failed', description: e?.message || 'Could not save profile.', variant: 'destructive' });
    } finally {
      setSavingProfile(false);
    }
  };

  // ─── Change password ───────────────────────────────────────────
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  const passwordsValid =
    newPwd.length >= 8 && newPwd === confirmPwd && currentPwd.length > 0;

  const handleChangePassword = async () => {
    if (!user) return;
    if (!passwordsValid) {
      toast({ title: 'Check the form', description: 'Make sure your new password is at least 8 characters and matches the confirmation.', variant: 'destructive' });
      return;
    }
    setSavingPwd(true);
    try {
      // Verify current password by re-authenticating
      const reauth = await supabase.auth.signInWithPassword({ email: user.email, password: currentPwd });
      if (reauth.error) throw new Error('Current password is incorrect.');
      // Update password
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
      toast({ title: 'Password updated', description: 'Use the new password next time you sign in.' });
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (e: any) {
      toast({ title: 'Could not update password', description: e?.message || 'Try again.', variant: 'destructive' });
    } finally {
      setSavingPwd(false);
    }
  };

  // ─── Personalization helpers (unchanged) ───────────────────────
  const handleSetMyCountry = (country: string) => {
    setMyCountry(country);
    toast({ title: 'Home country updated', description: `Set to ${country}.` });
  };
  const handleClearMyCountry = () => { setMyCountry(null); toast({ title: 'Home country cleared' }); };
  const handleAddFavorite = (country: string) => { addFavoriteCountry(country); toast({ title: 'Favorite added', description: `${country} added to favorites.` }); };
  const handleRemoveFavorite = (country: string) => { removeFavoriteCountry(country); toast({ title: 'Favorite removed', description: `${country} removed from favorites.` }); };
  const handleSetRegion = (region: string) => { setPreferredRegion(region); toast({ title: 'Preferred region updated', description: `Set to ${region}.` }); };

  const handleClearHistory = () => {
    const stored = localStorage.getItem('ayd_user_preferences');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        parsed.recentlyViewed = [];
        localStorage.setItem('ayd_user_preferences', JSON.stringify(parsed));
        window.location.reload();
      } catch { /* fallback */ }
    }
    toast({ title: 'History cleared', description: 'Recently viewed countries have been cleared.' });
  };

  const handleResetAll = () => {
    resetPreferences();
    setResetDialogOpen(false);
    toast({ title: 'All preferences reset', description: 'Your settings have been restored to defaults.' });
  };

  const availableFavorites = AFRICAN_COUNTRIES.filter((c) => !preferences.favoriteCountries.includes(c));
  const initials = user ? getInitials(user.name || user.email) : 'AY';

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-6 w-6 text-[#D4A017]" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tighter bg-gradient-to-br from-[#D4A017] from-10% via-white via-40% to-white/40 bg-clip-text text-transparent">
            Settings
          </h1>
          <p className="text-xs sm:text-sm text-[#A89070] mt-0.5">
            Manage your profile, security, and how the African Youth Observatory works for you.
          </p>
        </div>
      </div>

      {/* Profile hero card */}
      <Card className="bg-gradient-to-br from-[#D4A017]/[0.06] via-white/[0.03] to-transparent border-gray-800/80 rounded-2xl overflow-hidden relative">
        <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full blur-3xl bg-[#D4A017]/10 pointer-events-none" />
        <CardContent className="p-5 relative">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16 ring-2 ring-[#D4A017]/40">
              <AvatarFallback className="bg-[#D4A017] text-black font-bold text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="text-lg font-bold text-white truncate">{user?.name || 'Anonymous'}</h2>
                {user?.role && (
                  <Badge className="bg-[#D4A017]/15 text-[#D4A017] border-[#D4A017]/30 text-[10px] uppercase tracking-wider">
                    {user.role}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-gray-400 inline-flex items-center gap-1.5">
                <Mail className="h-3 w-3" /> {user?.email || '—'}
              </p>
              {user?.organization && (
                <p className="text-xs text-gray-500 inline-flex items-center gap-1.5 mt-1">
                  <Building2 className="h-3 w-3" /> {user.organization}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-5">
        <TabsList className="grid w-full grid-cols-3 bg-white/[0.03] border border-gray-800/80 h-10 p-1">
          <TabsTrigger value="profile" className="gap-2 text-xs"><UserIcon className="h-3.5 w-3.5" /> Profile</TabsTrigger>
          <TabsTrigger value="security" className="gap-2 text-xs"><Shield className="h-3.5 w-3.5" /> Security</TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2 text-xs"><Sliders className="h-3.5 w-3.5" /> Preferences</TabsTrigger>
        </TabsList>

        {/* ─── PROFILE TAB ─── */}
        <TabsContent value="profile" className="space-y-4">
          <Card className="bg-white/[0.03] border-gray-800/80 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-[#D4A017]" /> Edit profile
              </CardTitle>
              <CardDescription className="text-gray-400 text-xs">
                Update how your name and organization appear across the platform.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-300">Display name</Label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Your full name"
                    className="text-sm bg-white/[0.04] border-gray-800"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-300">Email <span className="text-gray-600 ml-1">(read-only)</span></Label>
                  <Input
                    value={user?.email ?? ''}
                    readOnly
                    className="text-sm bg-white/[0.02] border-gray-800/60 text-gray-400 cursor-not-allowed"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs text-gray-300">Organization</Label>
                  <Input
                    value={editOrganization}
                    onChange={(e) => setEditOrganization(e.target.value)}
                    placeholder="Where you work or study"
                    className="text-sm bg-white/[0.04] border-gray-800"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditName(user?.name ?? '');
                    setEditOrganization(user?.organization ?? '');
                  }}
                  disabled={!profileDirty || savingProfile}
                >
                  Reset
                </Button>
                <Button size="sm" onClick={handleSaveProfile} disabled={!profileDirty || savingProfile} className="gap-1.5">
                  {savingProfile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save changes
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/[0.03] border-gray-800/80 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4 text-[#D4A017]" /> {t('settings.language')}
              </CardTitle>
              <CardDescription className="text-gray-400 text-xs">
                {t('settings.languageDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={language}
                onValueChange={(value) => setLanguage(value as typeof language)}
                className="grid gap-2 sm:grid-cols-2"
              >
                {LANGUAGES.map((lang) => (
                  <label
                    key={lang.code}
                    htmlFor={`lang-${lang.code}`}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                      language === lang.code
                        ? 'border-[#D4A017]/40 bg-[#D4A017]/10'
                        : 'border-gray-800 bg-white/[0.02] hover:bg-white/[0.04]'
                    }`}
                  >
                    <RadioGroupItem value={lang.code} id={`lang-${lang.code}`} />
                    <span className="text-sm">
                      {lang.nativeName} <span className="text-gray-500 text-xs">({lang.name})</span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── SECURITY TAB ─── */}
        <TabsContent value="security" className="space-y-4">
          <Card className="bg-white/[0.03] border-gray-800/80 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4 text-[#D4A017]" /> Change password
              </CardTitle>
              <CardDescription className="text-gray-400 text-xs">
                Pick something at least 8 characters long. We'll re-verify your current password before saving.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-300">Current password</Label>
                <div className="relative">
                  <Input
                    type={showPwd ? 'text' : 'password'}
                    value={currentPwd}
                    onChange={(e) => setCurrentPwd(e.target.value)}
                    placeholder="••••••••"
                    className="text-sm bg-white/[0.04] border-gray-800 pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                    aria-label={showPwd ? 'Hide passwords' : 'Show passwords'}
                  >
                    {showPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-300">New password</Label>
                  <Input
                    type={showPwd ? 'text' : 'password'}
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    placeholder="At least 8 characters"
                    className="text-sm bg-white/[0.04] border-gray-800"
                  />
                  {newPwd && newPwd.length < 8 && (
                    <p className="text-[11px] text-amber-400">Too short — needs 8+ characters.</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-300">Confirm new password</Label>
                  <Input
                    type={showPwd ? 'text' : 'password'}
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    placeholder="Repeat the new password"
                    className="text-sm bg-white/[0.04] border-gray-800"
                  />
                  {confirmPwd && confirmPwd !== newPwd && (
                    <p className="text-[11px] text-red-400">Passwords don't match.</p>
                  )}
                  {confirmPwd && confirmPwd === newPwd && newPwd.length >= 8 && (
                    <p className="text-[11px] text-emerald-400 inline-flex items-center gap-1">
                      <Check className="h-3 w-3" /> Looks good
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={handleChangePassword} disabled={!passwordsValid || savingPwd} className="gap-1.5">
                  {savingPwd ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                  Update password
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/[0.03] border-gray-800/80 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <LogOut className="h-4 w-4 text-gray-400" /> Sign out
              </CardTitle>
              <CardDescription className="text-gray-400 text-xs">
                You'll need to sign in again to access your dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" onClick={() => signOut()} className="gap-1.5">
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── PREFERENCES TAB ─── */}
        <TabsContent value="preferences" className="space-y-4">
          {/* My Country */}
          <Card className="bg-white/[0.03] border-gray-800/80 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="h-4 w-4 text-[#D4A017]" /> Home country
              </CardTitle>
              <CardDescription className="text-gray-400 text-xs">
                Personalises dashboards, the youth index, and country reports for you first.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Select value={preferences.myCountry ?? ''} onValueChange={handleSetMyCountry}>
                  <SelectTrigger className="w-full max-w-xs h-9 text-xs bg-white/[0.04] border-gray-800">
                    <SelectValue placeholder="Select a country" />
                  </SelectTrigger>
                  <SelectContent>
                    {AFRICAN_COUNTRIES.map((country) => (
                      <SelectItem key={country} value={country} className="text-xs">
                        <span className="flex items-center gap-2">
                          <CountryFlag country={country} size="xs" />
                          {country}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {preferences.myCountry && (
                  <Button variant="outline" size="sm" onClick={handleClearMyCountry} className="h-9 text-xs">
                    Clear
                  </Button>
                )}
              </div>
              {preferences.myCountry && (
                <div className="flex items-center gap-2 text-xs text-gray-400 px-3 py-2 rounded-lg bg-[#D4A017]/[0.06] border border-[#D4A017]/20">
                  <CountryFlag country={preferences.myCountry} size="md" />
                  <span><span className="font-semibold text-white">{preferences.myCountry}</span> is your home country</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Favorite Countries */}
          <Card className="bg-white/[0.03] border-gray-800/80 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Favorite countries</CardTitle>
              <CardDescription className="text-gray-400 text-xs">
                Quick-access list across the dashboard. Up to 10 countries.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {preferences.favoriteCountries.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {preferences.favoriteCountries.map((country) => (
                    <Badge
                      key={country}
                      variant="secondary"
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-white/[0.04] border-gray-800"
                    >
                      <CountryFlag country={country} size="xs" />
                      {country}
                      <button
                        onClick={() => handleRemoveFavorite(country)}
                        className="ml-1 rounded-full hover:bg-red-500/20 hover:text-red-400 p-0.5 transition-colors"
                        aria-label={`Remove ${country}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              {preferences.favoriteCountries.length >= 10 ? (
                <p className="text-xs text-gray-400">Maximum of 10 favorites reached. Remove one to add another.</p>
              ) : (
                <Select onValueChange={handleAddFavorite} value="">
                  <SelectTrigger className="w-full max-w-xs h-9 text-xs bg-white/[0.04] border-gray-800">
                    <SelectValue placeholder="Add a country to favorites" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFavorites.map((country) => (
                      <SelectItem key={country} value={country} className="text-xs">
                        <span className="flex items-center gap-2">
                          <CountryFlag country={country} size="xs" />
                          {country}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {preferences.favoriteCountries.length === 0 && (
                <p className="text-xs text-gray-500 italic">No favorites yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Preferred Region */}
          <Card className="bg-white/[0.03] border-gray-800/80 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Preferred region</CardTitle>
              <CardDescription className="text-gray-400 text-xs">
                Filters region-aware data to your area by default.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={preferences.preferredRegion ?? ''}
                onValueChange={handleSetRegion}
                className="grid gap-2 sm:grid-cols-2"
              >
                {REGIONS.map((region) => (
                  <label
                    key={region}
                    htmlFor={`region-${region}`}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                      preferences.preferredRegion === region
                        ? 'border-[#D4A017]/40 bg-[#D4A017]/10'
                        : 'border-gray-800 bg-white/[0.02] hover:bg-white/[0.04]'
                    }`}
                  >
                    <RadioGroupItem value={region} id={`region-${region}`} />
                    <span className="text-sm">{region}</span>
                  </label>
                ))}
              </RadioGroup>
              {preferences.preferredRegion && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 text-xs"
                  onClick={() => { setPreferredRegion(null); toast({ title: 'Preferred region cleared' }); }}
                >
                  Clear region preference
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Recently Viewed */}
          <Card className="bg-white/[0.03] border-gray-800/80 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Recently viewed</CardTitle>
              <CardDescription className="text-gray-400 text-xs">
                Countries you've opened in the past sessions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {preferences.recentlyViewed.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {preferences.recentlyViewed.map((country) => (
                      <Badge key={country} variant="outline" className="flex items-center gap-1.5 px-2.5 py-1 text-xs border-gray-800">
                        <CountryFlag country={country} size="xs" />
                        {country}
                      </Badge>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" onClick={handleClearHistory} className="text-xs gap-1.5">
                    <Trash2 className="h-3.5 w-3.5" /> Clear history
                  </Button>
                </>
              ) : (
                <p className="text-xs text-gray-500 italic">No recently viewed countries.</p>
              )}
            </CardContent>
          </Card>

          {/* Reset zone */}
          <Card className="border-red-500/30 bg-red-500/[0.04] rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base text-red-400 flex items-center gap-2">
                <RotateCcw className="h-4 w-4" /> Reset all preferences
              </CardTitle>
              <CardDescription className="text-gray-400 text-xs">
                Wipes home country, favorites, region, history, and any other personalisation. Cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5" /> Reset all preferences
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-black/95 border-gray-800">
                  <DialogHeader>
                    <DialogTitle>Are you sure?</DialogTitle>
                    <DialogDescription>
                      This will reset all your preferences to their defaults — home country, favourites, region,
                      and recently-viewed history. Account profile and security settings are unaffected.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => setResetDialogOpen(false)}>Cancel</Button>
                    <Button variant="destructive" onClick={handleResetAll}>Yes, reset everything</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
