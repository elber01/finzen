/**
 * GET /api/v1/accounts
 *
 * Lists all accounts belonging to the authenticated user. Useful for
 * finding the `account_id` to pass to POST /api/v1/expenses or POST /api/v1/incomes.
 *
 * AUTH:
 *   Header: `X-API-Key: fz_<key>`  (or `Authorization: Bearer fz_<key>`)
 *
 * Query params (all optional):
 *   ?type=asset      filter by accountType ("asset" | "liability" | "income" | "expense")
 *   ?currency=DOP    filter by currency
 *
 * Response 200:
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
 * Errors:
 *   401 — missing/invalid API key
 *   429 — rate limited
 */

import { NextResponse } from 'next/server';
import { db, ensureDb } from '@/lib/db';
import { authenticateV1Request } from '@/lib/auth/v1-api';

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
