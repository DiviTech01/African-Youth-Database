import type { CmsRegistryEntry } from '../registry';

const FAQ_PAGE = 'faq';
const GLOSSARY_PAGE = 'glossary';
const METHODOLOGY_PAGE = 'methodology';

// Helpers to keep it compact
const faq = (
  slug: string,
  section: string,
  contentType: 'TEXT' | 'RICH_TEXT',
  defaultContent: string,
): CmsRegistryEntry => ({ key: slug, page: FAQ_PAGE, section, contentType, defaultContent });

const gloss = (slug: string, contentType: 'TEXT' | 'RICH_TEXT', defaultContent: string): CmsRegistryEntry => ({
  key: slug,
  page: GLOSSARY_PAGE,
  section: slug.startsWith('glossary.term.') ? 'terms' : 'page',
  contentType,
  defaultContent,
});

const meth = (
  slug: string,
  section: string,
  contentType: 'TEXT' | 'RICH_TEXT',
  defaultContent: string,
): CmsRegistryEntry => ({ key: slug, page: METHODOLOGY_PAGE, section, contentType, defaultContent });

// ==== FAQ ====
const faqPairs: Array<[string, string, string]> = [
  // platform
  ['platform', 'q1', 'What is the African Youth Observatory (AYO)?'],
  ['platform', 'q2', 'Who manages and maintains the AYO?'],
  ['platform', 'q3', 'How often is the data updated?'],
  ['platform', 'q4', 'Which countries are covered?'],
  // usage
  ['usage', 'q1', 'How do I search and filter data?'],
  ['usage', 'q2', 'What is the African Youth Index (AYI)?'],
  ['usage', 'q3', 'Can I download the data?'],
  ['usage', 'q4', 'Can I embed charts in my website or report?'],
  // quality
  ['quality', 'q1', 'Where does the data come from?'],
  ['quality', 'q2', 'How do you ensure data quality?'],
  ['quality', 'q3', 'What is the Credibility Score?'],
  ['quality', 'q4', 'Are there data gaps or limitations I should know about?'],
  // access
  ['access', 'q1', 'Is the platform free to use?'],
  ['access', 'q2', 'Do I need to create an account?'],
  ['access', 'q3', 'Can I use AYO data in my research or publications?'],
  ['access', 'q4', 'How can my organization contribute data?'],
];

const faqAnswers: Record<string, Record<string, string>> = {
  platform: {
    q1: "The African Youth Observatory is Africa's most comprehensive youth data intelligence platform. It centralizes, analyzes, and visualizes youth-related statistics across all 54 African countries, covering population, education, health, employment, and entrepreneurship. Our mission is to power policy, research, innovation, and investment decisions with trusted, accessible data.",
    q2: 'AYO is managed by PACSDA (Pan African Centre for Social Development and Accountability) with implementation support from ZeroUp Next. We collaborate with national statistical offices, international organizations (UN agencies, World Bank, African Development Bank), and research institutions across Africa.',
    q3: 'Data update frequency varies by indicator and source. Most core indicators are updated annually when new national or international survey data becomes available. Real-time indicators may be updated more frequently. Each dataset includes metadata showing the last update date and data vintage.',
    q4: 'AYO covers all 54 African Union member states. Coverage depth varies by country and indicator based on data availability. We continuously work with national partners to expand coverage and improve data quality.',
  },
  usage: {
    q1: 'Use our Data Explorer to browse data by country, theme (Population, Education, Health, Employment, Entrepreneurship), indicator, year, gender, and age group. The interactive map allows you to click on countries to view their profiles. You can also use the Compare Countries feature to analyze up to 5 countries side by side.',
    q2: 'The AYI is our flagship composite indicator that ranks all African countries based on youth development outcomes. It combines scores across education, employment, health, and civic engagement to provide a comprehensive measure of how well countries are supporting their youth population. Countries are ranked annually.',
    q3: 'Yes! All public datasets can be downloaded in multiple formats including CSV, Excel (XLSX), and PDF. Charts can be exported as PNG images. Premium API access provides programmatic access to raw data for advanced users and applications.',
    q4: "Yes, our charts support embedding. Click the 'Embed' button on any visualization to get an embed code. Please ensure you attribute the African Youth Observatory as the source and link back to the original data page.",
  },
  quality: {
    q1: 'Our data comes from multiple verified sources including: national statistical offices and census bureaus, UN agencies (UNDP, UNICEF, UNESCO, ILO), World Bank, African Development Bank, Demographic and Health Surveys (DHS), academic research, and specialized youth surveys. Each dataset includes full source attribution and methodology notes.',
    q2: 'We implement a rigorous quality assurance process: data validation and cross-checking with multiple sources, standardization of indicators across countries, credibility scoring for each dataset, human review of all AI-generated insights, and transparent documentation of methodology and limitations.',
    q3: 'Each dataset receives a Credibility Score (1-5 stars) based on: source reliability, methodology rigor, data recency, sample representativeness, and verification status. Higher scores indicate greater confidence in data accuracy. Datasets below 3 stars include advisory notes.',
    q4: "Yes, we maintain transparency about data limitations. Common challenges include: varying definitions of 'youth' across countries, limited data from fragile and conflict-affected states, gaps in disaggregated data (by gender, disability, etc.), and lag between data collection and publication. Each indicator page notes specific limitations.",
  },
  access: {
    q1: 'Yes, core platform features are free for all users. This includes browsing dashboards, viewing visualizations, downloading standard datasets, and accessing the African Youth Index. Premium features (API access, custom dashboards, advanced analytics) require registration or subscription.',
    q2: 'No account is needed for basic browsing. However, registered users can: save custom dashboards, set up data alerts, access download history, use the API, and contribute datasets. Registration is free for researchers and institutions.',
    q3: 'Yes! We encourage the use of AYO data for research, policy analysis, and journalism. Please cite the African Youth Observatory as your source and include a link to the specific dataset or page. For academic citations, use our suggested citation format available on each data page.',
    q4: 'We welcome data contributions from national statistical offices, research institutions, and development organizations. Contributors must: register through our Partner Portal, submit datasets with full metadata and methodology, undergo a verification review, and sign a data sharing agreement. Contributors receive attribution and impact metrics.',
  },
};

const faqEntries: CmsRegistryEntry[] = [
  faq('faq.header.title', 'header', 'TEXT', 'Frequently Asked Questions'),
  faq('faq.header.subtitle', 'header', 'RICH_TEXT', 'Find answers to common questions about the African Youth Observatory.'),
  faq('faq.platform.title', 'platform', 'TEXT', 'About the Platform'),
  faq('faq.usage.title', 'usage', 'TEXT', 'Using the Data'),
  faq('faq.quality.title', 'quality', 'TEXT', 'Data Quality & Sources'),
  faq('faq.access.title', 'access', 'TEXT', 'Access & Permissions'),
  faq('faq.still_questions.title', 'still_questions', 'TEXT', 'Still have questions?'),
  faq(
    'faq.still_questions.body',
    'still_questions',
    'RICH_TEXT',
    "Can't find the answer you're looking for? Our team is here to help.",
  ),
  faq('faq.still_questions.cta', 'still_questions', 'TEXT', 'Contact Support'),
  ...faqPairs.flatMap(([cat, qslug, question]) => [
    faq(`faq.${cat}.${qslug}.question`, cat, 'TEXT', question),
    faq(`faq.${cat}.${qslug}.answer`, cat, 'RICH_TEXT', faqAnswers[cat][qslug]),
  ]),
];

// ==== GLOSSARY ====
const glossaryTerms: Array<[string, string, string]> = [
  ['ayi', 'African Youth Index (AYI)', 'A composite indicator developed by AYO that ranks African countries based on youth development outcomes across education, employment, health, and civic engagement.'],
  ['youth', 'Youth', "In the context of AYO, youth refers to individuals aged 15–35, consistent with the African Union definition codified in the African Youth Charter. The UN's narrower 15–24 band remains queryable on Explore for cross-reference."],
  ['neet', 'NEET Rate', 'The share of young people who are Not in Education, Employment, or Training. A key indicator of youth economic exclusion.'],
  ['unemployment', 'Youth Unemployment Rate', 'The percentage of the youth labor force (15–35) that is without work but available and seeking employment.'],
  ['lfp', 'Labor Force Participation Rate', 'The percentage of youth population that is either employed or actively seeking employment.'],
  ['gpi', 'Gender Parity Index (GPI)', 'A ratio of female to male values for a given indicator, used to measure gender equality in education and employment.'],
  ['ger', 'Gross Enrollment Ratio (GER)', 'Total enrollment in a specific level of education, regardless of age, expressed as a percentage of the eligible official school-age population.'],
  ['ner', 'Net Enrollment Ratio (NER)', 'Enrollment of the official age group for a given level of education expressed as a percentage of the corresponding population.'],
  ['literacy', 'Youth Literacy Rate', 'The percentage of young people aged 15–35 who can read and write a short, simple statement about their everyday life.'],
  ['informal', 'Informal Employment', 'Employment in the informal sector or informal employment outside the informal sector, typically lacking social protection and formal contracts.'],
  ['dependency', 'Youth Dependency Ratio', 'The ratio of youth (15–35) to the working-age population, indicating the demographic burden on the economy.'],
  ['urban', 'Urban Youth', 'Young people residing in areas classified as urban according to national definitions, typically characterized by higher population density.'],
  ['hiv', 'HIV Prevalence', 'The percentage of people living with HIV in a specific population group, reported here for youth aged 15–35.'],
  ['yfhs', 'Youth-Friendly Health Services', "Health services designed to be accessible, acceptable, and appropriate for young people's needs."],
  ['early_entrepreneurship', 'Early-Stage Entrepreneurship', 'The rate of adults aged 18-24 who are either nascent entrepreneurs or owner-managers of new businesses.'],
  ['finance', 'Access to Finance', 'The availability and accessibility of formal financial services (banks, microfinance) to young entrepreneurs.'],
  ['provenance', 'Data Provenance', 'Documentation of the origin, methodology, and transformation history of data, ensuring transparency and trust.'],
  ['credibility', 'Credibility Score', 'A rating assigned to datasets based on source reliability, methodology rigor, and verification status.'],
];

const glossaryEntries: CmsRegistryEntry[] = [
  gloss('glossary.header.title', 'TEXT', 'Glossary'),
  gloss(
    'glossary.header.subtitle',
    'RICH_TEXT',
    'Definitions of key terms, indicators, and concepts used in the African Youth Observatory.',
  ),
  gloss('glossary.search.placeholder', 'TEXT', 'Search terms...'),
  gloss('glossary.empty.message', 'TEXT', 'No terms found matching your search.'),
  ...glossaryTerms.flatMap(([slug, term, definition]) => [
    gloss(`glossary.term.${slug}.term`, 'TEXT', term),
    gloss(`glossary.term.${slug}.definition`, 'RICH_TEXT', definition),
  ]),
];

// ==== METHODOLOGY ====
const methodologyEntries: CmsRegistryEntry[] = [
  meth('methodology.header.title', 'header', 'TEXT', 'Methodology'),
  meth('methodology.header.subtitle', 'header', 'RICH_TEXT', 'Understand how we collect, process, and validate youth data across Africa.'),

  meth('methodology.overview.title', 'overview', 'TEXT', 'Data Collection Overview'),
  meth(
    'methodology.overview.body',
    'overview',
    'RICH_TEXT',
    '<p>The African Youth Observatory aggregates youth-focused statistics from a diverse range of authoritative sources. Our data collection methodology is designed to ensure comprehensiveness, accuracy, and comparability across all 54 African countries.</p><h4>Primary Data Sources</h4><ul><li><strong>National Statistical Offices:</strong> Census data, labor force surveys, household surveys</li><li><strong>UN Agencies:</strong> UNDP Human Development Reports, UNESCO education statistics, ILO labor data, UNICEF surveys</li><li><strong>World Bank:</strong> World Development Indicators, Enterprise Surveys</li><li><strong>African Development Bank:</strong> African Economic Outlook, African Statistical Yearbook</li><li><strong>DHS Program:</strong> Demographic and Health Surveys</li><li><strong>Academic Research:</strong> Peer-reviewed studies and specialized youth surveys</li></ul>',
  ),

  meth('methodology.standardization.title', 'standardization', 'TEXT', 'Standardization Process'),
  meth(
    'methodology.standardization.body',
    'standardization',
    'RICH_TEXT',
    '<p>To enable cross-country comparison, we apply rigorous standardization procedures:</p><h4>Age Definition</h4><p>We standardize all youth indicators to the 15-35 age group, consistent with the African Union definition codified in the African Youth Charter. The UN&rsquo;s narrower 15-24 band remains queryable on the Explore page for cross-reference; where source data uses different brackets, we note this in metadata and apply statistical adjustments where possible.</p><h4>Indicator Harmonization</h4><ul><li>Standardized indicator definitions aligned with international statistical standards</li><li>Consistent calculation methodologies across countries</li><li>Currency conversions to USD using World Bank exchange rates</li><li>PPP adjustments for economic comparisons where appropriate</li></ul><h4>Temporal Alignment</h4><p>Data points are aligned to calendar years. Multi-year surveys are assigned to the midpoint year. When the latest data is not available for a country, we display the most recent available year with clear vintage labeling.</p>',
  ),

  meth('methodology.qa.title', 'qa', 'TEXT', 'Quality Assurance'),
  meth('methodology.qa.intro', 'qa', 'RICH_TEXT', 'Every dataset undergoes a multi-stage quality assurance process:'),
  meth('methodology.qa.source.title', 'qa', 'TEXT', '1. Source Verification'),
  meth('methodology.qa.source.body', 'qa', 'RICH_TEXT', 'Confirm data origin from official or peer-reviewed sources. Verify methodology documentation is available.'),
  meth('methodology.qa.validation.title', 'qa', 'TEXT', '2. Data Validation'),
  meth('methodology.qa.validation.body', 'qa', 'RICH_TEXT', 'Cross-check values against multiple sources. Flag outliers for manual review.'),
  meth('methodology.qa.consistency.title', 'qa', 'TEXT', '3. Consistency Checks'),
  meth('methodology.qa.consistency.body', 'qa', 'RICH_TEXT', 'Verify temporal consistency (no illogical year-over-year changes). Check against related indicators.'),
  meth('methodology.qa.credibility.title', 'qa', 'TEXT', '4. Credibility Scoring'),
  meth('methodology.qa.credibility.body', 'qa', 'RICH_TEXT', 'Assign 1-5 star rating based on source reliability, methodology rigor, and recency.'),

  meth('methodology.ayi.title', 'ayi', 'TEXT', 'African Youth Index Methodology'),
  meth('methodology.ayi.intro', 'ayi', 'RICH_TEXT', 'The African Youth Index (AYI) is a composite indicator developed by AYO to provide a comprehensive measure of youth development across African countries.'),
  meth('methodology.ayi.calculation', 'ayi', 'RICH_TEXT', '<li>Normalize all indicators to 0-100 scale using min-max normalization</li><li>Calculate dimension scores as weighted average of constituent indicators</li><li>Compute overall AYI as weighted sum of dimension scores</li><li>Rank countries from highest to lowest AYI score</li>'),

  meth('methodology.updates.title', 'updates', 'TEXT', 'Data Updates & Version Control'),
  meth(
    'methodology.updates.body',
    'updates',
    'RICH_TEXT',
    '<p>We maintain a systematic approach to data updates and version control:</p><ul><li><strong>Annual Updates:</strong> Core indicators are reviewed and updated annually when new source data is released</li><li><strong>Continuous Monitoring:</strong> We track major data releases from key sources and integrate promptly</li><li><strong>Version History:</strong> All datasets maintain version history showing changes over time</li><li><strong>Changelog:</strong> Material changes to methodology are documented and communicated to users</li><li><strong>API Versioning:</strong> Premium API users have access to version-specific endpoints for reproducibility</li></ul>',
  ),
];

export const resourcesEntries: CmsRegistryEntry[] = [
  ...faqEntries,
  ...glossaryEntries,
  ...methodologyEntries,
];
