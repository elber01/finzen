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

// ────────────────────────────────────────────────────────────────────────
// Flujos mensuales & historia de net worth — datos REALES (sin placeholders)
// ────────────────────────────────────────────────────────────────────────

interface FlowTx {
  type: string;
  amount: number;
  currency: string;
  occurredOn: string | Date;
}

export interface MonthlyFlow {
  /** YYYY-MM */
  key: string;
  year: number;
  /** 0-11 */
  month: number;
  income: number;
  expenses: number;
  /** income - expenses */
  net: number;
}

/**
 * Flujos (income/expense convertidos a baseCurrency) agregados por mes natural,
 * para los últimos `months` meses terminando en `endMonth`/`endYear` inclusive.
 * Las transferencias entre cuentas reales no alteran el net worth → se ignoran.
 */
export function computeMonthlyFlows(
  transactions: FlowTx[],
  baseCurrency: CurrencyCode,
  months: number,
  endYear: number,
  endMonth: number
): MonthlyFlow[] {
  const buckets = new Map<string, MonthlyFlow>();
  const flows: MonthlyFlow[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(endYear, endMonth - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const flow: MonthlyFlow = { key, year: d.getFullYear(), month: d.getMonth(), income: 0, expenses: 0, net: 0 };
    buckets.set(key, flow);
    flows.push(flow);
  }
  for (const tx of transactions) {
    if (tx.type !== 'income' && tx.type !== 'expense') continue;
    const d = new Date(tx.occurredOn);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const flow = buckets.get(key);
    if (!flow) continue; // fuera de la ventana
    const v = convertAmount(tx.amount, tx.currency as CurrencyCode, baseCurrency);
    if (tx.type === 'income') flow.income += v;
    else flow.expenses += v;
  }
  for (const flow of flows) flow.net = flow.income - flow.expenses;
  return flows;
}

/**
 * Reconstruye la historia del net worth hacia atrás a partir del valor actual:
 * netWorth(M) = netWorthActual − Σ flujos netos de los meses POSTERIORES a M.
 * Aproximación válida porque cada income/expense mueve cuentas reales
 * (double-entry) y las transferencias reales netean a cero.
 */
export function computeNetWorthHistory(
  currentNetWorth: number,
  flows: MonthlyFlow[]
): number[] {
  const history: number[] = [];
  let remaining = currentNetWorth;
  for (let i = flows.length - 1; i >= 0; i--) {
    history[i] = remaining;
    remaining -= flows[i].net;
  }
  return history;
}

/**
 * Variación porcentual mes-vs-mes-anterior.
 * `undefined` cuando no hay base de comparación (mes anterior = 0) —
 * mostrar "+0%" inventado engaña al usuario.
 */
export function computeDelta(current: number, previous: number): number | undefined {
  if (previous === 0) return undefined;
  return ((current - previous) / Math.abs(previous)) * 100;
}
