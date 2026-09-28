/**
 * Generate a NEW API key for Edwin directly in Turso.
 * We need to do this because Edwin doesn't know the full value of his
 * existing "Nueva grazzia" key (only the hash is stored).
 *
 * Writes the new key (hashed SHA-256) to the ApiKey table in Turso,
 * and prints the raw key so we can use it for curl tests.
 */

const { createClient } = require('@libsql/client');
const crypto = require('crypto');

const TURSO_URL = process.env.TURSO_URL; // [security] siempre por env — nunca hardcodear la URL
const TURSO_TOKEN = process.env.TURSO_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error('TURSO_URL y TURSO_TOKEN env vars requeridas');
  process.exit(1);
}

const turso = createClient({
  url: TURSO_URL,
  authToken: TURSO_TOKEN,
});

(async () => {
  // Find Edwin's user ID
  const userResult = await turso.execute({
    sql: "SELECT id FROM User WHERE email = ?",
    args: ['hamilton.edwin@gmail.com'],
  });
  if (userResult.rows.length === 0) {
    console.error('Edwin user not found in Turso!');
    process.exit(1);
  }
  const userId = userResult.rows[0].id;
  console.log('Edwin userId:', userId);

  // Generate new API key
  const rawKey = 'fz_turso_demo_' + crypto.randomBytes(8).toString('hex');
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.substring(0, 12) + '...';

  // Insert into ApiKey table
  const id = 'apikey_demo_' + crypto.randomBytes(6).toString('hex');
  await turso.execute({
    sql: `INSERT INTO ApiKey (id, userId, name, keyHash, keyPrefix, permissions, lastUsedAt, expiresAt, isActive, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 1, CURRENT_TIMESTAMP)`,
    args: [id, userId, 'Turso demo key', keyHash, keyPrefix, 'read,write'],
  });

  console.log('\n=== ✅ NEW API KEY CREATED IN TURSO ===');
  console.log('Raw key (use this for curl):', rawKey);
  console.log('Key hash stored in DB:', keyHash.substring(0, 20) + '...');
  console.log('Key prefix:', keyPrefix);
  console.log('\nUse with:');
  console.log(`  curl -X POST https://finzen-elber01s-projects.vercel.app/api/v1/expenses \\`);
  console.log(`    -H "X-API-Key: ${rawKey}" \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"amount": 419.99, "currency": "DOP", "category": "Alimentación"}'`);

  await turso.close();
})().catch(e => { console.error('ERR', e); process.exit(1); });
