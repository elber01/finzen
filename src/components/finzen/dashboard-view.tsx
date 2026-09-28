'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Lightbulb, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useFinZenStore } from '@/store/finzen-store';
import { translations } from '@/lib/finzen/i18n';
import {
  convertAmount,
  formatMoney,
  type CurrencyCode,
} from '@/lib/finzen/currency';
import { computeNetWorth } from '@/lib/finzen/finance';
import { KpiCard } from '@/components/finzen/kpi-card';
import { TransactionRow } from '@/components/finzen/transaction-row';
import { useAlerts } from '@/hooks/use-alerts';

export function DashboardView() {
  const { transactions, accounts, categories, locale, baseCurrency, setActiveView, setAddSheetOpen, setEditingTransactionId, loading } =
    useFinZenStore();
  const t = translations[locale];
  const alerts = useAlerts();

  function handleEditTx(id: string) {
    setEditingTransactionId(id);
    setAddSheetOpen(true);
  }

  // Dashboard month selector — allows viewing any month
  const [selectedMonth, setSelectedMonth] = useState<string>(''); // YYYY-MM, empty = current month
  const viewDate = selectedMonth
    ? new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]) - 1, 1)
    : new Date();

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return t['dashboard.greeting.morning'];
    if (h < 18) return t['dashboard.greeting.afternoon'];
    return t['dashboard.greeting.evening'];
  }, [t]);

  // ── Compute KPIs (selected month, in base currency)
  const monthTransactions = transactions.filter((tx) => {
    const d = new Date(tx.occurredOn);
    return d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear();
  });

  const totals = useMemo(() => {
    let income = 0;
    let expenses = 0;
    for (const tx of monthTransactions) {
      const converted = convertAmount(tx.amount, tx.currency, baseCurrency);
      if (tx.type === 'income') income += converted;
      else if (tx.type === 'expense') expenses += converted;
    }
    const savings = income - expenses;
    const ratio = income > 0 ? (savings / income) * 100 : 0;
    return { income, expenses, savings, ratio };
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  }, [monthTransactions, baseCurrency]);

  // Net worth = sum of all account balances (converted to base currency)
  const netWorth = useMemo(
    () => computeNetWorth(accounts, baseCurrency as CurrencyCode),
    [accounts, baseCurrency]
  );

  // ── Expense distribution by category (this month, in base currency)
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of monthTransactions) {
      if (tx.type !== 'expense' || !tx.categoryId) continue;
      const converted = convertAmount(tx.amount, tx.currency, baseCurrency);
      map.set(tx.categoryId, (map.get(tx.categoryId) ?? 0) + converted);
    }
    const result = Array.from(map.entries())
      .map(([catId, amount]) => {
        const cat = categories.find((c) => c.id === catId);
        return {
          name: cat ? (locale === 'es' ? (cat.nameEs || cat.name) : (cat.nameEn || cat.name)) : 'Other',
          value: amount,
          color: cat?.color ?? '#6B7280',
          icon: cat?.icon ?? '📦',
        };
      })
      .sort((a, b) => b.value - a.value);
    return result;
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  }, [monthTransactions, categories, baseCurrency, locale]);

  // ── Cash flow chart data — 12 months, computed from real transactions
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const cashFlowData = useMemo(() => {
    const baseCur = baseCurrency as CurrencyCode;
    const now = viewDate;
    const intlLocale = locale === 'es' ? 'es-DO' : 'en-US';
    const months: { key: string; label: string }[] = [];
    for (let i = 11; i >= 0; i--) {
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

  // ── Recent transactions (top 5)
  const recent = [...transactions]
    .sort((a, b) => new Date(b.occurredOn).getTime() - new Date(a.occurredOn).getTime())
    .slice(0, 5);

  // [UX fix, auditoría P2-8] Mientras cargan los datos (login o recarga), mostrar
  // skeletons en lugar del estado vacío — evita el susto de "perdí mis datos".
  // (Colocado tras TODOS los hooks para respetar rules-of-hooks.)
  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Cargando panel">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-36 w-full rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Greeting header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{greeting}</h1>
          <p className="text-sm text-muted-foreground">
            {formatMoney(netWorth, baseCurrency, locale)} {baseCurrency}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={selectedMonth || `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-9 text-xs rounded-md border border-border bg-surface-2 px-2 text-foreground"
            aria-label={locale === 'es' ? 'Seleccionar mes' : 'Select month'}
          />
          {selectedMonth && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedMonth('')}
              className="h-9 text-xs"
            >
              {locale === 'es' ? 'Hoy' : 'Today'}
            </Button>
          )}
          <Button onClick={() => setAddSheetOpen(true)} className="h-10">
            + {t['nav.add']}
          </Button>
        </div>
      </div>

      {/* Empty state — no accounts yet */}
      {accounts.length === 0 && transactions.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">👋</span>
          </div>
          <h2 className="text-xl font-bold mb-2">
            {locale === 'es' ? '¡Bienvenido a FinZen!' : 'Welcome to FinZen!'}
          </h2>
          <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
            {locale === 'es'
              ? 'Tu base de datos está limpia. Comienza creando tu primera cuenta para registrar transacciones y ver tus finanzas crecer.'
              : 'Your database is clean. Start by creating your first account to record transactions and watch your finances grow.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button onClick={() => setActiveView('accounts')}>
              {locale === 'es' ? '➕ Crear cuenta' : '➕ Create account'}
            </Button>
            <Button variant="outline" onClick={() => setAddSheetOpen(true)}>
              {locale === 'es' ? 'Registrar transacción' : 'Record transaction'}
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* Hero: Net Worth */}
          <KpiCard
            label={t['dashboard.netWorth']}
            amount={formatMoney(netWorth, baseCurrency, locale)}
            delta={netWorth > 0 ? '+0%' : undefined}
            deltaDirection={netWorth > 0 ? 'up' : 'neutral'}
            size="hero"
            sparkData={[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, netWorth]}
            color="primary"
          />

          {/* Three KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              label={t['dashboard.income']}
              amount={formatMoney(totals.income, baseCurrency, locale)}
              delta={totals.income > 0 ? '+0%' : undefined}
              deltaDirection={totals.income > 0 ? 'up' : 'neutral'}
              color="income"
            />
            <KpiCard
              label={t['dashboard.expenses']}
              amount={formatMoney(totals.expenses, baseCurrency, locale)}
              delta={totals.expenses > 0 ? '0%' : undefined}
              deltaDirection="neutral"
              color="expense"
            />
            <KpiCard
              label={t['dashboard.savingsRatio']}
              amount={`${totals.ratio.toFixed(1)}%`}
              delta={totals.ratio > 0 ? '+0%' : undefined}
              deltaDirection={totals.ratio > 0 ? 'up' : 'neutral'}
              color="income"
              suffix={t['dashboard.savingsTarget']}
            />
          </div>

          {/* Cash flow chart */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{t['dashboard.cashFlow']}</h2>
              <span className="text-xs text-muted-foreground">12 {locale === 'es' ? 'meses' : 'months'}</span>
            </div>
            <div className="h-56 sm:h-64 w-full overflow-x-auto scroll-area">
              <div className="h-full min-w-[500px] sm:min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cashFlowData} barGap={2}>
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
                    formatter={(v: number) => formatMoney(v, baseCurrency, locale)}
                  />
                  <Bar dataKey="income" fill="var(--income)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="expenses" fill="var(--expense)" radius={[4, 4, 0, 0]} maxBarSize={32} />
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

          {/* Distribution + Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Expense distribution donut */}
            <Card className="p-5 lg:col-span-1">
              <h2 className="text-lg font-semibold mb-4">{t['dashboard.expenseDistribution']}</h2>
              {categoryBreakdown.length > 0 ? (
                <>
                  <div className="h-48 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryBreakdown}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={2}
                          stroke="none"
                        >
                          {categoryBreakdown.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          formatter={(v: number) => formatMoney(v, baseCurrency, locale)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-xs text-muted-foreground">{t['dashboard.expenses']}</span>
                      <span className="text-xl font-bold tabular-nums">
                        {formatMoney(totals.expenses, baseCurrency, locale, { compact: true })}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {categoryBreakdown.slice(0, 4).map((c) => (
                      <div key={c.name} className="flex items-center gap-2 text-xs">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: c.color }}
                        />
                        <span className="flex-1 truncate">
                          {c.icon} {c.name}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {((c.value / totals.expenses) * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                  {t['transactions.noTransactions']}
                </div>
              )}
            </Card>

            {/* Alerts */}
            <Card className="p-5 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  {t['dashboard.alerts']} ({alerts.length})
                </h2>
              </div>
              {alerts.length > 0 ? (
                <div className="space-y-2">
                  {alerts.map((alert) => {
                    const Icon =
                      alert.severity === 'critical'
                        ? AlertTriangle
                        : alert.type === 'cash_flow_forecast'
                        ? (alert.severity === 'critical' ? TrendingDown : TrendingUp)
                        : alert.type === 'expense_spike'
                        ? TrendingUp
                        : Lightbulb;
                    const iconColor =
                      alert.severity === 'critical'
                        ? 'var(--expense)'
                        : alert.severity === 'warning'
                        ? 'var(--warning)'
                        : 'var(--info)';
                    return (
                      <div
                        key={alert.id}
                        className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-surface-2 transition-colors"
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: `${iconColor}20`, color: iconColor }}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">
                            {locale === 'es' ? alert.titleEs : alert.titleEn}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {locale === 'es' ? alert.messageEs : alert.messageEn}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {locale === 'es'
                    ? 'No hay alertas. ¡Todo bajo control! ✓'
                    : 'No alerts. All under control! ✓'}
                </div>
              )}
            </Card>
          </div>

          {/* Recent transactions */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">{t['dashboard.recentTransactions']}</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveView('transactions')}
                className="text-primary"
              >
                {t['dashboard.viewAll']}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            {recent.length > 0 ? (
              <div className="space-y-0.5">
                {recent.map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} onEdit={handleEditTx} />
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {t['transactions.noTransactions']}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
