import type { CmsRegistryEntry } from '../registry';

const PAGE = 'home';

export const homeEntries: CmsRegistryEntry[] = [
  // Hero
  { key: 'home.hero.eyebrow', page: PAGE, section: 'hero', contentType: 'TEXT', defaultContent: "Africa's Premier Youth Data Platform" },
  { key: 'home.hero.title', page: PAGE, section: 'hero', contentType: 'TEXT', defaultContent: "Empowering Africa's Youth Through Data" },
  { key: 'home.hero.subtitle', page: PAGE, section: 'hero', contentType: 'RICH_TEXT', defaultContent: 'Access comprehensive youth statistics across all 54 African nations. Power your research, policy decisions, and investments with trusted, real-time data.' },
  { key: 'home.hero.cta_label', page: PAGE, section: 'hero', contentType: 'TEXT', defaultContent: 'Explore Data' },

  // Quick Stats section
  { key: 'home.quick_stats.title', page: PAGE, section: 'quick_stats', contentType: 'TEXT', defaultContent: 'Key Statistics' },
  { key: 'home.quick_stats.subtitle', page: PAGE, section: 'quick_stats', contentType: 'RICH_TEXT', defaultContent: 'Explore essential data points on African youth across our five core thematic areas.' },
  { key: 'home.quick_stats.population.title', page: PAGE, section: 'quick_stats', contentType: 'TEXT', defaultContent: 'Population' },
  { key: 'home.quick_stats.population.description', page: PAGE, section: 'quick_stats', contentType: 'TEXT', defaultContent: 'African youth aged 15-35' },
  { key: 'home.quick_stats.education.title', page: PAGE, section: 'quick_stats', contentType: 'TEXT', defaultContent: 'Education' },
  { key: 'home.quick_stats.education.description', page: PAGE, section: 'quick_stats', contentType: 'TEXT', defaultContent: 'Secondary enrollment rate' },
  { key: 'home.quick_stats.health.title', page: PAGE, section: 'quick_stats', contentType: 'TEXT', defaultContent: 'Health' },
  { key: 'home.quick_stats.health.description', page: PAGE, section: 'quick_stats', contentType: 'TEXT', defaultContent: 'Access to healthcare' },
  { key: 'home.quick_stats.employment.title', page: PAGE, section: 'quick_stats', contentType: 'TEXT', defaultContent: 'Employment' },
  { key: 'home.quick_stats.employment.description', page: PAGE, section: 'quick_stats', contentType: 'TEXT', defaultContent: 'Youth labor participation' },
  { key: 'home.quick_stats.entrepreneurship.title', page: PAGE, section: 'quick_stats', contentType: 'TEXT', defaultContent: 'Entrepreneurship' },
  { key: 'home.quick_stats.entrepreneurship.description', page: PAGE, section: 'quick_stats', contentType: 'TEXT', defaultContent: 'Youth-led businesses' },

  // Featured section
  { key: 'home.featured.title', page: PAGE, section: 'featured', contentType: 'TEXT', defaultContent: 'Featured Insights' },
  { key: 'home.featured.subtitle', page: PAGE, section: 'featured', contentType: 'RICH_TEXT', defaultContent: 'Explore our latest visualizations and reports on African youth development.' },
  { key: 'home.featured.unemployment.title', page: PAGE, section: 'featured', contentType: 'TEXT', defaultContent: 'Youth Unemployment Trends' },
  { key: 'home.featured.unemployment.description', page: PAGE, section: 'featured', contentType: 'RICH_TEXT', defaultContent: 'Analysis of youth unemployment rates across African regions from 2010-2023.' },
  { key: 'home.featured.education_gender.title', page: PAGE, section: 'featured', contentType: 'TEXT', defaultContent: 'Education Access by Gender' },
  { key: 'home.featured.education_gender.description', page: PAGE, section: 'featured', contentType: 'RICH_TEXT', defaultContent: 'Comparative analysis of education access and completion rates by gender.' },
  { key: 'home.featured.entrepreneurship.title', page: PAGE, section: 'featured', contentType: 'TEXT', defaultContent: 'Youth-led Entrepreneurship' },
  { key: 'home.featured.entrepreneurship.description', page: PAGE, section: 'featured', contentType: 'RICH_TEXT', defaultContent: 'Emerging trends in youth entrepreneurship and business formation across Africa.' },
  { key: 'home.featured.explore_cta', page: PAGE, section: 'featured', contentType: 'TEXT', defaultContent: 'Explore' },
  { key: 'home.featured.view_all', page: PAGE, section: 'featured', contentType: 'TEXT', defaultContent: 'View All Reports' },

  // Partners
  { key: 'home.partners.heading', page: PAGE, section: 'partners', contentType: 'TEXT', defaultContent: 'Data Sources' },
];
