#!/usr/bin/env bun
/**
 * E2E test suite for the /api/v1/accounts CRUD endpoints (create, read,
 * patch, delete + transaction guard).
 *
 * Usage:
 *   bun scripts/e2e-accounts-v1.js --base http://localhost:3000 --key fz_...
 *
 * Or via environment variables:
 *   E2E_BASE_URL=http://localhost:3000 FINZEN_API_KEY=fz_... bun scripts/e2e-accounts-v1.js
 *
 * The API key is NEVER logged. Test accounts/expenses created during the run
 * are deleted in a finally block (errors during cleanup are ignored).
 *
 * Exit code: 0 if all steps pass, 1 otherwise.
 */

// ─────────────────────────────────────────────────────────────
// CLI args + config
// ─────────────────────────────────────────────────────────────

function argValue(name) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(`--${name}`);
  if (i !== -1 && i + 1 < argv.length) return argv[i + 1];
  return undefined;
}

const BASE = (argValue('base') || process.env.E2E_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const KEY = argValue('key') || process.env.FINZEN_API_KEY;

if (!KEY) {
  console.error('Missing API key: pass --key fz_... or set FINZEN_API_KEY');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Authenticated call. Returns { status, json }. */
async function call(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'X-API-Key': KEY,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

let passed = 0;
let failed = 0;

function check(n, name, expected, got, ok) {
  if (ok) {
    passed++;
    console.log(`✓ ${n}. ${name} — expected ${expected}, got ${got}`);
  } else {
    failed++;
    console.log(`✗ ${n}. ${name} — expected ${expected}, got ${got}`);
  }
}

const createdAccountIds = [];
const createdExpenseIds = [];

async function cleanup() {
  // Expenses first (they block account deletion via the guard)
  for (const id of createdExpenseIds) {
    try {
      await call('DELETE', `/api/v1/expenses/${id}`);
    } catch {
      // ignore — best effort
    }
  }
  for (const id of createdAccountIds) {
    try {
      await call('DELETE', `/api/v1/accounts/${id}`);
    } catch {
      // ignore — best effort
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────────────────────

async function main() {
  const TS = Date.now();

  // 1. GET /api/v1/accounts → 200 + initial count
  let res = await call('GET', '/api/v1/accounts');
  let initialCount = res.json?.count;
  check(1, 'GET list (baseline)', 'status 200, success true',
    `status ${res.status}, success ${res.json?.success}, count ${initialCount}`,
    res.status === 200 && res.json?.success === true && typeof initialCount === 'number');

  // 2. POST create account A (liability / loan / DOP)
  const payloadA = {
    name: `E2E Loan ${TS}`,
    accountType: 'liability',
    subType: 'loan',
    currency: 'DOP',
    currentBalance: 48120.73,
    institution: 'E2E Bank',
  };
  res = await call('POST', '/api/v1/accounts', payloadA);
  const a = res.json?.account;
  const idA = a?.id;
  if (idA) createdAccountIds.push(idA);
  const echoOk =
    a?.name === payloadA.name &&
    a?.accountType === 'liability' &&
    a?.subType === 'loan' &&
    a?.currency === 'DOP' &&
    a?.currentBalance === 48120.73 &&
    a?.institution === 'E2E Bank';
  check(2, 'POST create loan account', 'status 201 + field echo',
    `status ${res.status}, id ${idA}, echo ${echoOk}`,
    res.status === 201 && res.json?.success === true && !!idA && echoOk);

  // 3. GET list → account A appears with subType loan + balance 48120.73
  res = await call('GET', '/api/v1/accounts');
  const listed = res.json?.accounts?.find((acc) => acc.id === idA);
  check(3, 'GET list contains account A', 'subType loan, balance 48120.73',
    `subType ${listed?.subType}, balance ${listed?.currentBalance}`,
    listed?.subType === 'loan' && listed?.currentBalance === 48120.73);

  // 4. PATCH balance to 0 (APAP December case)
  res = await call('PATCH', `/api/v1/accounts/${idA}`, { currentBalance: 0 });
  check(4, 'PATCH currentBalance → 0', 'status 200, balance 0',
    `status ${res.status}, balance ${res.json?.account?.currentBalance}`,
    res.status === 200 && res.json?.success === true && res.json?.account?.currentBalance === 0);

  // 5. PATCH rename
  res = await call('PATCH', `/api/v1/accounts/${idA}`, { name: 'E2E Loan Renamed' });
  check(5, 'PATCH rename', 'status 200, name E2E Loan Renamed',
    `status ${res.status}, name ${res.json?.account?.name}`,
    res.status === 200 && res.json?.account?.name === 'E2E Loan Renamed');

  // 6. PATCH currency → 422 field_not_editable
  res = await call('PATCH', `/api/v1/accounts/${idA}`, { currency: 'USD' });
  check(6, 'PATCH currency (immutable)', 'status 422, error field_not_editable',
    `status ${res.status}, error ${res.json?.error}`,
    res.status === 422 && res.json?.error === 'field_not_editable');

  // 7. PATCH accountType → 422 field_not_editable
  res = await call('PATCH', `/api/v1/accounts/${idA}`, { accountType: 'asset' });
  check(7, 'PATCH accountType (immutable)', 'status 422, error field_not_editable',
    `status ${res.status}, error ${res.json?.error}`,
    res.status === 422 && res.json?.error === 'field_not_editable');

  // 8. PATCH nonexistent account → 404
  res = await call('PATCH', '/api/v1/accounts/noexistente123', { name: 'x' });
  check(8, 'PATCH nonexistent account', 'status 404, error not_found',
    `status ${res.status}, error ${res.json?.error}`,
    res.status === 404 && res.json?.error === 'not_found');

  // 9. POST invalid accountType
  res = await call('POST', '/api/v1/accounts', { name: 'X', accountType: 'cash' });
  check(9, 'POST invalid accountType', 'status 422, error invalid_account_type',
    `status ${res.status}, error ${res.json?.error}`,
    res.status === 422 && res.json?.error === 'invalid_account_type');

  // 10. POST invalid currency
  res = await call('POST', '/api/v1/accounts', { name: 'X', currency: 'EUR' });
  check(10, 'POST invalid currency', 'status 422, error invalid_currency',
    `status ${res.status}, error ${res.json?.error}`,
    res.status === 422 && res.json?.error === 'invalid_currency');

  // 11. POST without name
  res = await call('POST', '/api/v1/accounts', { accountType: 'asset' });
  check(11, 'POST without name', 'status 422, error invalid_name',
    `status ${res.status}, error ${res.json?.error}`,
    res.status === 422 && res.json?.error === 'invalid_name');

  // 12. POST subType alias credit → normalized to credit_card
  res = await call('POST', '/api/v1/accounts', { name: 'E2E Credit', subType: 'credit' });
  const credit = res.json?.account;
  const idCredit = credit?.id;
  if (idCredit) createdAccountIds.push(idCredit);
  check(12, 'POST subType credit alias', 'status 201, subType credit_card',
    `status ${res.status}, subType ${credit?.subType}`,
    res.status === 201 && credit?.subType === 'credit_card');

  // 13. POST create account B (asset / checking)
  res = await call('POST', '/api/v1/accounts', { name: `E2E Guard ${TS}`, accountType: 'asset', subType: 'checking' });
  const idB = res.json?.account?.id;
  if (idB) createdAccountIds.push(idB);
  check(13, 'POST create checking account B', 'status 201, id present',
    `status ${res.status}, id ${idB}`,
    res.status === 201 && !!idB);

  // 14. POST expense linked to B → 201 (needed to trigger the guard)
  res = await call('POST', '/api/v1/expenses', {
    amount: 1,
    currency: 'DOP',
    category: 'E2E Test',
    account_id: idB,
    description: 'e2e guard test',
  });
  const expenseId = res.json?.id;
  if (expenseId) createdExpenseIds.push(expenseId);
  check(14, 'POST expense on account B', 'status 201, expense id present',
    `status ${res.status}, id ${expenseId}`,
    res.status === 201 && !!expenseId);

  // 15. DELETE B → 409 account_has_transactions (transactionCount >= 1)
  res = await call('DELETE', `/api/v1/accounts/${idB}`);
  check(15, 'DELETE account with transactions', 'status 409, error account_has_transactions, count >= 1',
    `status ${res.status}, error ${res.json?.error}, transactionCount ${res.json?.transactionCount}`,
    res.status === 409 &&
      res.json?.error === 'account_has_transactions' &&
      typeof res.json?.transactionCount === 'number' &&
      res.json.transactionCount >= 1);

  // 16. DELETE the expense → 200
  res = await call('DELETE', `/api/v1/expenses/${expenseId}`);
  check(16, 'DELETE linked expense', 'status 200, deleted true',
    `status ${res.status}, deleted ${res.json?.deleted}`,
    res.status === 200 && res.json?.deleted === true);

  // 17. DELETE B again → 200 (guard no longer blocks)
  res = await call('DELETE', `/api/v1/accounts/${idB}`);
  check(17, 'DELETE account B after unlinking', 'status 200, deleted true',
    `status ${res.status}, deleted ${res.json?.deleted}`,
    res.status === 200 && res.json?.deleted === true);

  // 18. DELETE A → 200
  res = await call('DELETE', `/api/v1/accounts/${idA}`);
  check(18, 'DELETE account A', 'status 200, deleted true',
    `status ${res.status}, deleted ${res.json?.deleted}`,
    res.status === 200 && res.json?.deleted === true);

  // 19. DELETE credit account → 200
  res = await call('DELETE', `/api/v1/accounts/${idCredit}`);
  check(19, 'DELETE credit account', 'status 200, deleted true',
    `status ${res.status}, deleted ${res.json?.deleted}`,
    res.status === 200 && res.json?.deleted === true);

  // 20. GET list → count back to baseline
  res = await call('GET', '/api/v1/accounts');
  check(20, 'GET list (cleanup verified)', `count ${initialCount}`,
    `count ${res.json?.count}`,
    res.status === 200 && res.json?.count === initialCount);

  // 21. GET without API key → 401
  const noAuth = await fetch(`${BASE}/api/v1/accounts`);
  check(21, 'GET without API key', 'status 401', `status ${noAuth.status}`, noAuth.status === 401);
}

try {
  await main();
} catch (err) {
  console.error('Suite crashed:', err?.message || err);
  failed++;
} finally {
  await cleanup();
}

console.log(`RESULT: ${passed}/21 passed`);
if (failed > 0) {
  console.log(`${failed} step(s) FAILED`);
  process.exitCode = 1;
}
