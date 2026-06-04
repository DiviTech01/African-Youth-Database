// Generates the 12 -> 7 theme consolidation plan WITHOUT writing to the DB.
// Run from apps/api: node scripts/plan-7-theme-migration.js
const fs = require('fs');
const path = require('path');

function loadEnv(f) {
  if (!fs.existsSync(f)) return;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const s = l.trim();
    if (!s || s.startsWith('#')) continue;
    const e = s.indexOf('=');
    if (e < 0) continue;
    const k = s.slice(0, e).trim();
    let v = s.slice(e + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[k] === undefined) process.env[k] = v;
  }
}
loadEnv(path.resolve(__dirname, '..', '..', '..', '.env'));
loadEnv(path.resolve(__dirname, '..', '.env'));

const { PrismaClient } = require('@prisma/client');

// === The fixed 7 themes (user-mandated) ===
const FINAL_THEMES = [
  { slug: 'youth-demography-participation', name: 'Youth Demography & Participation', weight: 20, sortOrder: 0, color: '#2563eb', icon: 'Users' },
  { slug: 'education',                       name: 'Education',                        weight: 15, sortOrder: 1, color: '#7c3aed', icon: 'GraduationCap' },
  { slug: 'employment',                      name: 'Employment',                       weight: 15, sortOrder: 2, color: '#ea580c', icon: 'Briefcase' },
  { slug: 'health',                          name: 'Health',                           weight: 15, sortOrder: 3, color: '#dc2626', icon: 'HeartPulse' },
  { slug: 'entrepreneurship',                name: 'Entrepreneurship',                 weight: 15, sortOrder: 4, color: '#0891b2', icon: 'Rocket' },
  { slug: 'peace-security',                  name: 'Peace & Security',                 weight: 10, sortOrder: 5, color: '#16a34a', icon: 'Shield' },
  { slug: 'access-to-justice',               name: 'Access to Justice',                weight: 10, sortOrder: 6, color: '#9333ea', icon: 'Scale' },
];

// === Deterministic categorization: indicator slug -> one of the 7 themes, or 'DROP' with reason ===
// Built strictly from the indicator catalog observed in production.
const CATEGORIZE = {
  // ---------- Youth Demography & Participation ----------
  'total-population':                   'youth-demography-participation',
  'youth-population-15-35':             'youth-demography-participation',
  'youth-share-of-population':          'youth-demography-participation',
  'youth-disability-share':             'youth-demography-participation',
  'youth-rural-share':                  'youth-demography-participation',
  'youth-urban-share':                  'youth-demography-participation',
  'youth-voter-turnout':                'youth-demography-participation',
  'youth-political-participation-index':'youth-demography-participation',
  'youth-seats-in-parliament':          'youth-demography-participation',
  'youth-trust-in-government-index':    'youth-demography-participation',
  'cso-participation-rate':             'youth-demography-participation',
  'freedom-of-association-score':       'youth-demography-participation',
  'ayc-national-youth-policy':          'youth-demography-participation',
  'ayc-youth-volunteer-programme':      'youth-demography-participation',
  'ayc-composite-policy-index':         'youth-demography-participation',
  'ayc-national-gender-policy':         'youth-demography-participation',
  'ayc-women-empowerment-programme':    'youth-demography-participation',

  // ---------- Education ----------
  'youth-literacy-rate':                'education',
  'education-budget-share-gdp':         'education',
  'primary-enrollment-rate':            'education',
  'school-dropout-rate':                'education',
  'teacher-student-ratio':              'education',
  'secondary-school-net-enrollment-rate':'education',
  'tertiary-education-gross-enrollment-rate':'education',
  'primary-completion-rate':            'education',
  'mean-years-of-schooling':            'education',
  'stem-graduates-share':               'education',
  'youth-neet-rate':                    'education',
  'ayc-education-policy-sdg4':          'education',
  'ayc-tvet-policy':                    'education',
  'gender-parity-index-education':      'education',
  'women-in-stem':                      'education',

  // ---------- Employment ----------
  'youth-unemployment-rate':            'employment',
  'youth-labor-force-participation-rate':'employment',
  'youth-employment-to-population-ratio':'employment',
  'youth-adult-unemployment-ratio':     'employment',
  'youth-employment-in-agriculture':    'employment',
  'youth-employment-in-industry':       'employment',
  'youth-employment-in-services':       'employment',
  'informal-employment-rate':           'employment',
  'youth-wage-employment-share':        'employment',
  'youth-working-poverty-rate':         'employment',
  'ayc-youth-employment-plan':          'employment',
  'female-labor-force-participation-rate':'employment',
  'female-youth-unemployment-gap':      'employment',

  // ---------- Health ----------
  'births-by-skilled-staff':            'health',
  'contraceptive-prevalence-rate-youth':'health',
  'health-budget-share':                'health',
  'hiv-prevalence-rate-youth':          'health',
  'physician-density':                  'health',
  'yplwha-treatment-rate':              'health',
  'youth-accident-deaths':              'health',
  'youth-aids-deaths':                  'health',
  'youth-substance-abuse-deaths':       'health',
  'youth-suicide-rate':                 'health',
  'adolescent-fertility-rate':          'health',
  'mental-health-service-coverage':     'health',
  'stunting-prevalence-under-5':        'health',
  'youth-mortality-rate':               'health',
  'youth-healthcare-access':            'health',
  'maternal-mortality-ratio':           'health',
  'gender-based-violence-prevalence':   'health',
  'adolescent-marriage-rate':           'health',
  'ayc-adolescent-health-policy':       'health',
  'ayc-gbv-prevention-framework':       'health',

  // ---------- Entrepreneurship ----------
  'youth-entrepreneurship-rate':        'entrepreneurship',
  'youth-self-employment-rate':         'entrepreneurship',
  'internet-access-households':         'entrepreneurship',
  'ict-development-index':              'entrepreneurship',
  'fixed-broadband-subscriptions':      'entrepreneurship',
  'mobile-broadband-subscriptions':     'entrepreneurship',
  'mobile-cellular-subscriptions':      'entrepreneurship',
  'internet-penetration-rate':          'entrepreneurship',
  'youth-digital-literacy-rate':        'entrepreneurship',
  'tech-startup-density':               'entrepreneurship',
  'youth-ip-registrations':             'entrepreneurship',
  'youth-startup-survival-rate':        'entrepreneurship',
  'getting-credit-rank':                'entrepreneurship',
  'protecting-investors-rank':          'entrepreneurship',
  'youth-microcredit-recipients':       'entrepreneurship',
  'youth-movable-collateral-holders':   'entrepreneurship',
  'financial-literacy-rate':            'entrepreneurship',
  'insurance-coverage-rate':            'entrepreneurship',
  'mobile-money-account-penetration':   'entrepreneurship',
  'youth-access-to-credit':             'entrepreneurship',
  'youth-bank-account-ownership':       'entrepreneurship',
  'youth-savings-rate':                 'entrepreneurship',
  'ayc-entrepreneurship-programme':     'entrepreneurship',
  'ayc-sme-development-policy':         'entrepreneurship',
  'ayc-startup-act':                    'entrepreneurship',
  'ayc-youth-tax-incentives':           'entrepreneurship',
  'ayc-investment-promotion-agency':    'entrepreneurship',
  'ayc-investment-promotion-law':       'entrepreneurship',
  'ayc-ppp-framework':                  'entrepreneurship',
  'ayc-sez-framework':                  'entrepreneurship',
  'ayc-tax-reform-legislation':         'entrepreneurship',
  'ayc-cybersecurity-policy':           'entrepreneurship',
  'ayc-national-ict-policy':            'entrepreneurship',
  'ayc-digital-economy-strategy':       'entrepreneurship',
  'ayc-digital-skills-education':       'entrepreneurship',

  // ---------- Peace & Security ----------
  'youth-extremism-deaths':             'peace-security',
  'youth-idps':                         'peace-security',
  'ayc-youth-peace-security-plan':      'peace-security',

  // ---------- Access to Justice ----------
  'juvenile-detentions':                'access-to-justice',
  'youth-awaiting-trial':               'access-to-justice',
  'youth-imprisoned':                   'access-to-justice',
  'youth-trafficking-victims':          'access-to-justice',
};

// Slugs to drop because they duplicate a kept slug (legacy gender-split naming).
// Format: dup-slug -> canonical-slug
const DUPLICATES = {
  'youth-literacy-rate-male':          'youth-literacy-rate',
  'youth-literacy-rate-female':        'youth-literacy-rate',
  'secondary-enrollment-male':         'secondary-school-net-enrollment-rate',
  'secondary-enrollment-female':       'secondary-school-net-enrollment-rate',
  'tertiary-enrollment-rate':          'tertiary-education-gross-enrollment-rate',
  'education-expenditure-gdp':         'education-budget-share-gdp',
  'youth-employment-industry':         'youth-employment-in-industry',
  'youth-employment-services':         'youth-employment-in-services',
  'youth-employment-agriculture':      'youth-employment-in-agriculture',
  'youth-employment-ratio-male':       'youth-employment-to-population-ratio',
  'youth-employment-ratio-female':     'youth-employment-to-population-ratio',
  'labor-force-participation-youth-male':   'youth-labor-force-participation-rate',
  'labor-force-participation-youth-female': 'youth-labor-force-participation-rate',
  'youth-unemployment-male':           'youth-unemployment-rate',
  'youth-unemployment-female':         'youth-unemployment-rate',
  'skilled-birth-attendance':          'births-by-skilled-staff',
  'youth-contraceptive-prevalence':    'contraceptive-prevalence-rate-youth',
  'hiv-prevalence-youth-male':         'hiv-prevalence-rate-youth',
  'hiv-prevalence-youth-female':       'hiv-prevalence-rate-youth',
  'youth-hiv-treatment-rate':          'yplwha-treatment-rate',
  'household-internet-access':         'internet-access-households',
  'youth-population-share':            'youth-share-of-population',
  'youth-disability-prevalence':       'youth-disability-share',
  'youth-voter-registration-male':     'youth-voter-turnout',
  'youth-voter-registration-female':   'youth-voter-turnout',
};

// Slugs with no clean fit in the 7 themes (Environment & Climate, niche Agriculture, etc.)
const EXPLICIT_DROPS = new Set([
  // Environment & Climate (entire theme — not in 7)
  'carbon-emissions-per-capita',
  'climate-vulnerability-index',
  'environmental-education-coverage',
  'green-jobs-share',
  'renewable-energy-access-rate',
  'youth-engagement-environmental-action',
  'ayc-green-jobs-programme',
  'ayc-national-adaptation-plan',
  'ayc-ndc-climate-commitment',
  // Agriculture indicators with no youth angle (the one that has youth angle stays in Employment)
  'agribusiness-youth-participation-rate',
  'agricultural-productivity-index',
  'cereal-yield-per-hectare',
  'food-security-index',
  'youth-land-ownership-rate',
  // Zero-value or unmaintained
  'ease-doing-business-rank',
]);

(async () => {
  const p = new PrismaClient();
  const indicators = await p.indicator.findMany({ include: { _count: { select: { values: true } }, theme: { select: { slug: true } } } });

  const plan = {
    generatedAt: new Date().toISOString(),
    finalThemes: FINAL_THEMES,
    kept: {},       // theme slug -> [{ slug, name, valueCount, oldTheme }]
    duplicates: [], // [{ dup, canonical, dupValueCount, canonicalValueCount, status }]
    explicitDrops: [],
    uncategorized: [], // indicators not in any of the maps above — bug if non-empty
    zeroValueDrops: [],
    totals: {},
  };

  for (const t of FINAL_THEMES) plan.kept[t.slug] = [];

  for (const ind of indicators) {
    const slug = ind.slug;
    const vc = ind._count.values;

    if (DUPLICATES[slug]) {
      const canon = indicators.find(x => x.slug === DUPLICATES[slug]);
      plan.duplicates.push({
        dup: slug,
        canonical: DUPLICATES[slug],
        dupValueCount: vc,
        canonicalValueCount: canon ? canon._count.values : 'MISSING',
        action: 'DROP dup; values stay under canonical',
      });
      continue;
    }
    if (EXPLICIT_DROPS.has(slug)) {
      plan.explicitDrops.push({ slug, valueCount: vc, oldTheme: ind.theme?.slug, reason: 'no fit in 7 themes' });
      continue;
    }
    if (vc === 0) {
      plan.zeroValueDrops.push({ slug, oldTheme: ind.theme?.slug });
      continue;
    }
    const target = CATEGORIZE[slug];
    if (!target) {
      plan.uncategorized.push({ slug, valueCount: vc, oldTheme: ind.theme?.slug });
      continue;
    }
    plan.kept[target].push({ slug, name: ind.name, valueCount: vc, oldTheme: ind.theme?.slug });
  }

  // Totals
  let keptCount = 0, keptValues = 0;
  for (const t of FINAL_THEMES) {
    const arr = plan.kept[t.slug];
    arr.sort((a, b) => b.valueCount - a.valueCount);
    const v = arr.reduce((s, i) => s + i.valueCount, 0);
    keptCount += arr.length;
    keptValues += v;
  }
  const dupValues = plan.duplicates.reduce((s, d) => s + d.dupValueCount, 0);
  const dropValues = plan.explicitDrops.reduce((s, d) => s + d.valueCount, 0);
  plan.totals = {
    keptIndicators: keptCount,
    keptValues,
    duplicateIndicatorsDropped: plan.duplicates.length,
    duplicateValuesRemoved: dupValues,
    explicitDropsCount: plan.explicitDrops.length,
    explicitDropsValues: dropValues,
    zeroValueDropsCount: plan.zeroValueDrops.length,
    uncategorizedCount: plan.uncategorized.length,
  };

  const out = path.resolve(__dirname, '..', 'backups', 'consolidation-plan.json');
  fs.writeFileSync(out, JSON.stringify(plan, null, 2));
  console.log('Plan written to:', out);
  console.log('');
  console.log('=== TOTALS ===');
  console.log(JSON.stringify(plan.totals, null, 2));
  console.log('');
  console.log('=== PER-THEME COUNTS ===');
  for (const t of FINAL_THEMES) {
    const arr = plan.kept[t.slug];
    const v = arr.reduce((s, i) => s + i.valueCount, 0);
    console.log(`  ${t.name.padEnd(38)} weight=${t.weight}%  indicators=${String(arr.length).padStart(3)}  values=${v}`);
  }
  if (plan.uncategorized.length) {
    console.log('');
    console.log('⚠ UNCATEGORIZED (would be dropped — likely a bug, review):');
    for (const u of plan.uncategorized) console.log(`  ${u.slug} (oldTheme=${u.oldTheme}, values=${u.valueCount})`);
  }
  await p.$disconnect();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
