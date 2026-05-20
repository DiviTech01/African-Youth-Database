/**
 * Force every CMS ContentEntry.defaultContent row in the DB to match the
 * current source-code registry. Talks to Postgres directly (no admin JWT
 * needed). NEVER touches ContentDraft / ContentPublished — admin-saved edits
 * are preserved. Only defaultContent is refreshed.
 *
 * Run from repo root:
 *   set -a; . ./.env; set +a; npx tsx scripts/force-sync-cms-defaults.ts
 */
import { PrismaClient } from '@prisma/client';
import { cmsRegistry } from '../src/cms/registry';

(async () => {
  const prisma = new PrismaClient();
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const entry of cmsRegistry) {
    const existing = await prisma.contentEntry.findUnique({ where: { key: entry.key } });
    if (!existing) {
      await prisma.contentEntry.create({
        data: {
          key: entry.key,
          page: entry.page,
          section: entry.section ?? null,
          contentType: (entry.contentType ?? 'TEXT') as any,
          defaultContent: entry.defaultContent ?? '',
          defaultStyles: (entry.defaultStyles ?? {}) as any,
          description: entry.description ?? null,
        },
      });
      created++;
      console.log(`  + ${entry.key}`);
    } else if (
      existing.defaultContent !== (entry.defaultContent ?? '') ||
      existing.page !== entry.page ||
      existing.section !== (entry.section ?? null) ||
      existing.description !== (entry.description ?? null)
    ) {
      await prisma.contentEntry.update({
        where: { key: entry.key },
        data: {
          page: entry.page,
          section: entry.section ?? null,
          description: entry.description ?? null,
          defaultContent: entry.defaultContent ?? '',
        },
      });
      updated++;
      console.log(`  ~ ${entry.key}`);
    } else {
      unchanged++;
    }
  }

  console.log(`\n✔ created=${created}  updated=${updated}  unchanged=${unchanged}  total=${cmsRegistry.length}`);
  await prisma.$disconnect();
})();
