/**
 * POST /api/v1/expenses
 * GET  /api/v1/expenses
 *
 * Public API for registering expenses from external systems using an API key.
 *
 * POST payload:
 *   {
 *     "amount":      419.99,          // required, > 0
 *     "currency":    "DOP",           // "DOP" | "USD", default "DOP"
 *     "category":    "Alimentación",  // free text — matched by name/nameEs, else auto-created
 *     "merchant":    "Heladería X",   // optional — prepended to description
 *     "description": "Helados",      // optional
 *     "date":        "2026-09-23",    // ISO date, optional, default today
 *     "account_id":  "cmr00...",     // optional — explicit account ID
 *     "account":     "Cuenta..."     // optional — account name (used if account_id not provided)
 *   }
 *
 * POST response: 201 Created  { success, id, expense }
 *   401 — missing/invalid API key
 *   403 — API key lacks write permission
 *   422 — validation error (invalid amount, account not found, etc.)
 *   429 — rate limited
 *
 * GET query params:
 *   ?limit=10      default 50, max 200
 *   ?month=2026-09 filters by month (YYYY-MM)
 *
 * GET response: 200 OK  { success, count, expenses: [...] }
 */

import { NextResponse } from 'next/server';
import { db, ensureDb } from '@/lib/db';
import { authenticateV1Request, hasPermission } from '@/lib/auth/v1-api';
import { resolveCategoryByName, getDefaultExpenseAccount, resolveAccountFromPayload } from '@/lib/finzen/v1-helpers';

// ─────────────────────────────────────────────────────────────
// POST — register a new expense
// ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // 1. Authenticate + rate-limit
  const auth = await authenticateV1Request(req);
  if (!auth.ok) return auth.response!;
  const user = auth.user!;

  await ensureDb();

  // 2. Permission check
  if (!hasPermission(user, 'write')) {
    return NextResponse.json(
      { success: false, error: 'forbidden', message: 'This API key does not have write permission' },
      { status: 403 }
    );
  }

  // 3. Parse + validate body
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

  // 3a. amount — required, must be a positive number
  const numAmount = Number(amount);
  if (amount === undefined || amount === null || Number.isNaN(numAmount) || numAmount <= 0) {
    return NextResponse.json(
      { success: false, error: 'invalid_amount', message: 'amount is required and must be a positive number' },
      { status: 422 }
    );
  }

  // 3b. currency — DOP or USD, default DOP
  const cur = (typeof currency === 'string' && ['DOP', 'USD'].includes(currency.toUpperCase()))
    ? currency.toUpperCase()
    : 'DOP';

  // 3c. description — combine merchant + description for the stored text
  const merchantStr = (merchant && String(merchant).trim()) || '';
  const descStr = (description && String(description).trim()) || '';
  const fullDescription = [merchantStr, descStr].filter(Boolean).join(' · ') || merchantStr || descStr || 'External expense';

  // 3d. date — ISO date string or today
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

  // 4. Resolve category by name (auto-create if not found)
  const cat = await resolveCategoryByName(user.userId, category, 'expense');

  // 5. Resolve account — PRIORITY: account_id > accountId > account > default
  //    If the user explicitly provided account_id/accountId and it doesn't
  //    exist, return 422 (do NOT silently fall back to default).
  const { account: resolvedAcc, source } = await resolveAccountFromPayload(user.userId, {
    account_id,
    accountId,
    account,
  });

  let acc = resolvedAcc;
  let usedDefault = false;
  if (!acc && source === null) {
    // No account field provided at all — fall back to default
    acc = await getDefaultExpenseAccount(user.userId, cur);
    usedDefault = true;
  }
  if (!acc) {
    // User explicitly provided an account_id/account that doesn't exist
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

  // 6. Create the transaction — same shape as the in-app POST /api/transactions
  //    Expense: debit from real account (fromAccountId), credit to virtual
  //    "x_<categoryId>" (toAccountId).
  const toAccountId = cat.id ? `x_${cat.id}` : 'x_undefined';

  const tx = await db.transaction.create({
    data: {
      userId: user.userId,
      type: 'expense',
      amount: numAmount,
      currency: cur,
      fromAccountId: acc.id,
      toAccountId,
      categoryId: cat.id,
      description: fullDescription,
      occurredOn,
      tags: 'api_v1',
      importSource: 'api_v1',
    },
    include: { category: true },
  });

  // 7. Return the public expense shape
  return NextResponse.json(
    {
      success: true,
      id: tx.id,
      expense: {
        id: tx.id,
        amount: tx.amount,
        currency: tx.currency,
        category: tx.category?.nameEs || tx.category?.name || cat.name || null,
        merchant: merchantStr || null,
        description: descStr || null,
        date: occurredOn.toISOString().split('T')[0],
        account: { id: acc.id, name: acc.name, currency: acc.currency },
        account_source: usedDefault ? 'default' : source,  // for client debug
      },
    },
    { status: 201 }
  );
}

// ─────────────────────────────────────────────────────────────
// GET — list expenses
// ─────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  // 1. Authenticate + rate-limit
  const auth = await authenticateV1Request(req);
  if (!auth.ok) return auth.response!;
  const user = auth.user!;

  await ensureDb();

  // 2. Parse query
  const { searchParams } = new URL(req.url);
  const rawLimit = parseInt(searchParams.get('limit') || '50', 10);
  const limit = Number.isNaN(rawLimit) ? 50 : Math.max(1, Math.min(200, rawLimit));
  const month = searchParams.get('month'); // e.g. "2026-09"

  // 3. Build where clause
  const where: any = { userId: user.userId, type: 'expense' };
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

  // 5. Resolve account names for nicer output
  const accountIds = Array.from(new Set(txs.map((t) => t.fromAccountId).filter((id) => !id.startsWith('x_'))));
  const accounts = accountIds.length
    ? await db.account.findMany({ where: { id: { in: accountIds } }, select: { id: true, name: true, currency: true } })
    : [];
  const acctMap = new Map(accounts.map((a) => [a.id, a]));

  // 6. Shape response
  return NextResponse.json({
    success: true,
    count: txs.length,
    expenses: txs.map((t) => {
      const acct = acctMap.get(t.fromAccountId);
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
