# AfYO — African Youth Observatory Mobile App Build Reference

> **Working doc for the second terminal.** This file gives a fresh Claude Code (or any developer) full context to clone the **AYO mobile repo**, run it locally, and continue building it without needing access to this conversation. Hand it to a new terminal as the only context for the mobile track; the first terminal continues iterating on the web dashboard + API in the separate `african-youth-database` repo.

---

## 0. TL;DR — start in 4 commands

```bash
git clone https://github.com/DiviTech01/ayo-mobile.git
cd ayo-mobile
npm install
cp .env.example .env          # fill in keys (see §3)
npx expo start                # then press "i" for iOS sim, "a" for Android, or scan QR with Expo Go
```

---

## 1. What this project is

**AfYO** (mobile slug `ayo-mobile`, bundle id `org.pacsda.afyo`) is the **mobile companion** to the African Youth Observatory web platform built by PACSDA. It's an **Expo / React Native** app that talks to the same backend as the web dashboard, so any data uploaded by contributors on the web shows up on phone too.

It's already past the empty-template stage — auth, a tabbed home, country browsing, country detail, an AI assistant tab, and PKPB report components are scaffolded. The work now is **filling in screens, polishing UX, and shipping to stores**.

| Surface | Repo | Stack | Status |
|---|---|---|---|
| **Web dashboard** | `DiviTech01/African-Youth-Observatory` | Vite + React 18 + Tailwind + shadcn | Live in production (Cloudflare Pages + Render API) |
| **Mobile app — THIS** | `DiviTech01/ayo-mobile` | Expo SDK 54 + React Native 0.81 + React 19 + Expo Router + NativeWind v4 + TanStack Query + Supabase | Scaffolded, screens being built |

The mobile and web share:
- **The same Supabase project** (auth, profiles, sessions)
- **The same Nest API on Render** (https://african-youth-observatory.onrender.com/api)
- **The same Cloudflare R2** for uploaded documents
- **The same Anthropic Claude API** for AI chat (proxied by the API)

The mobile track does NOT have its own backend. All data flows through the web's API.

---

## 2. Repo to clone

**Repo URL**: `https://github.com/DiviTech01/ayo-mobile.git`
**Default branch**: `main`
**Owner**: `DiviTech01` (same GitHub account as the web repo)

```bash
# Pick a folder away from the web checkout to avoid confusion
cd ~/Code   # or wherever you keep clones
git clone https://github.com/DiviTech01/ayo-mobile.git
cd ayo-mobile
```

`app.json` declares:
- **Name**: AfYO · **Slug**: ayo-mobile · **Version**: 1.0.0
- **iOS bundle id**: `org.pacsda.afyo`, supports tablet, Face ID
- **Android package**: `org.pacsda.afyo`, edge-to-edge enabled, fingerprint/biometric perms
- **URL scheme**: `afyo://` (deep-link surface)
- **Expo owner**: `pacsda`
- **New Architecture**: `newArchEnabled: true` (React Native Fabric + TurboModules)
- **React Compiler**: enabled in `experiments`
- **Plugins**: expo-router, expo-secure-store, expo-local-authentication, expo-splash-screen, expo-notifications, expo-font

---

## 3. Prerequisites and environment

### Tooling

| Tool | Version | Why |
|---|---|---|
| Node.js | **24.x** | Expo SDK 54 supports it |
| npm | 11.x | (or pnpm — but lockfile is npm) |
| Expo CLI | bundled (`npx expo`) | Don't install globally; use `npx expo …` |
| iOS Simulator | macOS only — Xcode 16+ | Run on iOS without a device |
| Android Studio | with an emulator | Run on Android without a device |
| EAS CLI | `npm i -g eas-cli` | Production builds + submits to App Store / Play |
| Expo Go app | iOS/Android phone | Quick on-device testing of JS-only changes |

### `.env` — required keys

Copy `.env.example` to `.env` and fill in. Three keys needed:

```
EXPO_PUBLIC_SUPABASE_URL=https://lfvbwpmpuyfujrpwwgol.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<paste from web repo's .env — the SUPABASE_ANON_KEY value>
EXPO_PUBLIC_API_URL=https://african-youth-observatory.onrender.com/api
```

Notes:
- **`EXPO_PUBLIC_*` prefix is required** for env vars to be inlined into the JS bundle. Anything else is server-only and won't reach the device.
- **Never put the service-role key, the JWT secret, or the Anthropic key here.** Those live only in the API server's env (Render dashboard). The mobile app authenticates with Supabase using the anon key + the user's session JWT, then hits the Nest API which validates and proxies the privileged calls.
- For local dev pointed at a local API: `EXPO_PUBLIC_API_URL=http://192.168.x.x:3001/api` (your machine's LAN IP, NOT `localhost` — the phone or simulator can't resolve `localhost` to your Mac/PC).

---

## 4. Tech stack and architecture

### Routing — Expo Router (file-based)

Routes live in `app/`. Anything inside `(parens)` is a layout group that doesn't appear in the URL. Existing layout:

```
app/
├── _layout.tsx                    # Root: Stack + providers (TanStack Query, Auth, Theme)
├── (auth)/                        # Auth group — visible to signed-out users
│   ├── _layout.tsx
│   ├── sign-in.tsx
│   ├── sign-up.tsx
│   ├── forgot-password.tsx
│   └── verify-otp.tsx
├── (tabs)/                        # Main app — bottom-tab navigator
│   ├── _layout.tsx                # Tabs: Home / Explore / Countries / Ask AI / Profile
│   ├── index.tsx                  # Home (dashboard widgets)
│   ├── explore.tsx                # Indicator/data explorer
│   ├── countries.tsx              # Country grid (Report Cards)
│   ├── ai.tsx                     # AI assistant
│   └── profile.tsx                # User profile + settings entry
├── country/[slug].tsx             # Country detail page (linked from grid)
├── compare.tsx                    # Side-by-side comparison
├── experts.tsx                    # Experts directory
├── policy.tsx                     # Policy monitor
├── reports.tsx                    # Reports list
├── about.tsx                      # About / version / credits
├── edit-profile.tsx
├── change-password.tsx
├── pin-setup.tsx                  # First-run PIN setup
├── pin-unlock.tsx                 # Lock screen on cold start (biometric / PIN)
└── modal.tsx                      # Generic modal route
```

Typed routes are enabled (`experiments.typedRoutes`), so navigating uses `router.push('/country/[slug]', { slug: 'kenya' })` with type safety.

### Component library

`components/` (current contents — don't rebuild):

```
components/
├── AfricaMap.tsx                  # Continent SVG (uses topojson/world-atlas)
├── PinPad.tsx                     # Numeric PIN entry
├── GoogleSignInButton.tsx
├── haptic-tab.tsx                 # Tab button with haptic feedback (used in (tabs)/_layout)
├── parallax-scroll-view.tsx
├── themed-text.tsx, themed-view.tsx
├── ui/
│   ├── collapsible.tsx
│   ├── icon-symbol.tsx, icon-symbol.ios.tsx   # Cross-platform SF Symbols / Material
├── charts/
│   ├── BarChart.tsx
│   ├── LineChart.tsx
│   ├── RadarChart.tsx
│   └── colors.ts                  # Shared chart palette (5 colors)
├── report/                        # PKPB report card pieces
│   ├── AyemiGauge.tsx             # Gauge SVG with arc + needle
│   ├── IndicatorCard.tsx
│   ├── LegislationTable.tsx
│   └── PromiseList.tsx
└── widgets/                       # Home dashboard tiles
    ├── DashboardWidgets.tsx       # Composer
    ├── CountrySpotlight.tsx
    ├── RegionalBreakdown.tsx
    ├── StatsStrip.tsx
    ├── ToolsGrid.tsx
    ├── WidgetCard.tsx
    └── YouthIndexLeaderboard.tsx
```

### Data layer

`lib/` (everything goes through these — don't bypass):

| File | Purpose |
|---|---|
| `lib/supabase.ts` | Single Supabase client (`@supabase/supabase-js` + `react-native-url-polyfill` + AsyncStorage adapter). Used for auth + sessions. |
| `lib/api.ts` | Axios instance pointing at `EXPO_PUBLIC_API_URL`. Request interceptor pulls the active Supabase JWT and attaches `Authorization: Bearer …`. 401 response → tries `supabase.auth.refreshSession()`. Exports typed methods: `api.countries.list/get`, `api.themes`, etc. |
| `lib/queries.ts` | TanStack Query hooks (`useCountries`, `useCountry`, `useThemes`, `useIndicators`, `useYouthIndexRankings`, `useRegionalAverages`, `usePolicyRankings`). Query keys live in `qk` const. |
| `lib/auth.ts` | Auth helper functions (sign-in/sign-up/sign-out flows). |
| `lib/google-auth.ts` | Google OAuth via `expo-auth-session`. |
| `lib/ai-storage.ts` | Local-first AI chat history persistence (mirrors the web's `usePkpbUploads` pattern but for AI conversations). |
| `lib/dashboard-storage.ts` | Persisted dashboard preferences (favorite countries, pinned widgets). |
| `lib/country-helpers.ts` | Country slug ↔ ISO ↔ name resolution. |
| `lib/projection.ts` | D3-geo projection for the `AfricaMap` component. |

### Styling — NativeWind v4

Tailwind classes work directly on React Native components via NativeWind:

```tsx
<View className="flex-1 items-center justify-center bg-background">
  <Text className="font-display text-2xl text-primary">Hello</Text>
</View>
```

`global.css` is the entry CSS file. `tailwind.config.js` defines the theme (see §5 for the tokens). `metro.config.js` is wired with `withNativeWind`.

### Key Expo plugins in use

- `expo-router` — file-based routing
- `expo-secure-store` — encrypted key-value (used for the PIN, refresh tokens)
- `expo-local-authentication` — Face ID / Touch ID / Android biometric prompt
- `expo-notifications` — push notifications (ops still need an EAS push token + APNs/FCM creds)
- `expo-haptics` — used by `haptic-tab` for tactile feedback on tab switches
- `expo-splash-screen` — branded launch screen, white in light mode / black in dark
- `expo-image` — performant image with caching (use this, not `<Image>` from react-native)
- `expo-font` — loads Inter + Plus Jakarta Sans via `@expo-google-fonts/*`

---

## 5. Brand & design system (mobile vs web — important)

The user's directive was *"same colour theme and style as the web version."* There's a discrepancy to resolve:

### Mobile — current `tailwind.config.js`

The mobile is set up with a **Pan-African color palette** in **light mode**:

| Token | HSL | What it is |
|---|---|---|
| `background` | `40 33% 99%` | Near-white warm |
| `foreground` | `220 20% 14%` | Near-black ink |
| `primary` (DEFAULT) | `142 71% 35%` | **Pan-African green** |
| `secondary` (DEFAULT) | `36 100% 50%` | **Pan-African gold** |
| `accent` (DEFAULT) | `199 89% 48%` | Sky blue |
| `destructive` | `0 72% 51%` | Pan-African red |
| Chart palette | green / gold / blue / red / purple | 5 series |
| `font-sans` | Inter | Body |
| `font-display` | Plus Jakarta Sans | Headings |

### Web — current

The web is **dark mode with gold primary** (`#D4A017`), Playfair Display for display, IBM Plex Sans for body. See the web repo's `tailwind.config.ts` and `src/index.css`.

### Recommendation for mobile

Pick one of these on day one and document the choice in the next commit:

**Option A — keep current pan-African green/gold light theme.** Pros: feels native to mobile, light theme reads better on phones in sunlight, distinctive identity. Cons: doesn't match user's "same as web" directive literally.

**Option B — port the web's dark + gold-primary look to mobile.** Pros: identical brand language across surfaces. Cons: dark phones in sunlight are harder to read; need to refactor existing widgets that assume light bg.

**Option C — hybrid.** Light theme by default but use the web's gold (`#D4A017`) as primary instead of pan-African green. Adopt Playfair only for the biggest hero numbers; keep Plus Jakarta for everything else. Inter for body. This is probably the right answer — pan-African green stays as a *secondary* accent for the tier-fulfilling state on PKPB cards.

Whatever you pick, edit `tailwind.config.js` first and ripple through. The chart `colors.ts` should mirror the same palette. Use the existing token shape (50-900 scale + DEFAULT + foreground) so NativeWind class names like `bg-primary`, `text-primary-foreground` keep working.

---

## 6. The API the app talks to

The Nest API at `https://african-youth-observatory.onrender.com/api` exposes everything the mobile needs. Key endpoints (already wired by `lib/api.ts`):

| Endpoint | Purpose | Used by |
|---|---|---|
| `GET /countries`, `/countries/:id` | Country list + detail | `useCountries`, `useCountry` |
| `GET /themes`, `/themes/:id` | Theme catalog | `useThemes` |
| `GET /indicators?themeId=…`, `/indicators/:id`, `/indicators/:id/values` | Indicator catalog + raw values | `useIndicators` |
| `GET /data/timeseries?…`, `/data/comparison?…`, `/data/regional-averages?…`, `/data/heatmap?…` | Aggregated charts data | `useRegionalAverages` etc. |
| `GET /youth-index/rankings?year=…`, `/youth-index/:countryId` | AYEMI rankings + per-country | `useYouthIndexRankings`, `useYouthIndexCountry` |
| `GET /country-reports/:ref` | Single PKPB report data (real DB-backed) | (TODO — wire on country detail) |
| `GET /documents?type=PKPB_REPORT&limit=500` | All PKPB upload metadata | (TODO — for "Reports" tab) |
| `GET /documents/by-country/:ref/pkpb` | Latest PKPB document for a country (returns `htmlDocument` and `pdfDocument` separately) | (TODO — for in-app report viewer) |
| `GET /documents/:id/download?disposition=inline` | Stream the original file (HTML auto-injected with scroll animations on the server) | (TODO — for WebView-based report viewer) |
| `POST /ai/chat` | AI assistant — Claude with rule-based fallback. Body: `{ message, context?, history? }`. Returns `{ answer, visualization, visualizations[], followUpQuestions, source }`. | (TODO — wire `app/(tabs)/ai.tsx`) |
| `GET /platform/stats` | Headline counts for home dashboard | (TODO — `StatsStrip`) |
| `POST /newsletter/subscribe` | Email capture | (TODO — Profile screen) |

Auth: every request automatically gets the Supabase JWT via `lib/api.ts`'s axios interceptor. Public endpoints work without it.

### CORS

The Render API allows any origin in production (`CORS_ORIGIN=*`). The mobile makes plain `axios` requests — no preflight worries on native. On web preview (`expo start --web`) you'll be on `localhost:8081` which is also allowed.

---

## 7. Running locally

```bash
# Cold start
npm install

# Pick your dev surface:
npx expo start                  # interactive — press i / a / w
npx expo start --ios            # boot iOS simulator directly (macOS only)
npx expo start --android        # boot Android emulator (must be running)
npx expo start --web            # web preview (handy for quick UI iteration)
npx expo start --tunnel         # ngrok tunnel — use when on a different network from your phone

# Specific device
npx expo run:ios                # build and install a dev client on iOS simulator
npx expo run:android            # build and install a dev client on Android emulator
```

### Expo Go vs dev client

- **Expo Go** (the app from the App Store / Play Store) — works for JS-only changes. Native modules already in Expo Go include all the plugins we use except… custom native modules. Since this project only uses Expo plugins, **Expo Go works for now.**
- **Dev client** (`expo run:ios` / `expo run:android`) — builds a native shell yourself; required when you add a native module that's not in Expo Go. We don't need it yet.

### Hot reload

Save any file in `app/`, `components/`, `lib/`, or `hooks/` — Metro bundles it and pushes it to the device in <2s. Toggle Fast Refresh from the Expo dev menu (shake device or `Cmd+D` in iOS sim, `Ctrl+M` in Android emulator).

### Common gotchas

| Symptom | Likely cause | Fix |
|---|---|---|
| `EXPO_PUBLIC_API_URL` works on simulator but not physical phone | Phone can't resolve `localhost` | Use your computer's LAN IP in `.env` (e.g. `http://192.168.1.42:3001/api`) and reload |
| Supabase auth works on simulator but breaks on real device | Missing URL polyfill | Already imported via `lib/supabase.ts`. If the issue persists, check Network conditioner on iOS dev settings |
| White flash before splash | Splash config in `app.json` references missing image | Verify `assets/images/splash-icon.png` exists |
| Tabs aren't tinted with brand color | Hardcoded green in `app/(tabs)/_layout.tsx` (`'#15803d'`) | Replace with `tailwindcss/colors`-style derivation or `nativewind` token |
| Build crash on Android: `Unable to load script` | Metro cache | `npx expo start -c` (clears cache) |
| Reanimated worklet errors after upgrade | babel plugin missing | Verify `babel.config.js` has `react-native-worklets/plugin` last |

---

## 8. Building for stores — EAS

Production builds happen via **Expo Application Services**. One-time setup:

```bash
npm i -g eas-cli
eas login            # use the pacsda Expo account
eas build:configure  # writes eas.json (TODO: this hasn't been run yet)
```

Then for each platform:

```bash
# Internal preview build (TestFlight / Play Internal)
eas build --profile preview --platform ios
eas build --profile preview --platform android

# Production (App Store / Play Store)
eas build --profile production --platform all

# Submit to stores
eas submit --platform ios --latest
eas submit --platform android --latest
```

You'll need:
- **Apple Developer Program** membership ($99/yr) — bundle id `org.pacsda.afyo`
- **Google Play Console** account ($25 one-time) — package `org.pacsda.afyo`
- App icons + screenshots (already in `assets/images/`; verify size variants)
- Privacy policy URL (use the web's `/privacy`)

Set `extra.eas.projectId` in `app.json` after `eas build:configure` runs (currently `""`).

---

## 9. Native features in use

| Capability | Plugin | Where wired |
|---|---|---|
| **Face ID / Touch ID / fingerprint** | `expo-local-authentication` | `pin-unlock.tsx` (cold start), `change-password.tsx` |
| **PIN code (4–6 digits)** | `PinPad.tsx` + `expo-secure-store` | `pin-setup.tsx`, `pin-unlock.tsx` |
| **Push notifications** | `expo-notifications` | (TODO — set up server-side push token registration) |
| **Haptic feedback** | `expo-haptics` | `haptic-tab` (tab switches) |
| **Deep links** | URL scheme `afyo://` (`app.json`) | (TODO — handle `afyo://country/kenya` etc.) |
| **Secure storage** | `expo-secure-store` | Refresh tokens, PIN |
| **Edge-to-edge Android** | `app.json` `android.edgeToEdgeEnabled: true` | Status bar handling |
| **Auth deep-link return** | `expo-auth-session` + `expo-web-browser` | `lib/google-auth.ts` for OAuth |

---

## 10. What's done · what's pending · what to build next

### ✅ Done (per the last commit `16773d3 feat: web design system + dashboard with widgets`)

- Expo Router scaffolding with `(auth)` and `(tabs)` groups
- Auth screens: sign-in, sign-up, forgot password, verify OTP
- Bottom-tab layout (Home / Explore / Countries / Ask AI / Profile)
- Dashboard widgets: `CountrySpotlight`, `RegionalBreakdown`, `StatsStrip`, `ToolsGrid`, `WidgetCard`, `YouthIndexLeaderboard`
- Country grid (`countries.tsx`) and country detail (`country/[slug].tsx`) — likely partial
- AI tab placeholder (`ai.tsx`)
- Profile + settings entry, edit profile, change password
- PIN flow: setup + unlock
- Compare, Experts, Policy, Reports, About screens (likely scaffolded)
- Charts (`BarChart`, `LineChart`, `RadarChart`)
- PKPB report components (`AyemiGauge`, `IndicatorCard`, `LegislationTable`, `PromiseList`)
- AfricaMap component (SVG with d3-geo projection)
- Axios + Supabase wired with token interceptor
- TanStack Query hooks for country/theme/indicator/youth-index
- NativeWind v4 with custom theme tokens

### 🚧 Pending — build these in priority order

#### P0 — what makes the app actually useful

- [ ] **Sign-in flow end-to-end** — verify `(auth)/sign-in.tsx` actually authenticates against Supabase, the JWT is stored, and the root `_layout.tsx` redirects signed-in users into `(tabs)`. Test sign-up + email OTP verification too.
- [ ] **Home dashboard data wired up** — `(tabs)/index.tsx` should pull `usePlatformStats` + `useYouthIndexRankings` + a "my country" highlight. Right now widgets probably render hardcoded sample data.
- [ ] **Countries grid pulls live data** — `useCountries()` is already in `lib/queries.ts`. Plug it into `(tabs)/countries.tsx`. Show the same emerald "Uploaded" badge the web shows when a country has a PKPB on file (call `GET /documents?type=PKPB_REPORT` and group by `countryId`).
- [ ] **Country detail screen** — `country/[slug].tsx` should load `GET /country-reports/:ref` for headline stats AND `GET /documents/by-country/:ref/pkpb` for the PKPB doc. Render the report inside a `react-native-webview` (add `expo install react-native-webview`) pointing at `EXPO_PUBLIC_API_URL/documents/<id>/download?disposition=inline` — the API auto-injects scroll animations into served HTML, so the in-app render matches the web.
- [ ] **AI tab live-call** — `(tabs)/ai.tsx` should `axios.post('/ai/chat', { message, history })` and render markdown + multi-chart visualizations. The web's `parseAllVisualizationsFromText` + `normalizeVisualization` logic is reusable — port it. Persist conversations to AsyncStorage via `lib/ai-storage.ts`.
- [ ] **Profile + sign-out** — show the user, link to edit profile, change password, set PIN, biometric toggle, sign out. Currently scaffolded; verify each entry actually does what it says.
- [ ] **Light/dark mode toggle** in profile settings, persisted to AsyncStorage. Use `useColorScheme` hook + NativeWind's `dark:` variant.

#### P1 — polish + native feel

- [ ] **Pull-to-refresh** on home, countries, explore, reports — wire `RefreshControl` onto each `FlatList` / `ScrollView`. Each refresh should call `queryClient.invalidateQueries(...)` for the visible queries.
- [ ] **Skeleton states** while data loads — replace spinners with shimmer placeholders that match the final layout. Ship a `<Skeleton>` component in `components/ui/`.
- [ ] **Offline-first** — wrap TanStack Query with `@tanstack/react-query-persist-client` + AsyncStorage. Show an "offline" toast on `NetInfo` change. Cached data should render immediately when reopening; new fetches happen in the background.
- [ ] **Push notifications** — register a token on first sign-in, send to API (need a `POST /api/users/push-token` endpoint server-side too). Notifications for: AI response ready (background task), new PKPB upload for "my country", weekly platform digest.
- [ ] **Biometric unlock on cold start** — `pin-unlock.tsx` should auto-prompt Face ID / fingerprint if available, fallback to PIN, fallback to password.
- [ ] **Deep links from web** — `afyo://country/kenya`, `afyo://pkpb/nigeria`, `afyo://ai`, `afyo://reports`. Handle in `_layout.tsx` via `Linking.addEventListener` + `expo-router`'s `router.push`. Also register universal links so https://africanyouthobservatory.org/country/kenya opens the app on iOS/Android if installed.
- [ ] **Share** — every country / report should have a Share button that uses `expo-sharing` (or RN's `Share`) to send the canonical web URL, e.g. `https://africanyouthobservatory.org/dashboard/pkpb/kenya`.
- [ ] **Haptics on every meaningful action** — `expo-haptics` with `Light` for selection, `Medium` for confirm, `Heavy` for delete. Already on tabs; extend to buttons, swipes.
- [ ] **Africa map zoom + tap** — `AfricaMap.tsx` should be tappable; tap a country, navigate to `/country/[slug]`. Pinch-zoom via `react-native-gesture-handler`.

#### P2 — scale + delight

- [ ] **In-app upload** for contributors — pick a file with `expo-document-picker`, POST to `/api/documents` with multipart form. Show progress, success state, queue if offline.
- [ ] **PIN attempts limiter** — 5 failed PIN entries → require Supabase password. Track in SecureStore.
- [ ] **App-lock when backgrounded** — when app goes to background and comes back after >30s, re-prompt biometric/PIN.
- [ ] **Localization** — i18n with `expo-localization` + a JSON dictionary. Start with EN; add FR / AR / PT for the continent's main languages.
- [ ] **Live data ticker** on home — match the web's `<LiveDataTicker>` look (marquee with country/metric/value tuples).
- [ ] **Settings: data usage** — "auto-download charts on cellular" toggle. Skip image fetches when off.
- [ ] **Tablet layout** — `app.json` already has `ios.supportsTablet: true`. On iPad, render a sidebar + content layout instead of bottom tabs (use `useWindowDimensions`).

---

## 11. Coding conventions (match these — the web track follows the same style)

- **TypeScript everywhere.** No raw `.js` outside `metro.config.js` and `babel.config.js`.
- **Path alias** `@/` → repo root. Use `@/components/...`, `@/lib/api`, `@/hooks/...`. (Confirm `tsconfig.json` has the `paths` entry — looks like the project uses `~` or `@/`. Check before assuming.)
- **NativeWind classes** for styling. Avoid inline `StyleSheet.create` unless you need a value Tailwind can't express (rare).
- **TanStack Query for all server state.** Define a query key in `lib/queries.ts`'s `qk` const + a corresponding `useThing(...)` hook. Keep the hook colocated with the key.
- **Axios via `lib/api.ts` only.** Don't import `axios` directly — the shared instance has the auth interceptor.
- **Supabase via `lib/supabase.ts` only.** One client per process.
- **Comments answer "why", not "what".** No running narration. Annotate non-obvious decisions only.
- **No emojis in product copy** unless explicitly requested.
- **Icons**: prefer `@expo/vector-icons`'s `Ionicons` for consistency with the existing tab bar. Match icon weight (filled when active, outlined when inactive).
- **Animations**: use `react-native-reanimated` v4 (already installed). Match the web's easing: `Easing.bezier(0.22, 1, 0.36, 1)` for entrance, and `~0.85s` duration on section reveals. The web's `<ScrollReveal>` pattern — fade + 28px translate-up — should be the default for cards entering view.
- **Headers**: keep the same screen-title style across all stack screens — center-aligned, `font-display`, sized at `text-base font-semibold`. Override per-screen via `<Stack.Screen options={{ title: '…' }} />`.

---

## 12. Where state lives

| Kind | Mechanism | Cleared when… |
|---|---|---|
| **Auth session** | Supabase → SecureStore (refresh token) + AsyncStorage (session) | User signs out |
| **API responses** | TanStack Query cache (in-memory; persist after wiring up `react-query-persist-client`) | Background invalidate / manual refetch |
| **AI conversations** | `lib/ai-storage.ts` → AsyncStorage, keyed by user id (guest under `_guest`) | User signs out (history transfers from `_guest` to `_<userId>` on first sign-in — match the web's `loadConversationsFor` semantics) |
| **Dashboard preferences** | `lib/dashboard-storage.ts` → AsyncStorage | Manual reset in profile |
| **PIN** | `expo-secure-store` (encrypted) | "Forget PIN" in profile |
| **Theme preference** | AsyncStorage | Manual change |

---

## 13. Connecting to a local API instead of Render

If the web track is iterating on API changes that haven't deployed yet, point your phone/sim at the local Nest server:

1. On the machine running the web's `cd apps/api && npm run dev`:
   - Find your LAN IP: `ipconfig` (Windows) / `ifconfig` (mac/Linux)
   - Confirm port 3001 is reachable: `curl http://<your-ip>:3001/api/health`
2. In the mobile repo's `.env`:
   ```
   EXPO_PUBLIC_API_URL=http://<your-ip>:3001/api
   ```
3. Restart Expo: `npx expo start -c`

The phone and the dev machine must be on the same Wi-Fi network. Most coffee-shop networks block client-to-client traffic; tether off your laptop or use `npx expo start --tunnel`.

---

## 14. Useful command reference

```bash
# Day-to-day
npx expo start                  # Metro + interactive
npx expo start -c               # Same, with cache cleared
npm run lint                    # Expo's ESLint config
npx expo start --tunnel         # Public ngrok tunnel for off-network phones

# Add a package
npx expo install <pkg>          # Use this — picks the version compatible with current SDK
npm i <pkg>                     # ONLY for non-native packages

# Native rebuilds (after adding a native dep)
npx expo prebuild               # Generate ios/ + android/ folders
npx expo run:ios                # Build + run on iOS sim
npx expo run:android            # Build + run on Android emulator

# EAS (after configuring)
eas build --profile preview --platform ios
eas build --profile production --platform all
eas submit -p ios --latest
eas update                      # OTA JS/asset updates (no rebuild needed)

# Custom helper that exists
npm run build:geo               # Pre-generate Africa GeoJSON from world-atlas
```

---

## 15. Production environments

| Surface | URL / Identifier | Where it deploys from |
|---|---|---|
| **Mobile app — iOS** | App Store, bundle `org.pacsda.afyo` | EAS Build → `eas submit` |
| **Mobile app — Android** | Play Store, package `org.pacsda.afyo` | EAS Build → `eas submit` |
| **Web frontend** | https://african-youth-observatory.pages.dev (also https://africanyouthobservatory.org if pointed) | Cloudflare Pages auto-deploys from web repo's `main` |
| **API** | https://african-youth-observatory.onrender.com/api | Render auto-deploys from web repo's `main` |
| **Database** | Supabase project `lfvbwpmpuyfujrpwwgol` | Migrations via `npx prisma db push` from the web repo |
| **R2 storage** | Cloudflare R2 bucket `ayd-cms` | Public read via `https://pub-…r2.dev/<key>` |

The mobile track does NOT need to touch any of these except the API URL in its `.env`. Any backend changes flow through the web track.

---

## 16. Quick-start checklist for the second terminal

```
[ ] git clone https://github.com/DiviTech01/ayo-mobile.git
[ ] cd ayo-mobile
[ ] npm install
[ ] cp .env.example .env  →  fill in:
        EXPO_PUBLIC_SUPABASE_URL = (from web repo's .env, SUPABASE_URL value)
        EXPO_PUBLIC_SUPABASE_ANON_KEY = (from web repo's .env, SUPABASE_ANON_KEY value)
        EXPO_PUBLIC_API_URL = https://african-youth-observatory.onrender.com/api
[ ] npx expo start  →  press i (or a) to launch the simulator
[ ] Verify sign-in works against the live Supabase project
[ ] Pick the brand-color decision from §5 (Option A/B/C) and document it
[ ] Walk through P0 list (§10) — start with: home dashboard live data
[ ] When you change the API contract, sync with the web track (different repo, same engineer or pair)
```

---

## 17. Reference: the web app this mirrors

Repo: `https://github.com/DiviTech01/African-Youth-Observatory.git`
Structure (relevant to mobile parity):
- `src/pages/Dashboard.tsx` → mobile `app/(tabs)/index.tsx`
- `src/pages/Countries.tsx` → mobile `app/(tabs)/countries.tsx`
- `src/pages/PromiseKeptBrokenIndex.tsx` → consider building a "Reports" tab on mobile
- `src/pages/PromiseKeptBrokenCountry.tsx` → mobile `app/country/[slug].tsx` (use WebView for the iframe-equivalent)
- `src/pages/NaturalLanguageQuery.tsx` → mobile `app/(tabs)/ai.tsx` — port the multi-chart visualization parser
- `src/pages/Compare.tsx` → mobile `app/compare.tsx`
- `src/pages/Settings.tsx` → mobile `app/(tabs)/profile.tsx` + `app/edit-profile.tsx` + `app/change-password.tsx`

When you need to know what a page should do, look at the web equivalent. The **API contract** is identical — every endpoint your mobile app calls is the same one the web calls.

---

## 18. One important note on parallel work

The web repo (where this doc lives) and the mobile repo are **separate** GitHub repositories. Edits in one do not cross to the other. If you discover a bug or missing endpoint in the API while building the mobile, file it in the web repo or hand it to the dashboard track — don't try to patch the API from the mobile checkout (you'd have no way to deploy it).

Mobile-track scope: everything inside `ayo-mobile`. That's it.

---

Welcome to the team. Build something that feels like a continent in your pocket.
