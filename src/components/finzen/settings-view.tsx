'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import {
  User,
  Users,
  Tags,
  ShieldCheck,
  Building2,
  Palette,
  Globe,
  Moon,
  Download,
  Trash2,
  LogOut,
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useFinZenStore } from '@/store/finzen-store';
import { translations } from '@/lib/finzen/i18n';
import { CURRENCIES, type CurrencyCode, type Locale } from '@/lib/finzen/currency';
import { cn } from '@/lib/utils';
import { CategoriesManager } from '@/components/finzen/categories-manager';
import { ApiKeyManager } from '@/components/finzen/api-key-manager';

export function SettingsView() {
  const { locale, setLocale, baseCurrency, setBaseCurrency, resetStore } = useFinZenStore();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const t = translations[locale];

  const items = [
    { icon: User, label: t['settings.profile'], value: locale === 'es' ? 'Mi perfil' : 'My profile' },
    { icon: Users, label: t['settings.household'], value: locale === 'es' ? 'Mi Hogar · 1 miembro' : 'My Household · 1 member' },
    { icon: Tags, label: t['settings.categories'], value: `13 ${locale === 'es' ? 'categorías' : 'categories'}` },
    {
      icon: ShieldCheck,
      label: t['settings.security'],
      value: `2FA · WebAuthn · 1 ${locale === 'es' ? 'sesión' : 'session'}`,
    },
    {
      icon: Building2,
      label: t['settings.bankConnections'],
      value: locale === 'es' ? 'Sin conexiones activas' : 'No active connections',
    },
  ];

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-xl sm:text-2xl font-bold">{t['settings.title']}</h1>

      {/* Account items */}
      <Card className="p-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-surface-2 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-surface-2 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-xs text-muted-foreground truncate">{item.value}</div>
              </div>
            </button>
          );
        })}
      </Card>

      {/* Appearance */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">{t['settings.appearance']}</h2>
        </div>

        {/* Theme */}
        <div className="mb-4">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
            <Moon className="w-3 h-3" />
            {t['settings.theme']}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['light', 'dark', 'system'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setTheme(mode)}
                className={cn(
                  'h-10 rounded-md border text-sm font-medium transition-colors',
                  mounted && theme === mode
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-surface-2'
                )}
              >
                {mode === 'light' ? t['common.light'] : mode === 'dark' ? t['common.dark'] : t['common.system']}
              </button>
            ))}
          </div>
        </div>

        {/* Language */}
        <div className="mb-4">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
            <Globe className="w-3 h-3" />
            {t['settings.language']}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['es', 'en'] as Locale[]).map((l) => (
              <button
                key={l}
                onClick={() => setLocale(l)}
                className={cn(
                  'h-10 rounded-md border text-sm font-medium transition-colors',
                  locale === l
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-surface-2'
                )}
              >
                {l === 'es' ? '🇪🇸 Español' : '🇬🇧 English'}
              </button>
            ))}
          </div>
        </div>

        {/* Base currency */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
            {t['settings.currency']}
          </label>
          <Select
            value={baseCurrency}
            onValueChange={(v) => setBaseCurrency(v as CurrencyCode)}
          >
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CURRENCIES).map(([code, meta]) => (
                <SelectItem key={code} value={code}>
                  <span className="flex items-center gap-2">
                    <span style={{ color: meta.color }}>{meta.symbol}</span>
                    {code} — {meta.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Category Management */}
      <CategoriesManager />

      {/* AI Agent Integration */}
      <ApiKeyManager />

      {/* Data & danger zone */}
      <Card className="p-2">
        <button className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-surface-2 transition-colors text-left">
          <div className="w-9 h-9 rounded-lg bg-surface-2 flex items-center justify-center shrink-0">
            <Download className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">{t['settings.dataExport']}</div>
            <div className="text-xs text-muted-foreground">CSV · JSON</div>
          </div>
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-expense-soft transition-colors text-left group">
          <div className="w-9 h-9 rounded-lg bg-expense-soft flex items-center justify-center shrink-0">
            <Trash2 className="w-4 h-4 text-expense" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-expense">{t['settings.deleteAccount']}</div>
            <div className="text-xs text-muted-foreground">
              {locale === 'es' ? 'Elimina permanentemente todos tus datos' : 'Permanently delete all your data'}
            </div>
          </div>
        </button>
      </Card>

      {/* Logout */}
      <Card className="p-2">
        <button
          onClick={() => { resetStore(); signOut({ callbackUrl: '/login' }); }}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-surface-2 transition-colors text-left"
        >
          <div className="w-9 h-9 rounded-lg bg-surface-2 flex items-center justify-center shrink-0">
            <LogOut className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">{locale === 'es' ? 'Cerrar sesión' : 'Sign out'}</div>
            <div className="text-xs text-muted-foreground">{locale === 'es' ? 'Salir de tu cuenta' : 'Sign out of your account'}</div>
          </div>
        </button>
      </Card>

      {/* Footer */}
      <div className="text-center text-xs text-muted-foreground py-2">
        FinZen v2.0.0 · SQLite + Auth
      </div>
    </div>
  );
}
