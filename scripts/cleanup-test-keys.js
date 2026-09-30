import { PrismaClient } from '@prisma/client';
const db = new PrismaClient({ datasources: { db: { url: 'file:/home/z/my-project/db/custom.db' } } });
(async () => {
  // Delete the two curl-test keys we created
  const r = await db.apiKey.deleteMany({
    where: { name: { contains: 'curl test' } },
  });
  console.log('Deleted curl-test keys:', r.count);
  const r2 = await db.apiKey.deleteMany({
    where: { name: 'readonly test' },
  });
  console.log('Deleted readonly-test keys:', r2.count);
  // Show remaining
  const remaining = await db.apiKey.findMany({ select: { id: true, name: true, keyPrefix: true, isActive: true } });
  console.log('REMAINING KEYS:', JSON.stringify(remaining, null, 2));
  // Also delete the test transactions we created via API
  const tx = await db.transaction.deleteMany({
    where: { importSource: 'api_v1', description: { in: ['Heladería X · Helados', 'Taxi'] } },
  });
  console.log('Deleted test transactions:', tx.count);
  await db.$disconnect();
})();
