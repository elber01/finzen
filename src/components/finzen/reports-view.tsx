'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download } from 'lucide-react';
import { useFinZenStore } from '@/store/finzen-store';
import { translations } from '@/lib/finzen/i18n';
import { convertAmount, formatMoney, type CurrencyCode } from '@/lib/finzen/currency';

export function ReportsView() {
  const { transactions, categories, locale, baseCurrency } = useFinZenStore();
  const t = translations[locale];

  const [range, setRange] = useState<'6m' | '1y' | 'all'>('1y');

  const filteredTx = useMemo(() => {
    const now = new Date();
    return transactions.filter((tx) => {
      const d = new Date(tx.occurredOn);
      if (range === '6m') return d >= new Date(now.getFullYear(), now.getMonth() - 5, 1);
      if (range === '1y') return d.getFullYear() === now.getFullYear();
      return true;
    });
  }, [transactions, range]);

  const totals = useMemo(() => {
    let income = 0;
    let expenses = 0;
    for (const tx of filteredTx) {
      const v = convertAmount(tx.amount, tx.currency, baseCurrency as CurrencyCode);
      if (tx.type === 'income') income += v;
      else if (tx.type === 'expense') expenses += v;
    }
    return { income, expenses, savings: income - expenses, ratio: income > 0 ? ((income - expenses) / income) * 100 : 0 };
  }, [filteredTx, baseCurrency]);

  const topCategories = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of filteredTx) {
      if (tx.type !== 'expense' || !tx.categoryId) continue;
      const v = convertAmount(tx.amount, tx.currency, baseCurrency as CurrencyCode);
      map.set(tx.categoryId, (map.get(tx.categoryId) ?? 0) + v);
    }
    return Array.from(map.entries())
      .map(([id, amount]) => {
        const cat = categories.find((c) => c.id === id);
        return {
          name: cat ? (locale === 'es' ? (cat.nameEs || cat.name) : (cat.nameEn || cat.name)) : 'Other',
          icon: cat?.icon ?? '📦',
          color: cat?.color ?? '#6B7280',
          amount,
          pct: totals.expenses > 0 ? (amount / totals.expenses) * 100 : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [filteredTx, categories, baseCurrency, locale, totals]);

  const chartData = useMemo(() => {
    const baseCur = baseCurrency as CurrencyCode;
    const now = new Date();
    const intlLocale = locale === 'es' ? 'es-DO' : 'en-US';
    const months: { key: string; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = new Intl.DateTimeFormat(intlLocale, { month: 'short' }).format(d);
      months.push({ key, label });
    }
    return months.map(({ key, label }) => {
      let income = 0;
      let expenses = 0;
      for (const tx of transactions) {
        const d = new Date(tx.occurredOn);
        const txKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (txKey !== key) continue;
        const v = convertAmount(tx.amount, tx.currency, baseCur);
        if (tx.type === 'income') income += v;
        else if (tx.type === 'expense') expenses += v;
      }
      return { month: label, income, expenses };
    });
  }, [transactions, baseCurrency, locale]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">{t['reports.title']}</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border overflow-hidden">
            {(['6m', '1y', 'all'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  range === r ? 'bg-primary text-primary-foreground' : 'hover:bg-surface-2'
                }`}
              >
                {r === '6m' ? '6M' : r === '1y' ? '1Y' : locale === 'es' ? 'Todo' : 'All'}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-1.5" />
            {t['reports.export']}
          </Button>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">{t['reports.totalIncome']}</div>
          <div className="text-xl sm:text-2xl font-bold tabular-nums text-income mt-1">
            {formatMoney(totals.income, baseCurrency as CurrencyCode, locale)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">{t['reports.totalExpenses']}</div>
          <div className="text-xl sm:text-2xl font-bold tabular-nums text-expense mt-1">
            {formatMoney(totals.expenses, baseCurrency as CurrencyCode, locale)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">{t['reports.netSavings']}</div>
          <div className="text-xl sm:text-2xl font-bold tabular-nums mt-1">
            {formatMoney(totals.savings, baseCurrency as CurrencyCode, locale)}
          </div>
          <div className="text-xs text-muted-foreground">{totals.ratio.toFixed(1)}%</div>
        </Card>
      </div>

      {/* Income vs Expenses chart */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold mb-4">{t['reports.incomeVsExpenses']}</h2>
        <div className="h-60 sm:h-72 w-full overflow-x-auto scroll-area">
          <div className="h-full min-w-[500px] sm:min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={50}
              />
              <YAxis
                tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                width={50}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
              />
              <Tooltip
                cursor={{ fill: 'var(--surface-2)' }}
                contentStyle={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => formatMoney(v, baseCurrency as CurrencyCode, locale)}
              />
              <Bar dataKey="income" fill="var(--income)" radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Bar dataKey="expenses" fill="var(--expense)" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>
        <div className="flex gap-4 mt-2 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: 'var(--income)' }} />
            {t['dashboard.income']}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: 'var(--expense)' }} />
            {t['dashboard.expenses']}
          </span>
        </div>
      </Card>

      {/* Top categories */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold mb-4">{t['reports.topCategories']}</h2>
        <div className="space-y-3">
          {topCategories.map((cat, i) => (
            <div key={cat.name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}.</span>
                  <span>{cat.icon}</span>
                  <span className="font-medium">{cat.name}</span>
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {formatMoney(cat.amount, baseCurrency as CurrencyCode, locale)} · {cat.pct.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${cat.pct}%`, background: cat.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
