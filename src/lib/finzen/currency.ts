export type CurrencyCode = 'USD' | 'DOP' | 'EUR' | 'USDT' | 'BTC';
import { formatRelativeDateSafe } from './date-utils';

export type Locale = 'es' | 'en';

export const CURRENCIES: Record<
  CurrencyCode,
  { symbol: string; name: string; decimals: number; color: string }
> = {
  USD: { symbol: '$', name: 'US Dollar', decimals: 2, color: 'var(--info)' },
  DOP: { symbol: 'RD$', name: 'Dominican Peso', decimals: 2, color: 'var(--warning)' },
  EUR: { symbol: '€', name: 'Euro', decimals: 2, color: 'var(--primary)' },
  USDT: { symbol: '₮', name: 'Tether', decimals: 2, color: 'var(--usdt)' },
  BTC: { symbol: '₿', name: 'Bitcoin', decimals: 8, color: 'var(--btc)' },
};

// Approximate static FX rates relative to USD (for demo only)
export const FX_RATES: Record<CurrencyCode, number> = {
  USD: 1,
  DOP: 60.5,
  EUR: 0.92,
  USDT: 1,
  BTC: 0.0000145, // 1 USD ≈ 0.0000145 BTC
};

export function convertAmount(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode
): number {
  if (from === to) return amount;
  const usd = amount / FX_RATES[from];
  return usd * FX_RATES[to];
}

export function formatMoney(
  amount: number,
  currency: CurrencyCode,
  locale: Locale = 'es',
  opts?: { showSymbol?: boolean; compact?: boolean }
): string {
  const { showSymbol = true, compact = false } = opts ?? {};
  const meta = CURRENCIES[currency];
  const intlLocale = locale === 'es' ? 'es-DO' : 'en-US';

  if (compact && Math.abs(amount) >= 1000) {
    const formatted = new Intl.NumberFormat(intlLocale, {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
    return showSymbol ? `${meta.symbol}${formatted}` : formatted;
  }

  const formatted = new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  }).format(Math.abs(amount));

  const sign = amount < 0 ? '-' : '';
  if (!showSymbol) return `${sign}${formatted}`;
  return `${sign}${meta.symbol}${formatted}`;
}

export function formatDate(date: Date | string, locale: Locale = 'es'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const intlLocale = locale === 'es' ? 'es-DO' : 'en-US';
  return new Intl.DateTimeFormat(intlLocale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatRelativeDate(
  date: Date | string,
  locale: Locale = 'es'
): string {
  // Use the safe version that never shows negative days
  return formatRelativeDateSafe(date, locale);
}
