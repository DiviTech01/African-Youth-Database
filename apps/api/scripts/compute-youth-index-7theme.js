// Standalone runner: computes the 7-theme Youth Index for every year that has data.
// Mirrors the algorithm in src/modules/youth-index/youth-index-calculator.service.ts
// using only the Prisma client (no Nest bootstrap needed).
//
// Run from apps/api: node scripts/compute-youth-index-7theme.js [--year=2024]

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

// Batch jobs hit pooler connection limits. Prefer the direct URL when available.
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const { PrismaClient } = require('@prisma/client');

const SUB_WEIGHTS = {
  'youth-demography-participation': [
    { slug: 'youth-voter-turnout',                  direction: 'higher-is-better', weight: 0.35 },
    { slug: 'youth-share-of-population',            direction: 'higher-is-better', weight: 0.20 },
    { slug: 'youth-political-participation-index',  direction: 'higher-is-better', weight: 0.15 },
    { slug: 'youth-seats-in-parliament',            direction: 'higher-is-better', weight: 0.10 },
    { slug: 'youth-trust-in-government-index',      direction: 'higher-is-better', weight: 0.10 },
    { slug: 'freedom-of-association-score',         direction: 'higher-is-better', weight: 0.10 },
  ],
  'education': [
    { slug: 'youth-literacy-rate',                       direction: 'higher-is-better', weight: 0.25 },
    { slug: 'secondary-school-net-enrollment-rate',      direction: 'higher-is-better', weight: 0.20 },
    { slug: 'tertiary-education-gross-enrollment-rate',  direction: 'higher-is-better', weight: 0.15 },
    { slug: 'school-dropout-rate',                       direction: 'lower-is-better',  weight: 0.15 },
    { slug: 'primary-enrollment-rate',                   direction: 'higher-is-better', weight: 0.10 },
    { slug: 'education-budget-share-gdp',                direction: 'higher-is-better', weight: 0.10 },
    { slug: 'teacher-student-ratio',                     direction: 'lower-is-better',  weight: 0.05 },
  ],
  'employment': [
    { slug: 'youth-unemployment-rate',                 direction: 'lower-is-better',  weight: 0.35 },
    { slug: 'youth-labor-force-participation-rate',    direction: 'higher-is-better', weight: 0.25 },
    { slug: 'youth-employment-to-population-ratio',    direction: 'higher-is-better', weight: 0.20 },
    { slug: 'youth-adult-unemployment-ratio',          direction: 'lower-is-better',  weight: 0.10 },
    { slug: 'informal-employment-rate',                direction: 'lower-is-better',  weight: 0.10 },
  ],
  'health': [
    { slug: 'births-by-skilled-staff',             direction: 'higher-is-better', weight: 0.15 },
    { slug: 'physician-density',                   direction: 'higher-is-better', weight: 0.15 },
    { slug: 'hiv-prevalence-rate-youth',           direction: 'lower-is-better',  weight: 0.15 },
    { slug: 'yplwha-treatment-rate',               direction: 'higher-is-better', weight: 0.10 },
    { slug: 'youth-suicide-rate',                  direction: 'lower-is-better',  weight: 0.10 },
    { slug: 'contraceptive-prevalence-rate-youth', direction: 'higher-is-better', weight: 0.10 },
    { slug: 'maternal-mortality-ratio',            direction: 'lower-is-better',  weight: 0.10 },
    { slug: 'health-budget-share',                 direction: 'higher-is-better', weight: 0.05 },
    { slug: 'youth-aids-deaths',                   direction: 'lower-is-better',  weight: 0.05 },
    { slug: 'youth-substance-abuse-deaths',        direction: 'lower-is-better',  weight: 0.05 },
  ],
  'entrepreneurship': [
    { slug: 'youth-startup-survival-rate',         direction: 'higher-is-better', weight: 0.20 },
    { slug: 'youth-microcredit-recipients',        direction: 'higher-is-better', weight: 0.15 },
    { slug: 'internet-access-households',          direction: 'higher-is-better', weight: 0.15 },
    { slug: 'getting-credit-rank',                 direction: 'lower-is-better',  weight: 0.10 },
    { slug: 'protecting-investors-rank',           direction: 'lower-is-better',  weight: 0.10 },
    { slug: 'youth-ip-registrations',              direction: 'higher-is-better', weight: 0.10 },
    { slug: 'youth-entrepreneurship-rate',         direction: 'higher-is-better', weight: 0.10 },
    { slug: 'mobile-money-account-penetration',    direction: 'higher-is-better', weight: 0.05 },
    { slug: 'financial-literacy-rate',             direction: 'higher-is-better', weight: 0.05 },
  ],
  'peace-security': [
    { slug: 'youth-idps',                  direction: 'lower-is-better', weight: 0.40 },
    { slug: 'youth-trafficking-victims',   direction: 'lower-is-better', weight: 0.35 },
    { slug: 'youth-extremism-deaths',      direction: 'lower-is-better', weight: 0.25 },
  ],
  'access-to-justice': [
    { slug: 'youth-awaiting-trial',  direction: 'lower-is-better', weight: 0.45 },
    { slug: 'youth-imprisoned',      direction: 'lower-is-better', weight: 0.40 },
    { slug: 'juvenile-detentions',   direction: 'lower-is-better', weight: 0.15 },
  ],
};
const ALL_SLUGS = Object.values(SUB_WEIGHTS).flatMap((arr) => arr.map((s) => s.slug));
const DEFAULT_AGE_GROUP = '15-35';

async function computeForYear(prisma, year, themeWeight) {
  const countries = await prisma.country.findMany({
    select: { id: true, name: true, region: true },
  });

  const indicators = await prisma.indicator.findMany({
    where: { slug: { in: ALL_SLUGS } },
    select: { id: true, slug: true },
  });
  const slugToId = new Map(indicators.map((i) => [i.slug, i.id]));
  const indicatorIds = indicators.map((i) => i.id);

  const allValues = await prisma.indicatorValue.findMany({
    where: { year, gender: 'TOTAL', ageGroup: DEFAULT_AGE_GROUP, indicatorId: { in: indicatorIds } },
    select: { countryId: true, indicatorId: true, value: true },
  });

  const valueMap = new Map();
  for (const v of allValues) {
    let m = valueMap.get(v.indicatorId);
    if (!m) { m = new Map(); valueMap.set(v.indicatorId, m); }
    m.set(v.countryId, v.value);
  }

  const minMax = new Map();
  for (const [indId, m] of valueMap) {
    const vals = Array.from(m.values());
    if (!vals.length) continue;
    minMax.set(indId, { min: Math.min(...vals), max: Math.max(...vals) });
  }

  const countryScores = [];
  for (const country of countries) {
    const dimensions = {};
    for (const themeSlug of Object.keys(SUB_WEIGHTS)) {
      let weightedSum = 0, totalWeight = 0;
      for (const sub of SUB_WEIGHTS[themeSlug]) {
        const indId = slugToId.get(sub.slug);
        if (!indId) continue;
        const mm = minMax.get(indId);
        if (!mm) continue;
        const raw = valueMap.get(indId)?.get(country.id);
        if (raw === undefined || raw === null) continue;
        const range = mm.max - mm.min;
        // Soft-floor normalization: map min-max into [5, 100] instead of
        // [0, 100]. Worst-in-continent gets 5, not 0 — preserves ranking
        // but avoids visually-confusing zeros. Must mirror the Nest
        // calculator at src/modules/youth-index/youth-index-calculator.service.ts.
        const FLOOR = 5;
        const SCALE = 100 - FLOOR; // 95
        let normalized;
        if (range === 0) normalized = 50;
        else if (sub.direction === 'higher-is-better') normalized = FLOOR + ((raw - mm.min) / range) * SCALE;
        else normalized = FLOOR + ((mm.max - raw) / range) * SCALE;
        weightedSum += normalized * sub.weight;
        totalWeight += sub.weight;
      }
      dimensions[themeSlug] = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : null;
    }
    countryScores.push({ countryId: country.id, name: country.name, region: country.region, dimensions, overallScore: 0 });
  }

  // Regional averages
  const regionAvg = new Map();
  for (const cs of countryScores) {
    let m = regionAvg.get(cs.region);
    if (!m) { m = new Map(); regionAvg.set(cs.region, m); }
    for (const [k, v] of Object.entries(cs.dimensions)) {
      if (v === null) continue;
      const e = m.get(k) || { sum: 0, count: 0 };
      e.sum += v; e.count += 1;
      m.set(k, e);
    }
  }
  for (const cs of countryScores) {
    for (const themeSlug of Object.keys(SUB_WEIGHTS)) {
      if (cs.dimensions[themeSlug] !== null) continue;
      const e = regionAvg.get(cs.region)?.get(themeSlug);
      cs.dimensions[themeSlug] = e && e.count > 0 ? Math.round((e.sum / e.count) * 100) / 100 : 50;
    }
  }

  // Overall
  for (const cs of countryScores) {
    let overall = 0;
    for (const [themeSlug, dim] of Object.entries(cs.dimensions)) {
      overall += (dim ?? 50) * (themeWeight.get(themeSlug) ?? 0);
    }
    cs.overallScore = Math.round(overall * 100) / 100;
  }

  countryScores.sort((a, b) => b.overallScore - a.overallScore);
  const total = countryScores.length;

  const prev = await prisma.youthIndexScore.findMany({
    where: { year: year - 1 },
    select: { countryId: true, rank: true },
  });
  const previousRanks = new Map(prev.map((p) => [p.countryId, p.rank]));

  const tierOf = (pct) =>
    pct >= 80 ? 'HIGH' : pct >= 60 ? 'MEDIUM_HIGH' : pct >= 40 ? 'MEDIUM' : pct >= 20 ? 'MEDIUM_LOW' : 'LOW';

  for (let i = 0; i < countryScores.length; i++) {
    const cs = countryScores[i];
    const rank = i + 1;
    const percentile = Math.round(((total - rank) / total) * 10000) / 100;
    const prevRank = previousRanks.get(cs.countryId) ?? null;
    await prisma.youthIndexScore.upsert({
      where: { countryId_year: { countryId: cs.countryId, year } },
      create: {
        countryId: cs.countryId,
        year,
        overallScore: cs.overallScore,
        dimensionScores: cs.dimensions,
        rank,
        previousRank: prevRank,
        rankChange: prevRank !== null ? prevRank - rank : null,
        percentile,
        tier: tierOf(percentile),
      },
      update: {
        overallScore: cs.overallScore,
        dimensionScores: cs.dimensions,
        rank,
        previousRank: prevRank,
        rankChange: prevRank !== null ? prevRank - rank : null,
        percentile,
        tier: tierOf(percentile),
      },
    });
  }

  const scores = countryScores.map((c) => c.overallScore);
  const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
  return {
    year,
    countriesComputed: countryScores.length,
    averageScore: avg,
    topPerformer: countryScores[0],
    bottomPerformer: countryScores[countryScores.length - 1],
  };
}

(async () => {
  const prisma = new PrismaClient();

  // Theme weights from DB
  const themes = await prisma.theme.findMany({ where: { weight: { not: null } }, select: { slug: true, weight: true } });
  const themeWeight = new Map(themes.map((t) => [t.slug, t.weight]));
  const sumW = Array.from(themeWeight.values()).reduce((a, b) => a + b, 0);
  console.log(`Theme weights loaded: ${themes.length} themes, sum=${sumW.toFixed(2)}`);

  // Years to compute
  const arg = process.argv.find((a) => a.startsWith('--year='));
  let years;
  if (arg) {
    years = [parseInt(arg.split('=')[1], 10)];
  } else {
    const grouped = await prisma.indicatorValue.groupBy({
      by: ['year'],
      where: { gender: 'TOTAL', ageGroup: DEFAULT_AGE_GROUP },
      _count: { _all: true },
      orderBy: { year: 'asc' },
    });
    years = grouped.map((g) => g.year);
  }
  console.log(`Computing ${years.length} year(s): ${years[0]}..${years[years.length - 1]}`);

  const results = [];
  for (const y of years) {
    try {
      const r = await computeForYear(prisma, y, themeWeight);
      results.push(r);
      console.log(`  ✓ ${r.year}: ${r.countriesComputed} countries, avg=${r.averageScore}, top=${r.topPerformer.name}(${r.topPerformer.overallScore}), bottom=${r.bottomPerformer.name}(${r.bottomPerformer.overallScore})`);
    } catch (e) {
      console.error(`  ✗ ${y}: ${e.message}`);
    }
  }

  console.log(`\nDone. Computed ${results.length} years.`);
  const finalCount = await prisma.youthIndexScore.count();
  console.log(`YouthIndexScore rows in DB: ${finalCount}`);
  await prisma.$disconnect();
})().catch((e) => { console.error('FAIL:', e); process.exit(1); });
