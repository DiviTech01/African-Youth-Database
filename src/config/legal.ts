// Single source of truth for the app's legal-document links (Privacy Policy,
// Terms of Service, Data Licensing). These are surfaced in the site footer.
//
// PLACEHOLDER URLs — replace with the real legal document links when provided.
// You can override any of them at build time without touching this file by
// setting the matching VITE_* env var (e.g. VITE_PRIVACY_URL).

export const LEGAL_LINKS = {
  privacy:
    import.meta.env.VITE_PRIVACY_URL ??
    'https://africanyouthobservatory.org/privacy',
  terms:
    import.meta.env.VITE_TERMS_URL ??
    'https://africanyouthobservatory.org/terms',
  dataLicensing:
    import.meta.env.VITE_DATA_LICENSING_URL ??
    'https://africanyouthobservatory.org/data-licensing',
} as const;

export type LegalLinkKey = keyof typeof LEGAL_LINKS;
