import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { contentApi, type PublishedContentMap, type PublishedContent } from '@/services/content';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cmsTranslation } from '@/i18n/cms-locales';

interface ContentContextValue {
  map: PublishedContentMap;
  isLoaded: boolean;
  isPreview: boolean;
  get(key: string): PublishedContent | undefined;
  refresh(): Promise<void>;
}

const ContentContext = createContext<ContentContextValue | undefined>(undefined);

export const ContentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [map, setMap] = useState<PublishedContentMap>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const { user } = useAuth();
  const location = useLocation();

  const isAdmin = user?.role === 'ADMIN';
  const previewRequested = useMemo(() => {
    const p = new URLSearchParams(location.search).get('cms_preview');
    return p === '1' || p === 'true';
  }, [location.search]);
  const isPreview = isAdmin && previewRequested;

  const load = useCallback(async () => {
    try {
      const data = await contentApi.getPublished(isPreview);
      setMap(data ?? {});
    } catch (err) {
      // Silent fail — site falls back to default props on every <Content>.
      // eslint-disable-next-line no-console
      console.warn('[cms] failed to load content map', err);
      setMap({});
    } finally {
      setIsLoaded(true);
    }
  }, [isPreview]);

  useEffect(() => {
    load();
  }, [load]);

  const value = useMemo<ContentContextValue>(
    () => ({
      map,
      isLoaded,
      isPreview,
      get: (key: string) => map[key],
      refresh: load,
    }),
    [map, isLoaded, isPreview, load],
  );

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
};

export function useContentContext(): ContentContextValue {
  const ctx = useContext(ContentContext);
  if (!ctx) throw new Error('useContentContext must be used inside ContentProvider');
  return ctx;
}

export function useContent(key: string): PublishedContent | undefined {
  const ctx = useContext(ContentContext);
  return ctx?.map[key];
}

/**
 * Return the localized text for `key`.
 *
 * Resolution order:
 *  - non-English: i18n translation for the CMS key (if any) → English CMS
 *    override → `fallback`.
 *  - English: CMS override → `fallback`.
 *
 * Use this for cases where a plain string is required (props on 3rd-party
 * components). For DOM-level edits prefer <Content>.
 */
export function useContentText(key: string, fallback: string): string {
  const { language } = useLanguage();
  const entry = useContent(key);
  const translated = cmsTranslation(language, key);
  if (translated) return translated;
  const raw = entry?.content;
  return raw && raw.trim() ? raw : fallback;
}
