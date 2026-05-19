/** One-shot cleanup of the diagnostic subscriber rows I inserted while wiring
 *  up the newsletter pipeline. Idempotent — re-running does nothing. */
import { PrismaClient } from '@prisma/client';

(async () => {
  const prisma = new PrismaClient();
  const targets = ['ayd-newsletter-test@example.com', 'diagnostic-check@example.com'];
  const before = await prisma.newsletterSubscription.findMany({
    where: { email: { in: targets } },
    select: { email: true, status: true, createdAt: true },
  });
  console.log('Found:', before);
  const res = await prisma.newsletterSubscription.deleteMany({
    where: { email: { in: targets } },
  });
  console.log(`Deleted ${res.count} test row(s).`);
  await prisma.$disconnect();
})();
