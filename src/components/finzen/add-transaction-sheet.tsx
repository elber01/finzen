'use client';

import { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { CalendarIcon, Paperclip, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
// [UX fix] "September 27th, 2026" en UI española — date-fns sin locale
// formatea siempre en inglés. Localizamos según el idioma activo.
import { es as dateFnsEs, enUS as dateFnsEn } from 'date-fns/locale';
import { toast } from 'sonner';
import { useFinZenStore } from '@/store/finzen-store';
import { translations } from '@/lib/finzen/i18n';
import { CURRENCIES, type CurrencyCode } from '@/lib/finzen/currency';
import { toStorageISOString } from '@/lib/finzen/date-utils';
import type { TransactionType } from '@/store/finzen-store';

type TxType = 'expense' | 'income' | 'transfer';

export function AddTransactionSheet() {
  const {
    addSheetOpen,
    setAddSheetOpen,
    accounts,
    categories,
    transactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    editingTransactionId,
    setEditingTransactionId,
    locale,
  } = useFinZenStore();
  const t = translations[locale];

  const isEditMode = editingTransactionId !== null;
  const editingTx = editingTransactionId
    ? transactions.find((tx) => tx.id === editingTransactionId)
    : null;

  const [txType, setTxType] = useState<TxType>('expense');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [saving, setSaving] = useState(false);

  // [P0-2 fix] Snapshot del estado inicial del form: "dirty" significa
  // "difiere de lo cargado", no "tiene algún valor". Así el sheet de edición
  // se puede cerrar sin confirmación cuando no hubo cambios reales, y el
  // confirm solo aparece si el usuario perdería datos de verdad.
  const formSnapshot = useRef('');

  function currentFormState() {
    return JSON.stringify({
      txType,
      amount,
      currency,
      categoryId,
      description,
      fromAccountId,
      toAccountId,
      date: date.toDateString(),
    });
  }

  function snapshotFromEdit(tx: NonNullable<typeof editingTx>) {
    return JSON.stringify({
      txType: tx.type,
      amount: String(tx.amount),
      currency: tx.currency,
      categoryId: tx.categoryId ?? '',
      description: tx.description ?? '',
      fromAccountId: tx.type === 'expense' || tx.type === 'transfer' ? tx.fromAccountId : '',
      toAccountId: tx.type === 'income' || tx.type === 'transfer' ? tx.toAccountId : '',
      date: new Date(tx.occurredOn).toDateString(),
    });
  }

  function snapshotFromDefaults() {
    return JSON.stringify({
      txType: 'expense' as TxType,
      amount: '',
      currency: 'USD' as CurrencyCode,
      categoryId: '',
      description: '',
      fromAccountId: '',
      toAccountId: '',
      date: new Date().toDateString(),
    });
  }

  function reset() {
    setTxType('expense');
    setAmount('');
    setCurrency('USD');
    setFromAccountId('');
    setToAccountId('');
    setCategoryId('');
    setDescription('');
    setDate(new Date());
  }

  // Sync form state when opening in edit mode
  useEffect(() => {
    if (addSheetOpen && editingTx) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTxType(editingTx.type as TxType);
      setAmount(String(editingTx.amount));
      setCurrency(editingTx.currency as CurrencyCode);
      setCategoryId(editingTx.categoryId ?? '');
      setDescription(editingTx.description ?? '');
      setDate(new Date(editingTx.occurredOn));
      // For expense: fromAccountId is the real account
      // For income: toAccountId is the real account
      // For transfer: both are real accounts
      if (editingTx.type === 'expense') {
        setFromAccountId(editingTx.fromAccountId);
        setToAccountId('');
      } else if (editingTx.type === 'income') {
        setToAccountId(editingTx.toAccountId);
        setFromAccountId('');
      } else {
        setFromAccountId(editingTx.fromAccountId);
        setToAccountId(editingTx.toAccountId);
      }
      formSnapshot.current = snapshotFromEdit(editingTx);
    } else if (addSheetOpen && !editingTx) {
      reset();
      formSnapshot.current = snapshotFromDefaults();
    }
  }, [addSheetOpen, editingTransactionId]);

  // Dirty = el form difiere de su estado inicial. Se calcula en el momento
  // del evento (handleClose), no durante render — leer refs en render viola
  // las reglas de React 19 (react-hooks/refs).
  function isFormDirty() {
    return formSnapshot.current !== '' && formSnapshot.current !== currentFormState();
  }

  // [P0-2 fix] Cierre SIN confirmación: para usar tras guardar/eliminar con
  // éxito. El confirm de "perderás cambios" solo aplica a cierres del usuario
  // (Escape, X, Cancelar, click fuera) — nunca tras una operación exitosa.
  function forceClose() {
    setAddSheetOpen(false);
    setEditingTransactionId(null);
    setTimeout(reset, 200);
  }

  function handleClose(open: boolean) {
    if (!open && isFormDirty() && !saving) {
      // Show confirmation only if the user will actually lose real changes
      const confirmed = window.confirm(
        locale === 'es'
          ? '¿Seguro que quieres cerrar? Perderás los cambios no guardados.'
          : 'Are you sure you want to close? You will lose unsaved changes.'
      );
      if (!confirmed) return; // User cancelled, keep sheet open
    }
    setAddSheetOpen(open);
    if (!open) {
      setEditingTransactionId(null);
      setTimeout(reset, 200);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numericAmount = Number(amount.replace(',', '.'));
    if (!numericAmount || numericAmount <= 0) {
      toast.error(t['tx.saveFailed'], { description: 'Invalid amount' });
      return;
    }
    // Validation per type
    if (txType === 'expense' && !fromAccountId) {
      toast.error(t['tx.saveFailed'], { description: 'Select source account' });
      return;
    }
    if (txType === 'income' && !categoryId) {
      toast.error(t['tx.saveFailed'], { description: 'Select income category' });
      return;
    }
    if (txType === 'income' && !toAccountId) {
      toast.error(t['tx.saveFailed'], { description: 'Select destination account' });
      return;
    }
    if (txType === 'transfer' && (!fromAccountId || !toAccountId)) {
      toast.error(t['tx.saveFailed'], { description: 'Select both accounts' });
      return;
    }

    setSaving(true);

    // Double-entry model:
    // - expense: from real account → to virtual category account
    // - income: from virtual category account → to real account
    // - transfer: from real account → to real account
    const resolvedFromAccountId = txType === 'income' ? `x_${categoryId}` : fromAccountId;
    const resolvedToAccountId = txType === 'expense' ? `x_${categoryId}` : toAccountId;

    const payload = {
      type: txType as TransactionType,
      amount: numericAmount,
      currency,
      fromAccountId: resolvedFromAccountId,
      toAccountId: resolvedToAccountId,
      categoryId: txType === 'expense' || txType === 'income' ? categoryId : undefined,
      description: description || (txType === 'expense' ? 'Expense' : txType === 'income' ? 'Income' : 'Transfer'),
      occurredOn: toStorageISOString(date),
      tags: [],
      importSource: 'manual' as const,
    };

    try {
      if (isEditMode && editingTransactionId) {
        await updateTransaction(editingTransactionId, payload);
        toast.success(locale === 'es' ? 'Transacción actualizada' : 'Transaction updated');
      } else {
        await addTransaction(payload);
        toast.success(t['tx.saved']);
      }
    } catch (err) {
      // [P0-2 fix] En error: NO cerrar — el usuario conserva lo escrito y puede reintentar
      toast.error(t['tx.saveFailed'], { description: String(err).replace('Error: ', '') });
      setSaving(false);
      return;
    }
    setSaving(false);
    // [P0-2 fix] Cerrar sin pasar por el confirm de "cambios sin guardar":
    // la operación fue exitosa, no hay nada que perder.
    forceClose();
  }

  async function handleDelete() {
    if (!editingTransactionId) return;
    // [UX fix] Capturar ANTES de borrar: forceClose() limpia editingTransactionId
    // y el toast de deshacer necesita los datos originales.
    const tx = editingTx;
    try {
      await deleteTransaction(editingTransactionId);
      toast.success(locale === 'es' ? 'Transacción eliminada' : 'Transaction deleted', {
        action: {
          label: locale === 'es' ? 'Deshacer' : 'Undo',
          onClick: async () => {
            if (!tx) return;
            try {
              await addTransaction({
                type: tx.type as TransactionType,
                amount: tx.amount,
                currency: tx.currency as CurrencyCode,
                fromAccountId: tx.fromAccountId,
                toAccountId: tx.toAccountId,
                categoryId: tx.categoryId ?? undefined,
                description: tx.description ?? '',
                occurredOn: tx.occurredOn,
                tags: tx.tags || '',
                importSource: 'manual' as const,
              });
              toast.success(locale === 'es' ? 'Transacción restaurada' : 'Transaction restored');
            } catch {
              toast.error(locale === 'es' ? 'No se pudo restaurar' : 'Could not restore');
            }
          },
        },
        duration: 6000,
      });
    } catch (err) {
      // [P0-2 fix] En error: NO cerrar — mostrar el fallo y mantener contexto
      toast.error(locale === 'es' ? 'Error al eliminar' : 'Failed to delete');
      return;
    }
    forceClose();
  }

  const filteredCategories = categories.filter((c) =>
    txType === 'expense' ? c.direction === 'expense' : c.direction === 'income'
  );

  return (
    <Sheet open={addSheetOpen} onOpenChange={handleClose}>
      <SheetContent
        side="bottom"
        className="h-[92vh] sm:h-auto sm:max-h-[88vh] sm:max-w-lg sm:m-auto sm:rounded-xl overflow-y-auto scroll-area"
      >
        <SheetHeader>
          <SheetTitle className="text-xl sm:text-2xl font-bold">
            {isEditMode
              ? (locale === 'es' ? 'Editar Transacción' : 'Edit Transaction')
              : t['tx.addTitle']}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          {/* Type selector */}
          <Tabs value={txType} onValueChange={(v) => setTxType(v as TxType)}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger
                value="expense"
                className="data-[state=active]:bg-expense-soft data-[state=active]:text-expense"
              >
                {t['transactions.expense']}
              </TabsTrigger>
              <TabsTrigger
                value="income"
                className="data-[state=active]:bg-income-soft data-[state=active]:text-income"
              >
                {t['transactions.income']}
              </TabsTrigger>
              <TabsTrigger value="transfer">{t['transactions.transfer']}</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Amount + currency */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{t['tx.amount']}</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
                  placeholder="0.00"
                  className="text-2xl sm:text-3xl font-bold h-14 font-mono text-right pr-16 tabular-nums"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                  {CURRENCIES[currency].symbol}
                </span>
              </div>
              <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
                <SelectTrigger className="w-24 h-14">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CURRENCIES).map(([code, meta]) => (
                    <SelectItem key={code} value={code}>
                      <span className="flex items-center gap-2">
                        <span style={{ color: meta.color }}>{meta.symbol}</span>
                        {code}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* From / To — adapts based on transaction type */}
          {txType === 'expense' && (
            /* Expense: From account → To category */
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{t['tx.fromAccount']}</Label>
                <Select value={fromAccountId} onValueChange={setFromAccountId}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts
                      .filter((a) => a.subType !== 'credit_card' || a.currentBalance !== 0)
                      .map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{t['tx.toCategory']}</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-2">
                          <span>{c.icon}</span>
                          {locale === 'es' ? (c.nameEs || c.name) : (c.nameEn || c.name)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {txType === 'income' && (
            /* Income: From category (source) → To account (destination) */
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  {locale === 'es' ? 'Categoría (origen)' : 'Category (source)'}
                </Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-2">
                          <span>{c.icon}</span>
                          {locale === 'es' ? (c.nameEs || c.name) : (c.nameEn || c.name)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{t['tx.toAccount']}</Label>
                <Select value={toAccountId} onValueChange={setToAccountId}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {txType === 'transfer' && (
            /* Transfer: From account → To account */
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{t['tx.fromAccount']}</Label>
                <Select value={fromAccountId} onValueChange={setFromAccountId}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{t['tx.toAccount']}</Label>
                <Select value={toAccountId} onValueChange={setToAccountId}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts
                      .filter((a) => a.id !== fromAccountId)
                      .map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{t['tx.description']}</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t['tx.descriptionPlaceholder']}
              className="h-11"
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{t['tx.date']}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full h-11 justify-start font-normal">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {format(date, 'PPP', { locale: locale === 'es' ? dateFnsEs : dateFnsEn })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Receipt attachment (mock) — [UX fix] badge honesto: es un botón
              que aún no funciona; no debe parecer funcional */}
          <button
            type="button"
            className="w-full h-11 rounded-md border border-dashed border-border text-sm text-muted-foreground hover:bg-surface-2 flex items-center justify-center gap-2"
            onClick={() => toast.info(locale === 'es' ? 'Carga de recibo — próximamente' : 'Receipt upload — coming soon')}
          >
            <Paperclip className="w-4 h-4" />
            {t['tx.attachReceipt']}
            <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-surface-2">
              {locale === 'es' ? 'Próximamente' : 'Soon'}
            </span>
          </button>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {isEditMode && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 text-expense hover:bg-expense-soft hover:text-expense"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {locale === 'es' ? '¿Eliminar transacción?' : 'Delete transaction?'}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {locale === 'es'
                        ? 'Esta acción no se puede deshacer. La transacción se eliminará permanentemente.'
                        : 'This action cannot be undone. The transaction will be permanently deleted.'}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>
                      {locale === 'es' ? 'Cancelar' : 'Cancel'}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-expense text-white hover:bg-expense/90"
                    >
                      {locale === 'es' ? 'Eliminar' : 'Delete'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-12"
              onClick={() => handleClose(false)}
            >
              {t['tx.cancel']}
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="flex-[2] h-12 text-base font-semibold"
            >
              {saving
                ? t['tx.saving']
                : isEditMode
                ? (locale === 'es' ? 'Guardar Cambios' : 'Save Changes')
                : t['tx.save']}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
