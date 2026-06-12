// Single source of truth for the mobile-app download links.
//
// The Android APK is published as a GitHub Release asset (a permanent, public
// URL that won't expire like a raw EAS artifact). `VITE_APK_URL` overrides it
// if the APK is ever rehosted (e.g. on R2). iOS isn't available yet — Apple has
// no sideloading, so it ships via TestFlight/App Store later; drop that link
// into `IOS_APP_URL` (or `VITE_IOS_APP_URL`) when it exists and the UI lights up.

export const ANDROID_APK_URL =
  (import.meta.env.VITE_APK_URL as string | undefined)?.trim() ||
  'https://github.com/DiviTech01/ayo-mobile/releases/download/v1.0.0/AfYO-Android.apk';

export const IOS_APP_URL =
  (import.meta.env.VITE_IOS_APP_URL as string | undefined)?.trim() || '';

/** True when any installable app link exists (used to show/hide download UI). */
export const HAS_APP_DOWNLOAD = Boolean(ANDROID_APK_URL || IOS_APP_URL);
