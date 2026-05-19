/** Scan every CMS Draft/Published for any stored "15-24" so we can pinpoint
 *  which entry is rendering the wrong age range on the homepage. */
import { PrismaClient } from '@prisma/client';

(async () => {
  const prisma = new PrismaClient();
  const drafts = await prisma.contentDraft.findMany({
    where: { OR: [{ content: { contains: '15-24' } }, { content: { contains: '15–24' } }] },
    include: { entry: { select: { key: true } } },
  });
  const pubs = await prisma.contentPublished.findMany({
    where: { OR: [{ content: { contains: '15-24' } }, { content: { contains: '15–24' } }] },
    include: { entry: { select: { key: true } } },
  });
  console.log(`Drafts with "15-24": ${drafts.length}`);
  for (const d of drafts) console.log(`  [draft] ${d.entry.key}\n      ${d.content.slice(0, 200).replace(/\n/g, ' ')}`);
  console.log(`Published with "15-24": ${pubs.length}`);
  for (const p of pubs) console.log(`  [pub] ${p.entry.key}\n      ${p.content.slice(0, 200).replace(/\n/g, ' ')}`);
  await prisma.$disconnect();
})();
