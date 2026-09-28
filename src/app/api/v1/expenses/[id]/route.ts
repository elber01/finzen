/**
 * PATCH /api/v1/expenses/:id  — partial update of an existing expense
 * DELETE /api/v1/expenses/:id — delete an expense
 *
 * AUTH: same X-API-Key header as other /api/v1/* endpoints.
 *       Requires `write` permission.
 *
 * PATCH payload (all fields optional):
 *   {
 *     "amount":      500,              // new amount
 *     "currency":    "USD",            // DOP or USD
 *     "category":    "Comida",         // new category (auto-created if not exists)
 *     "merchant":    "New merchant",   // new merchant
 *     "description": "New desc",      // new description
 *     "date":        "2026-10-01",     // new ISO date
 *     "account_id":  "cmr00...",      // new account ID — must exist
 *     "account":     "Cuenta..."      // OR account name (fallback if account_id not provided)
 *   }
 *
 * PATCH response: 200 OK  { success, expense: {...} }
 *   401 — invalid API key
 *   403 — no write permission
 *   404 — expense not found / not owned by caller
 *   422 — validation error
 *
 * DELETE response: 200 OK  { success, id, deleted: true }
 *   401 / 403 / 404 — same as PATCH
 */

import { NextResponse } from 'next/server';
import { db, ensureDb } from '@/lib/db';
import { authenticateV1Request, hasPermission } from '@/lib/auth/v1-api';
import { resolveCategoryByName, resolveAccountFromPayload } from '@/lib/finzen/v1-helpers';

// ─────────────────────────────────────────────────────────────
// PATCH — update an expense
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

  // 2. Resolve expense — must be owned by caller AND be an expense type
  const { id } = await params;
  const existing = await db.transaction.findFirst({
    where: { id, userId: user.userId, type: 'expense' },
    include: { category: true },
  });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: 'not_found', message: 'Expense not found or not owned by your user' },
      { status: 404 }
    );
  }

  // 3. Parse body
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

  // 4. Build update data (only fields that are present)
  const data: any = {};

  // 4a. amount
  if (amount !== undefined) {
    const numAmount = Number(amount);
    if (Number.isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'invalid_amount', message: 'amount must be a positive number' },
        { status: 422 }
      );
    }
    data.amount = numAmount;
  }

  // 4b. currency
  if (currency !== undefined) {
    if (typeof currency !== 'string' || !['DOP', 'USD'].includes(currency.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'invalid_currency', message: 'currency must be "DOP" or "USD"' },
        { status: 422 }
      );
    }
    data.currency = currency.toUpperCase();
  }

  // 4c. description — if merchant or description is provided, rebuild the combined text
  if (merchant !== undefined || description !== undefined) {
    const merchantStr = (merchant !== undefined ? String(merchant).trim() : (existing.description?.split(' · ')[0] || ''));
    const descStr = (description !== undefined ? String(description).trim() : (existing.description?.split(' · ')[1] || ''));
    data.description = [merchantStr, descStr].filter(Boolean).join(' · ') || merchantStr || descStr || 'External expense';
  }

  // 4d. date
  if (date !== undefined) {
    const d = new Date(typeof date === 'string' && !date.includes('T') ? `${date}T12:00:00` : date);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json(
        { success: false, error: 'invalid_date', message: 'date must be an ISO date string (YYYY-MM-DD)' },
        { status: 422 }
      );
    }
    data.occurredOn = d;
  }

  // 4e. category — resolve + update categoryId
  if (category !== undefined) {
    const cat = await resolveCategoryByName(user.userId, category, 'expense');
    data.categoryId = cat.id;
    // Also update toAccountId to keep the double-entry convention
    data.toAccountId = cat.id ? `x_${cat.id}` : 'x_undefined';
  }

  // 4f. account — only if explicitly provided in the patch
  if (account_id !== undefined || accountId !== undefined || account !== undefined) {
    const { account: resolvedAcc, source } = await resolveAccountFromPayload(user.userId, {
      account_id,
      accountId,
      account,
    });
    if (!resolvedAcc) {
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
    data.fromAccountId = resolvedAcc.id;
  }

  // 5. Apply the update
  const updated = await db.transaction.update({
    where: { id: existing.id },
    data,
    include: { category: true },
  });

  // 6. Resolve account for response
  const acc = updated.fromAccountId && !updated.fromAccountId.startsWith('x_')
    ? await db.account.findFirst({ where: { id: updated.fromAccountId }, select: { id: true, name: true, currency: true } })
    : null;

  // 7. Return updated expense shape
  return NextResponse.json({
    success: true,
    id: updated.id,
    expense: {
      id: updated.id,
      amount: updated.amount,
      currency: updated.currency,
      category: updated.category?.nameEs || updated.category?.name || null,
      description: updated.description,
      date: updated.occurredOn.toISOString().split('T')[0],
      account: acc ? { id: acc.id, name: acc.name, currency: acc.currency } : null,
    },
  });
}

// ─────────────────────────────────────────────────────────────
// DELETE — delete an expense
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

  // 2. Resolve expense
  const { id } = await params;
  const existing = await db.transaction.findFirst({
    where: { id, userId: user.userId, type: 'expense' },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: 'not_found', message: 'Expense not found or not owned by your user' },
      { status: 404 }
    );
  }

  // 3. Delete
  await db.transaction.delete({ where: { id: existing.id } });

  // 4. Return confirmation
  return NextResponse.json({
    success: true,
    id: existing.id,
    deleted: true,
  });
}
