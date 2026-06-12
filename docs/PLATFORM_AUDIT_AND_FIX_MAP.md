# AYD Platform — Deep Audit & Fix Map

**Date:** 2026-06-11 (updated with live production DB inventory)
**Scope:** Functional correctness (what works / what's broken), data-consistency (UI vs database), and a prioritized fix map.
**Method:** Static analysis of web `src/`, API `apps/api/src/modules/**`, Prisma schema, seed data — **plus a live read-only inventory of the production Supabase DB.**

> ## ⚠️ Important correction after live DB inventory (read this first)
> The production database is **fully populated and matches the 7-theme model the frontend uses.** Live counts:
> **54 countries · 7 themes · 107 indicators · 52,007 indicator values · 1,080 Youth Index scores · 114 PKPB reports (all PUBLISHED) · 28 experts · 54 policies · 3 newsletter subscribers · 9 users.**
> Theme breakdown matches the frontend **exactly**: youth-demography-participation (17 ind, weight 0.20), education (15, 0.15), employment (13, 0.15), health (20, 0.15), entrepreneurship (35, 0.15), peace-security (3, 0.10), access-to-justice (4, 0.10).
>
> **Consequences for this document:** the "data-consistency mismatches" P-06, P-07, P-08, P-10 below were diagnosed against the **stale seed JSON files** (`seed/themes.json` = 12 themes, `seed/indicators.json` = 94), which are *outdated dev artifacts* and do **not** reflect production. Against the live DB, **the frontend's theme names, weights, and indicator counts are correct**, and `Theme.weight` **is** populated. Those four findings are **downgraded to "stale seed only"** (fix: refresh the seed files for parity, non-blocking). Indicator values span years 1995–2050 (some projections) and index scores 2006–2025; **every country and indicator has data.**
>
> **The real launch blockers are unchanged and confirmed:** the fake-data pages (P-01..P-05) bypass this populated API and render random/placeholder data. Wiring them to the real endpoints will surface **real numbers**. That is the core build.

---

## 1. Headline: what's blocking launch

The backend is solid. The problem is the **frontend renders fabricated data on several major pages**, and the **theme taxonomy is inconsistent** across the UI, the seed, and the Youth Index engine. Users would currently see invented numbers presented as real.

**Tier-1 launch blockers (fake data shown to users):**

| ID | Page | What's wrong | File |
|----|------|--------------|------|
| P-01 | `/compare` | **Entire page fabricated.** Bar/radar/table/exported-PNG all from `seededRandom()`. No API call. | `src/components/compare/CountryComparison.tsx:39,47,572,655,673,1080` |
| P-02 | `/insights` | **Entire page fabricated.** 8 hardcoded "AI insights" with invented stats ("Rwanda +12%", "$240M"). Real `/insights/*` backend ignored. | `src/pages/Insights.tsx:74-230` |
| P-03 | `/dashboard` (signed-in landing) | **Random charts.** Default + new widgets use `Math.random()` per render. (Note: `DashboardBuilder.tsx` uses real data — this is the *other* dashboard.) | `src/pages/Dashboard.tsx:79-150,408,420` |
| P-04 | `/experts` | Falls back to **9 invented experts** when the API returns empty. If the DB is empty at launch, users see fake people. | `src/pages/Experts.tsx:33-131,208` |
| P-05 | `/reports` | **localStorage-only** (base64 data URLs). Admin uploads only visible on the uploading device; embed iframe (`/embed/report/:id`) **doesn't exist**; only `public/reports/Nigeria.html` exists so every other country's report card 404s. | `src/services/adminContent.ts`, `src/pages/Reports.tsx:202`, `src/pages/CountryReportCard.tsx:217` |

**Tier-2 data-model inconsistencies (wrong/contradictory numbers):**

| ID | Issue | Detail | File |
|----|-------|--------|------|
| P-06 | **Two coexisting "theme" concepts (7 vs 12)** | The public Themes page + Youth Index use a **7-dimension** model; the data-explorer catalog uses **12 themes** from the seed. *Correction after deeper review:* this is **by design** (a deliberate recent "7-theme migration" — see web commit `181647d` and the mobile parity commit). The Youth Index keys on **indicator slugs**, not theme slugs, and **all its indicator slugs exist in the seed** (verified) — so the index *does* compute (given data). The real issue is **UX/consistency**: two taxonomies are visible and the `Theme.weight` comments are misleading (the index uses hardcoded `SUB_WEIGHTS`, not `Theme.weight`). Not a "computes nothing" bug. | `src/types/constants.ts:96`, `src/pages/Themes.tsx:42`, `youth-index-weights.ts:18`, `seed/themes.json` |
| P-07 | **`Theme.weight` never seeded** | UI claims weights "20/15/15/15/15/10/10 live on Theme.weight" but the seed never writes `weight` → it's `null` for every theme. | `seed.ts:54`, `seed/themes.json`, `constants.ts:95`, `Themes.tsx:50+` |
| P-08 | **Hardcoded indicator counts** | Themes page shows 17/15/13/20/35/3/4 (sum 107). Seed has **94 distinct** indicators across 12 themes, distributed differently. | `Themes.tsx:51+`, `constants.ts:97` |
| P-09 | **Country id scheme mismatch** | `constants.AFRICAN_COUNTRIES[].id` is lowercase ISO2 (`'dz'`); DB `Country.id` is a cuid, ISO2 stored uppercase. Core `/countries/:id` does strict cuid lookup → `'dz'` 404s. Live pages dodge this by routing via name-slug + flexible `resolveCountry`, but it's a latent trap. | `constants.ts:12`, `countries.service.ts:71` |
| P-10 | **Duplicate indicator slug** | `youth-employment-in-agriculture` appears twice in `seed/indicators.json`; unique-slug upsert means DB ends with **94**, not the 95 JSON rows. | `seed/indicators.json` |
| P-11 | **Advertised year range vs reality** | UI advertises 2010–2024; mock values (gated off by default) cover only 2018–2024, index 2022–2024. Default seed loads **0 indicator values**. Year pickers offer empty years. | `constants.ts:223`, `seed.ts:111,185` |
| P-12 | **Fabricated headline counters** | Landing + Africa map hardcode "500+ indicators", "226M youth", "19.7 yrs". DB has ~94 indicators and (default) 0 values. (Home `QuickStats`/`Hero` correctly compute from `/platform/stats`.) | `Landing.tsx:152,264`, `AfricaMap.tsx:355` |
| P-13 | **Stale duplicate Prisma schema** | `apps/api/prisma/schema.prisma` is out of date (5 fixed dimension columns instead of `dimensionScores Json`; missing `Document`, `UploadAudit`, `Newsletter*`, `Theme.weight`). Active schema is `packages/database/prisma/schema.prisma`. Generating from the wrong one breaks the API. | `apps/api/prisma/schema.prisma` |

**Tier-3 dead code (won't 404 at runtime but should be removed):** dead API-client methods for non-existent endpoints (`/data/chart-timeseries`, `/data/scatter`, `/data/heatmap`, `/auth/*`, `/reports`), unused hooks in `src/hooks/useData.ts`, empty stub generators in `src/services/insights.ts`. Full list in the audit appendix.

---

## 2. What actually works (verified)

- **Explore / data charts** (`/explore`) → real `/data/timeseries`.
- **Countries / country profiles** → real `/countries`, `/countries/:id` (via slug/flexible resolve).
- **Themes list data** (the data explorer, not the marketing `/themes` page) → real `/themes`.
- **PKPB / country reports** → real `/documents`, `/country-reports` (placeholder narrative when no upload — by design).
- **Youth Index page** → real `/youth-index` endpoints (but see P-06: scores depend on theme-slug alignment + loaded data).
- **Policy monitor** → real `/policy-monitor/rankings`.
- **NLQ / AI chat** (`/ask`) → real `/ai/chat` (needs `ANTHROPIC_API_KEY`).
- **Admin, CMS, newsletter, data-upload, auth (Supabase)** → real and correctly guarded (per security audit).
- **DashboardBuilder** (custom dashboards) → real `services/dashboard.ts`.

---

## 3. Root-cause read

Two distinct problems:

1. **Unfinished frontend pages** (P-01..P-05) were built with placeholder data generators while the backend caught up, and the placeholders were never swapped for real API calls. The backends for compare, insights, and experts **exist** — these are wiring jobs, not new features. Reports needs a real storage backend (R2 via the existing documents module) instead of localStorage.

2. **A taxonomy duality** (P-06..P-08, P-12): the platform deliberately exposes a **7-dimension** model on the public Themes page + Youth Index, while the data-explorer catalog uses the **12 seeded themes**. This was an intentional "7-theme migration", not an accident — but it leaves two visible taxonomies, misleading `Theme.weight` comments, and hardcoded weights/counts in the UI. The cleanup is mostly cosmetic/consistency (drive numbers from the API, fix comments), **not** a seed rewrite — unless the owner wants the two unified.

---

## 4. Prioritized fix map

### Phase A — Stop showing fake data (must-fix before launch)
1. **P-02 `/insights`** — replace hardcoded `INSIGHTS` with calls to the existing insights API (`/insights/country/:id`, `/insights/anomalies`, `/insights/correlations`). If a real call has no data, show an honest empty state, not invented insights.
2. **P-01 `/compare`** — replace `seededRandom` data with a real comparison endpoint. The `compare` module exists (`POST /compare/countries`); wire the bar/radar/table/PNG to it. Empty state when data is missing.
3. **P-03 `/dashboard`** — either (a) point default widgets at real `services/dashboard.ts` data sources (as `DashboardBuilder` already does), or (b) replace the random-data Dashboard with the real DashboardBuilder. Recommend (b) to avoid two divergent dashboards.
4. **P-04 `/experts`** — remove the fake-expert fallback; show an empty/"directory growing" state when the API returns none.
5. **P-12 counters** — drive Landing + AfricaMap headline numbers from `/platform/stats` (as Home already does), or remove the hardcoded figures.

### Phase B — Reconcile the data model (decision required, then code)
6. **P-06 theme taxonomy** — **decision needed:** is the canonical set 7 or 12 themes? Then make UI (`constants.ts`, `Themes.tsx`), seed (`seed/themes.json`), and the Youth Index weights (`youth-index-weights.ts`) all use the same slugs. Until aligned, the Youth Index dimension scores are unreliable.
7. **P-07 `Theme.weight`** — once taxonomy is fixed, actually seed the weights (add `weight` to `seed/themes.json` + write it in `seed.ts`), and have `Themes.tsx` read them from the API rather than hardcoding.
8. **P-08 indicator counts** — compute per-theme counts from `/themes` (with `_count.indicators`) instead of hardcoding.
9. **P-10 duplicate slug** — de-dupe `youth-employment-in-agriculture` in `seed/indicators.json`.
10. **P-11 year range** — derive available years from the data (`/data` min/max) instead of a hardcoded 2010–2024; or load real values covering the advertised range.
11. **P-13 stale schema** — delete or regenerate `apps/api/prisma/schema.prisma` to match the active `packages/database` schema (or make the API explicitly point at the active one).

### Phase C — Reports storage (must-fix if Reports is a launch feature)
12. **P-05** — migrate `adminContent.ts` reports from localStorage/base64 to the real documents/R2 pipeline (the `documents` module already stores to R2 and serves downloads). Fix the embed iframe to a real endpoint or remove the embed CTA. Generate/serve country report cards from the DB, not static `public/reports/*.html`.

### Phase D — Cleanup (non-blocking)
13. Delete dead API-client methods + unused hooks + stub generators (Tier-3).
14. Standardize package manager / lockfiles (also a security follow-up).

---

## 5. Still to verify (needs live DB or owner input)

- **Live row counts:** actual number of countries, indicators, indicator values, index scores, experts, documents, policies in the *production* Supabase DB — to know whether data-driven pages will be empty or populated at launch. (Requires DB access; the Postgres driver isn't installed in this workspace. Can be done with a short script once approved, or by the owner from the Supabase dashboard.)
- **Canonical theme taxonomy (7 vs 12):** product decision (P-06).
- **Is `/reports` a launch feature?** Determines whether Phase C is a blocker (P-05).
- **Is `SEED_MOCK_VALUES` intended for production?** If the prod DB only has the catalog (no values), most data pages are empty regardless of the frontend fixes.

---

## ✅ Resolution — implemented 2026-06-11

Owner decisions received: keep only the Experts mock fallback; everything else on real data; ship `/reports`; verify via Expo then APK last; build Claude insights + downloadable reports + admin send to subscribers/users/all.

**Done and verified building (API `nest build`, web `vite build`, mobile `tsc` all green):**

| Item | Resolution |
|------|-----------|
| P-01 `/compare` | Rewritten to real `POST /compare/countries` + `GET /compare/themes` (bar/table/radar/PNG all real; honest empty states). `src/components/compare/CountryComparison.tsx`. |
| P-02 `/insights` | Rewritten: real anomalies/correlations/country insights + a Claude **report generator** (continental/country/theme) with **download**, and an **admin-only send** to subscribers/users/all. `src/pages/Insights.tsx`. |
| P-03 `/dashboard` | Widgets now fetch real data (timeseries, youth-index); all `Math.random` removed. `src/pages/Dashboard.tsx`. |
| P-04 `/experts` | (Kept mock fallback per owner decision — the only approved mock.) |
| P-05 `/reports` | Public page + admin manager repointed to the real `/documents` API (114 published PKPB reports); broken embed iframe fixed; localStorage store removed. |
| P-12 counters | Landing + AfricaMap now from `/platform/stats` (real 54/107/52k); fabricated 226M/500+/19.7 removed. |
| NEW backend | `insight-reports` module: `POST /generate` (Claude, real-data-backed, rule-based fallback), `GET /:id`, `GET /:id/download` (printable HTML), `POST /:id/send` (admin → newsletter dispatch to SUBSCRIBERS/USERS/BOTH). No new DB table — reuses Documents/R2 + the newsletter campaign pipeline. |
| Mobile parity | Every screen verified on real data; dead mock generators removed from `lib/explore-data.ts`; insight-reports generate+download added to `app/insights.tsx`. |
| Web app-download popup | `src/components/DownloadAppPopup.tsx` (mounted globally) — phone visitors get a Download-app banner once `VITE_APK_URL` is set. |

**Stale-seed cleanup (P-07/P-08/P-10), non-blocking:** the `seed/*.json` files still describe the old 12-theme/94-indicator model and don't match production (7 themes/107 indicators). Production is correct; refresh the seed files for future fresh-DB parity when convenient.

**Remaining (owner-gated):** Expo verification pass, then APK build (eas.json `preview` profile is ready — needs `eas login` + `eas init` to populate the empty projectId), then set `VITE_APK_URL` to the hosted APK to light up the download popup. Plus the security owner-actions (rotate secrets, confirm Supabase RLS).

---

## 6. Open decisions for the owner (RESOLVED — kept for history)

1. **Theme taxonomy:** keep the deliberate split (7-dimension public/index model + 12-theme catalog) and just make it consistent (drive counts/weights from the API, fix the misleading `Theme.weight` comments), or unify them? *Recommend keeping the split* — the 7-theme model is the intentional recent migration; only the hardcoded numbers and comments need fixing.
2. **Reports feature:** ship it (then we wire R2 storage), or hide it for v1?
3. **Compare/Insights/Dashboard:** wire to real backends now (preferred), or hide the pages for v1 if the DB has no values yet?
4. **Production data:** is real indicator data loaded, or will launch run on catalog-only? This determines whether "empty states" or "real charts" is the realistic launch experience.
