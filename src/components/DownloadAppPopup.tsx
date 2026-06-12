import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, X, Download } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Content } from '@/components/cms';

const STORAGE_KEY = 'ayd_app_download_dismissed';

// The Android APK URL is injected at build time. Until the APK is built and
// hosted (e.g. on R2/Cloudflare or a GitHub Release), this is empty and the
// popup stays hidden — so we never show a broken download link. Set
// VITE_APK_URL in the deploy env once the APK exists.
const APK_URL = (import.meta.env.VITE_APK_URL as string | undefined)?.trim() || '';

function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
}

function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Bottom banner inviting phone visitors to install the AYO Android app.
 * - Only renders when VITE_APK_URL is configured (no broken links otherwise).
 * - Targets mobile visitors; on Android it offers a direct .apk download,
 *   on other phones it points at the same link (browser handles it).
 * - Dismissal is remembered in localStorage so we don't nag on every visit.
 */
const DownloadAppPopup = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!APK_URL) return; // nothing to download yet
    if (!isMobile()) return; // the CTA is "download to your phone"
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) return;
    // Small delay so it doesn't fight the first paint / cookie banner.
    const id = window.setTimeout(() => setVisible(true), 1500);
    return () => window.clearTimeout(id);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  const handleDownload = () => {
    // Remember the choice so the banner doesn't reappear next visit.
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  if (!APK_URL) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed bottom-0 left-0 right-0 z-50 p-4"
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <Card className="mx-auto max-w-md border-primary/30 shadow-xl">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <Content
                  as="p"
                  id="app_download.title"
                  fallback="Get the African Youth Observatory app"
                  className="text-sm font-semibold text-foreground"
                />
                <Content
                  as="p"
                  id="app_download.subtitle"
                  fallback={isAndroid() ? 'Install the Android app for the full experience on your phone.' : 'Available for Android. Open this link on an Android phone to install.'}
                  className="text-xs text-muted-foreground"
                />
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button asChild size="sm" onClick={handleDownload}>
                  <a href={APK_URL} download>
                    <Download className="mr-1.5 h-4 w-4" />
                    <Content as="span" id="app_download.cta" fallback="Download" />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={dismiss}
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DownloadAppPopup;
