'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Wallet, CreditCard, Banknote, Bitcoin, Coins, PiggyBank, Plus, Building2, Pencil, Trash2 } from 'lucide-react';
import { useFinZenStore } from '@/store/finzen-store';
import { translations } from '@/lib/finzen/i18n';
import { CURRENCIES, formatMoney, convertAmount, type CurrencyCode } from '@/lib/finzen/currency';
import { computeNetWorth, computeTotalAssets, computeTotalLiabilities } from '@/lib/finzen/finance';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const SUB_TYPE_META: Record<string, { icon: typeof Wallet; label: string; labelEs: string }> = {
  checking: { icon: Wallet, label: 'Checking', labelEs: 'Cuenta corriente' },
  savings: { icon: PiggyBank, label: 'Savings', labelEs: 'Ahorros' },
  credit_card: { icon: CreditCard, label: 'Credit Card', labelEs: 'Tarjeta de crédito' },
  cash: { icon: Banknote, label: 'Cash', labelEs: 'Efectivo' },
  crypto_wallet: { icon: Bitcoin, label: 'Crypto Wallet', labelEs: 'Billetera cripto' },
  investment: { icon: Coins, label: 'Investment', labelEs: 'Inversión' },
};
const SUB_TYPES = Object.keys(SUB_TYPE_META);

export function AccountsView() {
  const { accounts, locale, baseCurrency, transactions, addAccount, updateAccount, deleteAccount } = useFinZenStore();
  const t = translations[locale];
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [subType, setSubType] = useState('checking');
  const [accountType, setAccountType] = useState('asset');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [balance, setBalance] = useState('');
  const [institution, setInstitution] = useState('');

  function resetForm() { setName(''); setSubType('checking'); setAccountType('asset'); setCurrency('USD'); setBalance(''); setInstitution(''); }
  function openCreate() { resetForm(); setEditingId(null); setCreateOpen(true); }
  function openEdit(id: string) {
    const a = accounts.find(x => x.id === id); if (!a) return;
    setEditingId(id); setName(a.name); setSubType(a.subType || 'checking');
    setAccountType(a.accountType || 'asset');
    setCurrency(a.currency as CurrencyCode); setBalance(String(a.currentBalance));
    setInstitution(a.institution || ''); setCreateOpen(true);
  }
  function closeDialog() { setCreateOpen(false); setEditingId(null); setTimeout(resetForm, 200); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error(locale === 'es' ? 'Nombre requerido' : 'Name required'); return; }
    const payload = { name: name.trim(), subType, accountType, currency, currentBalance: Number(balance.replace(',', '.')) || 0, institution: institution.trim() || undefined };
    try {
      if (editingId) { await updateAccount(editingId, payload); toast.success(locale === 'es' ? 'Cuenta actualizada' : 'Account updated'); }
      else { await addAccount(payload); toast.success(locale === 'es' ? 'Cuenta creada' : 'Account created'); }
      closeDialog();
    } catch (err) { toast.error(String(err).replace('Error: ', '')); }
  }

  async function handleDelete(id: string) {
    const linkedTx = transactions.filter(tx => tx.fromAccountId === id || tx.toAccountId === id).length;
    try {
      await deleteAccount(id);
      toast.success(locale === 'es' ? `Cuenta eliminada${linkedTx > 0 ? ` (y ${linkedTx} transacciones)` : ''}` : `Account deleted${linkedTx > 0 ? ` (and ${linkedTx} transactions)` : ''}`);
    } catch (err) { toast.error(locale === 'es' ? 'Error al eliminar' : 'Failed to delete'); }
  }

  const totalByCurrency = accounts.reduce((m, a) => {
    const val = a.accountType === 'liability' ? -Math.abs(a.currentBalance) : a.currentBalance;
    m.set(a.currency, (m.get(a.currency) ?? 0) + val);
    return m;
  }, new Map<string, number>());
  const netWorth = computeNetWorth(accounts, baseCurrency as CurrencyCode);
  const totalAssets = computeTotalAssets(accounts, baseCurrency as CurrencyCode);
  const totalLiabilities = computeTotalLiabilities(accounts, baseCurrency as CurrencyCode);

  function renderForm() {
    return (
      <form onSubmit={handleSave} className="space-y-4 mt-2">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">{locale === 'es' ? 'Nombre' : 'Name'}</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder={locale === 'es' ? 'ej. Cuenta BHD' : 'e.g. BHD Checking'} className="h-11" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{locale === 'es' ? 'Tipo de cuenta' : 'Account type'}</Label>
            <Select value={accountType} onValueChange={setAccountType}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="asset">{locale === 'es' ? 'Activo (mi dinero)' : 'Asset (my money)'}</SelectItem>
                <SelectItem value="liability">{locale === 'es' ? 'Pasivo (deuda)' : 'Liability (debt)'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{locale === 'es' ? 'Subtipo' : 'Subtype'}</Label>
            <Select value={subType} onValueChange={setSubType}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{SUB_TYPES.map(st => { const m = SUB_TYPE_META[st]; const Ic = m.icon; return (
                <SelectItem key={st} value={st}><span className="flex items-center gap-2"><Ic className="w-4 h-4" />{locale === 'es' ? m.labelEs : m.label}</span></SelectItem>
              ); })}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{locale === 'es' ? 'Moneda' : 'Currency'}</Label>
            <Select value={currency} onValueChange={v => setCurrency(v as CurrencyCode)}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(CURRENCIES).map(([code, m]) => (
                <SelectItem key={code} value={code}><span className="flex items-center gap-2"><span style={{ color: m.color }}>{m.symbol}</span>{code}</span></SelectItem>
              ))}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{accountType === 'liability' ? (locale === 'es' ? 'Monto de deuda' : 'Debt amount') : (locale === 'es' ? 'Saldo' : 'Balance')}</Label>
            <Input type="text" inputMode="decimal" value={balance} onChange={e => setBalance(e.target.value.replace(/[^\d.,-]/g, ''))} placeholder="0.00" className="h-11 font-mono text-right" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{locale === 'es' ? 'Institución' : 'Institution'}</Label>
            <Input value={institution} onChange={e => setInstitution(e.target.value)} placeholder={locale === 'es' ? 'opcional' : 'optional'} className="h-11" />
          </div>
        </div>
        <Button type="submit" className="w-full h-11">{editingId ? (locale === 'es' ? 'Guardar Cambios' : 'Save Changes') : (locale === 'es' ? 'Crear cuenta' : 'Create account')}</Button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">{t['nav.accounts']}</h1>
        <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1" />{locale === 'es' ? 'Nueva cuenta' : 'New account'}</Button>
      </div>
      <Dialog open={createOpen} onOpenChange={o => { if (!o) closeDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingId ? (locale === 'es' ? 'Editar cuenta' : 'Edit account') : (locale === 'es' ? 'Crear cuenta' : 'Create account')}</DialogTitle></DialogHeader>
          {renderForm()}
        </DialogContent>
      </Dialog>
      <Card className="p-5 bg-gradient-to-br from-surface to-surface-2">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">{t['dashboard.netWorth']}</div>
        <div className="text-3xl sm:text-4xl font-bold tabular-nums mt-1">{formatMoney(netWorth, baseCurrency as CurrencyCode, locale)}</div>
        <div className="text-xs text-muted-foreground mt-1">{locale === 'es' ? 'Total en' : 'Total in'} {baseCurrency}</div>
        {/* Assets vs Liabilities breakdown */}
        {totalLiabilities > 0 && (
          <div className="flex flex-wrap gap-3 mt-3 text-xs">
            <span className="px-2 py-1 rounded-md bg-income-soft text-income">
              {locale === 'es' ? 'Activos' : 'Assets'}: {formatMoney(totalAssets, baseCurrency as CurrencyCode, locale, { compact: true })}
            </span>
            <span className="px-2 py-1 rounded-md bg-expense-soft text-expense">
              {locale === 'es' ? 'Pasivos' : 'Liabilities'}: −{formatMoney(totalLiabilities, baseCurrency as CurrencyCode, locale, { compact: true })}
            </span>
          </div>
        )}
        {totalByCurrency.size > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {Array.from(totalByCurrency.entries()).map(([cur, amt]) => { const m = CURRENCIES[cur as CurrencyCode]; return (
              <span key={cur} className="text-xs px-2 py-1 rounded-md bg-surface-2 flex items-center gap-1.5">
                <span style={{ color: m.color }}>{m.symbol}</span><span className="tabular-nums font-medium">{formatMoney(amt, cur as CurrencyCode, locale, { compact: true })}</span><span className="text-muted-foreground">{cur}</span>
              </span>); })}
          </div>)}
      </Card>
      {accounts.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto mb-3"><Building2 className="w-7 h-7 text-muted-foreground" /></div>
          <h3 className="text-lg font-semibold mb-1">{locale === 'es' ? 'No tienes cuentas aún' : 'No accounts yet'}</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-xs mx-auto">{locale === 'es' ? 'Crea tu primera cuenta para comenzar.' : 'Create your first account.'}</p>
          <Button onClick={openCreate} size="sm"><Plus className="w-4 h-4 mr-1" />{locale === 'es' ? 'Crear cuenta' : 'Create account'}</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {accounts.map(a => {
            const meta = SUB_TYPE_META[a.subType || 'checking'] || SUB_TYPE_META.checking;
            const Ic = meta.icon; const m2 = CURRENCIES[a.currency as CurrencyCode];
            const isLiability = a.accountType === 'liability';
            const isNeg = isLiability || a.currentBalance < 0;
            const displayBalance = isLiability ? -Math.abs(a.currentBalance) : a.currentBalance;
            const linkedTx = transactions.filter(tx => tx.fromAccountId === a.id || tx.toAccountId === a.id).length;
            return (
              <Card key={a.id} className="p-4 hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${m2.color}15`, color: m2.color }}><Ic className="w-5 h-5" /></div>
                    <div><div className="text-sm font-semibold">{a.name}</div><div className="text-xs text-muted-foreground">{locale === 'es' ? meta.labelEs : meta.label}{a.lastFour && ` · •••• ${a.lastFour}`}</div></div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(a.id)} className="p-2 rounded-md hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center" aria-label="Edit"><Pencil className="w-4 h-4" /></button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="p-2 rounded-md hover:bg-expense-soft text-muted-foreground hover:text-expense transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>{locale === 'es' ? '¿Eliminar cuenta?' : 'Delete account?'}</AlertDialogTitle><AlertDialogDescription>{locale === 'es' ? `Se eliminará "${a.name}"${linkedTx > 0 ? ` y ${linkedTx} transacciones` : ''}.` : `Delete "${a.name}"${linkedTx > 0 ? ` and ${linkedTx} transactions` : ''}?`}</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>{locale === 'es' ? 'Cancelar' : 'Cancel'}</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(a.id)} className="bg-expense text-white hover:bg-expense/90">{locale === 'es' ? 'Eliminar' : 'Delete'}</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div><div className="text-xs text-muted-foreground">{isLiability ? (locale === 'es' ? 'Deuda' : 'Debt') : t['dashboard.netWorth']}</div><div className={cn('text-lg sm:text-xl font-bold tabular-nums', isNeg && 'text-expense')} style={!isNeg ? { color: m2.color } : undefined}>{formatMoney(displayBalance, a.currency as CurrencyCode, locale)}</div></div>
                  <span className="text-xs text-muted-foreground">{a.currency}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
