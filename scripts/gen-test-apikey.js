/**
 * Test helper: generates a fresh API key for hamilton.edwin@gmail.com
 * and prints it, so we can run curl tests. The key is real (stored hashed
 * in the DB) — delete it from the DB after tests if you want.
 *
 * Run: node scripts/gen-test-apikey.js
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const db = new PrismaClient({ datasources: { db: { url: 'file:/home/z/my-project/db/custom.db' } } });

(async () => {
  try {
    const userId = 'cmqzzpg1c000rsrtmghrxldl7'; // hamilton.edwin@gmail.com
    const rawKey = 'fz_' + crypto.randomBytes(16).toString('hex');
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 8) + '...';

    const created = await db.apiKey.create({
      data: {
        userId,
        name: 'curl test ' + new Date().toISOString(),
        keyHash,
        keyPrefix,
        permissions: 'read,write',
      },
      select: { id: true, name: true, keyPrefix: true, permissions: true },
    });

    console.log('=== TEST API KEY (created) ===');
    console.log('RAW KEY (use this in curl):', rawKey);
    console.log('DB RECORD:', JSON.stringify(created, null, 2));
  } catch (e) {
    console.error('ERR', e.message);
  } finally {
    await db.$disconnect();
  }
})();
