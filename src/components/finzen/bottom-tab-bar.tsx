'use client';

import { Home, Receipt, Plus, BarChart3, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFinZenStore, type ViewKey } from '@/store/finzen-store';
import { translations } from '@/lib/finzen/i18n';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

const TABS: { view: ViewKey; icon: typeof Home; key: 'nav.dashboard' | 'nav.transactions' | 'nav.reports' | 'nav.settings' }[] = [
  { view: 'dashboard', icon: Home, key: 'nav.dashboard' },
  { view: 'transactions', icon: Receipt, key: 'nav.transactions' },
  { view: 'reports', icon: BarChart3, key: 'nav.reports' },
  { view: 'settings', icon: Settings, key: 'nav.settings' },
];

export function BottomTabBar() {
  const { activeView, setActiveView, setAddSheetOpen, locale, setLocale } = useFinZenStore();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const t = translations[locale];

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur-lg border-t border-border h-[72px] px-2"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Bottom navigation"
    >
      <div className="flex items-center justify-around h-full max-w-md mx-auto">
        {TABS.slice(0, 2).map((tab) => {
          const Icon = tab.icon;
          const active = activeView === tab.view;
          return (
            <button
              key={tab.view}
              onClick={() => setActiveView(tab.view)}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[64px]',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[11px] font-medium">{t[tab.key]}</span>
            </button>
          );
        })}

        {/* Center FAB */}
        <button
          onClick={() => setAddSheetOpen(true)}
          className="relative -mt-8 w-14 h-14 rounded-full bg-primary text-white shadow-lg flex items-center justify-center transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          aria-label={t['nav.add']}
        >
          <Plus className="w-6 h-6" />
        </button>

        {TABS.slice(2).map((tab) => {
          const Icon = tab.icon;
          const active = activeView === tab.view;
          return (
            <button
              key={tab.view}
              onClick={() => setActiveView(tab.view)}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[64px]',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[11px] font-medium">{t[tab.key]}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function MobileTopBar() {
  const { locale, setLocale, theme: _t } = useFinZenStore();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  return (
    <header className="lg:hidden sticky top-0 z-30 bg-surface/95 backdrop-blur-lg border-b border-border">
      <div className="flex items-center justify-between h-14 px-4">
        <span className="text-lg font-bold text-primary">FinZen</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setLocale(locale === 'es' ? 'en' : 'es')}
            className="px-2 py-1 rounded-md hover:bg-surface-2 text-xs font-semibold"
            aria-label="Switch language"
          >
            {locale === 'es' ? 'EN' : 'ES'}
          </button>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-md hover:bg-surface-2"
            aria-label="Toggle theme"
          >
            {mounted && theme === 'dark' ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
