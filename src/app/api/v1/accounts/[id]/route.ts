/**
 * PATCH  /api/v1/accounts/:id — partial update of an existing account
 * DELETE /api/v1/accounts/:id — delete an account (guarded)
 *
 * AUTH: same X-API-Key header as other /api/v1/* endpoints.
 *       Requires `write` permission.
 *
 * PATCH payload (all fields optional; `accountType` and `currency` are NOT
 * editable — changing them would rewrite net worth semantics; delete and
 * recreate the account instead):
 *   {
 *     "name":           "E2E Loan Renamed",  // non-empty string
 *     "currentBalance": 0,                   // direct balance adjustment
 *                                             // (never recomputed from transactions;
 *                                             // 0 and negatives are valid)
 *     "institution":    "Popular",           // string, "" → null
 *     "lastFour":       "4812",              // 2-4 digits or null
 *     "subType":        "loan"                // any valid subType or null (clears it)
 *   }
 *
 * PATCH response: 200 OK  { success, account: {...} }
 *   401 — invalid API key
 *   403 — no write permission
 *   404 — account not found / not owned by caller
 *   422 — validation error (invalid_json | invalid_name | invalid_balance |
 *          invalid_institution | invalid_last_four | invalid_sub_type |
 *          field_not_editable)
 *   429 — rate limited
 *
 * DELETE response: 200 OK  { success, id, deleted: true }
 *   401 / 403 / 404 — same as PATCH
 *   409 — account_has_transactions: the account still has linked
 *         transactions. To preserve double-entry history it cannot be
 *         deleted; PATCH its balance to 0 instead.
 *         Body: { success, error: "account_has_transactions", message,
 *                 transactionCount: <n> }
 */

import { NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { authenticateV1Request, hasPermission } from '@/lib/auth/v1-api';
import { updateAccountForUser, deleteAccountForUser } from '@/lib/services/accounts-service';

// ─────────────────────────────────────────────────────────────
// PATCH — update an account
// ─────────────────────────────────────────────────────────────

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'invalid_json', message: 'Request body must be valid JSON' },
      { status: 422 }
    );
  }

  // 3. Delegate to the service layer
  const { id } = await params;
  const result = await updateAccountForUser(user.userId, id, body);
  if (!result.ok) {
    if (result.code === 'not_found') {
      return NextResponse.json(
        { success: false, error: 'not_found', message: 'Account not found or not owned by your user' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { success: false, error: result.code, message: result.message },
      { status: 422 }
    );
  }

  // 4. Return the updated account
  return NextResponse.json({ success: true, account: result.account });
}

// ─────────────────────────────────────────────────────────────
// DELETE — delete an account (guarded by transaction count)
// ─────────────────────────────────────────────────────────────

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  // 2. Delegate to the service layer (includes the transaction guard)
  const { id } = await params;
  const result = await deleteAccountForUser(user.userId, id);
  if (!result.ok) {
    if (result.code === 'not_found') {
      return NextResponse.json(
        { success: false, error: 'not_found', message: 'Account not found or not owned by your user' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: result.code,
        message: result.message,
        transactionCount: result.transactionCount,
      },
      { status: 409 }
    );
  }

  // 3. Return confirmation
  return NextResponse.json({ success: true, id: result.id, deleted: true });
}
