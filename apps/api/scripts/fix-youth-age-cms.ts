/** Targeted CMS fix: the ContentEntry.defaultContent for
 *  `home.quick_stats.population.description` is stuck at "African youth aged 15-24"
 *  in production, from a sync done before the registry default moved to 15-35.
 *  cms:sync doesn't overwrite existing rows, so the homepage keeps showing
 *  15-24 even though every source file says 15-35. We update the DB column
 *  directly. Idempotent. */
import { PrismaClient } from '@prisma/client';

(async () => {
  const prisma = new PrismaClient();
  const KEY = 'home.quick_stats.population.description';
  const NEW = 'African youth aged 15-35';

  const entry = await prisma.contentEntry.findUnique({ where: { key: KEY } });
  if (!entry) {
    console.log(`No ContentEntry for ${KEY} — nothing to update.`);
    await prisma.$disconnect();
    return;
  }
  console.log('Before defaultContent:', entry.defaultContent);
  if (/15-24|15–24/.test(entry.defaultContent)) {
    await prisma.contentEntry.update({
      where: { key: KEY },
      data: { defaultContent: NEW },
    });
    console.log('→ Updated to:', NEW);
  } else {
    console.log('Already up to date — no change.');
  }
  await prisma.$disconnect();
})();
