/**
 * GET  /api/v1/accounts
 * POST /api/v1/accounts
 *
 * GET lists all accounts belonging to the authenticated user. Useful for
 * finding the `account_id` to pass to POST /api/v1/expenses or POST /api/v1/incomes.
 *
 * POST creates a new account for the authenticated user (business rules live
 * in src/lib/services/accounts-service.ts).
 *
 * AUTH:
 *   Header: `X-API-Key: fz_<key>`  (or `Authorization: Bearer fz_<key>`)
 *   POST additionally requires the `write` permission.
 *
 * GET query params (all optional):
 *   ?type=asset      filter by accountType ("asset" | "liability" | "income" | "expense")
 *   ?currency=DOP    filter by currency
 *
 * GET response 200:
 *   {
 *     "success": true,
 *     "count": 4,
 *     "accounts": [
 *       {
 *         "id": "cmr00knuy001psrtmgi352hqj",
 *         "name": "Cuenta corriente BPD 736556739",
 *         "accountType": "asset",
 *         "subType": "checking",
 *         "currency": "DOP",
 *         "currentBalance": 1247.02,
 *         "institution": null,
 *         "lastFour": null
 *       },
 *       ...
 *     ]
 *   }
 *
 * POST payload (only `name` required, all other fields optional):
 *   {
 *     "name":           "E2E Bank Loan",     // required, non-empty
 *     "accountType":    "liability",          // "asset" (default) | "liability"
 *     "subType":        "loan",               // checking (default) | savings | credit_card
 *                                              // | cash | crypto_wallet | investment | loan
 *                                              // | null ("credit" is aliased to "credit_card")
 *     "currency":       "DOP",                // "DOP" (default) | "USD"
 *     "currentBalance": 48120.73,             // default 0; finite number (0 and
 *                                              // negatives valid; positive liability = debt)
 *     "institution":    "E2E Bank",           // optional string, "" → null
 *     "lastFour":      "4812"                 // optional, 2-4 digits or null
 *   }
 *
 * POST response 201 Created: { success, account: {...} }
 *   401 — missing/invalid API key
 *   403 — API key lacks write permission
 *   422 — invalid JSON body or validation error
 *          (invalid_name | invalid_account_type | invalid_sub_type |
 *           invalid_currency | invalid_balance | invalid_institution | invalid_last_four)
 *   429 — rate limited
 */

import { NextResponse } from 'next/server';
import { db, ensureDb } from '@/lib/db';
import { authenticateV1Request, hasPermission } from '@/lib/auth/v1-api';
import { createAccountForUser } from '@/lib/services/accounts-service';

export async function GET(req: Request) {
  // 1. Auth
  const auth = await authenticateV1Request(req);
  if (!auth.ok) return auth.response!;
  const user = auth.user!;

  await ensureDb();

  // 2. Parse query
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || undefined;
  const currency = searchParams.get('currency') || undefined;

  // 3. Build where
  const where: any = { userId: user.userId };
  if (type) where.accountType = type;
  if (currency) where.currency = currency;

  // 4. Query
  const accounts = await db.account.findMany({
    where,
    orderBy: [{ accountType: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      accountType: true,
      subType: true,
      currency: true,
      currentBalance: true,
      institution: true,
      lastFour: true,
    },
  });

  // 5. Shape response
  return NextResponse.json({
    success: true,
    count: accounts.length,
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      accountType: a.accountType,
      subType: a.subType,
      currency: a.currency,
      currentBalance: a.currentBalance,
      institution: a.institution,
      lastFour: a.lastFour,
    })),
  });
}

// ─────────────────────────────────────────────────────────────
// POST — create a new account
// ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // 1. Auth
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

  // 3. Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'invalid_json', message: 'Request body must be valid JSON' },
      { status: 422 }
    );
  }

  // 4. Delegate to the service layer
  const result = await createAccountForUser(user.userId, body);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.code, message: result.message },
      { status: 422 }
    );
  }

  // 5. Return the created account
  return NextResponse.json({ success: true, account: result.account }, { status: 201 });
}
