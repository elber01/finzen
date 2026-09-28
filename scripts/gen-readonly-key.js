const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const db = new PrismaClient({ datasources: { db: { url: 'file:/home/z/my-project/db/custom.db' } } });
(async () => {
  const userId = 'cmqzzpg1c000rsrtmghrxldl7';
  const rawKey = 'fz_' + crypto.randomBytes(16).toString('hex');
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  await db.apiKey.create({
    data: {
      userId,
      name: 'readonly test',
      keyHash,
      keyPrefix: rawKey.substring(0, 8) + '...',
      permissions: 'read',
    },
  });
  console.log('READONLY KEY:', rawKey);
  await db.$disconnect();
})();
