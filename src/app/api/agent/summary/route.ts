import { NextResponse } from 'next/server';
import { validateApiKey, hasPermission } from '@/lib/auth/api-key';
import { db } from '@/lib/db';

/**
 * GET /api/agent/summary
 * Returns a financial summary for the authenticated API key user.
 * 
 * Headers: Authorization: Bearer fz_xxxxx
 * 
 * Query params:
 *   - month: YYYY-MM (defaults to current month)
 * 
 * Response:
 *   - netWorth: total net worth in base currency
 *   - totalAssets: sum of asset accounts
 *   - totalLiabilities: sum of liability accounts
 *   - monthIncome: income for the specified month
 *   - monthExpenses: expenses for the specified month
 *   - savingsRatio: (income - expenses) / income * 100
 *   - recentTransactions: last 10 transactions
 *   - budgetProgress: budget items with spent/planned
 *   - alerts: computed alerts (budget threshold, expense spike, etc.)
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  const user = await validateApiKey(authHeader);

  if (!user) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });
  }
  if (!hasPermission(user, 'read')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get('month'); // YYYY-MM
  const now = new Date();
  const viewDate = monthParam
    ? new Date(parseInt(monthParam.split('-')[0]), parseInt(monthParam.split('-')[1]) - 1, 1)
    : now;

  // Get user's base currency
  const userRecord = await db.user.findUnique({
    where: { id: user.userId },
    select: { baseCurrency: true, preferredLang: true },
  });

  // Accounts
  const accounts = await db.account.findMany({
    where: { userId: user.userId },
  });

  // Compute net worth
  let totalAssets = 0;
  let totalLiabilities = 0;
  accounts.forEach(a => {
    if (a.accountType === 'liability') {
      totalLiabilities += Math.abs(a.currentBalance);
    } else if (a.accountType === 'asset' || a.accountType === 'investment') {
      totalAssets += a.currentBalance;
    }
  });
  const netWorth = totalAssets - totalLiabilities;

  // Transactions for the month
  const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const monthEnd = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0, 23, 59, 59);

  const monthTransactions = await db.transaction.findMany({
    where: {
      userId: user.userId,
      occurredOn: { gte: monthStart, lte: monthEnd },
    },
    include: { category: true },
    orderBy: { occurredOn: 'desc' },
  });

  let monthIncome = 0;
  let monthExpenses = 0;
  monthTransactions.forEach(tx => {
    if (tx.type === 'income') monthIncome += tx.amount;
    else if (tx.type === 'expense') monthExpenses += tx.amount;
  });

  const savings = monthIncome - monthExpenses;
  const savingsRatio = monthIncome > 0 ? (savings / monthIncome) * 100 : 0;

  // Recent transactions (last 10)
  const recentTransactions = await db.transaction.findMany({
    where: { userId: user.userId },
    orderBy: { occurredOn: 'desc' },
    take: 10,
    select: {
      id: true,
      type: true,
      amount: true,
      currency: true,
      description: true,
      occurredOn: true,
      category: { select: { name: true, nameEs: true, icon: true } },
    },
  });

  // Budget progress
  const budget = await db.budget.findFirst({
    where: { userId: user.userId },
    include: { items: { include: { category: true } } },
  });

  const budgetProgress = budget ? budget.items.map(item => {
    const spent = monthTransactions
      .filter(tx => tx.categoryId === item.categoryId && tx.type === 'expense')
      .reduce((sum, tx) => sum + tx.amount, 0);
    return {
      category: item.category?.name || 'Unknown',
      categoryEs: item.category?.nameEs || item.category?.name || 'Unknown',
      icon: item.category?.icon || '📦',
      planned: item.plannedAmount,
      spent,
      remaining: item.plannedAmount - spent,
      pct: item.plannedAmount > 0 ? (spent / item.plannedAmount) * 100 : 0,
      threshold: item.alertThresholdPct,
    };
  }) : [];

  // Simple alerts
  const alerts: { severity: string; message: string }[] = [];
  budgetProgress.forEach(bp => {
    if (bp.pct >= 100) {
      alerts.push({ severity: 'critical', message: `${bp.category}: budget exceeded (${bp.pct.toFixed(0)}%)` });
    } else if (bp.pct >= bp.threshold) {
      alerts.push({ severity: 'warning', message: `${bp.category}: approaching limit (${bp.pct.toFixed(0)}%)` });
    }
  });
  if (monthIncome > 0 && savingsRatio < 10) {
    alerts.push({ severity: 'warning', message: `Savings ratio is ${savingsRatio.toFixed(1)}% (below 10%)` });
  }

  return NextResponse.json({
    user: { email: user.email, name: user.name },
    baseCurrency: userRecord?.baseCurrency || 'USD',
    language: userRecord?.preferredLang || 'es',
    period: {
      month: viewDate.getMonth() + 1,
      year: viewDate.getFullYear(),
      label: new Intl.DateTimeFormat(userRecord?.preferredLang === 'es' ? 'es-DO' : 'en-US', { month: 'long', year: 'numeric' }).format(viewDate),
    },
    netWorth,
    totalAssets,
    totalLiabilities,
    monthIncome,
    monthExpenses,
    savings,
    savingsRatio: parseFloat(savingsRatio.toFixed(2)),
    transactionCount: monthTransactions.length,
    budgetProgress,
    alerts,
    recentTransactions: recentTransactions.map(tx => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      currency: tx.currency,
      description: tx.description,
      date: tx.occurredOn.toISOString().split('T')[0],
      category: tx.category?.name || null,
      categoryEs: tx.category?.nameEs || tx.category?.name || null,
    })),
  });
}
