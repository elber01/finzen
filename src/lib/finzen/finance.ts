import type { CurrencyCode } from './currency';
import { convertAmount } from './currency';

/**
 * Compute net worth from a list of accounts.
 * - asset, investment, equity → ADD to net worth
 * - liability → SUBTRACT from net worth (uses absolute value of balance)
 * - income, expense → IGNORE (these are virtual category accounts, not real accounts)
 *
 * @param accounts Array of accounts with accountType, currentBalance, currency
 * @param baseCurrency The base currency to convert to
 * @returns Net worth in base currency
 */
export function computeNetWorth(
  accounts: { accountType: string; currentBalance: number; currency: string }[],
  baseCurrency: CurrencyCode
): number {
  return accounts.reduce((sum, a) => {
    const converted = convertAmount(a.currentBalance, a.currency as CurrencyCode, baseCurrency);
    switch (a.accountType) {
      case 'asset':
      case 'investment':
      case 'equity':
        return sum + converted;
      case 'liability':
        // Liabilities are stored as positive numbers representing debt.
        // Subtract the absolute value from net worth.
        return sum - Math.abs(converted);
      default:
        // income, expense — these are virtual, not real accounts
        return sum;
    }
  }, 0);
}

/**
 * Compute total assets (only asset + investment accounts).
 */
export function computeTotalAssets(
  accounts: { accountType: string; currentBalance: number; currency: string }[],
  baseCurrency: CurrencyCode
): number {
  return accounts
    .filter(a => a.accountType === 'asset' || a.accountType === 'investment')
    .reduce((sum, a) => sum + convertAmount(a.currentBalance, a.currency as CurrencyCode, baseCurrency), 0);
}

/**
 * Compute total liabilities (only liability accounts).
 * Returns a positive number representing total debt.
 */
export function computeTotalLiabilities(
  accounts: { accountType: string; currentBalance: number; currency: string }[],
  baseCurrency: CurrencyCode
): number {
  return accounts
    .filter(a => a.accountType === 'liability')
    .reduce((sum, a) => sum + Math.abs(convertAmount(a.currentBalance, a.currency as CurrencyCode, baseCurrency)), 0);
}
