'use client';

import { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScanLine, Upload, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useFinZenStore } from '@/store/finzen-store';
import { translations } from '@/lib/finzen/i18n';
import { CURRENCIES, type CurrencyCode } from '@/lib/finzen/currency';
import { scanReceipt, type ParsedReceipt } from '@/lib/finzen/ocr';
import type { TransactionType } from '@/store/finzen-store';

type Step = 'upload' | 'scanning' | 'review' | 'done';

export function OcrFlow({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { locale, accounts, categories, baseCurrency, addTransaction } = useFinZenStore();
  const t = translations[locale];
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('upload');
  const [progress, setProgress] = useState(0);
  const [receipt, setReceipt] = useState<ParsedReceipt | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>(baseCurrency as CurrencyCode);
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() { setStep('upload'); setProgress(0); setReceipt(null); setImagePreview(null); setAmount(''); setMerchant(''); setDate(new Date().toISOString().split('T')[0]); setCategoryId(''); setAccountId(''); }
  function handleOpenChange(o: boolean) { setOpen(o); onOpenChange(o); if (!o) setTimeout(reset, 200); }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const isImg = file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i.test(file.name);
    if (!isImg) { toast.error(locale === 'es' ? 'Solo imágenes' : 'Only images'); return; }
    if (accounts.length > 0) setAccountId(accounts[0].id);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    setStep('scanning'); setProgress(0);
    try {
      const result = await scanReceipt(file, locale, (p) => setProgress(p));
      setReceipt(result);
      if (result.total) setAmount(String(result.total));
      if (result.currency) setCurrency(result.currency as CurrencyCode);
      if (result.merchant) setMerchant(result.merchant);
      if (result.date) setDate(result.date);
      if (result.merchant) {
        const ml = result.merchant.toLowerCase();
        const ac = categories.find(c => { if (c.direction !== 'expense') return false; const n = (locale === 'es' ? (c.nameEs || c.name) : (c.nameEn || c.name)).toLowerCase(); if (n.includes('comida') || n.includes('food')) return /super|mercado|restaurante|cafe|food|market|grocery/i.test(ml); if (n.includes('transport')) return /gas|uber|taxi|bus|fuel|gasolina/i.test(ml); return false; });
        if (ac) setCategoryId(ac.id);
      }
      setStep('review');
      toast.success(locale === 'es' ? `OCR: ${result.confidence.toFixed(0)}%` : `OCR: ${result.confidence.toFixed(0)}%`);
    } catch { toast.error(locale === 'es' ? 'Error OCR' : 'OCR failed'); setStep('review'); }
  }

  async function handleSave() {
    const n = Number(amount.replace(',', '.'));
    if (!n || n <= 0) { toast.error(locale === 'es' ? 'Monto inválido' : 'Invalid'); return; }
    if (accounts.length === 0) { toast.error(locale === 'es' ? 'Crea cuenta' : 'Create account'); return; }
    if (!accountId) { toast.error(locale === 'es' ? 'Selecciona cuenta' : 'Select account'); return; }
    if (!categoryId) { toast.error(locale === 'es' ? 'Selecciona categoría' : 'Select category'); return; }
    try {
      await addTransaction({ type: 'expense' as TransactionType, amount: n, currency, fromAccountId: accountId, toAccountId: `x_${categoryId}`, categoryId, description: merchant || 'Recibo', occurredOn: new Date(date).toISOString(), tags: [], importSource: 'ocr' });
      setStep('done'); toast.success(locale === 'es' ? 'Gasto agregado' : 'Expense added');
    } catch { toast.error(locale === 'es' ? 'Error' : 'Failed'); }
  }

  const expenseCategories = categories.filter(c => c.direction === 'expense');

  return (
    <>
      <Card className="p-5 cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setOpen(true)}>
        <div className="w-12 h-12 rounded-xl bg-btc/10 flex items-center justify-center mb-3"><ScanLine className="w-6 h-6 text-btc" /></div>
        <div className="text-base font-semibold">{t['import.receipt']}</div>
        <div className="text-xs text-muted-foreground mt-1">{t['import.receiptDesc']}</div>
        <div className="flex gap-1.5 mt-3"><span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-surface-2">JPG</span><span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-surface-2">PNG</span><span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-surface-2">OCR</span></div>
      </Card>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto scroll-area">
          {/* File input INSIDE the Dialog */}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          <DialogHeader><DialogTitle>{locale === 'es' ? 'Escanear Recibo' : 'Scan Receipt'}</DialogTitle></DialogHeader>
          {step === 'upload' && (
            <div className="space-y-4 mt-2">
              <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-surface-2">
                <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" /><p className="text-sm font-medium">{locale === 'es' ? 'Sube foto del recibo' : 'Upload receipt'}</p>
              </div>
            </div>
          )}
          {step === 'scanning' && (
            <div className="space-y-4 mt-2 py-6 text-center">
              <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
              <h3 className="text-base font-semibold">{locale === 'es' ? 'Procesando...' : 'Processing...'}</h3>
              <div className="w-full max-w-xs mx-auto"><div className="h-2 rounded-full bg-surface-2 overflow-hidden"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.round(progress * 100)}%` }} /></div><div className="text-xs text-muted-foreground mt-1.5">{Math.round(progress * 100)}%</div></div>
              {imagePreview && <div className="max-w-[200px] mx-auto rounded-lg overflow-hidden border border-border"><img src={imagePreview} alt="Receipt" className="w-full h-auto" /></div>}
            </div>
          )}
          {step === 'review' && (
            <div className="space-y-4 mt-2">
              {imagePreview && <div className="flex gap-3"><div className="w-20 h-20 rounded-lg overflow-hidden border border-border shrink-0"><img src={imagePreview} alt="Receipt" className="w-full h-full object-cover" /></div><div className="flex-1">{receipt && <span className="text-xs text-muted-foreground">{receipt.confidence.toFixed(0)}%</span>}</div></div>}
              <div className="space-y-2"><Label className="text-xs text-muted-foreground">{locale === 'es' ? 'Comercio' : 'Merchant'}</Label><Input value={merchant} onChange={e => setMerchant(e.target.value)} className="h-11" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label className="text-xs text-muted-foreground">{t['tx.amount']}</Label><div className="relative"><Input type="text" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="0.00" className="h-11 font-mono text-right pr-10" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{CURRENCIES[currency].symbol}</span></div></div>
                <div className="space-y-2"><Label className="text-xs text-muted-foreground">{locale === 'es' ? 'Moneda' : 'Currency'}</Label><Select value={currency} onValueChange={v => setCurrency(v as CurrencyCode)}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(CURRENCIES).map(([code, m]) => <SelectItem key={code} value={code}><span className="flex items-center gap-2"><span style={{ color: m.color }}>{m.symbol}</span>{code}</span></SelectItem>)}</SelectContent></Select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label className="text-xs text-muted-foreground">{locale === 'es' ? 'Categoría' : 'Category'}</Label><Select value={categoryId} onValueChange={setCategoryId}><SelectTrigger className="h-11"><SelectValue placeholder="—" /></SelectTrigger><SelectContent>{expenseCategories.map(c => <SelectItem key={c.id} value={c.id}><span className="flex items-center gap-2"><span>{c.icon}</span>{locale === 'es' ? (c.nameEs || c.name) : (c.nameEn || c.name)}</span></SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label className="text-xs text-muted-foreground">{locale === 'es' ? 'Cuenta' : 'Account'}</Label>{accounts.length > 0 ? <Select value={accountId} onValueChange={setAccountId}><SelectTrigger className="h-11"><SelectValue placeholder="—" /></SelectTrigger><SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select> : <div className="h-11 rounded-md border-2 border-dashed border-warning/40 flex items-center justify-center"><span className="text-xs text-warning">{locale === 'es' ? '⚠ Crea cuenta' : '⚠ Create account'}</span></div>}</div>
              </div>
              <div className="space-y-2"><Label className="text-xs text-muted-foreground">{t['tx.date']}</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-11" /></div>
              <Button onClick={handleSave} className="w-full h-11">{locale === 'es' ? 'Guardar Gasto' : 'Save Expense'}</Button>
            </div>
          )}
          {step === 'done' && (
            <div className="space-y-4 mt-2 text-center py-4"><div className="w-16 h-16 rounded-full bg-income/10 flex items-center justify-center mx-auto"><CheckCircle2 className="w-8 h-8 text-income" /></div><h3 className="text-lg font-semibold">{locale === 'es' ? '¡Gasto agregado!' : 'Expense added!'}</h3><Button className="h-11" onClick={() => handleOpenChange(false)}>{locale === 'es' ? 'Cerrar' : 'Close'}</Button></div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
