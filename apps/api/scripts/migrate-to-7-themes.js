// Destructive migration: 12 themes -> 7 themes. Reads consolidation-plan.json
// produced by plan-7-theme-migration.js and applies it atomically.
// Run from apps/api: node scripts/migrate-to-7-themes.js
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

const planPath = path.resolve(__dirname, '..', 'backups', 'consolidation-plan.json');
if (!fs.existsSync(planPath)) {
  console.error('Plan file not found. Run plan-7-theme-migration.js first.');
  process.exit(1);
}
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));

(async () => {
  const p = new PrismaClient();

  // Pre-flight counts
  const before = {
    themes: await p.theme.count(),
    indicators: await p.indicator.count(),
    indicatorValues: await p.indicatorValue.count(),
    youthIndexScores: await p.youthIndexScore.count(),
  };
  console.log('BEFORE:', JSON.stringify(before));

  // === Step 1: Upsert the 7 final themes ===
  console.log('\n[1/6] Upserting 7 final themes...');
  const themeIdBySlug = {};
  for (const t of plan.finalThemes) {
    const upserted = await p.theme.upsert({
      where: { slug: t.slug },
      create: {
        slug: t.slug,
        name: t.name,
        description: `${t.name} — ${t.weight}% of the African Youth Index. Weight set by AYO methodology.`,
        icon: t.icon,
        color: t.color,
        sortOrder: t.sortOrder,
      },
      update: {
        name: t.name,
        icon: t.icon,
        color: t.color,
        sortOrder: t.sortOrder,
      },
    });
    themeIdBySlug[t.slug] = upserted.id;
    console.log(`  ✓ ${t.slug} -> id=${upserted.id}`);
  }

  // === Step 2: Build the set of indicator IDs to delete and reassign ===
  const dupSlugs = plan.duplicates.map(d => d.dup);
  const dropSlugs = plan.explicitDrops.map(d => d.slug);
  const slugsToDelete = [...dupSlugs, ...dropSlugs];

  const indicatorsToDelete = await p.indicator.findMany({
    where: { slug: { in: slugsToDelete } },
    select: { id: true, slug: true },
  });
  const indicatorIdsToDelete = indicatorsToDelete.map(i => i.id);
  console.log(`\n[2/6] ${indicatorIdsToDelete.length} indicators marked for deletion (${dupSlugs.length} dup + ${dropSlugs.length} drop)`);

  // === Step 3: Build the reassignment map: keep-slug -> new themeId ===
  const reassignments = {};
  for (const themeSlug of Object.keys(plan.kept)) {
    for (const ind of plan.kept[themeSlug]) {
      reassignments[ind.slug] = themeIdBySlug[themeSlug];
    }
  }
  console.log(`[3/6] Reassigning ${Object.keys(reassignments).length} surviving indicators to new themes...`);

  // === Atomic transaction for the destructive part ===
  console.log('\n[4/6] Running destructive ops in a transaction...');
  const result = await p.$transaction(async (tx) => {
    // 4a. Reassign every surviving indicator to its new theme
    let reassigned = 0;
    for (const [slug, themeId] of Object.entries(reassignments)) {
      const r = await tx.indicator.updateMany({ where: { slug }, data: { themeId } });
      reassigned += r.count;
    }

    // 4b. Delete values for indicators being removed
    let valuesDeleted = 0;
    if (indicatorIdsToDelete.length) {
      const r = await tx.indicatorValue.deleteMany({ where: { indicatorId: { in: indicatorIdsToDelete } } });
      valuesDeleted = r.count;
    }

    // 4c. Delete the indicators themselves
    let indicatorsDeleted = 0;
    if (indicatorIdsToDelete.length) {
      const r = await tx.indicator.deleteMany({ where: { id: { in: indicatorIdsToDelete } } });
      indicatorsDeleted = r.count;
    }

    // 4d. Wipe all YouthIndexScore rows — they reference the old dimension columns
    //     and will be rebuilt in the calculator-rewrite phase.
    const scoresDeleted = await tx.youthIndexScore.deleteMany({});

    // 4e. Delete retired themes (now have no indicators)
    const orphanThemes = await tx.theme.findMany({
      where: {
        slug: { notIn: plan.finalThemes.map(t => t.slug) },
      },
      include: { _count: { select: { indicators: true } } },
    });
    const orphansWithNoIndicators = orphanThemes.filter(t => t._count.indicators === 0);
    let themesDeleted = 0;
    if (orphansWithNoIndicators.length) {
      const r = await tx.theme.deleteMany({
        where: { id: { in: orphansWithNoIndicators.map(t => t.id) } },
      });
      themesDeleted = r.count;
    }
    const orphansWithIndicators = orphanThemes.filter(t => t._count.indicators > 0);

    return { reassigned, valuesDeleted, indicatorsDeleted, scoresDeleted: scoresDeleted.count, themesDeleted, orphansWithIndicators };
  }, { timeout: 120000 });

  console.log('  ✓ reassigned indicators:', result.reassigned);
  console.log('  ✓ values deleted:       ', result.valuesDeleted);
  console.log('  ✓ indicators deleted:   ', result.indicatorsDeleted);
  console.log('  ✓ youth-index scores wiped:', result.scoresDeleted);
  console.log('  ✓ retired themes deleted:', result.themesDeleted);
  if (result.orphansWithIndicators.length) {
    console.log('  ⚠ retired themes still have indicators (NOT deleted):');
    for (const t of result.orphansWithIndicators) console.log(`     ${t.slug} (${t._count.indicators} indicators)`);
  }

  // === Step 5: Post-flight verification ===
  console.log('\n[5/6] Verifying...');
  const after = {
    themes: await p.theme.count(),
    indicators: await p.indicator.count(),
    indicatorValues: await p.indicatorValue.count(),
    youthIndexScores: await p.youthIndexScore.count(),
  };
  console.log('AFTER: ', JSON.stringify(after));

  const themes = await p.theme.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { indicators: true } } },
  });
  console.log('\n[6/6] Final theme state:');
  for (const t of themes) {
    console.log(`  [${t.sortOrder}] ${t.name.padEnd(38)} slug=${t.slug.padEnd(34)} indicators=${t._count.indicators}`);
  }

  // Sanity checks
  const issues = [];
  if (after.themes !== 7) issues.push(`Theme count ${after.themes} ≠ 7`);
  const expectedValueDelta = before.indicatorValues - after.indicatorValues;
  if (expectedValueDelta < 0) issues.push(`IndicatorValue count grew — should have shrunk`);
  if (issues.length) {
    console.error('\n⚠ ISSUES:'); for (const i of issues) console.error('  ' + i);
  } else {
    console.log('\n✓ Migration complete. All sanity checks passed.');
  }

  await p.$disconnect();
})().catch(e => { console.error('MIGRATION FAILED:', e.message); console.error(e.stack); process.exit(1); });
