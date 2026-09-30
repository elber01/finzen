'use client';

import { useEffect } from 'react';
import { useFinZenStore } from '@/store/finzen-store';
import { Sidebar } from './sidebar';
import { BottomTabBar, MobileTopBar } from './bottom-tab-bar';
import { AddTransactionSheet } from './add-transaction-sheet';
import { DashboardView } from './dashboard-view';
import { TransactionsView } from './transactions-view';
import { AccountsView } from './accounts-view';
import { BudgetsView } from './budgets-view';
import { ReportsView } from './reports-view';
import { ImportView } from './import-view';
import { SettingsView } from './settings-view';
import { ViewTransition } from './view-transition';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const VIEWS = {
  dashboard: DashboardView,
  transactions: TransactionsView,
  accounts: AccountsView,
  budgets: BudgetsView,
  reports: ReportsView,
  import: ImportView,
  settings: SettingsView,
} as const;

export function AppShell() {
  const { activeView, sidebarCollapsed, loadData, loading, transactions, accounts } = useFinZenStore();

  // Load data from API on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Show loading state on first load
  if (loading && transactions.length === 0 && accounts.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" role="status" aria-label="Cargando">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const ActiveView = VIEWS[activeView];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:rounded-md focus:bg-primary focus:text-primary-foreground focus:text-sm focus:font-medium focus:shadow-lg"
      >
        Saltar al contenido principal
      </a>

      <Sidebar />

      <MobileTopBar />

      <main
        id="main-content"
        className={cn(
          'min-h-screen pb-24 lg:pb-0',
          'lg:pl-[280px]',
          sidebarCollapsed && 'lg:pl-16'
        )}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <ViewTransition key={activeView}>
            <ActiveView />
          </ViewTransition>
        </div>
      </main>

      <BottomTabBar />
      <AddTransactionSheet />
    </div>
  );
}
