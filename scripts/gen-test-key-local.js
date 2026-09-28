const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const db = new PrismaClient({ datasources: { db: { url: 'file:/home/z/my-project/db/custom.db' } } });
(async () => {
  const userId = 'cmqzzpg1c000rsrtmghrxldl7'; // Edwin
  const rawKey = 'fz_local_test_' + crypto.randomBytes(8).toString('hex');
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.substring(0, 12) + '...';
  await db.apiKey.create({
    data: { userId, name: 'Local curl test ' + Date.now(), keyHash, keyPrefix, permissions: 'read,write' },
  });
  console.log(rawKey);
  await db.$disconnect();
})();
