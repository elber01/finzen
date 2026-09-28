/**
 * GET /api/v1/summary
 *
 * Returns a monthly summary: total spent, total income, and breakdowns
 * by category for both directions.
 *
 * AUTH:
 *   Header: `X-API-Key: fz_<key>`  (or `Authorization: Bearer fz_<key>`)
 *
 * Query params:
 *   ?month=2026-09   required — YYYY-MM
 *
 * Response 200:
 *   {
 *     "success": true,
 *     "month": "2026-09",
 *     "currency": "DOP",
 *     "expenses": {
 *       "total": 419.99,
 *       "count": 1,
 *       "byCategory": [
 *         { "category": "Alimentación", "total": 419.99, "count": 1 }
 *       ]
 *     },
 *     "income": {
 *       "total": 7500,
 *       "count": 1,
 *       "byCategory": [
 *         { "category": "Aporte", "total": 7500, "count": 1 }
 *       ]
 *     },
 *     "net": 7080.01
 *   }
 *
 * Errors:
 *   400 — missing/invalid `month`
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

  // 2. Parse + validate month
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { success: false, error: 'invalid_month', message: 'month query param is required (format: YYYY-MM, e.g. 2026-09)' },
      { status: 400 }
    );
  }

  const [y, m] = month.split('-').map(Number);
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 1, 0, 0, 0, 0);

  // 3. Fetch ALL transactions for this user in this month (both income + expense)
  const txs = await db.transaction.findMany({
    where: {
      userId: user.userId,
      occurredOn: { gte: start, lt: end },
      type: { in: ['income', 'expense'] },
    },
    select: {
      id: true,
      type: true,
      amount: true,
      currency: true,
      categoryId: true,
      category: { select: { id: true, name: true, nameEs: true } },
    },
  });

  // 4. Separate expenses and incomes
  const expenseTxs = txs.filter((t) => t.type === 'expense');
  const incomeTxs = txs.filter((t) => t.type === 'income');

  // 5. Aggregate each side
  const totalExpenses = expenseTxs.reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = incomeTxs.reduce((sum, t) => sum + t.amount, 0);

  function aggregateByCategory(items: typeof txs) {
    const map = new Map<string, { category: string; total: number; count: number }>();
    for (const t of items) {
      const catName = t.category?.nameEs || t.category?.name || 'Sin categoría';
      const existing = map.get(catName) || { category: catName, total: 0, count: 0 };
      existing.total += t.amount;
      existing.count += 1;
      map.set(catName, existing);
    }
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .map((c) => ({ ...c, total: Number(c.total.toFixed(2)) }));
  }

  const expensesByCategory = aggregateByCategory(expenseTxs);
  const incomeByCategory = aggregateByCategory(incomeTxs);

  // 6. Pick a representative currency (most common among all txs)
  const curCounts = new Map<string, number>();
  for (const t of txs) {
    curCounts.set(t.currency, (curCounts.get(t.currency) || 0) + 1);
  }
  const currency = txs.length > 0
    ? Array.from(curCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]
    : 'DOP';

  // 7. Compute net (income - expenses)
  const net = Number((totalIncome - totalExpenses).toFixed(2));

  return NextResponse.json({
    success: true,
    month,
    currency,
    expenses: {
      total: Number(totalExpenses.toFixed(2)),
      count: expenseTxs.length,
      byCategory: expensesByCategory,
    },
    income: {
      total: Number(totalIncome.toFixed(2)),
      count: incomeTxs.length,
      byCategory: incomeByCategory,
    },
    net,
  });
}
