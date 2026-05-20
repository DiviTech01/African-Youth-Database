import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding AYO database...');

  // Load seed data
  const seedDir = path.resolve(__dirname, '../../../seed');
  const countries = JSON.parse(
    fs.readFileSync(path.join(seedDir, 'countries.json'), 'utf-8'),
  );
  const themes = JSON.parse(
    fs.readFileSync(path.join(seedDir, 'themes.json'), 'utf-8'),
  );
  const indicators = JSON.parse(
    fs.readFileSync(path.join(seedDir, 'indicators.json'), 'utf-8'),
  );

  // 1. Seed countries
  console.log(`  📍 Seeding ${countries.length} countries...`);
  for (const c of countries) {
    await prisma.country.upsert({
      where: { isoCode3: c.isoCode3 },
      update: {},
      create: {
        name: c.name,
        isoCode2: c.isoCode2,
        isoCode3: c.isoCode3,
        region: c.region,
        capital: c.capital,
        population: BigInt(c.population),
        youthPopulation: BigInt(c.youthPopulation),
        area: c.area,
        currency: c.currency,
        languages: c.languages,
        economicBlocs: c.economicBlocs,
        latitude: c.latitude,
        longitude: c.longitude,
        flagEmoji: c.flagEmoji,
      },
    });
  }

  // 2. Seed themes
  console.log(`  🎨 Seeding ${themes.length} themes...`);
  const themeMap = new Map<string, string>();
  for (const t of themes) {
    const theme = await prisma.theme.upsert({
      where: { slug: t.slug },
      update: {},
      create: {
        name: t.name,
        slug: t.slug,
        description: t.description,
        icon: t.icon,
        color: t.color,
        sortOrder: t.sortOrder,
      },
    });
    themeMap.set(t.slug, theme.id);
  }

  // 3. Seed indicators
  console.log(`  📊 Seeding ${indicators.length} indicators...`);
  for (const ind of indicators) {
    const themeId = themeMap.get(ind.themeSlug);
    if (!themeId) {
      console.warn(`  ⚠️  Theme not found for indicator: ${ind.name} (themeSlug: ${ind.themeSlug})`);
      continue;
    }
    await prisma.indicator.upsert({
      where: { slug: ind.slug },
      update: {},
      create: {
        name: ind.name,
        slug: ind.slug,
        description: ind.description,
        unit: ind.unit,
        source: ind.source,
        methodology: ind.methodology,
        frequency: ind.frequency,
        themeId,
      },
    });
  }

  // 4 & 5: Mock value generation — gated behind SEED_MOCK_VALUES because
  // (a) the platform is moving to real uploads (AYIMS template + Policies DB),
  // (b) the loop saturates the Supabase pooler with 36k+ sequential upserts.
  if (process.env.SEED_MOCK_VALUES !== 'true') {
    console.log('  ⏭️  Skipping sample indicator values + Youth Index scores (set SEED_MOCK_VALUES=true to generate them).');
    console.log('🌱 Done. Catalog seeded — upload real data via the Contributor Hub.');
    return;
  }

  // 4. Generate sample indicator values
  console.log('  📈 Generating sample indicator values...');
  const allCountries = await prisma.country.findMany();
  const allIndicators = await prisma.indicator.findMany();

  // Seeded random for reproducibility
  let seed = 42;
  function seededRandom() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  const years = [2018, 2019, 2020, 2021, 2022, 2023, 2024];
  let valueCount = 0;

  for (const country of allCountries) {
    for (const indicator of allIndicators) {
      // Base value depends on unit type
      let baseValue: number;
      switch (indicator.unit) {
        case 'PERCENTAGE':
          baseValue = 20 + seededRandom() * 70;
          break;
        case 'RATE':
          baseValue = 5 + seededRandom() * 80;
          break;
        case 'INDEX':
        case 'SCORE':
          baseValue = 20 + seededRandom() * 60;
          break;
        case 'NUMBER':
          baseValue = 1000 + seededRandom() * 50000;
          break;
        case 'CURRENCY':
          baseValue = 100 + seededRandom() * 5000;
          break;
        case 'YEARS':
          baseValue = 5 + seededRandom() * 12;
          break;
        default:
          baseValue = 30 + seededRandom() * 50;
      }

      for (const year of years) {
        // Small trend per year
        const trend = (year - 2018) * (seededRandom() * 2 - 0.5);
        const noise = (seededRandom() - 0.5) * baseValue * 0.1;
        let value = baseValue + trend + noise;

        // Clamp percentages
        if (indicator.unit === 'PERCENTAGE' || indicator.unit === 'RATE') {
          value = Math.max(0, Math.min(100, value));
        }
        value = Math.round(value * 100) / 100;

        await prisma.indicatorValue.upsert({
          where: {
            countryId_indicatorId_year_gender_ageGroup: {
              countryId: country.id,
              indicatorId: indicator.id,
              year,
              gender: 'TOTAL',
              ageGroup: '15-35',
            },
          },
          update: { value },
          create: {
            countryId: country.id,
            indicatorId: indicator.id,
            year,
            value,
            gender: 'TOTAL',
            ageGroup: '15-35',
            source: indicator.source,
            confidence: 0.7 + seededRandom() * 0.3,
            isEstimate: seededRandom() > 0.7,
          },
        });
        valueCount++;
      }
    }
  }
  console.log(`  ✅ Created ${valueCount} indicator values`);

  // 5. Generate youth index scores
  console.log('  🏆 Generating Youth Index scores...');
  for (const year of [2022, 2023, 2024]) {
    const scores: { countryId: string; score: number }[] = [];

    for (const country of allCountries) {
      const edu = 20 + seededRandom() * 60;
      const emp = 20 + seededRandom() * 60;
      const hlt = 20 + seededRandom() * 60;
      const civ = 20 + seededRandom() * 60;
      const inn = 20 + seededRandom() * 60;
      const overall =
        edu * 0.25 + emp * 0.3 + hlt * 0.25 + civ * 0.1 + inn * 0.1;

      scores.push({ countryId: country.id, score: overall });
    }

    // Sort and assign ranks
    scores.sort((a, b) => b.score - a.score);

    for (let i = 0; i < scores.length; i++) {
      const s = scores[i];
      const rank = i + 1;
      const percentile = ((allCountries.length - rank) / allCountries.length) * 100;

      let tier: 'HIGH' | 'MEDIUM_HIGH' | 'MEDIUM' | 'MEDIUM_LOW' | 'LOW';
      if (percentile >= 80) tier = 'HIGH';
      else if (percentile >= 60) tier = 'MEDIUM_HIGH';
      else if (percentile >= 40) tier = 'MEDIUM';
      else if (percentile >= 20) tier = 'MEDIUM_LOW';
      else tier = 'LOW';

      // Get previous year rank
      let previousRank: number | null = null;
      if (year > 2022) {
        const prev = await prisma.youthIndexScore.findFirst({
          where: { countryId: s.countryId, year: year - 1 },
        });
        previousRank = prev?.rank ?? null;
      }

      const edu = 20 + seededRandom() * 60;
      const emp = 20 + seededRandom() * 60;
      const hlt = 20 + seededRandom() * 60;
      const civ = 20 + seededRandom() * 60;
      const inn = 20 + seededRandom() * 60;

      await prisma.youthIndexScore.upsert({
        where: {
          countryId_year: {
            countryId: s.countryId,
            year,
          },
        },
        update: {},
        create: {
          countryId: s.countryId,
          year,
          overallScore: Math.round(s.score * 100) / 100,
          educationScore: Math.round(edu * 100) / 100,
          employmentScore: Math.round(emp * 100) / 100,
          healthScore: Math.round(hlt * 100) / 100,
          civicScore: Math.round(civ * 100) / 100,
          innovationScore: Math.round(inn * 100) / 100,
          rank,
          previousRank,
          rankChange: previousRank ? previousRank - rank : null,
          percentile: Math.round(percentile * 100) / 100,
          tier,
        },
      });
    }
  }

  // 6. Seed role-binding user rows.
  // Supabase owns authentication; these rows exist only to attach roles.
  // When a real user signs in via Supabase, JIT provisioning in JwtStrategy
  // creates/links rows by Supabase UUID.
  console.log('  👤 Seeding role-binding user rows...');
  const seedUsers = [
    { id: 'seed-admin-001', email: 'admin@africanyouthobservatory.org', name: 'AYO Admin', role: 'ADMIN' as const },
    { id: 'seed-contributor-001', email: 'data@africanyouthobservatory.org', name: 'Data Team', role: 'CONTRIBUTOR' as const },
  ];
  let adminUser: { id: string; email: string } | null = null;
  for (const u of seedUsers) {
    const row = await prisma.user.upsert({
      where: { email: u.email },
      update: { role: u.role },
      create: { id: u.id, email: u.email, name: u.name, role: u.role },
    });
    if (u.role === 'ADMIN') adminUser = { id: row.id, email: row.email };
    console.log(`    ✅ ${u.role}: ${row.email}`);
  }
  if (!adminUser) throw new Error('Admin seed user missing — cannot attach dashboard templates');

  // 7. Seed dashboard templates
  console.log('  📊 Seeding dashboard templates...');
  const templates = [
    {
      title: 'Continental Overview',
      description: 'High-level view of youth data across all 54 African countries.',
      isPublic: true,
      layout: { isTemplate: true, columns: 2 },
      widgets: [
        {
          id: 'w-overview-1',
          type: 'stat_card',
          title: 'Countries with Data',
          config: { dataSource: 'platform-stats', metric: 'countriesWithData' },
          position: { x: 0, y: 0, w: 1, h: 1 },
        },
        {
          id: 'w-overview-2',
          type: 'map',
          title: 'Youth Unemployment Rate (Latest)',
          config: { indicatorSlug: 'youth-unemployment-rate', year: 'latest' },
          position: { x: 1, y: 0, w: 1, h: 2 },
        },
        {
          id: 'w-overview-3',
          type: 'bar_chart',
          title: 'Top 10 Countries by Youth Index Score',
          config: { dataSource: 'youth-index-rankings', limit: 10, sortOrder: 'desc' },
          position: { x: 0, y: 1, w: 1, h: 1 },
        },
        {
          id: 'w-overview-4',
          type: 'line_chart',
          title: 'Continental Average Youth Index Over Time',
          config: { dataSource: 'youth-index-trend', yearStart: 2010, yearEnd: 2024 },
          position: { x: 0, y: 2, w: 2, h: 1 },
        },
      ],
    },
    {
      title: 'Country Deep Dive',
      description: 'Detailed analysis of a single country across all dimensions.',
      isPublic: true,
      layout: { isTemplate: true, columns: 2, defaultCountry: 'configurable' },
      widgets: [
        {
          id: 'w-deep-1',
          type: 'stat_card',
          title: 'Youth Population',
          config: { dataSource: 'country-stats', metric: 'youthPopulation' },
          position: { x: 0, y: 0, w: 1, h: 1 },
        },
        {
          id: 'w-deep-2',
          type: 'stat_card',
          title: 'Youth Index Rank',
          config: { dataSource: 'country-stats', metric: 'youthIndexRank' },
          position: { x: 1, y: 0, w: 1, h: 1 },
        },
        {
          id: 'w-deep-3',
          type: 'radar',
          title: 'Dimensional Scores',
          config: { dataSource: 'youth-index-dimensions' },
          position: { x: 0, y: 1, w: 1, h: 2 },
        },
        {
          id: 'w-deep-4',
          type: 'line_chart',
          title: 'Youth Unemployment Trend (2010-2024)',
          config: { indicatorSlug: 'youth-unemployment-rate', yearStart: 2010, yearEnd: 2024 },
          position: { x: 1, y: 1, w: 1, h: 1 },
        },
        {
          id: 'w-deep-5',
          type: 'bar_chart',
          title: 'Education Theme Indicators',
          config: { themeSlug: 'education', sortOrder: 'desc' },
          position: { x: 1, y: 2, w: 1, h: 1 },
        },
      ],
    },
    {
      title: 'Regional Comparison',
      description: 'Compare youth outcomes across Africa\'s five regions.',
      isPublic: true,
      layout: { isTemplate: true, columns: 2 },
      widgets: [
        {
          id: 'w-region-1',
          type: 'bar_chart',
          title: 'Youth Unemployment by Region',
          config: { dataSource: 'regional-comparison', indicatorSlug: 'youth-unemployment-rate' },
          position: { x: 0, y: 0, w: 1, h: 1 },
        },
        {
          id: 'w-region-2',
          type: 'map',
          title: 'Education Expenditure (% GDP)',
          config: { indicatorSlug: 'education-expenditure-gdp', year: 'latest' },
          position: { x: 1, y: 0, w: 1, h: 1 },
        },
        {
          id: 'w-region-3',
          type: 'table',
          title: 'Top 5 Most Improved Countries',
          config: { dataSource: 'most-improved', limit: 5 },
          position: { x: 0, y: 1, w: 1, h: 1 },
        },
        {
          id: 'w-region-4',
          type: 'pie_chart',
          title: 'Youth Population Distribution by Region',
          config: { dataSource: 'regional-population' },
          position: { x: 1, y: 1, w: 1, h: 1 },
        },
      ],
    },
  ];

  for (const template of templates) {
    await prisma.dashboard.upsert({
      where: {
        id: `template-${template.title.toLowerCase().replace(/\s+/g, '-')}`,
      },
      update: {},
      create: {
        id: `template-${template.title.toLowerCase().replace(/\s+/g, '-')}`,
        title: template.title,
        description: template.description,
        isPublic: template.isPublic,
        layout: template.layout,
        widgets: template.widgets,
        userId: adminUser.id,
      },
    });
  }
  console.log(`  ✅ Created ${templates.length} dashboard templates`);

  console.log('✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
