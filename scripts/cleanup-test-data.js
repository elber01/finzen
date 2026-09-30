import { PrismaClient } from '@prisma/client';
const db = new PrismaClient({ datasources: { db: { url: 'file:/home/z/my-project/db/custom.db' } } });
(async () => {
  // Delete test API keys
  const k = await db.apiKey.deleteMany({ where: { name: { contains: 'Local curl test' } } });
  console.log('Deleted test API keys:', k.count);
  // Delete auto-created categories "Test" and "Aporte" (if no transactions)
  for (const name of ['Test', 'Aporte']) {
    const c = await db.category.findFirst({ where: { name, userId: 'cmqzzpg1c000rsrtmghrxldl7' }, include: { transactions: { select: { id: true } } } });
    if (c && c.transactions.length === 0) {
      await db.category.delete({ where: { id: c.id } });
      console.log('Deleted orphan category:', name);
    }
  }
  // Verify final state
  const tx = await db.transaction.count({ where: { userId: 'cmqzzpg1c000rsrtmghrxldl7' } });
  console.log('Final tx count for Edwin:', tx);
  await db.$disconnect();
})();
