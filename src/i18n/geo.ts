// Geo → default-language resolution (web).
//
// When a visitor has never explicitly picked a language, we default to the
// main language of the country they open the site from:
//   Francophone country  → fr   (Senegal, Côte d'Ivoire, Mali, ...)
//   Arabic-speaking       → ar   (Egypt, Morocco, Algeria, Tunisia, Sudan, ...)
//   Lusophone             → pt   (Angola, Mozambique, Cabo Verde, ...)
//   Swahili-speaking      → sw   (Kenya, Tanzania)
//   anything else/unknown → en   (default fallback)
//
// A manual choice always wins and is never overridden (see LanguageContext).
// Detection prefers the visitor's physical country (Cloudflare edge, since the
// site is deployed on Cloudflare Pages), then a public IP service, then the
// browser locale as a last resort.

import type { Language } from './locales';

// ISO 3166-1 alpha-2 country code → default UI language.
// Only non-English mappings are listed; everything else falls back to 'en'.
const COUNTRY_LANGUAGE: Record<string, Language> = {
  // ── Arabic ──────────────────────────────────────────────────────────────
  DZ: 'ar', EG: 'ar', LY: 'ar', MA: 'ar', TN: 'ar', SD: 'ar', MR: 'ar',
  DJ: 'ar', SO: 'ar', KM: 'ar', EH: 'ar',
  SA: 'ar', AE: 'ar', QA: 'ar', KW: 'ar', BH: 'ar', OM: 'ar',
  YE: 'ar', JO: 'ar', LB: 'ar', SY: 'ar', IQ: 'ar', PS: 'ar',

  // ── French (Francophone Africa + diaspora) ──────────────────────────────
  SN: 'fr', CI: 'fr', ML: 'fr', BF: 'fr', NE: 'fr', GN: 'fr', TG: 'fr',
  BJ: 'fr', GA: 'fr', CG: 'fr', CD: 'fr', CM: 'fr', CF: 'fr', TD: 'fr',
  MG: 'fr', BI: 'fr',
  FR: 'fr', BE: 'fr', MC: 'fr', LU: 'fr',

  // ── Portuguese (Lusophone) ──────────────────────────────────────────────
  AO: 'pt', MZ: 'pt', CV: 'pt', GW: 'pt', ST: 'pt', GQ: 'pt',
  PT: 'pt', BR: 'pt',

  // ── Swahili ─────────────────────────────────────────────────────────────
  TZ: 'sw', KE: 'sw',
};

/** Map an ISO alpha-2 country code to our default language ('en' if none). */
export function mapCountryToLanguage(code?: string | null): Language {
  if (!code) return 'en';
  return COUNTRY_LANGUAGE[code.trim().toUpperCase()] ?? 'en';
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response | null> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Parse `loc=XX` out of a Cloudflare trace body. */
function parseCloudflareTrace(body: string): string | null {
  const m = body.match(/(?:^|\n)loc=([A-Z]{2})/);
  return m ? m[1] : null;
}

/** Browser-locale fallback: derive language from navigator.language. */
function languageFromNavigator(): Language {
  const tags = [navigator.language, ...(navigator.languages ?? [])].filter(Boolean);
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    // region-aware first: e.g. "fr-SN", "ar-EG"
    const region = lower.split('-')[1];
    if (region) {
      const byRegion = COUNTRY_LANGUAGE[region.toUpperCase()];
      if (byRegion) return byRegion;
    }
    const base = lower.split('-')[0];
    if (base === 'fr' || base === 'ar' || base === 'pt' || base === 'sw') return base;
  }
  return 'en';
}

/**
 * Best-effort detection of the visitor's default language.
 * Never throws; returns null only if every signal fails.
 */
export async function detectDefaultLanguage(): Promise<Language | null> {
  // 1. Cloudflare edge trace — same-origin in production (site is on CF Pages),
  //    zero third-party, privacy-friendly.
  try {
    const res = await fetchWithTimeout('/cdn-cgi/trace', 2500);
    if (res && res.ok) {
      const cc = parseCloudflareTrace(await res.text());
      if (cc) return mapCountryToLanguage(cc);
    }
  } catch {
    /* fall through */
  }

  // 2. Public IP geolocation service (no key).
  try {
    const res = await fetchWithTimeout('https://ipwho.is/?fields=country_code', 3000);
    if (res && res.ok) {
      const json = (await res.json()) as { country_code?: string };
      if (json?.country_code && /^[A-Za-z]{2}$/.test(json.country_code)) {
        return mapCountryToLanguage(json.country_code);
      }
    }
  } catch {
    /* fall through */
  }

  // 3. Browser locale (reflects device language, not physical location).
  try {
    return languageFromNavigator();
  } catch {
    return null;
  }
}
