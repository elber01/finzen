import { PrismaClient } from '@prisma/client';
const db = new PrismaClient({ datasources: { db: { url: 'file:/home/z/my-project/db/custom.db' } } });
(async () => {
  try {
    const users = await db.user.findMany({ select: { id: true, email: true, name: true } });
    console.log('USERS:', JSON.stringify(users, null, 2));
    const keys = await db.apiKey.findMany({ select: { id: true, name: true, keyPrefix: true, isActive: true, userId: true } });
    console.log('API KEYS:', JSON.stringify(keys, null, 2));
    const accounts = await db.account.findMany({ select: { id: true, name: true, accountType: true, userId: true, currency: true, currentBalance: true } });
    console.log('ACCOUNTS:', JSON.stringify(accounts, null, 2));
    const categories = await db.category.findMany({ select: { id: true, name: true, userId: true, direction: true, isSystem: true }, take: 50 });
    console.log('CATEGORIES:', JSON.stringify(categories, null, 2));
    const txs = await db.transaction.findMany({ select: { id: true, type: true, amount: true, occurredOn: true, userId: true }, take: 5 });
    console.log('SAMPLE TXS:', JSON.stringify(txs, null, 2));
  } catch (e) {
    console.error('ERR', e.message);
  } finally { await db.$disconnect(); }
})();
