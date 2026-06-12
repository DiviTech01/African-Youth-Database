# AYD Platform — Security Audit & Fix Log

> Living document. Findings are logged as discovered; fixes are appended with timestamps.
> Audit started: 2026-06-11. Auditor: Claude (automated, authorized by platform owner).
> Scope: Web frontend (Vite/React), API (NestJS), Mobile (Expo/React Native), Supabase, Cloudflare R2, Render, Anthropic, mail.

## Severity legend
- **CRITICAL** — exploitable now, data loss / account takeover / secret compromise. Block launch.
- **HIGH** — likely exploitable, sensitive. Fix before launch.
- **MEDIUM** — hardening / defense-in-depth. Fix soon.
- **LOW** — informational / best practice.

---

## Findings register

| ID | Severity | Area | Title | Status |
|----|----------|------|-------|--------|
| F-01 | HIGH | API / documents | Public document `getById` + `download` don't filter `status=PUBLISHED` → IDOR: unpublished/DRAFT reports downloadable by cuid | **FIXED** |
| F-02 | HIGH | API / experts | `POST /api/experts` is fully public mutation → unauthenticated PII spam/insert | **FIXED** |
| F-03 | MEDIUM | API / AI cost | `ai-chat`, `nlq`, `insights` public endpoints invoke Anthropic (real $) with only per-IP throttle → cost-amplification | **FIXED** (tighter throttle) |
| F-04 | MEDIUM | Mobile / auth | Supabase session (access+refresh tokens) stored in AsyncStorage plaintext | **FIXED** (SecureStore adapter) |
| F-05 | LOW | API / info-disclosure | Swagger `/api/docs` exposed unconditionally in production | **FIXED** (gated to non-prod) |
| F-06 | LOW | API / logging | JWT secret length + first 8 chars logged at boot | **FIXED** (length only) |
| F-07 | LOW | Deploy / Docker | `NODE_ENV` not forced to `production` in prod Dockerfiles → risk of dev CORS + JWKS TLS bypass | **FIXED** |
| F-08 | LOW | API / upload | `data-upload` accepts file with no MIME allowlist (size cap only) | **FIXED** (allowlist) |
| F-09 | LOW | API / XSS | `documents` serves uploaded `text/html` inline with `text/html` content-type (CONTRIBUTOR/ADMIN-gated, separate origin) | **MITIGATED** (CSP sandbox on non-PKPB) |
| F-10 | LOW | Mobile / network | No certificate pinning on API/Supabase traffic | ACCEPTED (documented) |
| F-11 | INFO | Secrets ops | Live secrets (Anthropic key, DB password, JWT secret) present in working-tree `.env` (gitignored, not committed) — recommend rotation since shared in plaintext | ACTION REQUIRED (owner) |

### Verified NOT vulnerable (negative results worth recording)
- No SQL injection: only raw query is a parameterized `Prisma.sql` tagged template (`data-upload.service.ts:502`) + `SELECT 1` health check. No `$queryRawUnsafe`/`$executeRawUnsafe` anywhere.
- NLQ "natural language → query" does **not** generate or execute SQL — LLM is constrained to 6 typed Prisma-backed tools. No arbitrary-query path.
- No SSRF: no user-controlled `fetch`/`axios`/`http(s)` requests.
- No service_role key in frontend or mobile bundle; only anon key (safe to be public).
- `uploads/` and `backups/` are **not** served statically.
- Role is sourced from DB (`prisma.user.findUnique`), never trusted from JWT claims → no privilege escalation via forged claim.
- Admin + seed/reset controllers correctly `JwtAuthGuard + RolesGuard + @Roles('ADMIN')` protected.
- `.env` not git-tracked in either repo; no secrets in committed source (only `.env.example` placeholders).

---

## Detailed findings

### F-01 — HIGH — IDOR on documents (unpublished reports downloadable)
`apps/api/src/modules/documents/documents.service.ts` — `getById()` (line 144) and `getDownloadStream()` (line 193) look up by id with **no `status` filter**, while `list()` and `getLatestPkpbForCountry()` correctly filter `status: 'PUBLISHED'`. The controller routes `GET /documents/:id` and `GET /documents/:id/download` are public (no guard). An unauthenticated user who knows or enumerates a document cuid can fetch a DRAFT/unpublished report's metadata, extracted text, and original file.
**Fix:** enforce `status === 'PUBLISHED'` on the public read/download paths.

### F-02 — HIGH — Public unauthenticated mutation on experts
`apps/api/src/modules/expert-directory/expert-directory.controller.ts:58-67` — `POST /api/experts` is `@Public()`. Anyone can insert Expert rows (name/email/org PII). New rows are unverified, but this is an unauthenticated write/spam vector. Self-registration is the intended product behaviour, so locking it entirely would break the feature.
**Fix:** keep public submission but add a strict per-IP throttle (3/hour) to stop automated spam.

### F-03 — MEDIUM — AI cost endpoints rely only on per-IP throttle
`ai-chat.controller.ts`, `nlq.controller.ts`, `insights.controller.ts` expose `@Public()` routes that call Anthropic Claude (real cost). Default throttle (10/min/IP) allows distributed cost amplification.
**Fix:** apply a tighter dedicated `@Throttle` (e.g. AI: 20/min, 200/day-ish via short+long buckets) as defense-in-depth. (A per-user daily token budget is the longer-term fix; noted as follow-up.)

### F-04 — MEDIUM — Mobile token storage in plaintext
`ayo-mobile/lib/supabase.ts:11` — session persisted to AsyncStorage (unencrypted). On a rooted device or via backup, refresh/access tokens are replayable.
**Fix:** SecureStore-backed storage adapter (chunked, since SecureStore caps ~2KB); AsyncStorage kept for web only.

### F-05/06/07/08/09 — LOW hardening
- F-05: `main.ts:129-130` Swagger setup runs always → gate behind `!isProd`.
- F-06: `jwt.strategy.ts:125-127` logs secret prefix → length only.
- F-07: prod Dockerfiles don't set `ENV NODE_ENV=production`.
- F-08: `data-upload.controller.ts` upload has no MIME allowlist.
- F-09: `documents` inline HTML serving → add `Content-Security-Policy: sandbox` for non-PKPB HTML.

### F-11 — INFO — Secret rotation (owner action)
The working-tree `.env` holds live credentials. They are **not** committed (gitignored, absent from history), so there's no repo leak. However, they were transmitted in plaintext during this session. Recommend rotating, as owner-side operations:
- Anthropic API key (`sk-ant-...`)
- Supabase DB password (in `DATABASE_URL`/`DIRECT_URL`)
- `SUPABASE_JWT_SECRET` (rotating this invalidates issued sessions — coordinate)
These cannot be rotated from code; the owner must do it in the Anthropic and Supabase dashboards and update Render/Railway env vars.

---

## Fix log

All fixes applied 2026-06-11. API verified with `nest build` (clean); mobile verified with `tsc --noEmit` (clean).

### F-01 — documents IDOR — FIXED
`apps/api/src/modules/documents/documents.service.ts`
- `getById()` → `findFirst({ where: { id, status: 'PUBLISHED' } })` (was `findUnique({ where: { id } })`).
- `getDownloadStream()` → same `status: 'PUBLISHED'` filter.
Public read/download now returns 404 for any non-published document. Admin tooling reads via the admin module, unaffected.

### F-02 — public expert POST spam — FIXED
`apps/api/src/modules/expert-directory/expert-directory.controller.ts`
- Added `@Throttle({ default: { ttl: 3_600_000, limit: 3 } })` to `POST /experts`. Self-registration stays public but capped at 3/hour/IP.

### F-03 — AI cost amplification — FIXED (defense-in-depth)
- `apps/api/src/app.module.ts` — added a named `long` throttle bucket (24h window).
- `ai-chat.controller.ts`, `nlq.controller.ts` (both routes), `insights.controller.ts` — added `long` daily caps (300/day chat & nlq, 500/day insights) on top of existing per-minute limits.
- Follow-up (not blocking launch): a per-user/global Anthropic token budget in `AiService` for botnet-across-many-IPs scenarios. Logged as future work.

### F-04 — mobile plaintext token storage — FIXED
`ayo-mobile/lib/secure-storage.ts` (new) — chunked `expo-secure-store` adapter (Keychain/Keystore), works around the ~2KB per-value cap.
`ayo-mobile/lib/supabase.ts` — native session storage switched from `AsyncStorage` to the SecureStore adapter; web unchanged.
**Migration note:** existing native sessions stored in AsyncStorage won't be found after this change, so current app users are signed out once and must log in again. Acceptable pre-launch.

### F-05 — Swagger in production — FIXED
`apps/api/src/main.ts` — Swagger now only mounts when `!isProd` (or explicit `ENABLE_SWAGGER=true`). `/api/docs` is no longer exposed in production by default.

### F-06 — JWT secret prefix in logs — FIXED
`apps/api/src/modules/auth/strategies/jwt.strategy.ts` — boot log reduced to `length=` only; the 8-char prefix is no longer printed.

### F-07 — NODE_ENV in Docker — FIXED
`Dockerfile` — added `ENV NODE_ENV=production` so the prod image defaults to production (closing dev-CORS + JWKS-TLS-bypass if the platform forgets to inject it).

### F-08 — data-upload MIME validation — FIXED
`apps/api/src/modules/data-upload/data-upload.controller.ts` — added a shared `spreadsheetUpload` config with a `fileFilter` allowlisting CSV/XLS/XLSX (by MIME + extension); applied to all three upload endpoints.

### F-09 — inline HTML stored-XSS — MITIGATED
`apps/api/src/modules/documents/documents.controller.ts` — inline non-PKPB HTML now served with `Content-Security-Policy: sandbox; default-src 'none'; …` + `X-Content-Type-Options: nosniff`. PKPB reports (admin-curated, need their animation scripts) remain exempt.

### F-10 — mobile cert pinning — ACCEPTED
Standard system-CA trust retained. Pinning deferred unless threat model warrants; documented in report.

### F-11 — secret rotation — OWNER ACTION REQUIRED
Not code-fixable. Owner to rotate Anthropic key, Supabase DB password, and (carefully) the Supabase JWT secret in their dashboards and update Render/Railway env. See report.
