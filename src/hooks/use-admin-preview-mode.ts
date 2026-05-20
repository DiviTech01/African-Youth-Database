import { useCallback, useEffect, useState } from 'react';

/**
 * Admin "preview as user" mode.
 *
 * Default: OFF. Sidebar shows admin + contributor entries only — clean
 * admin console.
 *
 * ON: sidebar swaps to the regular user nav (data + contributor), the admin
 * section disappears, and a red banner across the top of every page offers
 * an "Exit preview" button. Stored in sessionStorage so it resets each tab —
 * an admin who closes the browser starts fresh in admin mode.
 */
const STORAGE_KEY = 'ayo_admin_preview_mode_v1';

function read(): boolean {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem(STORAGE_KEY) === '1';
}

export function useAdminPreviewMode(): {
  previewMode: boolean;
  setPreviewMode: (on: boolean) => void;
} {
  const [previewMode, setPreview] = useState<boolean>(read);

  // Cross-tab is intentional via sessionStorage scope — but within one tab
  // we still want components that read this hook to stay in sync if one
  // toggles it, so we listen for a custom event we emit from `setPreviewMode`.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      if (typeof detail === 'boolean') setPreview(detail);
    };
    window.addEventListener('ayo:admin-preview-mode', handler as EventListener);
    return () => window.removeEventListener('ayo:admin-preview-mode', handler as EventListener);
  }, []);

  const setPreviewMode = useCallback((on: boolean) => {
    try {
      if (on) window.sessionStorage.setItem(STORAGE_KEY, '1');
      else window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* private mode etc. */
    }
    setPreview(on);
    window.dispatchEvent(new CustomEvent('ayo:admin-preview-mode', { detail: on }));
  }, []);

  return { previewMode, setPreviewMode };
}
