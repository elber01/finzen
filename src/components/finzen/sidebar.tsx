'use client';

import {
  LayoutDashboard,
  Receipt,
  Wallet,
  Target,
  BarChart3,
  Download,
  Settings,
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight,
  Languages,
  LogOut,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useFinZenStore, type ViewKey } from '@/store/finzen-store';
import { translations, type TranslationKey } from '@/lib/finzen/i18n';

const NAV_ITEMS: { view: ViewKey; icon: typeof LayoutDashboard; key: TranslationKey }[] = [
  { view: 'dashboard', icon: LayoutDashboard, key: 'nav.dashboard' },
  { view: 'transactions', icon: Receipt, key: 'nav.transactions' },
  { view: 'accounts', icon: Wallet, key: 'nav.accounts' },
  { view: 'budgets', icon: Target, key: 'nav.budgets' },
  { view: 'reports', icon: BarChart3, key: 'nav.reports' },
  { view: 'import', icon: Download, key: 'nav.import' },
  { view: 'settings', icon: Settings, key: 'nav.settings' },
];

export function Sidebar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { data: session } = useSession();
  const { activeView, setActiveView, sidebarCollapsed, toggleSidebar, locale, setLocale } =
    useFinZenStore();
  const t = translations[locale];

  // Datos reales de sesión — nada de placeholders
  const userName = session?.user?.name || session?.user?.email || '—';
  const userEmail = session?.user?.email || '';
  const userInitial = userName.charAt(0).toUpperCase() || 'U';

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  return (
    <aside
      className={cn(
        'hidden lg:flex fixed inset-y-0 left-0 z-30 flex-col bg-surface border-r border-border transition-[width] duration-200',
        sidebarCollapsed ? 'w-16' : 'w-[280px]'
      )}
      aria-label="Sidebar navigation"
    >
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-border">
        {!sidebarCollapsed && (
          <span className="text-xl sm:text-2xl font-bold text-primary tracking-tight">FinZen</span>
        )}
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-md hover:bg-surface-2 text-muted-foreground"
          aria-label="Toggle sidebar"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Session info — datos reales de la sesión activa */}
      {!sidebarCollapsed && session?.user && (
        <div className="p-3 border-b border-border">
          <div className="px-3 py-2 rounded-md bg-surface-2 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{userName}</div>
              <div className="text-xs text-muted-foreground truncate">{userEmail}</div>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => setActiveView(item.view)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors relative',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
                sidebarCollapsed && 'justify-center'
              )}
              title={sidebarCollapsed ? t[item.key] : undefined}
              aria-current={active ? 'page' : undefined}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-primary" />
              )}
              <Icon className="w-5 h-5 shrink-0" />
              {!sidebarCollapsed && <span>{t[item.key]}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer: theme + lang + user */}
      <div className="p-2 border-t border-border space-y-1">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-surface-2',
            sidebarCollapsed && 'justify-center'
          )}
          aria-label="Toggle theme"
        >
          {mounted && theme === 'dark' ? (
            <Sun className="w-5 h-5" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
          {!sidebarCollapsed && (
            <span>{mounted && theme === 'dark' ? t['nav.lightMode'] : t['nav.darkMode']}</span>
          )}
        </button>

        <button
          onClick={() => setLocale(locale === 'es' ? 'en' : 'es')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-surface-2',
            sidebarCollapsed && 'justify-center'
          )}
          aria-label="Switch language"
        >
          <Languages className="w-5 h-5" />
          {!sidebarCollapsed && (
            <span>{locale === 'es' ? 'English' : 'Español'}</span>
          )}
        </button>

        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-expense-soft hover:text-expense transition-colors',
            sidebarCollapsed && 'justify-center'
          )}
          aria-label={t['nav.logout']}
          title={sidebarCollapsed ? t['nav.logout'] : undefined}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!sidebarCollapsed && <span>{t['nav.logout']}</span>}
        </button>
      </div>
    </aside>
  );
}
