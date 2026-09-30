'use client';

import { Home, Receipt, Plus, BarChart3, Settings, Wallet, PieChart, FileUp, Menu, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFinZenStore, type ViewKey } from '@/store/finzen-store';
import { translations } from '@/lib/finzen/i18n';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { signOut } from 'next-auth/react';
import { Separator } from '@/components/ui/separator';

type TabKey = 'nav.dashboard' | 'nav.transactions' | 'nav.reports' | 'nav.settings' | 'nav.accounts' | 'nav.budgets' | 'nav.import' | 'nav.more';

const LEFT_TABS: { view: ViewKey; icon: typeof Home; key: TabKey }[] = [
  { view: 'dashboard', icon: Home, key: 'nav.dashboard' },
  { view: 'transactions', icon: Receipt, key: 'nav.transactions' },
];

// [UX fix, auditoría P1-4] "Cuentas" era inaccesible en móvil — ahora es tab.
const RIGHT_TAB: { view: ViewKey; icon: typeof Home; key: TabKey } = {
  view: 'accounts',
  icon: Wallet,
  key: 'nav.accounts',
};

// Las vistas menos frecuentes viven en el sheet "Más".
const MORE_ITEMS: { view: ViewKey; icon: typeof Home; key: TabKey }[] = [
  { view: 'budgets', icon: PieChart, key: 'nav.budgets' },
  { view: 'reports', icon: BarChart3, key: 'nav.reports' },
  { view: 'import', icon: FileUp, key: 'nav.import' },
  { view: 'settings', icon: Settings, key: 'nav.settings' },
];
const MORE_VIEWS = MORE_ITEMS.map((i) => i.view);

export function BottomTabBar() {
  const { activeView, setActiveView, setAddSheetOpen, locale } = useFinZenStore();
  const [moreOpen, setMoreOpen] = useState(false);
  const t = translations[locale];

  function goTo(view: ViewKey) {
    setActiveView(view);
    setMoreOpen(false);
  }

  const tabClass = (active: boolean) =>
    cn(
      'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[64px]',
      active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
    );

  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur-lg border-t border-border h-[72px] px-2"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Bottom navigation"
      >
        <div className="flex items-center justify-around h-full max-w-md mx-auto">
          {LEFT_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeView === tab.view;
            return (
              <button
                key={tab.view}
                onClick={() => setActiveView(tab.view)}
                className={tabClass(active)}
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

          {/* Cuentas — antes inaccesible en móvil */}
          {(() => {
            const Icon = RIGHT_TAB.icon;
            const active = activeView === RIGHT_TAB.view;
            return (
              <button
                onClick={() => setActiveView(RIGHT_TAB.view)}
                className={tabClass(active)}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] font-medium">{t[RIGHT_TAB.key]}</span>
              </button>
            );
          })()}

          {/* Más — abre sheet con Presupuestos / Reportes / Importar / Ajustes */}
          <button
            onClick={() => setMoreOpen(true)}
            className={tabClass(MORE_VIEWS.includes(activeView))}
            aria-current={MORE_VIEWS.includes(activeView) ? 'page' : undefined}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
          >
            <Menu className="w-5 h-5" />
            <span className="text-[11px] font-medium">{t['nav.more']}</span>
          </button>
        </div>
      </nav>

      {/* Sheet "Más" */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="h-auto pb-6 rounded-t-xl sm:m-auto sm:max-w-md">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-base">{t['nav.more']}</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2 px-1">
            {MORE_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeView === item.view;
              return (
                <button
                  key={item.view}
                  onClick={() => goTo(item.view)}
                  className={cn(
                    'flex flex-col items-center gap-2 py-5 rounded-xl border transition-colors active:scale-[0.98]',
                    active
                      ? 'border-primary/40 bg-primary/5 text-primary'
                      : 'border-border bg-surface hover:bg-surface-2 text-foreground'
                  )}
                >
                  <Icon className="w-6 h-6" />
                  <span className="text-sm font-medium">{t[item.key]}</span>
                </button>
              );
            })}
          </div>
          <Separator className="my-3" />
          <button
            onClick={() => {
              setMoreOpen(false);
              signOut({ callbackUrl: '/login' });
            }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-expense hover:bg-expense-soft transition-colors active:scale-[0.98]"
          >
            <LogOut className="w-4 h-4" />
            {t['nav.logout']}
          </button>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function MobileTopBar() {
  const { locale, setLocale } = useFinZenStore();
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
