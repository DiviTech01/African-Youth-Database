import { useCallback, useEffect, useState } from 'react';

/**
 * Admin layout density — "comfortable" (default) or "compact". Persists to
 * localStorage and is applied as a data attribute on the admin page wrapper
 * so styles can react via `[data-density="compact"] …`.
 */
export type Density = 'comfortable' | 'compact';

const STORAGE_KEY = 'ayo_admin_density_v1';

function read(): Density {
  if (typeof window === 'undefined') return 'comfortable';
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === 'compact' ? 'compact' : 'comfortable';
}

export function useAdminDensity(): { density: Density; toggle: () => void; set: (d: Density) => void } {
  const [density, setDensity] = useState<Density>(read);

  // Cross-tab sync: if another tab toggles, this one reflects the change.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'compact' || e.newValue === 'comfortable')) {
        setDensity(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const set = useCallback((d: Density) => {
    setDensity(d);
    try {
      window.localStorage.setItem(STORAGE_KEY, d);
    } catch {
      /* private mode etc. — silent */
    }
  }, []);

  const toggle = useCallback(() => set(density === 'compact' ? 'comfortable' : 'compact'), [density, set]);

  return { density, toggle, set };
}
