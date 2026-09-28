import type { CurrencyCode } from './currency';

export type TransactionType = 'income' | 'expense' | 'transfer' | 'adjustment';

export interface Category {
  id: string;
  name: string;
  nameEs: string;
  nameEn: string;
  icon: string;
  color: string;
  direction: 'income' | 'expense' | 'transfer';
}

export interface Member {
  id: string;
  displayName: string;
  avatarColor: string;
}

export interface Account {
  id: string;
  name: string;
  subType: 'checking' | 'savings' | 'credit_card' | 'cash' | 'crypto_wallet' | 'investment';
  currency: CurrencyCode;
  currentBalance: number;
  institution?: string;
  lastFour?: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: CurrencyCode;
  fromAccountId: string;
  toAccountId: string;
  categoryId?: string;
  memberId: string;
  description: string;
  occurredOn: string; // ISO date
  tags: string[];
  importSource?: 'manual' | 'csv' | 'ocr' | 'plaid' | 'recurring';
}

export interface Budget {
  id: string;
  name: string;
  period: 'monthly' | 'quarterly' | 'annual';
  startDate: string;
  endDate: string;
  items: BudgetItem[];
}

export interface BudgetItem {
  id: string;
  categoryId: string;
  plannedAmount: number;
  currency: CurrencyCode;
  alertThresholdPct: number;
}

export interface Alert {
  id: string;
  type: 'budget_threshold' | 'expense_spike' | 'savings_suggestion' | 'cash_flow_forecast';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  titleEs: string;
  message: string;
  messageEs: string;
}

// ────────────────────────────────────────────────────────────────
// SEED DATA — CLEAN START (all zeros, no transactions)
// User can build their financial picture from scratch.
// ────────────────────────────────────────────────────────────────

export const SEED_MEMBERS: Member[] = [
  { id: 'm_me', displayName: 'Me', avatarColor: '#1E3A5F' },
];

export const SEED_CATEGORIES: Category[] = [
  // Income
  { id: 'c_salary', name: 'Salary', nameEs: 'Salario', nameEn: 'Salary', icon: '💼', color: '#059669', direction: 'income' },
  { id: 'c_passive', name: 'Passive Income', nameEs: 'Ingreso Pasivo', nameEn: 'Passive Income', icon: '📈', color: '#10B981', direction: 'income' },
  { id: 'c_freelance', name: 'Freelance', nameEs: 'Freelance', nameEn: 'Freelance', icon: '💻', color: '#14B8A6', direction: 'income' },
  { id: 'c_refund', name: 'Refund', nameEs: 'Reembolso', nameEn: 'Refund', icon: '↩️', color: '#22C55E', direction: 'income' },
  // Expense
  { id: 'c_housing', name: 'Housing', nameEs: 'Vivienda', nameEn: 'Housing', icon: '🏠', color: '#1E3A5F', direction: 'expense' },
  { id: 'c_food', name: 'Food', nameEs: 'Comida', nameEn: 'Food', icon: '🍔', color: '#F59E0B', direction: 'expense' },
  { id: 'c_transport', name: 'Transport', nameEs: 'Transporte', nameEn: 'Transport', icon: '🚇', color: '#3B82F6', direction: 'expense' },
  { id: 'c_leisure', name: 'Leisure', nameEs: 'Ocio', nameEn: 'Leisure', icon: '🎬', color: '#A855F7', direction: 'expense' },
  { id: 'c_utilities', name: 'Utilities', nameEs: 'Servicios', nameEn: 'Utilities', icon: '⚡', color: '#EF4444', direction: 'expense' },
  { id: 'c_health', name: 'Health', nameEs: 'Salud', nameEn: 'Health', icon: '🏥', color: '#EC4899', direction: 'expense' },
  { id: 'c_shopping', name: 'Shopping', nameEs: 'Compras', nameEn: 'Shopping', icon: '🛍️', color: '#F97316', direction: 'expense' },
  { id: 'c_invest', name: 'Investment', nameEs: 'Inversión', nameEn: 'Investment', icon: '₿', color: '#F7931A', direction: 'expense' },
  { id: 'c_other', name: 'Other', nameEs: 'Otros', nameEn: 'Other', icon: '📦', color: '#6B7280', direction: 'expense' },
];

// Empty accounts list — user creates their own accounts in the app
export const SEED_ACCOUNTS: Account[] = [];

// Empty transactions — clean slate
export const SEED_TRANSACTIONS: Transaction[] = [];

// Empty budget — user sets their own budget items
export const SEED_BUDGET: Budget = {
  id: 'b_current',
  name: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
  period: 'monthly',
  startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
  endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10),
  items: [],
};

// No alerts until the user has data
export const SEED_ALERTS: Alert[] = [];

// Empty cash-flow history (will be filled as user adds transactions)
export const CASH_FLOW_HISTORY = [
  { month: 'Jan', monthEs: 'Ene', income: 0, expenses: 0 },
  { month: 'Feb', monthEs: 'Feb', income: 0, expenses: 0 },
  { month: 'Mar', monthEs: 'Mar', income: 0, expenses: 0 },
  { month: 'Apr', monthEs: 'Abr', income: 0, expenses: 0 },
  { month: 'May', monthEs: 'May', income: 0, expenses: 0 },
  { month: 'Jun', monthEs: 'Jun', income: 0, expenses: 0 },
];

// Flat net-worth sparkline at zero
export const NET_WORTH_HISTORY = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
