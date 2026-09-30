import { PrismaClient } from '@prisma/client';
const db = new PrismaClient({ datasources: { db: { url: 'file:/home/z/my-project/db/custom.db' } } });
(async () => {
  const u = await db.user.count();
  const t = await db.transaction.count();
  const a = await db.account.count();
  const c = await db.category.count();
  const k = await db.apiKey.count();
  const b = await db.budget.count();
  console.log('Sandbox DB stats:');
  console.log('  Users:', u);
  console.log('  Transactions:', t);
  console.log('  Accounts:', a);
  console.log('  Categories:', c);
  console.log('  ApiKeys:', k);
  console.log('  Budgets:', b);
  // Show API keys (just prefix)
  const keys = await db.apiKey.findMany({ select: { id: true, name: true, keyPrefix: true, isActive: true, userId: true } });
  console.log('  API keys:', JSON.stringify(keys, null, 2));
  await db.$disconnect();
})();
