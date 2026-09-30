import { PrismaClient } from '@prisma/client';
const db = new PrismaClient({ datasources: { db: { url: 'file:/home/z/my-project/db/custom.db' } } });
(async () => {
  try {
    // get a complete sample tx
    const tx = await db.transaction.findFirst({
      where: { userId: 'cmqzzpg1c000rsrtmghrxldl7', type: 'expense' },
      include: { category: true }
    });
    console.log('EXPENSE TX:', JSON.stringify(tx, null, 2));
    
    // check for cash-type accounts (default for external expenses)
    const cash = await db.account.findMany({
      where: { userId: 'cmqzzpg1c000rsrtmghrxldl7', subType: 'cash' }
    });
    console.log('CASH ACCTS:', JSON.stringify(cash, null, 2));
    
    // Get "Cuenta Deb" and BPD account IDs (probably the cash-like ones)
    console.log('NEED: which account to use as "from" for an external expense (cash-like default)');
    
    // Get current transactions count
    const count = await db.transaction.count({ where: { userId: 'cmqzzpg1c000rsrtmghrxldl7' } });
    console.log('TX COUNT HAMILTON:', count);
  } catch (e) { console.error('ERR', e.message); }
  finally { await db.$disconnect(); }
})();
