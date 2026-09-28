/**
 * PATCH /api/v1/incomes/:id  — partial update of an existing income
 * DELETE /api/v1/incomes/:id — delete an income
 *
 * Same auth + shape as /api/v1/expenses/:id, but operates on type='income'.
 */

import { NextResponse } from 'next/server';
import { db, ensureDb } from '@/lib/db';
import { authenticateV1Request, hasPermission } from '@/lib/auth/v1-api';
import { resolveCategoryByName, resolveAccountFromPayload } from '@/lib/finzen/v1-helpers';

// ─────────────────────────────────────────────────────────────
// PATCH — update an income
// ─────────────────────────────────────────────────────────────

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const existing = await db.transaction.findFirst({
    where: { id, userId: user.userId, type: 'income' },
    include: { category: true },
  });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: 'not_found', message: 'Income not found or not owned by your user' },
      { status: 404 }
    );
  }

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
  const data: any = {};

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

  if (currency !== undefined) {
    if (typeof currency !== 'string' || !['DOP', 'USD'].includes(currency.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'invalid_currency', message: 'currency must be "DOP" or "USD"' },
        { status: 422 }
      );
    }
    data.currency = currency.toUpperCase();
  }

  if (merchant !== undefined || description !== undefined) {
    const merchantStr = (merchant !== undefined ? String(merchant).trim() : (existing.description?.split(' · ')[0] || ''));
    const descStr = (description !== undefined ? String(description).trim() : (existing.description?.split(' · ')[1] || ''));
    data.description = [merchantStr, descStr].filter(Boolean).join(' · ') || merchantStr || descStr || 'External income';
  }

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

  if (category !== undefined) {
    const cat = await resolveCategoryByName(user.userId, category, 'income');
    data.categoryId = cat.id;
    // For income, the virtual side is `fromAccountId`
    data.fromAccountId = cat.id ? `x_${cat.id}` : 'x_undefined';
  }

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
    // For income, the real account is `toAccountId`
    data.toAccountId = resolvedAcc.id;
  }

  const updated = await db.transaction.update({
    where: { id: existing.id },
    data,
    include: { category: true },
  });

  const acc = updated.toAccountId && !updated.toAccountId.startsWith('x_')
    ? await db.account.findFirst({ where: { id: updated.toAccountId }, select: { id: true, name: true, currency: true } })
    : null;

  return NextResponse.json({
    success: true,
    id: updated.id,
    income: {
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
// DELETE — delete an income
// ─────────────────────────────────────────────────────────────

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const existing = await db.transaction.findFirst({
    where: { id, userId: user.userId, type: 'income' },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: 'not_found', message: 'Income not found or not owned by your user' },
      { status: 404 }
    );
  }

  await db.transaction.delete({ where: { id: existing.id } });

  return NextResponse.json({
    success: true,
    id: existing.id,
    deleted: true,
  });
}
