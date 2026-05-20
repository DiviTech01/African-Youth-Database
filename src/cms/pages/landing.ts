import type { CmsRegistryEntry } from '../registry';

const PAGE = 'landing';

export const landingEntries: CmsRegistryEntry[] = [
  // Brand / header
  { key: 'landing.brand.name', page: PAGE, section: 'header', contentType: 'TEXT', defaultContent: 'African Youth Observatory', description: 'Wordmark next to the AYO logo.' },
  { key: 'landing.header.signin', page: PAGE, section: 'header', contentType: 'TEXT', defaultContent: 'Sign In' },
  { key: 'landing.header.get_started', page: PAGE, section: 'header', contentType: 'TEXT', defaultContent: 'Get Started' },

  // Hero
  { key: 'landing.hero.badge', page: PAGE, section: 'hero', contentType: 'TEXT', defaultContent: "Africa's Premier Youth Data Intelligence Platform" },
  { key: 'landing.hero.title_line1', page: PAGE, section: 'hero', contentType: 'TEXT', defaultContent: "Empowering Africa's", description: 'First line of the H1.' },
  { key: 'landing.hero.title_line2', page: PAGE, section: 'hero', contentType: 'TEXT', defaultContent: 'Youth Through Data', description: 'Second line, gradient-styled.' },
  { key: 'landing.hero.description', page: PAGE, section: 'hero', contentType: 'RICH_TEXT', defaultContent: 'Access comprehensive youth statistics across all 54 African nations. Power your research, policy decisions, and investments with trusted, real-time data.' },
  { key: 'landing.hero.cta_primary', page: PAGE, section: 'hero', contentType: 'TEXT', defaultContent: 'Start Exploring Data' },
  { key: 'landing.hero.cta_secondary', page: PAGE, section: 'hero', contentType: 'TEXT', defaultContent: 'Sign In to Dashboard' },

  // Stats
  { key: 'landing.stats.countries.label', page: PAGE, section: 'stats', contentType: 'TEXT', defaultContent: 'African Countries' },
  { key: 'landing.stats.indicators.label', page: PAGE, section: 'stats', contentType: 'TEXT', defaultContent: 'Data Indicators' },
  { key: 'landing.stats.youth.label', page: PAGE, section: 'stats', contentType: 'TEXT', defaultContent: 'Youth Covered' },
  { key: 'landing.stats.years.label', page: PAGE, section: 'stats', contentType: 'TEXT', defaultContent: 'Years of Data' },

  // Features
  { key: 'landing.features.title', page: PAGE, section: 'features', contentType: 'TEXT', defaultContent: 'Comprehensive Data Solutions' },
  { key: 'landing.features.subtitle', page: PAGE, section: 'features', contentType: 'RICH_TEXT', defaultContent: "Everything you need to understand Africa's youth demographics and drive impactful decisions." },
  { key: 'landing.features.card1.title', page: PAGE, section: 'features', contentType: 'TEXT', defaultContent: 'Interactive Maps' },
  { key: 'landing.features.card1.description', page: PAGE, section: 'features', contentType: 'RICH_TEXT', defaultContent: 'Visualize data across Africa with our dynamic, interactive mapping tools.' },
  { key: 'landing.features.card2.title', page: PAGE, section: 'features', contentType: 'TEXT', defaultContent: 'Advanced Analytics' },
  { key: 'landing.features.card2.description', page: PAGE, section: 'features', contentType: 'RICH_TEXT', defaultContent: 'Deep dive into trends with powerful charts and comparative analysis.' },
  { key: 'landing.features.card3.title', page: PAGE, section: 'features', contentType: 'TEXT', defaultContent: 'Data Export' },
  { key: 'landing.features.card3.description', page: PAGE, section: 'features', contentType: 'RICH_TEXT', defaultContent: 'Download datasets in multiple formats for your research needs.' },
  { key: 'landing.features.card4.title', page: PAGE, section: 'features', contentType: 'TEXT', defaultContent: 'Youth Index (AYI)' },
  { key: 'landing.features.card4.description', page: PAGE, section: 'features', contentType: 'RICH_TEXT', defaultContent: 'Track country rankings across education, health, and economic dimensions.' },
  { key: 'landing.features.card5.title', page: PAGE, section: 'features', contentType: 'TEXT', defaultContent: 'Trend Analysis' },
  { key: 'landing.features.card5.description', page: PAGE, section: 'features', contentType: 'RICH_TEXT', defaultContent: 'Monitor changes over time with historical data spanning over a decade.' },
  { key: 'landing.features.card6.title', page: PAGE, section: 'features', contentType: 'TEXT', defaultContent: 'Reports & Insights' },
  { key: 'landing.features.card6.description', page: PAGE, section: 'features', contentType: 'RICH_TEXT', defaultContent: 'Access curated reports and policy briefs from leading researchers.' },

  // Bottom CTA
  { key: 'landing.bottom_cta.title', page: PAGE, section: 'cta', contentType: 'TEXT', defaultContent: "Ready to Unlock Africa's Youth Data?" },
  { key: 'landing.bottom_cta.description', page: PAGE, section: 'cta', contentType: 'RICH_TEXT', defaultContent: 'Join researchers, policymakers, and organizations using AYO to drive meaningful change across the continent.' },
  { key: 'landing.bottom_cta.primary', page: PAGE, section: 'cta', contentType: 'TEXT', defaultContent: 'Create Free Account' },
  { key: 'landing.bottom_cta.secondary', page: PAGE, section: 'cta', contentType: 'TEXT', defaultContent: 'Learn More About AYO' },

  // Footer
  { key: 'landing.footer.copyright', page: PAGE, section: 'footer', contentType: 'TEXT', defaultContent: '© 2026 African Youth Observatory. Powered by PACSDA & ZeroUp Next.' },
  { key: 'landing.footer.link_about', page: PAGE, section: 'footer', contentType: 'TEXT', defaultContent: 'About' },
  { key: 'landing.footer.link_contact', page: PAGE, section: 'footer', contentType: 'TEXT', defaultContent: 'Contact' },
  { key: 'landing.footer.link_privacy', page: PAGE, section: 'footer', contentType: 'TEXT', defaultContent: 'Privacy' },
  { key: 'landing.footer.link_terms', page: PAGE, section: 'footer', contentType: 'TEXT', defaultContent: 'Terms' },
];
