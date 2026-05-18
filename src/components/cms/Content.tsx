import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { useContent } from '@/contexts/ContentContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cmsTranslation } from '@/i18n/cms-locales';
import type { ContentStyles } from '@/services/content';

type AsProp = keyof React.JSX.IntrinsicElements;

interface ContentProps {
  /** CMS key, e.g. "home.hero.title" */
  id: string;
  /** Fallback content rendered when the CMS has no override for this key */
  fallback?: React.ReactNode;
  /** HTML tag to render as. Default "span". */
  as?: AsProp;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

function stylesToCSS(s: ContentStyles | undefined): React.CSSProperties {
  if (!s) return {};
  const out: React.CSSProperties = {};
  if (s.color) out.color = s.color;
  if (s.backgroundColor) out.backgroundColor = s.backgroundColor;
  if (s.fontSize) out.fontSize = s.fontSize;
  if (s.fontWeight) out.fontWeight = s.fontWeight as React.CSSProperties['fontWeight'];
  if (s.fontStyle) out.fontStyle = s.fontStyle;
  if (s.textAlign) out.textAlign = s.textAlign as React.CSSProperties['textAlign'];
  if (s.letterSpacing) out.letterSpacing = s.letterSpacing;
  if (s.lineHeight) out.lineHeight = s.lineHeight;
  if (s.textDecoration) out.textDecoration = s.textDecoration;
  if (s.textTransform) out.textTransform = s.textTransform as React.CSSProperties['textTransform'];
  return out;
}

export const Content: React.FC<ContentProps> = ({
  id,
  fallback,
  as = 'span',
  className,
  style,
  children,
}) => {
  const entry = useContent(id);
  const { language } = useLanguage();
  const Tag = as as AsProp;

  const mergedStyle = useMemo(
    () => ({ ...stylesToCSS(entry?.styles), ...style }),
    [entry?.styles, style],
  );

  // For non-English, the i18n translation for this CMS key wins over the
  // English CMS override / fallback so the whole page actually localizes.
  const translated = cmsTranslation(language, id);

  const sanitizedHtml = useMemo(() => {
    if (!entry || entry.contentType !== 'RICH_TEXT') return '';
    return DOMPurify.sanitize(entry.content || '');
  }, [entry?.contentType, entry?.content]);

  // A translation is HTML if it contains tags OR its CMS key is RICH_TEXT.
  // (entry is often absent — most keys have no admin override — so we can't
  // rely on entry.contentType alone.)
  const translationIsHtml = !!translated && /<[a-z][\s\S]*>/i.test(translated);

  const sanitizedTranslation = useMemo(() => {
    if (!translated || !translationIsHtml) return '';
    return DOMPurify.sanitize(translated);
  }, [translated, translationIsHtml]);

  if (translated) {
    if (translationIsHtml) {
      return (
        <Tag
          className={className}
          style={mergedStyle}
          data-cms-id={id}
          data-cms-lang={language}
          dangerouslySetInnerHTML={{ __html: sanitizedTranslation }}
        />
      );
    }
    return (
      <Tag className={className} style={mergedStyle} data-cms-id={id} data-cms-lang={language}>
        {translated}
      </Tag>
    );
  }

  // No override yet — render fallback (or children for wrapping-usage compat).
  if (!entry || (!entry.content && !entry.imageUrl)) {
    return (
      <Tag className={className} style={mergedStyle} data-cms-id={id} data-cms-missing="true">
        {children ?? fallback}
      </Tag>
    );
  }

  if (entry.contentType === 'RICH_TEXT') {
    return (
      <Tag
        className={className}
        style={mergedStyle}
        data-cms-id={id}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    );
  }

  // TEXT (or IMAGE rendered as text fallback — images should use <ContentImage>)
  return (
    <Tag className={className} style={mergedStyle} data-cms-id={id}>
      {entry.content || fallback}
    </Tag>
  );
};

export default Content;
