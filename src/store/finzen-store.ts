'use client';

import { create } from 'zustand';
import type { Locale, CurrencyCode } from '@/lib/finzen/currency';

export type ViewKey =
  | 'dashboard'
  | 'transactions'
  | 'accounts'
  | 'budgets'
  | 'reports'
  | 'import'
  | 'settings';

export type TransactionType = 'income' | 'expense' | 'transfer' | 'adjustment';

// Types matching the database schema
// NOTE: `loadData` asigna JSON crudo de la API (any), por eso estos
// interfaces son la frontera de tipos del cliente — mantenerlos
// sincronizados con prisma/schema.prisma.
export interface Category {
  id: string;
  name: string;
  nameEs: string | null;
  nameEn: string | null;
  icon: string | null;
  color: string | null;
  direction: string;
  isSystem: boolean;
  sortOrder: number;
}

export interface Account {
  id: string;
  name: string;
  accountType: string;
  subType: string | null;
  currency: CurrencyCode;
  currentBalance: number;
  institution: string | null;
  lastFour: string | null;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: CurrencyCode;
  fromAccountId: string;
  toAccountId: string;
  categoryId: string | null;
  description: string | null;
  occurredOn: string;
  tags: string;
  importSource: string | null;
  category?: Category | null;
  fromAccount?: { id: string; name: string } | null;
  toAccount?: { id: string; name: string } | null;
}

export interface BudgetItem {
  id: string;
  categoryId: string;
  plannedAmount: number;
  alertThresholdPct: number;
  category?: Category | null;
}

export interface Budget {
  id: string;
  name: string;
  period: string;
  startDate: string;
  endDate: string;
  items: BudgetItem[];
}

interface FinZenState {
  // User settings
  locale: Locale;
  baseCurrency: CurrencyCode;
  themePref: 'light' | 'dark' | 'system';

  // UI state
  activeView: ViewKey;
  addSheetOpen: boolean;
  sidebarCollapsed: boolean;
  editingTransactionId: string | null;
  loading: boolean;

  // Server data
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  budget: Budget | null;

  // Actions
  setLocale: (l: Locale) => void;
  setBaseCurrency: (c: CurrencyCode) => void;
  setThemePref: (t: 'light' | 'dark' | 'system') => void;
  setActiveView: (v: ViewKey) => void;
  setAddSheetOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setEditingTransactionId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;

  // Data actions (server-synced)
  loadData: () => Promise<void>;
  addTransaction: (tx: any) => Promise<void>;
  updateTransaction: (id: string, patch: any) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addAccount: (account: any) => Promise<void>;
  updateAccount: (id: string, patch: any) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  addBudgetItem: (item: any) => Promise<void>;
  updateBudgetItem: (budgetId: string, itemId: string, patch: any) => Promise<void>;
  deleteBudgetItem: (id: string) => Promise<void>;
  addCategory: (cat: any) => Promise<void>;
  updateCategory: (id: string, patch: any) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  updatePreferences: (prefs: any) => Promise<void>;
  resetStore: () => void;
}

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Request failed');
  }
  return res.json();
}

export const useFinZenStore = create<FinZenState>((set, get) => ({
  // Settings
  locale: 'es',
  baseCurrency: 'USD',
  themePref: 'system',

  // UI
  activeView: 'dashboard',
  addSheetOpen: false,
  sidebarCollapsed: false,
  editingTransactionId: null,
  // [UX] Empieza en true: cubre desde el primer render hasta que loadData
  // resuelve — evita el flash de "¡Bienvenido! $0.00" con datos existentes.
  loading: true,

  // Data
  transactions: [],
  accounts: [],
  categories: [],
  budget: null,

  // UI Actions
  setLocale: (l) => set({ locale: l }),
  setBaseCurrency: (c) => set({ baseCurrency: c }),
  setThemePref: (t) => set({ themePref: t }),
  setActiveView: (v) => set({ activeView: v }),
  setAddSheetOpen: (open) => set({ addSheetOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setEditingTransactionId: (id) => set({ editingTransactionId: id }),
  setLoading: (loading) => set({ loading }),

  // Load all data from API
  loadData: async () => {
    set({ loading: true });
    try {
      const [accounts, transactions, categories, budgets, me] = await Promise.all([
        apiFetch('/api/accounts'),
        apiFetch('/api/transactions'),
        apiFetch('/api/categories'),
        apiFetch('/api/budgets'),
        apiFetch('/api/me'),
      ]);

      set({
        accounts,
        transactions,
        categories,
        budget: budgets[0] || null,
        locale: (me.preferredLang as Locale) || 'es',
        baseCurrency: (me.baseCurrency as CurrencyCode) || 'USD',
        themePref: (me.theme as 'light' | 'dark' | 'system') || 'system',
        loading: false,
      });
    } catch (err) {
      console.error('Failed to load data:', err);
      set({ loading: false });
    }
  },

  // Transaction CRUD
  addTransaction: async (tx) => {
    // Optimistic: add to local state immediately
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const optimistic = { ...tx, id: tempId, occurredOn: tx.occurredOn, tags: Array.isArray(tx.tags) ? tx.tags.join(',') : (tx.tags || ''), _optimistic: true } as any;
    set((s) => ({ transactions: [optimistic, ...s.transactions] }));
    try {
      const created = await apiFetch('/api/transactions', { method: 'POST', body: JSON.stringify(tx) });
      // Replace temp with real
      set((s) => ({ transactions: s.transactions.map((t) => t.id === tempId ? created : t) }));
    } catch (err) {
      // Rollback
      set((s) => ({ transactions: s.transactions.filter((t) => t.id !== tempId) }));
      throw err;
    }
  },

  updateTransaction: async (id, patch) => {
    // Optimistic: update local state immediately
    const prev = get().transactions.find((t) => t.id === id);
    if (prev) {
      set((s) => ({ transactions: s.transactions.map((t) => t.id === id ? { ...t, ...patch } : t) }));
    }
    try {
      const updated = await apiFetch(`/api/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      set((s) => ({ transactions: s.transactions.map((t) => t.id === id ? { ...t, ...updated } : t) }));
    } catch (err) {
      // Rollback
      if (prev) {
        set((s) => ({ transactions: s.transactions.map((t) => t.id === id ? prev : t) }));
      }
      throw err;
    }
  },

  deleteTransaction: async (id) => {
    // Optimistic: remove from local state immediately
    const prev = get().transactions.find((t) => t.id === id);
    set((s) => ({
      transactions: s.transactions.filter((t) => t.id !== id),
      editingTransactionId: s.editingTransactionId === id ? null : s.editingTransactionId,
    }));
    try {
      await apiFetch(`/api/transactions/${id}`, { method: 'DELETE' });
    } catch (err) {
      // Rollback: re-add the transaction
      if (prev) {
        set((s) => ({ transactions: [prev, ...s.transactions] }));
      }
      throw err;
    }
  },

  // Account CRUD
  addAccount: async (account) => {
    const created = await apiFetch('/api/accounts', {
      method: 'POST',
      body: JSON.stringify(account),
    });
    set((s) => ({ accounts: [...s.accounts, created] }));
  },

  updateAccount: async (id, patch) => {
    const updated = await apiFetch(`/api/accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    set((s) => ({
      accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...updated } : a)),
    }));
  },

  deleteAccount: async (id) => {
    await apiFetch(`/api/accounts/${id}`, { method: 'DELETE' });
    set((s) => ({
      accounts: s.accounts.filter((a) => a.id !== id),
      transactions: s.transactions.filter(
        (t) => t.fromAccountId !== id && t.toAccountId !== id
      ),
    }));
  },

  // Budget CRUD (simplified — creates a budget with items if none exists)
  addBudgetItem: async (item) => {
    const state = get();
    if (!state.budget) {
      // Create a new budget first
      const now = new Date();
      const budget = await apiFetch('/api/budgets', {
        method: 'POST',
        body: JSON.stringify({
          name: now.toLocaleString('en', { month: 'long', year: 'numeric' }),
          period: 'monthly',
          startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
          endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString(),
          items: [item],
        }),
      });
      set({ budget });
    } else {
      // Add item to existing budget (would need a separate endpoint)
      // For now, we'll just update locally
      set((s) => ({
        budget: s.budget ? {
          ...s.budget,
          items: [...s.budget.items, { id: `temp_${Date.now()}`, ...item }],
        } : null,
      }));
    }
  },

  deleteBudgetItem: async (id) => {
    const state = get();
    if (state.budget) {
      await apiFetch(`/api/budgets/${state.budget.id}/items/${id}`, { method: 'DELETE' });
    }
    set((s) => ({
      budget: s.budget ? {
        ...s.budget,
        items: s.budget.items.filter((i) => i.id !== id),
      } : null,
    }));
  },

  updateBudgetItem: async (budgetId, itemId, patch) => {
    await apiFetch(`/api/budgets/${budgetId}/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    set((s) => ({
      budget: s.budget ? {
        ...s.budget,
        items: s.budget.items.map((i) =>
          i.id === itemId ? { ...i, ...patch } : i
        ),
      } : null,
    }));
  },

  // Category CRUD
  addCategory: async (cat) => {
    const created = await apiFetch('/api/categories', {
      method: 'POST',
      body: JSON.stringify(cat),
    });
    set((s) => ({ categories: [...s.categories, created] }));
  },

  updateCategory: async (id, patch) => {
    const updated = await apiFetch(`/api/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    set((s) => ({
      categories: s.categories.map((c) => (c.id === id ? { ...c, ...updated } : c)),
    }));
  },

  deleteCategory: async (id) => {
    await apiFetch(`/api/categories/${id}`, { method: 'DELETE' });
    set((s) => ({
      categories: s.categories.filter((c) => c.id !== id),
    }));
  },

  // Update user preferences
  updatePreferences: async (prefs) => {
    await apiFetch('/api/me', {
      method: 'PATCH',
      body: JSON.stringify(prefs),
    });
    if (prefs.preferredLang) set({ locale: prefs.preferredLang as Locale });
    if (prefs.baseCurrency) set({ baseCurrency: prefs.baseCurrency as CurrencyCode });
    if (prefs.theme) set({ themePref: prefs.theme as 'light' | 'dark' | 'system' });
  },

  // Reset store on logout — clears all user data from memory
  resetStore: () => {
    set({
      transactions: [],
      accounts: [],
      categories: [],
      budget: null,
      activeView: 'dashboard',
      addSheetOpen: false,
      editingTransactionId: null,
      loading: false,
      // Keep locale, baseCurrency, themePref — they'll be reloaded on next login
    });
  },
}));
