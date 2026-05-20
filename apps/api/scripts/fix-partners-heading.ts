/** The CMS DB still serves "Our Partners & Data Sources" for
 *  `home.partners.heading` even though the registry now says "Our Partners".
 *  cms:sync doesn't overwrite existing rows, so the DB drifts. Update both
 *  defaultContent and any Draft/Published overrides directly. Idempotent. */
import { PrismaClient } from '@prisma/client';

(async () => {
  const prisma = new PrismaClient();
  const KEY = 'home.partners.heading';
  const NEW = 'Our Partners';
  const isStale = (s: string | undefined | null) =>
    !!s && /Data Sources|Our Partners & Data Sources/i.test(s);

  const entry = await prisma.contentEntry.findUnique({
    where: { key: KEY },
    include: { draft: true, published: true },
  });
  if (!entry) {
    console.log(`No ContentEntry for ${KEY} — nothing to update.`);
    await prisma.$disconnect();
    return;
  }
  console.log('Before:');
  console.log('  defaultContent:', entry.defaultContent);
  console.log('  draft         :', entry.draft?.content ?? '(none)');
  console.log('  published     :', entry.published?.content ?? '(none)');

  if (isStale(entry.defaultContent)) {
    await prisma.contentEntry.update({ where: { key: KEY }, data: { defaultContent: NEW } });
    console.log('  → defaultContent updated');
  }
  if (entry.draft && isStale(entry.draft.content)) {
    await prisma.contentDraft.update({ where: { entryId: entry.id }, data: { content: NEW } });
    console.log('  → draft updated');
  }
  if (entry.published && isStale(entry.published.content)) {
    await prisma.contentPublished.update({ where: { entryId: entry.id }, data: { content: NEW } });
    console.log('  → published updated');
  }

  const after = await prisma.contentEntry.findUnique({
    where: { key: KEY },
    include: { draft: true, published: true },
  });
  console.log('After:');
  console.log('  defaultContent:', after?.defaultContent);
  console.log('  draft         :', after?.draft?.content ?? '(none)');
  console.log('  published     :', after?.published?.content ?? '(none)');
  await prisma.$disconnect();
})();
