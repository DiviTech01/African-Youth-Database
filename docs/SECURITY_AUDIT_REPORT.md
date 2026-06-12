# African Youth Database / Observatory — Security Audit & Fix Report

**Date:** 2026-06-11
**Auditor:** Claude (automated, authorized by platform owner)
**Scope:** Web frontend (Vite/React), API (NestJS), Mobile (Expo/React Native), and third-party services: Supabase (Postgres + Auth), Cloudflare R2, Render/Railway deploy, Anthropic, mail.
**Companion document:** `SECURITY_AUDIT_LOG.md` (full finding-by-finding detail + fix diffs).

---

## 1. Executive summary

The platform is in **good security shape** and is **launch-ready after the fixes in this report**. No critical, remotely-exploitable vulnerabilities were found. The most dangerous candidate — the database seed/reset controller — is correctly locked behind admin auth.

We found **2 HIGH**, **2 MEDIUM**, and **7 LOW/INFO** issues. **All code-level issues have been fixed and verified** (API `nest build` clean, mobile `tsc` clean). One INFO item (F-11, secret rotation) requires owner action in the Anthropic and Supabase dashboards — it cannot be fixed from code.

| Severity | Found | Fixed in code | Owner action |
|----------|-------|---------------|--------------|
| CRITICAL | 0 | — | — |
| HIGH | 2 | 2 | 0 |
| MEDIUM | 2 | 2 | 0 |
| LOW | 6 | 5 (1 accepted) | 0 |
| INFO | 1 | 0 | 1 (secret rotation) |

---

## 2. What was verified secure (negative results)

These are the high-impact attack classes we actively checked and found **not** present:

- **No SQL injection.** The only raw query is a fully parameterized `Prisma.sql` tagged template; everything else uses Prisma's query builder. No `$queryRawUnsafe`/`$executeRawUnsafe` exists.
- **No LLM-generated SQL execution.** The natural-language-query feature does *not* turn questions into SQL. The model is constrained to 6 typed tools that call parameterized Prisma queries. There is no path for the model to emit or run arbitrary SQL.
- **No SSRF.** No user-controlled outbound HTTP requests.
- **No secret leakage to the client.** Frontend and mobile bundles contain only the Supabase **anon** key (safe by design). The `service_role` key appears nowhere client-side; the API doesn't even instantiate a Supabase client (it verifies JWTs and uses Prisma).
- **No privilege escalation via token tampering.** User role is read from the database on every request, never trusted from JWT claims, and tokens are signature-verified.
- **No committed secrets.** `.env` is gitignored and absent from git history in both repos; only `.env.example` placeholders are tracked.
- **Static dirs not exposed.** `uploads/` and `backups/` are not served statically.
- **Admin surface locked.** Admin, seed/reset, newsletter-admin, and data-upload write endpoints all enforce `JwtAuthGuard + RolesGuard + @Roles`.

---

## 3. Findings and fixes

### HIGH

**F-01 — IDOR: unpublished documents downloadable.** The public `GET /documents/:id` and `/:id/download` looked documents up by id with no status filter, so a DRAFT/unpublished report could be fetched by guessing/enumerating its id. **Fixed:** both paths now require `status = PUBLISHED`.

**F-02 — Unauthenticated expert registration spam.** `POST /api/experts` was fully public, letting anyone bulk-insert PII rows. Self-registration is intended, so we kept it public but **added a hard 3-per-hour-per-IP rate limit**.

### MEDIUM

**F-03 — AI endpoints cost-amplification.** `ai-chat`, `nlq`, and `insights` call Anthropic (real money) and were protected only by a per-minute IP throttle. **Fixed:** added daily per-IP caps (300/day chat & nlq, 500/day insights). A per-user/global token budget is recommended as a follow-up for distributed-IP abuse.

**F-04 — Mobile tokens stored in plaintext.** The Supabase session (access + refresh tokens) was persisted to AsyncStorage, readable on a rooted device or via backup. **Fixed:** native storage now uses a chunked `expo-secure-store` (Keychain/Keystore) adapter. *One-time effect: existing app users are signed out and must log in again.*

### LOW / INFO

- **F-05 — Swagger exposed in prod.** Now gated to non-production (or explicit `ENABLE_SWAGGER=true`). **Fixed.**
- **F-06 — JWT secret prefix logged at boot.** Reduced to length-only. **Fixed.**
- **F-07 — NODE_ENV not forced in Docker.** Added `ENV NODE_ENV=production` (prevents accidental dev-CORS / JWKS-TLS-bypass in prod). **Fixed.**
- **F-08 — data-upload had no MIME allowlist.** Added a CSV/XLSX file filter. **Fixed.**
- **F-09 — inline HTML stored-XSS.** Non-PKPB inline HTML now served with a `sandbox` CSP + `nosniff`. (CONTRIBUTOR/ADMIN-gated, separate origin — low risk.) **Mitigated.**
- **F-10 — no mobile cert pinning.** Standard system-CA trust kept; pinning deferred. **Accepted.**
- **F-11 — live secrets in working-tree `.env`.** Not committed, so no repo leak — but they were handled in plaintext. **Owner action:** see §4.

---

## 4. Owner action required (cannot be done from code)

1. **Rotate the Anthropic API key** (`sk-ant-…`) in the Anthropic console; update the value in Render/Railway env and local `.env`.
2. **Rotate the Supabase database password** (the one embedded in `DATABASE_URL`/`DIRECT_URL`) in Supabase → Settings → Database; update all deploy envs.
3. **Consider rotating the Supabase JWT secret** — *this signs out all current users*, so do it in a maintenance window. Lower priority since it hasn't leaked publicly.
4. **Verify Row Level Security posture on Supabase.** The API enforces access in the application layer (Prisma + guards), not via Postgres RLS. That's fine as long as the **anon key cannot read tables directly via PostgREST**. Confirm in Supabase → Authentication → Policies that RLS is ON for any table reachable by the anon role, or that PostgREST data API access is restricted. (This is the one item to double-check before launch — the app is safe, but the anon key is public.)
5. **Run a dependency audit** (`pnpm audit`) and standardize on one package manager — three lockfiles (`pnpm-lock.yaml`, `package-lock.json`, `bun.lockb`) currently coexist.

---

## 5. Launch recommendation

**Go, after (a) the code fixes ship — done — and (b) owner confirms item #4 (Supabase RLS / anon-key data-API exposure).** Items #1–#3 (secret rotation) and #5 (dep audit) are strongly recommended but not strict blockers if the secrets have never been committed or shared beyond trusted parties.
