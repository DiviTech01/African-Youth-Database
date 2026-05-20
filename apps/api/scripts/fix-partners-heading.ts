/** Set the CMS partners heading to a specific value (matches the registry).
 *  Idempotent. Pass the desired value as argv[2] if you want to override. */
import { PrismaClient } from '@prisma/client';

const TARGET = process.argv[2] || 'Data Sources';

(async () => {
  const prisma = new PrismaClient();
  const KEY = 'home.partners.heading';
  const entry = await prisma.contentEntry.findUnique({
    where: { key: KEY },
    include: { draft: true, published: true },
  });
  if (!entry) {
    console.log(`No ContentEntry for ${KEY}.`);
    await prisma.$disconnect();
    return;
  }
  console.log('Before:');
  console.log('  defaultContent:', entry.defaultContent);
  console.log('  draft         :', entry.draft?.content ?? '(none)');
  console.log('  published     :', entry.published?.content ?? '(none)');

  if (entry.defaultContent !== TARGET) {
    await prisma.contentEntry.update({ where: { key: KEY }, data: { defaultContent: TARGET } });
    console.log(`  → defaultContent set to "${TARGET}"`);
  }
  if (entry.draft && entry.draft.content !== TARGET) {
    await prisma.contentDraft.update({ where: { entryId: entry.id }, data: { content: TARGET } });
    console.log(`  → draft set to "${TARGET}"`);
  }
  if (entry.published && entry.published.content !== TARGET) {
    await prisma.contentPublished.update({ where: { entryId: entry.id }, data: { content: TARGET } });
    console.log(`  → published set to "${TARGET}"`);
  }
  await prisma.$disconnect();
})();
