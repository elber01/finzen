'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Lightbulb, Target, Plus, Pencil, Trash2 } from 'lucide-react';
import { useFinZenStore } from '@/store/finzen-store';
import { translations } from '@/lib/finzen/i18n';
import { convertAmount, formatMoney, CURRENCIES, type CurrencyCode } from '@/lib/finzen/currency';
import { toast } from 'sonner';

export function BudgetsView() {
  const { budget, transactions, categories, locale, baseCurrency, addBudgetItem, updateBudgetItem, deleteBudgetItem } = useFinZenStore();
  const t = translations[locale];
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [plannedAmount, setPlannedAmount] = useState('');
  const [alertThreshold, setAlertThreshold] = useState('80');

  function openCreate() {
    setEditingItemId(null); setCategoryId(''); setPlannedAmount(''); setAlertThreshold('80'); setDialogOpen(true);
  }
  function openEdit(itemId: string) {
    const item = budget?.items.find(i => i.id === itemId);
    if (!item) return;
    setEditingItemId(itemId);
    setCategoryId(item.categoryId);
    setPlannedAmount(String(item.plannedAmount));
    setAlertThreshold(String(item.alertThresholdPct));
    setDialogOpen(true);
  }
  function closeDialog() { setDialogOpen(false); setEditingItemId(null); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId) { toast.error(locale === 'es' ? 'Selecciona categoría' : 'Select category'); return; }
    const amount = Number(plannedAmount.replace(',', '.'));
    if (!amount || amount <= 0) { toast.error(locale === 'es' ? 'Monto inválido' : 'Invalid amount'); return; }
    const threshold = Math.min(100, Math.max(1, parseInt(alertThreshold) || 80));
    try {
      if (editingItemId && budget) {
        await updateBudgetItem(budget.id, editingItemId, { plannedAmount: amount, alertThresholdPct: threshold });
        toast.success(locale === 'es' ? 'Partida actualizada' : 'Budget updated');
      } else {
        if (budget && budget.items.some(i => i.categoryId === categoryId)) { toast.error(locale === 'es' ? 'Ya tiene presupuesto' : 'Already budgeted'); return; }
        await addBudgetItem({ categoryId, plannedAmount: amount, alertThresholdPct: threshold });
        toast.success(locale === 'es' ? 'Partida agregada' : 'Budget added');
      }
      closeDialog();
    } catch (err) { toast.error(String(err).replace('Error: ', '')); }
  }

  async function handleDelete(itemId: string) {
    try { await deleteBudgetItem(itemId); toast.success(locale === 'es' ? 'Partida eliminada' : 'Budget deleted'); }
    catch (err) { toast.error(locale === 'es' ? 'Error' : 'Failed'); }
  }

  const items = useMemo(() => {
    if (!budget) return [];
    const now = new Date();
    return budget.items.map(item => {
      const cat = categories.find(c => c.id === item.categoryId);
      const spent = transactions.filter(tx => tx.categoryId === item.categoryId && tx.type === 'expense' && (() => { const d = new Date(tx.occurredOn); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })()).reduce((s, tx) => s + convertAmount(tx.amount, tx.currency, baseCurrency as CurrencyCode), 0);
      const planned = item.plannedAmount; const pct = planned > 0 ? (spent / planned) * 100 : 0;
      return { ...item, category: cat, spent, planned, pct, remaining: planned - spent };
    });
  }, [budget, transactions, categories, baseCurrency]);

  const totals = useMemo(() => { const s = items.reduce((a, i) => a + i.spent, 0); const p = items.reduce((a, i) => a + i.planned, 0); return { spent: s, planned: p, pct: p > 0 ? (s / p) * 100 : 0 }; }, [items]);
  const availableCategories = categories.filter(c => c.direction === 'expense' && !(budget?.items || []).some(i => i.categoryId === c.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">{t['budgets.title']}</h1>
        <Button size="sm" onClick={openCreate} disabled={availableCategories.length === 0 && !editingItemId}><Plus className="w-4 h-4 mr-1" />{t['budgets.new']}</Button>
      </div>
      {items.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium">{t['budgets.overall']}</span><span className="text-sm tabular-nums">{formatMoney(totals.spent, baseCurrency as CurrencyCode, locale)} / {formatMoney(totals.planned, baseCurrency as CurrencyCode, locale)}</span></div>
          <div className="h-3 rounded-full bg-surface-2 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${Math.min(totals.pct, 100)}%`, background: totals.pct > 100 ? 'var(--expense)' : totals.pct >= 80 ? 'var(--warning)' : 'var(--income)' }} /></div>
          <div className="text-xs text-muted-foreground mt-1.5">{totals.pct.toFixed(0)}% {t['budgets.spent']}</div>
        </Card>
      )}
      {items.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto mb-3"><Target className="w-7 h-7 text-muted-foreground" /></div>
          <h3 className="text-lg font-semibold mb-1">{locale === 'es' ? 'No hay presupuesto' : 'No budget'}</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-xs mx-auto">{locale === 'es' ? 'Crea un presupuesto mensual.' : 'Create a monthly budget.'}</p>
          <Button size="sm" onClick={openCreate} disabled={availableCategories.length === 0}><Plus className="w-4 h-4 mr-1" />{t['budgets.new']}</Button>
        </Card>
      ) : (
        <Card className="p-4 space-y-2">
          {items.map(item => {
            const isOver = item.pct > 100; const isAppr = item.pct >= item.alertThresholdPct && !isOver;
            return (
              <div key={item.id} className="p-3 rounded-lg border border-border hover:bg-surface-2 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0"><span className="text-base shrink-0">{item.category?.icon ?? '📦'}</span><span className="text-sm font-medium truncate">{item.category ? (locale === 'es' ? (item.category.nameEs || item.category.name) : (item.category.nameEn || item.category.name)) : '—'}</span>{(isOver || isAppr) && <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: isOver ? 'var(--expense-soft)' : 'var(--warning-soft)', color: isOver ? 'var(--expense)' : 'var(--warning)' }}>{isOver ? t['budgets.overBudget'] : t['budgets.approaching']}</span>}</div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(item.id)} className="p-2 rounded-md hover:bg-surface-2 text-muted-foreground hover:text-foreground min-w-[36px] min-h-[36px] flex items-center justify-center" aria-label="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="p-2 rounded-md hover:bg-expense-soft text-muted-foreground hover:text-expense min-w-[36px] min-h-[36px] flex items-center justify-center" aria-label="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>{locale === 'es' ? '¿Eliminar?' : 'Delete?'}</AlertDialogTitle><AlertDialogDescription>{locale === 'es' ? 'No se puede deshacer.' : 'Cannot undo.'}</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>{locale === 'es' ? 'Cancelar' : 'Cancel'}</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(item.id)} className="bg-expense text-white hover:bg-expense/90">{locale === 'es' ? 'Eliminar' : 'Delete'}</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-1.5"><span className="text-xs tabular-nums text-muted-foreground">{formatMoney(item.spent, baseCurrency as CurrencyCode, locale)} / {formatMoney(item.planned, baseCurrency as CurrencyCode, locale)}</span><span className="text-xs tabular-nums text-muted-foreground">{item.pct.toFixed(0)}%</span></div>
                <div className="h-2 rounded-full bg-surface-2 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${Math.min(item.pct, 100)}%`, background: isOver ? 'var(--expense)' : isAppr ? 'var(--warning)' : item.category?.color ?? 'var(--primary)' }} /></div>
                <div className="flex items-center justify-between mt-1.5 text-xs"><span className="text-muted-foreground">{locale === 'es' ? 'Alerta al' : 'Alert at'} {item.alertThresholdPct}%</span><span className="tabular-nums" style={{ color: isOver ? 'var(--expense)' : 'var(--muted-foreground)' }}>{isOver ? `${t['budgets.overBudget']} ${t['budgets.by']} ${formatMoney(Math.abs(item.remaining), baseCurrency as CurrencyCode, locale)}` : `${formatMoney(item.remaining, baseCurrency as CurrencyCode, locale)} ${t['budgets.left']}`}</span></div>
              </div>
            );
          })}
        </Card>
      )}
      <Dialog open={dialogOpen} onOpenChange={o => { if (!o) closeDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingItemId ? (locale === 'es' ? 'Editar partida' : 'Edit budget item') : (locale === 'es' ? 'Nueva partida' : 'New budget item')}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">{locale === 'es' ? 'Categoría' : 'Category'}</Label>
              <Select value={categoryId} onValueChange={setCategoryId} disabled={editingItemId !== null}>
                <SelectTrigger className="h-11"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {(editingItemId ? categories.filter(c => c.direction === 'expense') : availableCategories).map(c => (
                    <SelectItem key={c.id} value={c.id}><span className="flex items-center gap-2"><span>{c.icon}</span>{locale === 'es' ? (c.nameEs || c.name) : (c.nameEn || c.name)}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{locale === 'es' ? 'Monto' : 'Amount'}</Label>
                <div className="relative">
                  <Input type="text" inputMode="decimal" value={plannedAmount} onChange={e => setPlannedAmount(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="0.00" className="h-11 font-mono text-right pr-12" required />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">{CURRENCIES[baseCurrency as CurrencyCode].symbol}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{locale === 'es' ? 'Alerta (%)' : 'Alert (%)'}</Label>
                <Input type="number" min="1" max="100" value={alertThreshold} onChange={e => setAlertThreshold(e.target.value)} className="h-11 font-mono text-right" />
              </div>
            </div>
            <Button type="submit" className="w-full h-11">{editingItemId ? (locale === 'es' ? 'Guardar Cambios' : 'Save Changes') : (locale === 'es' ? 'Agregar' : 'Add')}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
