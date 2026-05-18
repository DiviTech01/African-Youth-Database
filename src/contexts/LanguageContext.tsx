import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { TRANSLATIONS, LANGUAGES, type Language } from '@/i18n/locales';
import { detectDefaultLanguage } from '@/i18n/geo';

export type { Language };
export { LANGUAGES };

interface LanguageContextType {
  language: Language;
  /** 'user' = explicit sticky choice; 'auto' = geo/fallback default. */
  languageSource: 'user' | 'auto';
  setLanguage: (lang: Language) => void;
  /** Lock in the current language as the user's sticky choice (no change). */
  confirmLanguage: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  dir: 'ltr' | 'rtl';
  languageInfo: typeof LANGUAGES[number];
}

const LanguageContext = createContext<LanguageContextType | null>(null);

const STORAGE_KEY = 'ayd_language';
// 'user' = visitor explicitly picked this language (sticky forever).
// 'auto' = a default we chose (geo / fallback) and may still refine.
const SOURCE_KEY = 'ayd_language_source';

/** Replace {name} placeholders with values from params. */
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in params ? String(params[key]) : match,
  );
}

// Dev-only guarantee that every non-English file has full key parity with `en`.
if (import.meta.env?.DEV) {
  const enKeys = Object.keys(TRANSLATIONS.en);
  (Object.keys(TRANSLATIONS) as Language[])
    .filter((lang) => lang !== 'en')
    .forEach((lang) => {
      const missing = enKeys.filter((k) => !(k in TRANSLATIONS[lang]));
      if (missing.length > 0) {
        // eslint-disable-next-line no-console
        console.warn(
          `[i18n] "${lang}" is missing ${missing.length} key(s) present in "en":`,
          missing,
        );
      }
    });
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && ['en', 'fr', 'ar', 'pt', 'sw'].includes(stored)) return stored as Language;
    } catch {}
    return 'en';
  });

  // Was the current language an explicit user choice (sticky) or an auto
  // default? Kept as state (for reactive consumers like the sign-in prompt)
  // mirrored into a ref (for the async geo check).
  const [languageSource, setLanguageSourceState] = useState<'user' | 'auto'>(() => {
    try {
      return localStorage.getItem(SOURCE_KEY) === 'user' ? 'user' : 'auto';
    } catch {
      return 'auto';
    }
  });
  const sourceRef = useRef<'user' | 'auto'>(languageSource);

  const markSource = useCallback((s: 'user' | 'auto') => {
    sourceRef.current = s;
    setLanguageSourceState(s);
    try {
      localStorage.setItem(SOURCE_KEY, s);
    } catch {}
  }, []);

  const setLanguage = useCallback(
    (lang: Language) => {
      // An explicit pick is sticky — record it so geo never overrides it again.
      markSource('user');
      setLanguageState(lang);
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch {}
    },
    [markSource],
  );

  // Lock in the current (auto-detected) language as the user's sticky choice
  // without changing it — the "keep this language" action on the prompt.
  const confirmLanguage = useCallback(() => {
    markSource('user');
  }, [markSource]);

  // On first load, if the visitor never explicitly chose a language, default
  // to the main language of the country they're opening the site from.
  const geoChecked = useRef(false);
  useEffect(() => {
    if (geoChecked.current || sourceRef.current === 'user') return;
    geoChecked.current = true;
    let cancelled = false;
    detectDefaultLanguage()
      .then((detected) => {
        if (cancelled || !detected || sourceRef.current === 'user') return;
        setLanguageState((prev) => {
          if (prev === detected) return prev;
          try {
            localStorage.setItem(STORAGE_KEY, detected);
          } catch {}
          return detected;
        });
        markSource('auto');
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [markSource]);

  // Apply RTL direction + lang attribute to the document.
  useEffect(() => {
    const info = LANGUAGES.find((l) => l.code === language);
    document.documentElement.dir = info?.dir || 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const template =
        TRANSLATIONS[language]?.[key] ?? TRANSLATIONS.en[key] ?? key;
      return interpolate(template, params);
    },
    [language],
  );

  const dir = useMemo(() => {
    return LANGUAGES.find((l) => l.code === language)?.dir || 'ltr';
  }, [language]);

  const languageInfo = useMemo(() => {
    return LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];
  }, [language]);

  const value = useMemo(
    () => ({ language, languageSource, setLanguage, confirmLanguage, t, dir, languageInfo }),
    [language, languageSource, setLanguage, confirmLanguage, t, dir, languageInfo],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
