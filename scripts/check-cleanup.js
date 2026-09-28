const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient({ datasources: { db: { url: 'file:/home/z/my-project/db/custom.db' } } });
(async () => {
  // Check if "Alimentación" category has transactions; if not, delete it (was auto-created)
  const cat = await db.category.findFirst({
    where: { name: 'Alimentación', userId: 'cmqzzpg1c000rsrtmghrxldl7' },
    include: { transactions: { select: { id: true } } }
  });
  if (cat) {
    console.log('Alimentación cat has', cat.transactions.length, 'txs');
    if (cat.transactions.length === 0) {
      await db.category.delete({ where: { id: cat.id } });
      console.log('Deleted orphan Alimentación category');
    }
  } else {
    console.log('Alimentación category not found (already clean)');
  }
  await db.$disconnect();
})();
