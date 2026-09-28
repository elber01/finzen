/**
 * POST /api/v1/incomes
 * GET  /api/v1/incomes
 *
 * Public API for registering incomes from external systems using an API key.
 * Same payload format as /api/v1/expenses, but stores as type='income'.
 *
 * Double-entry convention (matches the in-app UI):
 *   - For an INCOME, the money flows INTO a real account (e.g. checking),
 *     so `fromAccountId = x_<categoryId>` (virtual) and
 *     `toAccountId = <real account id>`.
 *   - This is the MIRROR of an expense, where `fromAccountId = <real>` and
 *     `toAccountId = x_<categoryId>`.
 *
 * POST payload (same as expenses):
 *   {
 *     "amount":      7500,            // required, > 0
 *     "currency":    "DOP",           // "DOP" | "USD", default "DOP"
 *     "category":    "Aporte",        // free text — matched by name/nameEs, else auto-created as income
 *     "merchant":    "Aporte Deb",    // optional — prepended to description
 *     "description": "Aporte Deb",  // optional
 *     "date":        "2026-09-23",    // ISO date, optional, default today
 *     "account_id":  "cmr00...",     // optional — explicit account ID (income target)
 *     "account":     "Cuenta..."     // optional — account name
 *   }
 *
 * POST response: 201 Created  { success, id, income: {...} }
 *   401 / 403 / 422 / 429 — same as expenses
 *
 * GET query params:
 *   ?limit=10      default 50, max 200
 *   ?month=2026-09 filters by month (YYYY-MM)
 *
 * GET response: 200 OK  { success, count, incomes: [...] }
 */

import { NextResponse } from 'next/server';
import { db, ensureDb } from '@/lib/db';
import { authenticateV1Request, hasPermission } from '@/lib/auth/v1-api';
import { resolveCategoryByName, getDefaultExpenseAccount, resolveAccountFromPayload } from '@/lib/finzen/v1-helpers';

// ─────────────────────────────────────────────────────────────
// POST — register a new income
// ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // 1. Auth
  const auth = await authenticateV1Request(req);
  if (!auth.ok) return auth.response!;
  const user = auth.user!;

  await ensureDb();

  if (!hasPermission(user, 'write')) {
    return NextResponse.json(
      { success: false, error: 'forbidden', message: 'This API key does not have write permission' },
      { status: 403 }
    );
  }

  // 2. Parse body
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'invalid_json', message: 'Request body must be valid JSON' },
      { status: 422 }
    );
  }

  const { amount, currency, category, merchant, description, date, account_id, accountId, account } = body || {};

  // 2a. amount
  const numAmount = Number(amount);
  if (amount === undefined || amount === null || Number.isNaN(numAmount) || numAmount <= 0) {
    return NextResponse.json(
      { success: false, error: 'invalid_amount', message: 'amount is required and must be a positive number' },
      { status: 422 }
    );
  }

  // 2b. currency
  const cur = (typeof currency === 'string' && ['DOP', 'USD'].includes(currency.toUpperCase()))
    ? currency.toUpperCase()
    : 'DOP';

  // 2c. description
  const merchantStr = (merchant && String(merchant).trim()) || '';
  const descStr = (description && String(description).trim()) || '';
  const fullDescription = [merchantStr, descStr].filter(Boolean).join(' · ') || merchantStr || descStr || 'External income';

  // 2d. date
  let occurredOn: Date;
  if (date) {
    const d = new Date(typeof date === 'string' && !date.includes('T') ? `${date}T12:00:00` : date);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json(
        { success: false, error: 'invalid_date', message: 'date must be an ISO date string (YYYY-MM-DD)' },
        { status: 422 }
      );
    }
    occurredOn = d;
  } else {
    occurredOn = new Date();
  }

  // 3. Resolve category as income direction
  const cat = await resolveCategoryByName(user.userId, category, 'income');

  // 4. Resolve account (income target — same logic as expenses)
  const { account: resolvedAcc, source } = await resolveAccountFromPayload(user.userId, {
    account_id,
    accountId,
    account,
  });

  let acc = resolvedAcc;
  let usedDefault = false;
  if (!acc && source === null) {
    acc = await getDefaultExpenseAccount(user.userId, cur);
    usedDefault = true;
  }
  if (!acc) {
    const field = (account_id && 'account_id') || (accountId && 'accountId') || 'account';
    return NextResponse.json(
      {
        success: false,
        error: 'account_not_found',
        message: `The "${field}" you provided doesn't exist or doesn't belong to your user.`,
      },
      { status: 422 }
    );
  }
  if (!acc && usedDefault) {
    return NextResponse.json(
      { success: false, error: 'no_account', message: 'No asset account found for this user. Open the app and create a checking account first, or pass the "account_id" field.' },
      { status: 422 }
    );
  }

  // 5. Create transaction — INCOME shape:
  //    fromAccountId = virtual (x_<categoryId>)
  //    toAccountId = real account (where the money lands)
  const fromAccountId = cat.id ? `x_${cat.id}` : 'x_undefined';

  const tx = await db.transaction.create({
    data: {
      userId: user.userId,
      type: 'income',
      amount: numAmount,
      currency: cur,
      fromAccountId,
      toAccountId: acc.id,
      categoryId: cat.id,
      description: fullDescription,
      occurredOn,
      tags: 'api_v1',
      importSource: 'api_v1',
    },
    include: { category: true },
  });

  // 6. Return
  return NextResponse.json(
    {
      success: true,
      id: tx.id,
      income: {
        id: tx.id,
        amount: tx.amount,
        currency: tx.currency,
        category: tx.category?.nameEs || tx.category?.name || cat.name || null,
        merchant: merchantStr || null,
        description: descStr || null,
        date: occurredOn.toISOString().split('T')[0],
        account: { id: acc.id, name: acc.name, currency: acc.currency },
        account_source: usedDefault ? 'default' : source,
      },
    },
    { status: 201 }
  );
}

// ─────────────────────────────────────────────────────────────
// GET — list incomes
// ─────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  // 1. Auth
  const auth = await authenticateV1Request(req);
  if (!auth.ok) return auth.response!;
  const user = auth.user!;

  await ensureDb();

  // 2. Parse query
  const { searchParams } = new URL(req.url);
  const rawLimit = parseInt(searchParams.get('limit') || '50', 10);
  const limit = Number.isNaN(rawLimit) ? 50 : Math.max(1, Math.min(200, rawLimit));
  const month = searchParams.get('month');

  // 3. Build where — INCOMES use toAccountId as the real account
  const where: any = { userId: user.userId, type: 'income' };
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number);
    const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const end = new Date(y, m, 1, 0, 0, 0, 0);
    where.occurredOn = { gte: start, lt: end };
  }

  // 4. Query
  const txs = await db.transaction.findMany({
    where,
    orderBy: { occurredOn: 'desc' },
    take: limit,
    include: { category: true },
  });

  // 5. Resolve account names — for income, the real account is toAccountId
  const accountIds = Array.from(new Set(txs.map((t) => t.toAccountId).filter((id) => !id.startsWith('x_'))));
  const accounts = accountIds.length
    ? await db.account.findMany({ where: { id: { in: accountIds } }, select: { id: true, name: true, currency: true } })
    : [];
  const acctMap = new Map(accounts.map((a) => [a.id, a]));

  // 6. Shape response
  return NextResponse.json({
    success: true,
    count: txs.length,
    incomes: txs.map((t) => {
      const acct = acctMap.get(t.toAccountId);
      return {
        id: t.id,
        amount: t.amount,
        currency: t.currency,
        category: t.category?.nameEs || t.category?.name || null,
        description: t.description,
        date: t.occurredOn.toISOString().split('T')[0],
        account: acct ? { id: acct.id, name: acct.name, currency: acct.currency } : null,
      };
    }),
  });
}
