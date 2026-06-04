import type { CmsRegistryEntry } from '../registry';

// Header/subtitles on these pages already flow through the i18n system (useLanguage).
// Only the *hardcoded* static copy that wasn't i18n'd gets CMS entries here.

const entries: CmsRegistryEntry[] = [];

// ============ COUNTRIES ============
const C = 'countries';
entries.push(
  { key: 'countries.back_button', page: C, section: 'profile', contentType: 'TEXT', defaultContent: 'Back to Country List' },
  { key: 'countries.empty.title', page: C, section: 'empty', contentType: 'TEXT', defaultContent: 'No countries found' },
  { key: 'countries.empty.description', page: C, section: 'empty', contentType: 'TEXT', defaultContent: 'Try adjusting your search or region filter.' },
  { key: 'countries.offline_notice', page: C, section: 'notice', contentType: 'TEXT', defaultContent: 'Showing offline data' },
  { key: 'countries.card.view_profile', page: C, section: 'card', contentType: 'TEXT', defaultContent: 'View Profile' },
);

// ============ THEMES ============
const T = 'themes';
const themeSlugs: Array<[string, string, string, Array<[string, string]>]> = [
  ['population', 'Population', 'Youth demographics, trends, and projections across African nations.', [['total', 'Total Youth Population'], ['growth', 'Annual Growth Rate'], ['urban', 'Urban Youth']]],
  ['education', 'Education', 'Educational attainment, enrollment rates, and quality metrics for African youth.', [['literacy', 'Literacy Rate'], ['secondary', 'Secondary Enrollment'], ['tertiary', 'Tertiary Enrollment']]],
  ['health', 'Health', 'Health access, outcomes, and risk factors affecting African youth.', [['access', 'Healthcare Access'], ['insurance', 'Health Insurance Coverage'], ['mental', 'Mental Health Services']]],
  ['employment', 'Employment', 'Labor market participation, unemployment, and work conditions for young Africans.', [['unemployment', 'Youth Unemployment'], ['participation', 'Labor Participation'], ['informal', 'Informal Employment']]],
  ['entrepreneurship', 'Entrepreneurship', 'Startup ecosystems, business ownership, and innovation among African youth.', [['ownership', 'Business Ownership'], ['finance', 'Access to Finance'], ['startup', 'Startup Formation']]],
  ['civic_engagement', 'Civic Engagement', 'Youth participation in governance, civic processes, and civil society across Africa.', [['voter', 'Voter Registration (Youth)'], ['parliament', 'Youth in Parliament'], ['cso', 'Civil Society Orgs']]],
  ['innovation_technology', 'Innovation & Technology', 'Digital access, STEM participation, and technological innovation among African youth.', [['internet', 'Internet Penetration'], ['mobile', 'Mobile Ownership'], ['stem', 'STEM Enrollment']]],
  ['agriculture', 'Agriculture', 'Youth involvement in agriculture, land access, and food production across the continent.', [['youth_in_ag', 'Youth in Agriculture'], ['land', 'Arable Land Access'], ['productivity', 'Productivity Index']]],
  ['gender_equality', 'Gender Equality', 'Gender parity in education, workforce participation, and safety for African youth.', [['gpi_edu', 'GPI Education'], ['workforce', 'Women in Workforce'], ['gbv', 'GBV Prevalence']]],
];
for (const [slug, title, desc, stats] of themeSlugs) {
  entries.push(
    { key: `themes.${slug}.title`, page: T, section: slug, contentType: 'TEXT', defaultContent: title },
    { key: `themes.${slug}.description`, page: T, section: slug, contentType: 'RICH_TEXT', defaultContent: desc },
  );
  for (const [statSlug, statLabel] of stats) {
    entries.push({ key: `themes.${slug}.stat.${statSlug}.label`, page: T, section: slug, contentType: 'TEXT', defaultContent: statLabel });
  }
}
entries.push(
  { key: 'themes.cta.explore', page: T, section: 'shared_cta', contentType: 'TEXT', defaultContent: 'Explore Data' },
  { key: 'themes.cta.indicators', page: T, section: 'shared_cta', contentType: 'TEXT', defaultContent: 'View Indicators' },
  { key: 'themes.cta.compare', page: T, section: 'shared_cta', contentType: 'TEXT', defaultContent: 'Compare Countries' },
);

// ============ YOUTH INDEX ============
const YI = 'youth_index';
entries.push(
  { key: 'youth_index.export_button', page: YI, section: 'header', contentType: 'TEXT', defaultContent: 'Export' },
  { key: 'youth_index.top_ranked_badge', page: YI, section: 'top3', contentType: 'TEXT', defaultContent: 'Top Ranked' },
  { key: 'youth_index.change_suffix', page: YI, section: 'top3', contentType: 'TEXT', defaultContent: 'from last year' },
  { key: 'youth_index.your_country_badge', page: YI, section: 'table', contentType: 'TEXT', defaultContent: 'Your Country' },
  { key: 'youth_index.score_tooltip', page: YI, section: 'table', contentType: 'TEXT', defaultContent: 'Weighted composite of all dimensions' },
  { key: 'youth_index.about.title', page: YI, section: 'about', contentType: 'TEXT', defaultContent: 'About the African Youth Index' },
  {
    key: 'youth_index.about.body',
    page: YI,
    section: 'about',
    contentType: 'RICH_TEXT',
    defaultContent:
      'The African Youth Index is a composite indicator that ranks all 54 African Union member states by youth development outcomes. Scores range from 0–100 and are computed each year across seven weighted thematic dimensions: Youth Demography & Participation (20%), Education (15%), Employment (15%), Health (15%), Entrepreneurship (15%), Peace & Security (10%), and Access to Justice (10%). Indicator values are min–max normalized per year, then combined with these weights into the overall score. Missing indicators have their weight redistributed within the same theme; missing themes fall back to the regional average.',
  },
  { key: 'youth_index.about.methodology_link', page: YI, section: 'about', contentType: 'TEXT', defaultContent: 'View full methodology' },
);

// ============ EXPLORE ============
const E = 'explore';
entries.push(
  { key: 'explore.filters_button', page: E, section: 'header', contentType: 'TEXT', defaultContent: 'Filters' },
  { key: 'explore.filters_sheet_title', page: E, section: 'header', contentType: 'TEXT', defaultContent: 'Data Filters' },
  { key: 'explore.map.title', page: E, section: 'map', contentType: 'TEXT', defaultContent: 'Africa Map' },
  { key: 'explore.map.description', page: E, section: 'map', contentType: 'TEXT', defaultContent: 'Click on a country to view its youth data.' },
);

// ============ REPORTS ============
const R = 'reports';
entries.push(
  { key: 'reports.header.title', page: R, section: 'header', contentType: 'TEXT', defaultContent: 'Reports & Publications' },
  { key: 'reports.header.subtitle', page: R, section: 'header', contentType: 'RICH_TEXT', defaultContent: 'Access our latest reports, thematic briefs, and data publications on African youth development.' },
  { key: 'reports.featured.heading', page: R, section: 'featured', contentType: 'TEXT', defaultContent: 'Featured Publications' },
  { key: 'reports.filters.heading', page: R, section: 'filters', contentType: 'TEXT', defaultContent: 'Filter Reports' },
  { key: 'reports.search.placeholder', page: R, section: 'filters', contentType: 'TEXT', defaultContent: 'Search reports...' },
  { key: 'reports.all.heading', page: R, section: 'all', contentType: 'TEXT', defaultContent: 'All Publications' },
  { key: 'reports.download_button', page: R, section: 'shared', contentType: 'TEXT', defaultContent: 'Download' },
  { key: 'reports.embed_button', page: R, section: 'shared', contentType: 'TEXT', defaultContent: 'Embed' },
  { key: 'reports.downloads_suffix', page: R, section: 'shared', contentType: 'TEXT', defaultContent: 'downloads' },
  { key: 'reports.toast.embed_copied_title', page: R, section: 'toasts', contentType: 'TEXT', defaultContent: 'Embed code copied!' },
  {
    key: 'reports.toast.embed_copied_description',
    page: R,
    section: 'toasts',
    contentType: 'TEXT',
    defaultContent: 'Embed code for "{title}" has been copied to your clipboard.',
    description: 'Use {title} as the placeholder for the report title.',
  },
);

export const dataPagesEntries: CmsRegistryEntry[] = entries;
