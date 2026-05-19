import type { CmsRegistryEntry } from '../registry';

// "Chrome" = site-wide UI (navbar, footer, cookie consent) that appears on every page.
// Nav link labels that already flow through the i18n system (useLanguage / t()) are NOT
// registered here — those are driven by the translation dictionary, not the CMS.

const NAVBAR = 'navbar';
const FOOTER = 'footer';
const COOKIE = 'cookie_consent';

export const chromeEntries: CmsRegistryEntry[] = [
  // Navbar
  { key: 'navbar.brand.name', page: NAVBAR, section: 'brand', contentType: 'TEXT', defaultContent: 'African Youth Observatory' },
  { key: 'navbar.user_menu.dashboard', page: NAVBAR, section: 'user_menu', contentType: 'TEXT', defaultContent: 'Dashboard' },
  { key: 'navbar.user_menu.settings', page: NAVBAR, section: 'user_menu', contentType: 'TEXT', defaultContent: 'Settings' },
  { key: 'navbar.user_menu.sign_out', page: NAVBAR, section: 'user_menu', contentType: 'TEXT', defaultContent: 'Sign Out' },

  // Footer — brand block
  { key: 'footer.brand.name', page: FOOTER, section: 'brand', contentType: 'TEXT', defaultContent: 'AfriYouthStats' },
  { key: 'footer.brand.description', page: FOOTER, section: 'brand', contentType: 'RICH_TEXT', defaultContent: 'The central hub for African youth statistics, supporting research, policy-making, and development initiatives.' },

  // Footer — Navigation column
  { key: 'footer.nav.heading', page: FOOTER, section: 'nav', contentType: 'TEXT', defaultContent: 'Navigation' },
  { key: 'footer.nav.home', page: FOOTER, section: 'nav', contentType: 'TEXT', defaultContent: 'Home' },
  { key: 'footer.nav.explore', page: FOOTER, section: 'nav', contentType: 'TEXT', defaultContent: 'Data Explorer' },
  { key: 'footer.nav.compare', page: FOOTER, section: 'nav', contentType: 'TEXT', defaultContent: 'Compare Countries' },
  { key: 'footer.nav.themes', page: FOOTER, section: 'nav', contentType: 'TEXT', defaultContent: 'Themes' },
  { key: 'footer.nav.countries', page: FOOTER, section: 'nav', contentType: 'TEXT', defaultContent: 'Countries' },
  { key: 'footer.nav.about', page: FOOTER, section: 'nav', contentType: 'TEXT', defaultContent: 'About' },

  // Footer — Resources column
  { key: 'footer.resources.heading', page: FOOTER, section: 'resources', contentType: 'TEXT', defaultContent: 'Resources' },
  { key: 'footer.resources.glossary', page: FOOTER, section: 'resources', contentType: 'TEXT', defaultContent: 'Glossary' },
  { key: 'footer.resources.methodology', page: FOOTER, section: 'resources', contentType: 'TEXT', defaultContent: 'Methodology' },
  { key: 'footer.resources.faq', page: FOOTER, section: 'resources', contentType: 'TEXT', defaultContent: 'FAQ' },
  { key: 'footer.resources.reports', page: FOOTER, section: 'resources', contentType: 'TEXT', defaultContent: 'Reports' },
  { key: 'footer.resources.toolkits', page: FOOTER, section: 'resources', contentType: 'TEXT', defaultContent: 'Toolkits' },

  // Footer — Contact + Newsletter column
  { key: 'footer.contact.heading', page: FOOTER, section: 'contact', contentType: 'TEXT', defaultContent: 'Contact' },
  { key: 'footer.contact.email', page: FOOTER, section: 'contact', contentType: 'TEXT', defaultContent: 'info@africanyouthstats.org' },
  { key: 'footer.contact.form_link', page: FOOTER, section: 'contact', contentType: 'TEXT', defaultContent: 'Contact Form' },
  { key: 'footer.newsletter.heading', page: FOOTER, section: 'newsletter', contentType: 'TEXT', defaultContent: 'Newsletter' },
  { key: 'footer.newsletter.placeholder', page: FOOTER, section: 'newsletter', contentType: 'TEXT', defaultContent: 'Your email' },
  { key: 'footer.newsletter.submit', page: FOOTER, section: 'newsletter', contentType: 'TEXT', defaultContent: 'Subscribe' },

  // Footer — bottom
  { key: 'footer.copyright', page: FOOTER, section: 'bottom', contentType: 'TEXT', defaultContent: '© 2026 African Youth Observatory. All rights reserved.' },
  { key: 'footer.legal.privacy', page: FOOTER, section: 'bottom', contentType: 'TEXT', defaultContent: 'Privacy Policy' },
  { key: 'footer.legal.terms', page: FOOTER, section: 'bottom', contentType: 'TEXT', defaultContent: 'Terms of Service' },

  // Cookie consent banner
  { key: 'cookie_consent.message', page: COOKIE, section: 'banner', contentType: 'RICH_TEXT', defaultContent: 'We use cookies to improve your experience. By continuing to use this site you agree to our use of cookies.' },
  { key: 'cookie_consent.manage', page: COOKIE, section: 'banner', contentType: 'TEXT', defaultContent: 'Manage Preferences' },
  { key: 'cookie_consent.accept', page: COOKIE, section: 'banner', contentType: 'TEXT', defaultContent: 'Accept All' },
];
