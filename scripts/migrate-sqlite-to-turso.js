/**
 * Migrate the sandbox SQLite DB to Turso.
 *
 * Reads from /home/z/my-project/db/custom.db (sandbox local SQLite)
 * Writes to the Turso libSQL DB (via @libsql/client HTTP API).
 *
 * Idempotent: uses INSERT OR REPLACE to handle re-runs without duplicating.
 *
 * Usage:
 *   TURSO_URL="libsql://..." TURSO_TOKEN="eyJ..." node scripts/migrate-sqlite-to-turso.js
 */

const { createClient } = require('@libsql/client');
const { PrismaClient } = require('@prisma/client');

const SANDBOX_DB = '/home/z/my-project/db/custom.db';
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

const sandbox = new PrismaClient({
  datasources: { db: { url: `file:${SANDBOX_DB}` } },
});

// Load schema.sql for DDL
const fs = require('fs');
const path = require('path');
const schemaSql = fs.readFileSync(
  path.join('/home/z/my-project', 'db/schema.sql'),
  'utf-8'
);

async function execTurso(sql) {
  return turso.execute(sql);
}

async function applySchema() {
  // Strip full-line comments, split by ';', execute each non-empty statement
  const noComments = schemaSql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  const statements = noComments
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`Found ${statements.length} DDL statements to apply to Turso`);
  let ok = 0;
  let errors = 0;
  for (const stmt of statements) {
    try {
      await turso.execute(stmt);
      ok++;
    } catch (e) {
      const msg = String(e?.message || '');
      if (msg.includes('already exists') || msg.includes('no such table')) {
        // OK — idempotent
      } else {
        errors++;
        console.error('DDL error:', msg.substring(0, 200));
        console.error('  Statement:', stmt.substring(0, 100));
      }
    }
  }
  console.log(`Schema applied: ${ok} OK, ${errors} errors`);
}

async function migrateTable(tableName, columns, transform = (r) => r) {
  const rows = await sandbox[`$queryRawUnsafe`]
    ? null
    : null;
  // Use raw SQL since we want all columns
  const data = await sandbox.$queryRawUnsafe(`SELECT * FROM "${tableName}"`);
  console.log(`  ${tableName}: ${data.length} rows`);

  if (data.length === 0) return;

  // Build INSERT OR REPLACE statements
  const colList = columns.join(', ');
  const placeholderList = columns.map(() => '?').join(', ');
  const sql = `INSERT OR REPLACE INTO "${tableName}" (${colList}) VALUES (${placeholderList})`;

  for (const row of data) {
    const values = columns.map((c) => {
      let v = row[c];
      // Prisma returns DATETIME as Date objects — convert to ISO string
      if (v instanceof Date) v = v.toISOString();
      // Prisma returns BIGINT in some cases — convert to number
      if (typeof v === 'bigint') v = Number(v);
      return v;
    });
    try {
      await turso.execute({ sql, args: values });
    } catch (e) {
      console.error(`  Insert error on ${tableName}:`, e?.message?.substring(0, 200));
      console.error(`  Row:`, JSON.stringify(row).substring(0, 300));
      throw e;
    }
  }
  console.log(`  ✅ ${tableName}: ${data.length} rows migrated`);
}

async function main() {
  console.log('=== Step 1: Apply schema to Turso ===');
  await applySchema();

  console.log('\n=== Step 2: Migrate data from sandbox SQLite to Turso ===');

  // Disable foreign key checks during migration (we'll insert in dependency order)
  await turso.execute('PRAGMA foreign_keys = OFF');

  // Order matters: parents before children
  await migrateTable('User', ['id', 'email', 'name', 'passwordHash', 'preferredLang', 'baseCurrency', 'theme', 'createdAt', 'updatedAt']);
  await migrateTable('Session', ['id', 'sessionToken', 'userId', 'expires', 'createdAt']);
  await migrateTable('Account', ['id', 'userId', 'name', 'accountType', 'subType', 'currency', 'currentBalance', 'institution', 'lastFour', 'createdAt', 'updatedAt']);
  await migrateTable('Category', ['id', 'userId', 'name', 'nameEs', 'nameEn', 'icon', 'color', 'direction', 'isSystem', 'sortOrder', 'createdAt']);
  await migrateTable('Transaction', ['id', 'userId', 'type', 'amount', 'currency', 'fromAccountId', 'toAccountId', 'categoryId', 'description', 'occurredOn', 'tags', 'importSource', 'createdAt', 'updatedAt']);
  await migrateTable('Budget', ['id', 'userId', 'name', 'period', 'startDate', 'endDate', 'createdAt']);
  await migrateTable('BudgetItem', ['id', 'budgetId', 'categoryId', 'plannedAmount', 'alertThresholdPct', 'createdAt']);
  await migrateTable('ApiKey', ['id', 'userId', 'name', 'keyHash', 'keyPrefix', 'permissions', 'lastUsedAt', 'expiresAt', 'isActive', 'createdAt']);

  await turso.execute('PRAGMA foreign_keys = ON');

  console.log('\n=== Step 3: Verify migration ===');
  const tables = ['User', 'Session', 'Account', 'Category', 'Transaction', 'Budget', 'BudgetItem', 'ApiKey'];
  for (const t of tables) {
    const result = await turso.execute(`SELECT COUNT(*) as count FROM "${t}"`);
    const count = result.rows[0].count;
    console.log(`  ${t}: ${count} rows`);
  }

  await sandbox.$disconnect();
  await turso.close();
  console.log('\n✅ Migration complete!');
}

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
