'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Download, Filter } from 'lucide-react';
import { useFinZenStore } from '@/store/finzen-store';
import { translations } from '@/lib/finzen/i18n';
import { toast } from 'sonner';
import {
  convertAmount,
  formatMoney,
  type CurrencyCode,
} from '@/lib/finzen/currency';
import { TransactionRow } from '@/components/finzen/transaction-row';

type DateFilter = 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'last_year' | 'all' | 'specific_month';

export function TransactionsView() {
  const { transactions, categories, accounts, locale, baseCurrency, setAddSheetOpen, setEditingTransactionId } = useFinZenStore();
  const members = [{ id: 'me', displayName: 'Me', avatarColor: '#1E3A5F' }];
  const t = translations[locale];

  function handleEditTx(id: string) {
    setEditingTransactionId(id);
    setAddSheetOpen(true);
  }

  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [specificMonth, setSpecificMonth] = useState<string>(''); // YYYY-MM format
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [memberFilter, setMemberFilter] = useState<string>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    const now = new Date();
    return transactions
      .filter((tx) => {
        // Date filter
        const d = new Date(tx.occurredOn);
        switch (dateFilter) {
          case 'this_month':
            if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
            break;
          case 'last_month': {
            const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            if (d.getMonth() !== lm.getMonth() || d.getFullYear() !== lm.getFullYear()) return false;
            break;
          }
          case 'this_quarter': {
            // Quarter: Q1=Jan-Mar(0-2), Q2=Apr-Jun(3-5), Q3=Jul-Sep(6-8), Q4=Oct-Dec(9-11)
            const q = Math.floor(now.getMonth() / 3);
            const tq = Math.floor(d.getMonth() / 3);
            if (tq !== q || d.getFullYear() !== now.getFullYear()) return false;
            break;
          }
          case 'this_year':
            if (d.getFullYear() !== now.getFullYear()) return false;
            break;
          case 'last_year':
            if (d.getFullYear() !== now.getFullYear() - 1) return false;
            break;
          case 'all':
            // No date filter
            break;
          case 'specific_month': {
            if (!specificMonth) return false;
            const [year, month] = specificMonth.split('-').map(Number);
            if (d.getMonth() !== month - 1 || d.getFullYear() !== year) return false;
            break;
          }
        }
        // Category
        if (categoryFilter !== 'all' && tx.categoryId !== categoryFilter) return false;
        // Member
        if (memberFilter !== 'all' && tx.memberId !== memberFilter) return false;
        // Account
        if (accountFilter !== 'all' && tx.fromAccountId !== accountFilter && tx.toAccountId !== accountFilter) return false;
        // Search
        if (search && !tx.description.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => new Date(b.occurredOn).getTime() - new Date(a.occurredOn).getTime());
  }, [transactions, dateFilter, specificMonth, categoryFilter, memberFilter, accountFilter, search]);

  // Group by day
  const grouped = useMemo(() => {
    const groups: { label: string; items: typeof filtered }[] = [];
    let currentLabel = '';
    for (const tx of filtered) {
      const d = new Date(tx.occurredOn);
      const today = new Date();
      const isToday = d.toDateString() === today.toDateString();
      const isYesterday =
        d.toDateString() === new Date(today.getTime() - 86400000).toDateString();
      const label = isToday
        ? t['transactions.today']
        : isYesterday
        ? t['transactions.yesterday']
        : d.toLocaleDateString(locale === 'es' ? 'es-DO' : 'en-US', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          });
      if (label !== currentLabel) {
        groups.push({ label, items: [] });
        currentLabel = label;
      }
      groups[groups.length - 1].items.push(tx);
    }
    return groups;
  }, [filtered, t, locale]);

  // Totals
  const totals = useMemo(() => {
    let income = 0;
    let expenses = 0;
    for (const tx of filtered) {
      const v = convertAmount(tx.amount, tx.currency, baseCurrency as CurrencyCode);
      if (tx.type === 'income') income += v;
      else if (tx.type === 'expense') expenses += v;
    }
    return { income, expenses, count: filtered.length };
  }, [filtered, baseCurrency]);

  function exportFiltered(format: 'csv' | 'json') {
    if (filtered.length === 0) { toast.error(locale === 'es' ? 'No hay transacciones para exportar' : 'No transactions to export'); return; }
    let content: string; let mime: string; let ext: string;
    if (format === 'json') {
      content = JSON.stringify({ exportedAt: new Date().toISOString(), filterApplied: { dateFilter, categoryFilter, search }, transactions: filtered }, null, 2);
      mime = 'application/json'; ext = 'json';
    } else {
      const h = ['Date','Type','Amount','Currency','Description','Category','Account'];
      const rows = filtered.map((tx) => {
        const cat = categories.find(c => c.id === tx.categoryId);
        const acct = accounts.find(a => a.id === tx.fromAccountId) ?? accounts.find(a => a.id === tx.toAccountId);
        return [new Date(tx.occurredOn).toISOString().split('T')[0], tx.type, String(tx.amount), tx.currency, `"${(tx.description||'').replace(/"/g,'""')}"`, `"${cat ? (locale==='es'?(cat.nameEs||cat.name):(cat.nameEn||cat.name)) : ''}"`, `"${acct?.name ?? ''}"`].join(',');
      });
      content = [h.join(','), ...rows].join('\n'); mime = 'text/csv'; ext = 'csv';
    }
    const blob = new Blob([content], { type: mime }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `finzen-filtered-${new Date().toISOString().split('T')[0]}.${ext}`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    toast.success(locale === 'es' ? `${filtered.length} exportadas como ${format.toUpperCase()}` : `${filtered.length} exported as ${format.toUpperCase()}`);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">{t['transactions.title']}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportFiltered('csv')}>
            <Download className="w-4 h-4 mr-1.5" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportFiltered('json')}>
            <Download className="w-4 h-4 mr-1.5" />
            JSON
          </Button>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">{t['dashboard.income']}</div>
          <div className="text-lg font-bold tabular-nums text-income">
            {formatMoney(totals.income, baseCurrency as CurrencyCode, locale)}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">{t['dashboard.expenses']}</div>
          <div className="text-lg font-bold tabular-nums text-expense">
            {formatMoney(totals.expenses, baseCurrency as CurrencyCode, locale)}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">#</div>
          <div className="text-lg font-bold tabular-nums">{totals.count}</div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-3 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t['transactions.search']}
            className="pl-9 h-10"
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 *:min-w-0">
          <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
            <SelectTrigger className="h-9 text-xs w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">{t['transactions.thisMonth']}</SelectItem>
              <SelectItem value="last_month">{t['transactions.lastMonth']}</SelectItem>
              <SelectItem value="this_quarter">{t['transactions.thisQuarter']}</SelectItem>
              <SelectItem value="this_year">{t['transactions.thisYear']}</SelectItem>
              <SelectItem value="last_year">{t['transactions.lastYear']}</SelectItem>
              <SelectItem value="all">{locale === 'es' ? 'Todos' : 'All'}</SelectItem>
              <SelectItem value="specific_month">{locale === 'es' ? 'Mes específico...' : 'Specific month...'}</SelectItem>
            </SelectContent>
          </Select>
          {dateFilter === 'specific_month' && (
            <Input
              type="month"
              value={specificMonth}
              onChange={(e) => setSpecificMonth(e.target.value)}
              className="h-9 text-xs w-auto"
            />
          )}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-9 text-xs w-full">
              <Filter className="w-3 h-3 mr-1" />
              <SelectValue placeholder={t['transactions.allCategories']} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t['transactions.allCategories']}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.icon} {locale === 'es' ? (c.nameEs || c.name) : (c.nameEn || c.name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={memberFilter} onValueChange={setMemberFilter}>
            <SelectTrigger className="h-9 text-xs w-full">
              <SelectValue placeholder={t['transactions.allMembers']} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t['transactions.allMembers']}</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="h-9 text-xs w-full">
              <SelectValue placeholder={t['transactions.allAccounts']} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t['transactions.allAccounts']}</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* List */}
      <Card className="p-2">
        {grouped.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-12">
            {t['transactions.noTransactions']}
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.map((group) => (
              <div key={group.label}>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 py-1.5">
                  {group.label}
                </div>
                <div className="space-y-0.5">
                  {group.items.map((tx) => (
                    <TransactionRow
                      key={tx.id}
                      tx={tx}
                      onEdit={handleEditTx}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="text-xs text-center text-muted-foreground">
        {t['transactions.showing']} {filtered.length} {t['transactions.of']} {transactions.length}
      </div>
    </div>
  );
}
