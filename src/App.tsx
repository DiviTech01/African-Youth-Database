import React, { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { ContentProvider } from "@/contexts/ContentContext";
import { UserPreferencesProvider } from "@/contexts/UserPreferencesContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import CookieConsent from "@/components/CookieConsent";
import PublicLayout from "@/layouts/PublicLayout";
import DashboardLayout from "@/layouts/DashboardLayout";
import PageTransition from "@/components/PageTransition";
import { ScrollToTop } from "@/components/ScrollToTop";
import { AuthRequired } from "@/components/AuthRequired";
import { PublicOnly } from "@/components/PublicOnly";
import { RoleRequired } from "@/components/RoleRequired";

// Critical pages - static imports
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import SignIn from "./pages/auth/SignIn";
import SignUp from "./pages/auth/SignUp";
import NotFound from "./pages/NotFound";

// Lazy-loaded pages
const Explore = lazy(() => import("./pages/Explore"));
const Compare = lazy(() => import("./pages/Compare"));
const Themes = lazy(() => import("./pages/Themes"));
const Countries = lazy(() => import("./pages/Countries"));
const About = lazy(() => import("./pages/About"));
const Reports = lazy(() => import("./pages/Reports"));
const Contact = lazy(() => import("./pages/Contact"));
const YouthIndex = lazy(() => import("./pages/YouthIndex"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Insights = lazy(() => import("./pages/Insights"));
const PolicyMonitor = lazy(() => import("./pages/PolicyMonitor"));
const NaturalLanguageQuery = lazy(() => import("./pages/NaturalLanguageQuery"));
const Experts = lazy(() => import("./pages/Experts"));
const Admin = lazy(() => import("./pages/Admin"));
const Settings = lazy(() => import("./pages/Settings"));
const Glossary = lazy(() => import("./pages/resources/Glossary"));
const FAQ = lazy(() => import("./pages/resources/FAQ"));
const Methodology = lazy(() => import("./pages/resources/Methodology"));
const Toolkits = lazy(() => import("./pages/resources/Toolkits"));
const CountryProfilePage = lazy(() => import("./pages/CountryProfilePage"));
const CountryDataProfile = lazy(() => import("./pages/CountryDataProfile"));
const PromiseKeptBrokenCountry = lazy(() => import("./pages/PromiseKeptBrokenCountry"));
const PromiseKeptBrokenIndex = lazy(() => import("./pages/PromiseKeptBrokenIndex"));
const ContributorReports = lazy(() => import("./pages/ContributorReports"));
const DataUpload = lazy(() => import("./pages/DataUpload"));
const ContentManager = lazy(() => import("./pages/admin/ContentManager"));
const ReportsManager = lazy(() => import("./pages/admin/ReportsManager"));
const NewsletterManager = lazy(() => import("./pages/admin/NewsletterManager"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <LanguageProvider>
  <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <AuthProvider>
          <ContentProvider>
          <UserPreferencesProvider>
          <AnimatePresence mode="wait">
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
            <Routes>
              {/* ── PublicOnly: bounce authenticated users away ──
                  Only the marketing landing + the auth screens themselves —
                  signed-in users on /auth/signin should land in /dashboard. */}
              <Route element={<PublicOnly />}>
                <Route path="/" element={<PublicLayout><PageTransition><Index /></PageTransition></PublicLayout>} />
                <Route path="/landing" element={<PageTransition><Landing /></PageTransition>} />
                <Route path="/auth/signin" element={<PageTransition><SignIn /></PageTransition>} />
                <Route path="/auth/signup" element={<PageTransition><SignUp /></PageTransition>} />
              </Route>

              {/* ── Public marketing pages (minimal layout) ── */}
              <Route path="/about" element={<PublicLayout><PageTransition><About /></PageTransition></PublicLayout>} />
              <Route path="/contact" element={<PublicLayout><PageTransition><Contact /></PageTransition></PublicLayout>} />

              {/* ── Open dashboard (no auth gate) ──
                  Anyone can browse data, charts, country profiles, PKPB
                  reports, etc. Signin is only prompted per-action by
                  `useExportGuard` when a user tries to download / export. */}
              <Route path="/dashboard" element={<DashboardLayout><PageTransition><Dashboard /></PageTransition></DashboardLayout>} />
              <Route path="/explore" element={<DashboardLayout><PageTransition><Explore /></PageTransition></DashboardLayout>} />
              <Route path="/dashboard/explore" element={<DashboardLayout><PageTransition><Explore /></PageTransition></DashboardLayout>} />
              <Route path="/compare" element={<DashboardLayout><PageTransition><Compare /></PageTransition></DashboardLayout>} />
              <Route path="/dashboard/compare" element={<DashboardLayout><PageTransition><Compare /></PageTransition></DashboardLayout>} />
              <Route path="/themes" element={<DashboardLayout><PageTransition><Themes /></PageTransition></DashboardLayout>} />
              <Route path="/dashboard/themes" element={<DashboardLayout><PageTransition><Themes /></PageTransition></DashboardLayout>} />
              <Route path="/countries" element={<DashboardLayout><PageTransition><Countries /></PageTransition></DashboardLayout>} />
              <Route path="/dashboard/countries" element={<DashboardLayout><PageTransition><Countries /></PageTransition></DashboardLayout>} />
              <Route path="/countries/:id" element={<DashboardLayout><PageTransition><CountryProfilePage /></PageTransition></DashboardLayout>} />
              <Route path="/dashboard/countries/:id" element={<DashboardLayout><PageTransition><CountryProfilePage /></PageTransition></DashboardLayout>} />
              <Route path="/pkpb" element={<DashboardLayout><PageTransition><PromiseKeptBrokenIndex /></PageTransition></DashboardLayout>} />
              <Route path="/dashboard/pkpb" element={<DashboardLayout><PageTransition><PromiseKeptBrokenIndex /></PageTransition></DashboardLayout>} />
              <Route path="/pkpb/:countryRef" element={<DashboardLayout><PageTransition><PromiseKeptBrokenCountry /></PageTransition></DashboardLayout>} />
              <Route path="/dashboard/pkpb/:countryRef" element={<DashboardLayout><PageTransition><PromiseKeptBrokenCountry /></PageTransition></DashboardLayout>} />
              <Route path="/reports" element={<DashboardLayout><PageTransition><Reports /></PageTransition></DashboardLayout>} />
              <Route path="/dashboard/reports" element={<DashboardLayout><PageTransition><Reports /></PageTransition></DashboardLayout>} />
              <Route path="/youth-index" element={<DashboardLayout><PageTransition><YouthIndex /></PageTransition></DashboardLayout>} />
              <Route path="/dashboard/youth-index" element={<DashboardLayout><PageTransition><YouthIndex /></PageTransition></DashboardLayout>} />
              <Route path="/dashboard/profile/:slug" element={<DashboardLayout><PageTransition><CountryDataProfile /></PageTransition></DashboardLayout>} />
              <Route path="/profile/:slug" element={<DashboardLayout><PageTransition><CountryDataProfile /></PageTransition></DashboardLayout>} />
              <Route path="/insights" element={<DashboardLayout><PageTransition><Insights /></PageTransition></DashboardLayout>} />
              <Route path="/dashboard/insights" element={<DashboardLayout><PageTransition><Insights /></PageTransition></DashboardLayout>} />
              <Route path="/policy-monitor" element={<DashboardLayout><PageTransition><PolicyMonitor /></PageTransition></DashboardLayout>} />
              <Route path="/dashboard/policy-monitor" element={<DashboardLayout><PageTransition><PolicyMonitor /></PageTransition></DashboardLayout>} />
              <Route path="/ask" element={<DashboardLayout><PageTransition><NaturalLanguageQuery /></PageTransition></DashboardLayout>} />
              <Route path="/dashboard/ask" element={<DashboardLayout><PageTransition><NaturalLanguageQuery /></PageTransition></DashboardLayout>} />
              <Route path="/experts" element={<DashboardLayout><PageTransition><Experts /></PageTransition></DashboardLayout>} />
              <Route path="/dashboard/experts" element={<DashboardLayout><PageTransition><Experts /></PageTransition></DashboardLayout>} />

              {/* Resources — also publicly browsable */}
              <Route path="/resources/glossary" element={<DashboardLayout><PageTransition><Glossary /></PageTransition></DashboardLayout>} />
              <Route path="/resources/faq" element={<DashboardLayout><PageTransition><FAQ /></PageTransition></DashboardLayout>} />
              <Route path="/resources/methodology" element={<DashboardLayout><PageTransition><Methodology /></PageTransition></DashboardLayout>} />
              <Route path="/resources/toolkits" element={<DashboardLayout><PageTransition><Toolkits /></PageTransition></DashboardLayout>} />

              {/* ── Auth-gated (any signed-in user) ── */}
              <Route element={<AuthRequired />}>
                <Route path="/settings" element={<DashboardLayout><PageTransition><Settings /></PageTransition></DashboardLayout>} />
              </Route>

              {/* ── Contributor + Admin only ── */}
              <Route element={<RoleRequired roles={['CONTRIBUTOR', 'ADMIN']} />}>
                <Route path="/dashboard/data-upload" element={<DashboardLayout><PageTransition><DataUpload /></PageTransition></DashboardLayout>} />
                <Route path="/dashboard/contributor/reports" element={<DashboardLayout><PageTransition><ContributorReports /></PageTransition></DashboardLayout>} />
              </Route>

              {/* ── Admin only ── */}
              <Route element={<RoleRequired roles={['ADMIN']} />}>
                <Route path="/admin" element={<DashboardLayout><PageTransition><Admin /></PageTransition></DashboardLayout>} />
                <Route path="/admin/cms" element={<DashboardLayout><PageTransition><ContentManager /></PageTransition></DashboardLayout>} />
                <Route path="/admin/reports" element={<DashboardLayout><PageTransition><ReportsManager /></PageTransition></DashboardLayout>} />
                <Route path="/admin/newsletter" element={<DashboardLayout><PageTransition><NewsletterManager /></PageTransition></DashboardLayout>} />
              </Route>

              {/* Catch-all */}
              <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
            </Routes>
            </Suspense>
          </AnimatePresence>
          </UserPreferencesProvider>
          </ContentProvider>
          </AuthProvider>
          <CookieConsent />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
  </LanguageProvider>
);

export default App;
