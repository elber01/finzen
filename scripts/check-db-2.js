const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient({ datasources: { db: { url: 'file:/home/z/my-project/db/custom.db' } } });
(async () => {
  try {
    // categories of hamilton
    const cats = await db.category.findMany({ 
      where: { OR: [{ userId: 'cmqzzpg1c000rsrtmghrxldl7' }, { isSystem: true, userId: null }] },
      select: { id: true, name: true, nameEs: true, userId: true, direction: true }
    });
    console.log('HAMILTON CATEGORIES:', JSON.stringify(cats, null, 2));
    
    // sample transactions
    const txs = await db.transaction.findMany({
      where: { userId: 'cmqzzpg1c000rsrtmghrxldl7' },
      select: { id: true, type: true, amount: true, currency: true, fromAccountId: true, toAccountId: true, categoryId: true, occurredOn: true, importSource: true },
      take: 3,
      orderBy: { occurredOn: 'desc' }
    });
    console.log('SAMPLE TX HAMILTON:', JSON.stringify(txs, null, 2));
    
    // accounts of hamilton
    const accts = await db.account.findMany({ 
      where: { userId: 'cmqzzpg1c000rsrtmghrxldl7' },
      select: { id: true, name: true, accountType: true, subType: true, currency: true }
    });
    console.log('HAMILTON ACCOUNTS:', JSON.stringify(accts, null, 2));
    
    // Check how the UI creates expenses — find the default cash account or "x_" pattern
    console.log('SCHEMA PATHS:', '/api/transactions expects fromAccountId, toAccountId');
  } catch (e) { console.error('ERR', e.message); }
  finally { await db.$disconnect(); }
})();
