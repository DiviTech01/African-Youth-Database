import { useEffect, useState } from 'react';
import { X, Download, Apple } from 'lucide-react';
import { ANDROID_APK_URL, IOS_APP_URL } from '@/config/app-download';

type Platform = 'android' | 'ios' | null;
// v2 — bumped when the banner changed to a dark theme + real download link, so
// anyone who dismissed the old "coming soon" version sees the working one.
const STORAGE_KEY = 'ayo_mobile_banner_dismissed_v2';

function detectMobilePlatform(): Platform {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  return null;
}

const MobileAppBanner = () => {
  const [platform, setPlatform] = useState<Platform>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const p = detectMobilePlatform();
    if (!p) return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    setPlatform(p);
    const t = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setOpen(false);
  };

  const remember = () => {
    // Remember the choice but let the download navigation proceed.
    localStorage.setItem(STORAGE_KEY, '1');
  };

  if (!open || !platform) return null;

  const androidReady = Boolean(ANDROID_APK_URL);
  const iosReady = Boolean(IOS_APP_URL);

  return (
    <>
      <div
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={dismiss}
      />
      <div
        role="dialog"
        aria-label="Get the AfYO mobile app"
        className="fixed bottom-0 left-0 right-0 z-[101] bg-[#0A0A0A] border-t border-zinc-800 rounded-t-3xl shadow-2xl pb-[env(safe-area-inset-bottom)] animate-in slide-in-from-bottom duration-300"
      >
        <div className="flex justify-center pt-3">
          <div className="h-1 w-10 rounded-full bg-zinc-700" />
        </div>

        <button
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-full p-2 text-gray-500 hover:bg-zinc-800 hover:text-gray-300"
        >
          <X size={18} />
        </button>

        <div className="px-6 pb-6 pt-4">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white">
              <img src="/ayo-logo.png" alt="AfYO" className="h-12 w-12 object-contain" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white">Get the AfYO mobile app</h3>
              <p className="mt-1 text-sm text-gray-400">
                Faster charts, offline reports, and push alerts on your phone.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {platform === 'android' ? (
              androidReady ? (
                <a
                  href={ANDROID_APK_URL}
                  download
                  onClick={remember}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#D4A017] py-3 font-semibold text-black hover:bg-[#E5B028] transition-colors"
                >
                  <Download size={18} />
                  Download now
                </a>
              ) : (
                <button
                  disabled
                  className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-zinc-800 py-3 font-semibold text-gray-500"
                >
                  Android app coming soon
                </button>
              )
            ) : iosReady && IOS_APP_URL ? (
              <a
                href={IOS_APP_URL}
                onClick={remember}
                className="flex items-center justify-center gap-2 rounded-xl bg-white py-3 font-semibold text-black hover:bg-gray-200 transition-colors"
              >
                <Apple size={18} />
                Open in App Store
              </a>
            ) : (
              <button
                disabled
                className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-zinc-800 py-3 font-semibold text-gray-500"
              >
                iOS app coming soon
              </button>
            )}

            <button
              onClick={dismiss}
              className="w-full rounded-xl py-3 text-sm font-medium text-gray-400 hover:bg-zinc-900"
            >
              Continue in browser
            </button>
          </div>

          <p className="mt-3 text-center text-xs text-gray-500">
            We'll remember your choice on this device.
          </p>
        </div>
      </div>
    </>
  );
};

export default MobileAppBanner;
