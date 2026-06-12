// OAuth redirect bridge — routes Supabase OAuth callbacks to the right destination.
//
// Supabase rejects non-HTTPS schemes (like `exp://` or `afyo://`) in its OAuth
// redirect_to allowlist, so the mobile app can't directly receive the OAuth
// callback. This page acts as a redirector:
//
//   1. Mobile app starts sign-in with `redirectTo: https://prod.pages.dev/auth-callback`
//   2. Supabase accepts that (HTTPS, in Site URL) and Google completes
//   3. Browser lands here with tokens in the URL hash
//   4. We detect mobile vs web and either:
//      - Bounce to `afyo://auth-callback#access_token=...` (Android intent / iOS Universal Link → Expo Go)
//      - Install the session locally and route to `/dashboard` (web flow)
//
// The detection uses a `from=mobile` query param (set by the mobile app when
// it builds the OAuth URL) — more reliable than user-agent sniffing.

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'working' | 'mobile-bounce' | 'web-success' | 'error'>('working');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [mobileDeepLink, setMobileDeepLink] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        // Supabase returns tokens in the URL hash (#access_token=...&refresh_token=...)
        const hash = window.location.hash.startsWith('#')
          ? window.location.hash.slice(1)
          : window.location.hash;
        const hashParams = new URLSearchParams(hash);
        const query = new URLSearchParams(window.location.search);

        const error = hashParams.get('error_description') || hashParams.get('error') || query.get('error');
        if (error) {
          setErrorMessage(error);
          setStatus('error');
          return;
        }

        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        // Mobile flag — set by the mobile app via `?from=mobile` on the redirect_to.
        // Without it we default to the web flow (install session and route to /dashboard).
        const fromMobile = query.get('from') === 'mobile';

        if (!accessToken || !refreshToken) {
          setErrorMessage('Missing tokens in OAuth response. Sign-in may have been cancelled.');
          setStatus('error');
          return;
        }

        if (fromMobile) {
          // Bounce to the app's deep link — pass the tokens through the fragment
          // so the mobile auth-callback handler can install the session.
          //
          // The app sends its real return URL as `?return=` so we hit the right
          // scheme: `exp://<lan-ip>:8081/--/auth-callback` in Expo Go, or
          // `afyo://auth-callback` in a dev/production build. Older builds that
          // don't send `return` fall back to the production scheme.
          const returnTarget = query.get('return') || 'afyo://auth-callback';
          const sep = returnTarget.includes('#') ? '&' : '#';
          const deepLink = `${returnTarget}${sep}access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}`;
          setMobileDeepLink(deepLink);
          setStatus('mobile-bounce');
          // Try the redirect; if the OS doesn't have a handler the user sees the fallback button.
          window.location.replace(deepLink);
          return;
        }

        // Web flow: install the session and route to /dashboard.
        const { error: setErr } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (setErr) {
          setErrorMessage(setErr.message);
          setStatus('error');
          return;
        }
        setStatus('web-success');
        navigate('/dashboard', { replace: true });
      } catch (e: any) {
        setErrorMessage(e?.message ?? 'Unknown error during sign-in');
        setStatus('error');
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-6">
      <div className="max-w-md w-full text-center">
        {status === 'working' && (
          <>
            <div className="inline-block h-10 w-10 rounded-full border-2 border-[#D4A017] border-t-transparent animate-spin mb-5" />
            <h1 className="text-xl font-semibold text-white">Signing you in…</h1>
            <p className="mt-2 text-sm text-gray-400">One moment while we finish the handshake with Supabase.</p>
          </>
        )}

        {status === 'mobile-bounce' && (
          <>
            <div className="h-12 w-12 mx-auto mb-5 rounded-2xl bg-[#D4A017]/15 border border-[#D4A017]/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-[#D4A017]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-white">Opening the AfYO app…</h1>
            <p className="mt-2 text-sm text-gray-400">If the app doesn't open automatically, tap the button below.</p>
            <a
              href={mobileDeepLink}
              className="mt-5 inline-flex items-center justify-center px-5 py-2.5 rounded-md bg-[#D4A017] text-black text-sm font-semibold hover:bg-[#E5B028] transition-colors"
            >
              Open the AfYO app
            </a>
            <p className="mt-4 text-xs text-gray-500">
              If the app isn't installed, you can still continue on the web — your sign-in worked.
            </p>
          </>
        )}

        {status === 'web-success' && (
          <>
            <div className="h-10 w-10 mx-auto mb-4 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-white">Signed in — taking you to your dashboard.</h1>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="h-10 w-10 mx-auto mb-4 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-white">Sign-in didn't complete</h1>
            <p className="mt-2 text-sm text-gray-400 break-words">{errorMessage}</p>
            <a
              href="/auth/signin"
              className="mt-5 inline-block px-5 py-2.5 rounded-md border border-gray-700 text-gray-200 text-sm hover:bg-white/[0.04] transition-colors"
            >
              Try again
            </a>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
