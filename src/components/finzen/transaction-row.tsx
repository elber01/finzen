'use client';

import { cn } from '@/lib/utils';
import { useFinZenStore } from '@/store/finzen-store';
import { translations } from '@/lib/finzen/i18n';
import { formatMoney, formatRelativeDate, type CurrencyCode } from '@/lib/finzen/currency';
import type { Transaction } from '@/store/finzen-store';

interface TransactionRowProps {
  tx: Transaction;
  onEdit?: (id: string) => void;
}

export function TransactionRow({ tx, onEdit }: TransactionRowProps) {
  const { categories, accounts, locale } = useFinZenStore();
  const t = translations[locale];

  const category = tx.categoryId ? categories.find((c) => c.id === tx.categoryId) : undefined;
  // Find the real account (not the virtual "x_categoryId" placeholder)
  const fromAccount = accounts.find((a) => a.id === tx.fromAccountId);
  const toAccount = accounts.find((a) => a.id === tx.toAccountId);
  const relevantAccount = fromAccount ?? toAccount;

  const isIncome = tx.type === 'income';
  const isTransfer = tx.type === 'transfer';
  const sign = isIncome ? '+' : isTransfer ? '' : '-';

  // Show amount in its ORIGINAL currency (not converted)
  const displayAmount = tx.amount;
  const displayCur = tx.currency as CurrencyCode;

  function handleClick() {
    if (onEdit) onEdit(tx.id);
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        'flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-surface-2 transition-colors',
        onEdit && 'cursor-pointer active:bg-surface-2'
      )}
      role={onEdit ? 'button' : undefined}
      tabIndex={onEdit ? 0 : undefined}
      onKeyDown={onEdit ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } } : undefined}
    >
      {/* Icon */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-base shrink-0"
        style={{
          background: category ? `${category.color}20` : 'var(--surface-2)',
          color: category?.color ?? 'var(--muted-foreground)',
        }}
      >
        {category?.icon ?? (isTransfer ? '🔄' : '💰')}
      </div>

      {/* Description + meta */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{tx.description}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
          <span>{category ? (locale === 'es' ? (category.nameEs || category.name) : (category.nameEn || category.name)) : t[`transactions.${tx.type}`]}</span>
          <span>·</span>
          <span>{formatRelativeDate(tx.occurredOn, locale)}</span>
          {relevantAccount && (
            <>
              <span>·</span>
              <span className="truncate">{relevantAccount.name}</span>
            </>
          )}
        </div>
      </div>

      {/* Amount — shown in the transaction's original currency */}
      <div
        className={cn(
          'text-sm font-semibold tabular-nums shrink-0 text-right whitespace-nowrap',
          isIncome ? 'text-income' : isTransfer ? 'text-foreground' : 'text-expense'
        )}
      >
        {sign}
        {formatMoney(displayAmount, displayCur, locale)}
      </div>
    </div>
  );
}
