/** Sweep every CMS row (ContentEntry.defaultContent, ContentDraft.content,
 *  ContentPublished.content) and rewrite the legacy brand name "AYD" / "African
 *  Youth Database" → "AYO" / "African Youth Observatory". Word-boundary safe so
 *  AYI / AYIMS stay intact. Idempotent. */
import { PrismaClient } from '@prisma/client';

const apply = (s: string) =>
  s.replace(/African Youth Database/g, 'African Youth Observatory').replace(/\bAYD\b/g, 'AYO');

(async () => {
  const prisma = new PrismaClient();

  // ContentEntry.defaultContent
  const entries = await prisma.contentEntry.findMany({
    where: { OR: [{ defaultContent: { contains: 'AYD' } }, { defaultContent: { contains: 'African Youth Database' } }] },
    select: { id: true, key: true, defaultContent: true },
  });
  let entryUpdates = 0;
  for (const e of entries) {
    const next = apply(e.defaultContent);
    if (next !== e.defaultContent) {
      await prisma.contentEntry.update({ where: { id: e.id }, data: { defaultContent: next } });
      console.log(`  entry ${e.key}: defaultContent updated`);
      entryUpdates++;
    }
  }

  // ContentDraft.content
  const drafts = await prisma.contentDraft.findMany({
    where: { OR: [{ content: { contains: 'AYD' } }, { content: { contains: 'African Youth Database' } }] },
    include: { entry: { select: { key: true } } },
  });
  let draftUpdates = 0;
  for (const d of drafts) {
    const next = apply(d.content);
    if (next !== d.content) {
      await prisma.contentDraft.update({ where: { id: d.id }, data: { content: next } });
      console.log(`  draft ${d.entry.key}: content updated`);
      draftUpdates++;
    }
  }

  // ContentPublished.content
  const pubs = await prisma.contentPublished.findMany({
    where: { OR: [{ content: { contains: 'AYD' } }, { content: { contains: 'African Youth Database' } }] },
    include: { entry: { select: { key: true } } },
  });
  let pubUpdates = 0;
  for (const p of pubs) {
    const next = apply(p.content);
    if (next !== p.content) {
      await prisma.contentPublished.update({ where: { id: p.id }, data: { content: next } });
      console.log(`  published ${p.entry.key}: content updated`);
      pubUpdates++;
    }
  }

  console.log(`\nTotals: ${entryUpdates} defaults, ${draftUpdates} drafts, ${pubUpdates} published.`);
  await prisma.$disconnect();
})();
