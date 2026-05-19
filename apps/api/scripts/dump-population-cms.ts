import { PrismaClient } from '@prisma/client';
(async () => {
  const p = new PrismaClient();
  const entries = await p.contentEntry.findMany({
    where: { key: { startsWith: 'home.quick_stats.population' } },
    include: { draft: true, published: true },
  });
  for (const e of entries) {
    console.log('\n=== key:', e.key);
    console.log('  defaultContent:', e.defaultContent);
    console.log('  draft         :', e.draft?.content ?? '(none)');
    console.log('  published     :', e.published?.content ?? '(none)');
  }
  await p.$disconnect();
})();
