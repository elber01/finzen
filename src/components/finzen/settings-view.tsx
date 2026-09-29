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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useTheme } from 'next-themes';
import { useSession, signOut } from 'next-auth/react';
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
  FileText,
  Database,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { useFinZenStore } from '@/store/finzen-store';
import { translations } from '@/lib/finzen/i18n';
import { CURRENCIES, type CurrencyCode, type Locale } from '@/lib/finzen/currency';
import { cn } from '@/lib/utils';
import { CategoriesManager } from '@/components/finzen/categories-manager';
import { ApiKeyManager } from '@/components/finzen/api-key-manager';

// [UX fix, auditoría P2-2] Las filas de cuenta eran botones muertos: ahora son
// acordeones con información REAL de la sesión y del store.
export function SettingsView() {
  const { locale, setLocale, baseCurrency, setBaseCurrency, categories, accounts, transactions, resetStore } = useFinZenStore();
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => setMounted(true), []);
  const t = translations[locale];

  // [UX fix, auditoría P2-2] Exportar datos desde Ajustes: era un botón muerto.
  // Misma lógica probada del Import Center (export completo, sin filtros).
  function exportData(format: 'csv' | 'json') {
    if (transactions.length === 0 && accounts.length === 0) {
      toast.error(locale === 'es' ? 'No hay datos' : 'No data');
      return;
    }
    let content: string; let mime: string; let ext: string;
    if (format === 'json') {
      content = JSON.stringify({ exportedAt: new Date().toISOString(), accounts, transactions }, null, 2);
      mime = 'application/json'; ext = 'json';
    } else {
      const h = ['Date', 'Type', 'Amount', 'Currency', 'Description', 'Category', 'Account'];
      const rows = transactions.map((tx) => {
        const cat = categories.find((c) => c.id === tx.categoryId);
        const acct = accounts.find((a) => a.id === tx.fromAccountId) ?? accounts.find((a) => a.id === tx.toAccountId);
        return [new Date(tx.occurredOn).toISOString().split('T')[0], tx.type, String(tx.amount), tx.currency,
          `"${(tx.description || '').replace(/"/g, '""')}"`,
          `"${cat ? (locale === 'es' ? (cat.nameEs || cat.name) : (cat.nameEn || cat.name)) : ''}"`,
          `"${acct?.name ?? ''}"`].join(',');
      });
      content = [h.join(','), ...rows].join('\n');
      mime = 'text/csv'; ext = 'csv';
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finzen-export-${new Date().toISOString().split('T')[0]}.${ext}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(locale === 'es' ? `Exportado ${format.toUpperCase()}` : `Exported ${format.toUpperCase()}`);
  }

  // [UX fix, auditoría P2-2] Eliminar cuenta: era un botón muerto sin confirmación.
  // Ahora: DELETE /api/me (cascada) + confirmación explícita + logout.
  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      const res = await fetch('/api/me', { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      resetStore();
      toast.success(locale === 'es' ? 'Cuenta eliminada. Adiós 👋' : 'Account deleted. Bye 👋');
      signOut({ callbackUrl: '/login' });
    } catch (err) {
      toast.error(locale === 'es' ? 'No se pudo eliminar la cuenta' : 'Failed to delete account', {
        description: String(err),
      });
      setDeleting(false);
    }
  }

  function InfoRow({ label, value }: { label: string; value: string }) {
    return (
      <div className="flex items-center justify-between py-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-medium text-right break-all min-w-0 pl-4">{value}</span>
      </div>
    );
  }

  function ComingSoon() {
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-surface-2 text-muted-foreground shrink-0">
        {locale === 'es' ? 'Próximamente' : 'Soon'}
      </span>
    );
  }

  const items = [
    {
      icon: User,
      label: t['settings.profile'],
      subtitle: session?.user?.name || (locale === 'es' ? 'Mi perfil' : 'My profile'),
      content: (
        <div className="divide-y divide-border">
          <InfoRow label={locale === 'es' ? 'Nombre' : 'Name'} value={session?.user?.name || '—'} />
          <InfoRow label="Email" value={session?.user?.email || '—'} />
          <InfoRow label={locale === 'es' ? 'Idioma' : 'Language'} value={locale === 'es' ? '🇪🇸 Español' : '🇬🇧 English'} />
          <InfoRow label={locale === 'es' ? 'Moneda base' : 'Base currency'} value={`${CURRENCIES[baseCurrency as CurrencyCode].symbol} ${baseCurrency}`} />
        </div>
      ),
    },
    {
      icon: Users,
      label: t['settings.household'],
      subtitle: locale === 'es' ? `Mi Hogar · ${1} ${1 === 1 ? 'miembro' : 'miembros'}` : `My Household · 1 member`,
      content: (
        <div className="text-sm text-muted-foreground space-y-2">
          <InfoRow label={locale === 'es' ? 'Miembros' : 'Members'} value={session?.user?.name || '—'} />
          <p>{locale === 'es' ? 'La gestión multi-miembro (invitar a tu familia, asignar transacciones) está en desarrollo.' : 'Multi-member management (invite your family, assign transactions) is in development.'}</p>
          <ComingSoon />
        </div>
      ),
    },
    {
      icon: Tags,
      label: t['settings.categories'],
      subtitle: `${categories.length} ${locale === 'es' ? 'categorías' : 'categories'}`,
      content: (
        <div className="text-sm text-muted-foreground space-y-2">
          <p>{locale === 'es' ? 'Gestiona, edita y crea categorías en la sección de esta misma página.' : 'Manage, edit and create categories in the section below on this page.'}</p>
        </div>
      ),
    },
    {
      icon: ShieldCheck,
      label: t['settings.security'],
      subtitle: '2FA · WebAuthn',
      content: (
        <div className="divide-y divide-border">
          <InfoRow label={locale === 'es' ? 'Contraseñas' : 'Passwords'} value={locale === 'es' ? 'bcrypt (12 rounds)' : 'bcrypt (12 rounds)'} />
          <InfoRow label={locale === 'es' ? 'Sesiones' : 'Sessions'} value={locale === 'es' ? 'JWT en cookies httpOnly' : 'JWT in httpOnly cookies'} />
          <div className="pt-2"><ComingSoon /><span className="text-xs text-muted-foreground ml-1.5">{locale === 'es' ? '2FA y passkeys en desarrollo' : '2FA & passkeys in development'}</span></div>
        </div>
      ),
    },
    {
      icon: Building2,
      label: t['settings.bankConnections'],
      subtitle: locale === 'es' ? 'Sin conexiones activas' : 'No active connections',
      content: (
        <div className="text-sm text-muted-foreground space-y-2">
          <p>{locale === 'es' ? 'Importación automática desde tu banco vía Plaid.' : 'Automatic bank import via Plaid.'}</p>
          <ComingSoon />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-xl sm:text-2xl font-bold">{t['settings.title']}</h1>

      {/* Account items — acordeones con contenido real */}
      <Card className="px-4">
        <Accordion type="single" collapsible className="w-full">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <AccordionItem key={item.label} value={item.label} className="border-border">
                <AccordionTrigger className="py-3 hover:no-underline group">
                  <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <div className="w-9 h-9 rounded-lg bg-surface-2 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium group-hover:no-underline">{item.label}</div>
                      <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200" />
                </AccordionTrigger>
                <AccordionContent className="pb-4 pt-1">{item.content}</AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
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
      <Card className="px-4 py-2">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="export" className="border-border">
            <AccordionTrigger className="py-3 hover:no-underline group">
              <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
                <div className="w-9 h-9 rounded-lg bg-surface-2 flex items-center justify-center shrink-0">
                  <Download className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{t['settings.dataExport']}</div>
                  <div className="text-xs text-muted-foreground">CSV · JSON</div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 pt-1">
              <p className="text-xs text-muted-foreground mb-3">
                {locale === 'es'
                  ? 'Descarga todas tus cuentas y transacciones (sin filtros).'
                  : 'Download all your accounts and transactions (no filters).'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => exportData('csv')}>
                  <FileText className="w-4 h-4 mr-1.5" />CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportData('json')}>
                  <Database className="w-4 h-4 mr-1.5" />JSON
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>

      <Card className="p-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-expense-soft transition-colors text-left group" disabled={deleting}>
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
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {locale === 'es' ? '¿Eliminar tu cuenta para siempre?' : 'Delete your account forever?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {locale === 'es'
                  ? 'Se eliminarán TODAS tus cuentas, transacciones, presupuestos, categorías y claves API. Esta acción NO se puede deshacer. Exporta tus datos primero si quieres conservarlos.'
                  : 'ALL your accounts, transactions, budgets, categories and API keys will be deleted. This action CANNOT be undone. Export your data first if you want to keep it.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>
                {locale === 'es' ? 'Cancelar' : 'Cancel'}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); handleDeleteAccount(); }}
                className="bg-expense text-white hover:bg-expense/90"
                disabled={deleting}
              >
                {deleting
                  ? (locale === 'es' ? 'Eliminando…' : 'Deleting…')
                  : (locale === 'es' ? 'Sí, eliminar todo' : 'Yes, delete everything')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
        FinZen v2.0.0 · Turso + Auth
      </div>
    </div>
  );
}
