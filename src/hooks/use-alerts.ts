'use client';

import { useMemo } from 'react';
import { useFinZenStore } from '@/store/finzen-store';
import { convertAmount, type CurrencyCode } from '@/lib/finzen/currency';

export interface Alert {
  id: string;
  type: 'budget_threshold' | 'expense_spike' | 'savings_suggestion' | 'cash_flow_forecast' | 'unusual_transaction';
  severity: 'info' | 'warning' | 'critical';
  titleEs: string;
  titleEn: string;
  messageEs: string;
  messageEn: string;
}

/**
 * Hook that computes the 5 alert rules from loaded transactions.
 * Runs entirely client-side using data already in the Zustand store.
 */
export function useAlerts(): Alert[] {
  const { transactions, budget, accounts, baseCurrency, categories } = useFinZenStore();

  return useMemo(() => {
    const alerts: Alert[] = [];
    const baseCur = baseCurrency as CurrencyCode;
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    // Helper: get transactions for a specific month
    const txsForMonth = (month: number, year: number) =>
      transactions.filter(tx => {
        const d = new Date(tx.occurredOn);
        return d.getMonth() === month && d.getFullYear() === year;
      });

    // Helper: sum expenses by category for a month (in base currency)
    const expensesByCategory = (month: number, year: number): Map<string, number> => {
      const map = new Map<string, number>();
      txsForMonth(month, year)
        .filter(tx => tx.type === 'expense' && tx.categoryId)
        .forEach(tx => {
          const v = convertAmount(tx.amount, tx.currency, baseCur);
          map.set(tx.categoryId!, (map.get(tx.categoryId!) ?? 0) + v);
        });
      return map;
    };

    // ── RULE 1: Budget Threshold
    // Alert when a budget item's spent exceeds its alertThresholdPct
    if (budget) {
      const currentExpenses = expensesByCategory(thisMonth, thisYear);
      budget.items.forEach(item => {
        const spent = currentExpenses.get(item.categoryId) ?? 0;
        const pct = item.plannedAmount > 0 ? (spent / item.plannedAmount) * 100 : 0;
        const cat = categories.find(c => c.id === item.categoryId);
        const catName = cat ? (cat.nameEs || cat.name) : '—';

        if (pct >= 100) {
          alerts.push({
            id: `budget_over_${item.id}`,
            type: 'budget_threshold',
            severity: 'critical',
            titleEs: `${catName}: presupuesto excedido`,
            titleEn: `${catName}: budget exceeded`,
            messageEs: `Has gastado ${pct.toFixed(0)}% del presupuesto (${spent.toFixed(0)} de ${item.plannedAmount.toFixed(0)}).`,
            messageEn: `You've spent ${pct.toFixed(0)}% of budget (${spent.toFixed(0)} of ${item.plannedAmount.toFixed(0)}).`,
          });
        } else if (pct >= item.alertThresholdPct) {
          alerts.push({
            id: `budget_warn_${item.id}`,
            type: 'budget_threshold',
            severity: 'warning',
            titleEs: `${catName}: ${pct.toFixed(0)}% del presupuesto`,
            titleEn: `${catName}: ${pct.toFixed(0)}% of budget`,
            messageEs: `Te queda ${(item.plannedAmount - spent).toFixed(0)} para este mes.`,
            messageEn: `You have ${(item.plannedAmount - spent).toFixed(0)} left this month.`,
          });
        }
      });
    }

    // ── RULE 2: Expense Spike
    // Compare current month's spending in each category vs. the 3-month average
    // Alert if current month spending is >50% above the 3-month average
    const currentExpenses = expensesByCategory(thisMonth, thisYear);
    const last3MonthsExpenses = new Map<string, number[]>();
    for (let i = 1; i <= 3; i++) {
      const d = new Date(thisYear, thisMonth - i, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      const exp = expensesByCategory(m, y);
      exp.forEach((val, catId) => {
        if (!last3MonthsExpenses.has(catId)) last3MonthsExpenses.set(catId, []);
        last3MonthsExpenses.get(catId)!.push(val);
      });
    }

    currentExpenses.forEach((currentSpent, catId) => {
      const history = last3MonthsExpenses.get(catId) || [];
      if (history.length < 2) return; // Need at least 2 months of history
      const avg = history.reduce((a, b) => a + b, 0) / history.length;
      if (avg < 100) return; // Skip tiny categories
      const pctIncrease = ((currentSpent - avg) / avg) * 100;
      if (pctIncrease > 50) {
        const cat = categories.find(c => c.id === catId);
        const catName = cat ? (cat.nameEs || cat.name) : '—';
        alerts.push({
          id: `spike_${catId}`,
          type: 'expense_spike',
          severity: 'warning',
          titleEs: `Pico de gasto en ${catName}`,
          titleEn: `Spending spike in ${catName}`,
          messageEs: `Gastaste ${pctIncrease.toFixed(0)}% más que el promedio de los últimos 3 meses (promedio: ${avg.toFixed(0)}, actual: ${currentSpent.toFixed(0)}).`,
          messageEn: `You spent ${pctIncrease.toFixed(0)}% more than the 3-month average (avg: ${avg.toFixed(0)}, current: ${currentSpent.toFixed(0)}).`,
        });
      }
    });

    // ── RULE 3: Savings Suggestion
    // If savings ratio this month < 10%, show suggestion
    const monthTx = txsForMonth(thisMonth, thisYear);
    let monthIncome = 0;
    let monthExpenses = 0;
    monthTx.forEach(tx => {
      const v = convertAmount(tx.amount, tx.currency, baseCur);
      if (tx.type === 'income') monthIncome += v;
      else if (tx.type === 'expense') monthExpenses += v;
    });
    const savingsRatio = monthIncome > 0 ? ((monthIncome - monthExpenses) / monthIncome) * 100 : 0;

    if (monthIncome > 0 && savingsRatio < 10) {
      alerts.push({
        id: 'savings_low',
        type: 'savings_suggestion',
        severity: monthIncome > 0 && monthExpenses >= monthIncome ? 'critical' : 'warning',
        titleEs: savingsRatio < 0 ? 'Gastos superan ingresos' : 'Ratio de ahorro bajo',
        titleEn: savingsRatio < 0 ? 'Expenses exceed income' : 'Low savings ratio',
        messageEs: savingsRatio < 0
          ? `Tus gastos (${monthExpenses.toFixed(0)}) superan tus ingresos (${monthIncome.toFixed(0)}) este mes.`
          : `Tu ratio de ahorro es ${savingsRatio.toFixed(1)}%. Considera reducir gastos para ahorrar al menos 10%.`,
        messageEn: savingsRatio < 0
          ? `Your expenses (${monthExpenses.toFixed(0)}) exceed your income (${monthIncome.toFixed(0)}) this month.`
          : `Your savings ratio is ${savingsRatio.toFixed(1)}%. Consider reducing spending to save at least 10%.`,
      });
    }

    // ── RULE 4: Cash Flow Forecast
    // Project end-of-month balance based on current spending rate
    if (monthExpenses > 0 && now.getDate() > 5) {
      const daysElapsed = now.getDate();
      const daysInMonth = new Date(thisYear, thisMonth + 1, 0).getDate();
      const dailyRate = monthExpenses / daysElapsed;
      const projectedExpenses = dailyRate * daysInMonth;
      const projectedBalance = monthIncome - projectedExpenses;

      if (projectedBalance < 0) {
        alerts.push({
          id: 'forecast_negative',
          type: 'cash_flow_forecast',
          severity: 'critical',
          titleEs: 'Pronóstico: saldo negativo a fin de mes',
          titleEn: 'Forecast: negative balance by month-end',
          messageEs: `Al ritmo actual, proyectas gastar ${projectedExpenses.toFixed(0)} y ganar ${monthIncome.toFixed(0)}, con un déficit de ${Math.abs(projectedBalance).toFixed(0)}.`,
          messageEn: `At current rate, you'll spend ${projectedExpenses.toFixed(0)} and earn ${monthIncome.toFixed(0)}, with a deficit of ${Math.abs(projectedBalance).toFixed(0)}.`,
        });
      } else if (projectedBalance < monthIncome * 0.1 && projectedBalance > 0) {
        alerts.push({
          id: 'forecast_tight',
          type: 'cash_flow_forecast',
          severity: 'info',
          titleEs: 'Pronóstico: mes ajustado',
          titleEn: 'Forecast: tight month ahead',
          messageEs: `Al ritmo actual, terminarás el mes con solo ${projectedBalance.toFixed(0)} de margen.`,
          messageEn: `At current rate, you'll end the month with only ${projectedBalance.toFixed(0)} of margin.`,
        });
      }
    }

    // ── RULE 5: Unusual Transaction
    // Alert if a single transaction is >3x the average for that category
    const currentMonthExpenses = monthTx.filter(tx => tx.type === 'expense' && tx.categoryId);
    const categoryAverages = new Map<string, number>();

    // Compute all-time average per category
    const categoryTotals = new Map<string, { sum: number; count: number }>();
    transactions
      .filter(tx => tx.type === 'expense' && tx.categoryId)
      .forEach(tx => {
        const v = convertAmount(tx.amount, tx.currency, baseCur);
        const existing = categoryTotals.get(tx.categoryId!) || { sum: 0, count: 0 };
        categoryTotals.set(tx.categoryId!, { sum: existing.sum + v, count: existing.count + 1 });
      });
    categoryTotals.forEach((val, catId) => {
      categoryAverages.set(catId, val.sum / val.count);
    });

    // Check this month's transactions for anomalies
    const alertedCats = new Set<string>();
    currentMonthExpenses.forEach(tx => {
      if (!tx.categoryId || alertedCats.has(tx.categoryId)) return;
      const avg = categoryAverages.get(tx.categoryId);
      if (!avg || avg < 50) return; // Skip small categories
      const amount = convertAmount(tx.amount, tx.currency, baseCur);
      if (amount > avg * 3) {
        const cat = categories.find(c => c.id === tx.categoryId);
        const catName = cat ? (cat.nameEs || cat.name) : '—';
        alertedCats.add(tx.categoryId);
        alerts.push({
          id: `unusual_${tx.id}`,
          type: 'unusual_transaction',
          severity: 'info',
          titleEs: `Transacción inusual en ${catName}`,
          titleEn: `Unusual transaction in ${catName}`,
          messageEs: `"${tx.description}" (${amount.toFixed(0)}) es ${(amount / avg).toFixed(1)}x el promedio de la categoría (${avg.toFixed(0)}).`,
          messageEn: `"${tx.description}" (${amount.toFixed(0)}) is ${(amount / avg).toFixed(1)}x the category average (${avg.toFixed(0)}).`,
        });
      }
    });

    return alerts;
  }, [transactions, budget, accounts, baseCurrency, categories]);
}
