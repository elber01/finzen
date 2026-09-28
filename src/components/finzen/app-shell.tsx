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
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export function AppShell() {
  const { activeView, sidebarCollapsed, loadData, loading, transactions, accounts } = useFinZenStore();

  // Load data from API on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Show loading state on first load
  if (loading && transactions.length === 0 && accounts.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />

      <MobileTopBar />

      <main
        className={cn(
          'min-h-screen pb-24 lg:pb-0',
          'lg:pl-[280px]',
          sidebarCollapsed && 'lg:pl-16'
        )}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          {activeView === 'dashboard' && <DashboardView />}
          {activeView === 'transactions' && <TransactionsView />}
          {activeView === 'accounts' && <AccountsView />}
          {activeView === 'budgets' && <BudgetsView />}
          {activeView === 'reports' && <ReportsView />}
          {activeView === 'import' && <ImportView />}
          {activeView === 'settings' && <SettingsView />}
        </div>
      </main>

      <BottomTabBar />
      <AddTransactionSheet />
    </div>
  );
}
