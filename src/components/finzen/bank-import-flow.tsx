'use client';

import { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table';
import { Building2, Upload, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useFinZenStore, type TransactionType } from '@/store/finzen-store';
import { translations } from '@/lib/finzen/i18n';
import { formatMoney, formatDate, type CurrencyCode } from '@/lib/finzen/currency';
import { parseLocalDate, toLocalDateString, toStorageISOString, matchCategory } from '@/lib/finzen/date-utils';
import { parseCSVLine } from '@/lib/finzen/csv';
import { parseOfxStatement } from '@/lib/finzen/ofx';
import { BANK_PRESETS, autoMapColumns, parseBankAmount, type BankPreset } from '@/lib/finzen/bank-presets';

interface ParsedBankTx {
  date: string;
  amount: number;
  type: 'income' | 'expense';
  description: string;
  fitid: string | null;
}

type Step = 'bank' | 'upload' | 'mapping' | 'preview' | 'done';

export function BankImportFlow() {
  const store = useFinZenStore();
  const { locale, accounts, categories, baseCurrency, transactions, addTransaction } = store;
  const t = translations[locale];
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('bank');
  const [preset, setPreset] = useState<BankPreset | null>(null);
  const [isOfx, setIsOfx] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [parsed, setParsed] = useState<ParsedBankTx[]>([]);
  const [ofxCurrency, setOfxCurrency] = useState<string | null>(null);
  const [targetAccountId, setTargetAccountId] = useState('');
  const [counts, setCounts] = useState({ imported: 0, duplicates: 0, skipped: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAP_FIELDS = [
    { key: 'date', label: locale === 'es' ? 'Fecha' : 'Date', required: true },
    { key: 'amount', label: locale === 'es' ? 'Monto' : 'Amount', required: false },
    { key: 'debit', label: locale === 'es' ? 'Débito' : 'Debit', required: false },
    { key: 'credit', label: locale === 'es' ? 'Crédito' : 'Credit', required: false },
    { key: 'description', label: locale === 'es' ? 'Descripción' : 'Description', required: false },
    { key: 'type', label: locale === 'es' ? 'Tipo' : 'Type', required: false },
  ];

  function reset() {
    setStep('bank'); setPreset(null); setIsOfx(false); setOfxCurrency(null); setHeaders([]); setRows([]);
    setMapping({}); setParsed([]); setCounts({ imported: 0, duplicates: 0, skipped: 0 });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleOpenChange(o: boolean) {
    setOpen(o);
    if (!o) setTimeout(reset, 200);
  }

  function openWizard() {
    if (accounts.length === 0) { toast.error(locale === 'es' ? 'Crea una cuenta' : 'Create account first'); return; }
    reset(); setTargetAccountId(accounts[0].id); setOpen(true);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = String(ev.target?.result ?? '');
        const noTx = () => toast.error(locale === 'es' ? 'Sin transacciones' : 'No transactions found');
        if (/\.(ofx|qfx)$/i.test(file.name) || /OFXHEADER|<OFX|STMTTRN/i.test(text)) {
          const stmt = parseOfxStatement(text);
          if (stmt.transactions.length === 0) { noTx(); return; }
          setParsed(stmt.transactions.map(tx => ({
            date: tx.date,
            amount: Math.abs(tx.amount),
            type: tx.amount < 0 ? 'expense' as const : 'income' as const,
            description: tx.description,
            fitid: tx.fitid,
          })));
          setIsOfx(true); setOfxCurrency(stmt.currency); setStep('preview');
          return;
        }
        if (!preset) { toast.error(locale === 'es' ? 'Selecciona un banco' : 'Select a bank'); return; }
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length < 2) { noTx(); return; }
        let headerIdx = 0;
        let hdrs: string[] | null = null;
        const candidates = lines.slice(0, 5);
        for (let i = 0; i < candidates.length; i++) {
          const cand = parseCSVLine(candidates[i]);
          const m = autoMapColumns(cand, preset);
          if (m.date && (m.amount || m.debit || m.credit)) { headerIdx = i; hdrs = cand; break; }
        }
        const fileHeaders = hdrs ?? parseCSVLine(lines[0]);
        const dataRows = lines.slice(headerIdx + 1).map(line => {
          const v = parseCSVLine(line);
          const r: Record<string, string> = {};
          fileHeaders.forEach((h, i) => { r[h] = v[i] ?? ''; });
          return r;
        });
        if (dataRows.length === 0) { noTx(); return; }
        setHeaders(fileHeaders); setRows(dataRows);
        setMapping(autoMapColumns(fileHeaders, preset));
        setIsOfx(false); setOfxCurrency(null); setStep('mapping');
      } catch { toast.error(locale === 'es' ? 'Error al procesar el archivo' : 'Error processing file'); }
    };
    reader.readAsText(file);
  }

  function handleContinueToPreview() {
    if (!preset) return;
    const result: ParsedBankTx[] = [];
    for (const row of rows) {
      const dateStr = mapping.date ? row[mapping.date] : '';
      if (!dateStr) continue;
      const d = parseLocalDate(dateStr);
      if (isNaN(d.getTime())) continue;
      let type: 'income' | 'expense' | null = null;
      let amount = 0;
      if (mapping.debit && mapping.credit) {
        const creditVal = parseBankAmount(row[mapping.credit], preset.decimalComma);
        const debitVal = parseBankAmount(row[mapping.debit], preset.decimalComma);
        if (creditVal != null) { type = 'income'; amount = Math.abs(creditVal); }
        else if (debitVal != null) { type = 'expense'; amount = Math.abs(debitVal); }
      } else if (mapping.amount) {
        const v = parseBankAmount(row[mapping.amount], preset.decimalComma);
        if (v != null) { amount = Math.abs(v); type = v < 0 ? 'expense' : 'income'; }
      }
      if (!type || amount <= 0) continue;
      if (mapping.type && row[mapping.type]) {
        const tv = row[mapping.type].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (tv.includes('ingreso') || tv.includes('income') || tv.includes('abono') || tv.includes('credit')) type = 'income';
        else if (tv.includes('gasto') || tv.includes('expense') || tv.includes('retiro') || tv.includes('debito') || tv.includes('cargo')) type = 'expense';
      }
      const description = (mapping.description ? (row[mapping.description] || '') : '').trim() || 'Estado de cuenta';
      result.push({ date: toLocalDateString(d), amount, type, description, fitid: null });
    }
    if (result.length === 0) { toast.error(locale === 'es' ? 'Sin transacciones válidas' : 'No valid transactions'); return; }
    setParsed(result); setStep('preview');
  }

  const previewData = step === 'preview' && parsed.length > 0 ? (() => {
    const sorted = parsed.map(p => p.date).sort();
    const income = parsed.filter(p => p.type === 'income').length;
    const existing = new Set<string>();
    transactions.forEach(tx => {
      const datePart = tx.occurredOn.split('T')[0];
      const realAccountId = tx.type === 'income' ? tx.toAccountId : tx.fromAccountId;
      existing.add(`${datePart}|${tx.amount}|${(tx.description || '').toLowerCase().trim()}|${realAccountId}`);
    });
    let duplicates = 0;
    const seen = new Set<string>();
    for (const p of parsed) {
      const key = `${p.date}|${p.amount}|${p.description.toLowerCase().trim()}|${targetAccountId}`;
      if (existing.has(key) || seen.has(key)) duplicates++;
      else seen.add(key);
    }
    return { min: sorted[0], max: sorted[sorted.length - 1], income, expense: parsed.length - income, duplicates };
  })() : null;

  const targetCurrency = (accounts.find(a => a.id === targetAccountId)?.currency ?? baseCurrency) as CurrencyCode;

  async function handleCommit() {
    if (!targetAccountId) { toast.error(locale === 'es' ? 'Selecciona cuenta' : 'Select account'); return; }
    const currency = (accounts.find(a => a.id === targetAccountId)?.currency ?? baseCurrency) as CurrencyCode;
    let imported = 0, duplicates = 0;
    let skipped = isOfx ? 0 : Math.max(0, rows.length - parsed.length);
    const importBatchId = `bank_${preset?.key ?? 'generic'}_${Date.now()}`;
    const existingTxKeys = new Set<string>();
    transactions.forEach(tx => {
      const datePart = tx.occurredOn.split('T')[0];
      const realAccountId = tx.type === 'income' ? tx.toAccountId : tx.fromAccountId;
      existingTxKeys.add(`${datePart}|${tx.amount}|${(tx.description || '').toLowerCase().trim()}|${realAccountId}`);
    });
    for (const p of parsed) {
      const d = parseLocalDate(p.date);
      const dateKey = toLocalDateString(d);
      const txKey = `${dateKey}|${p.amount}|${p.description.toLowerCase().trim()}|${targetAccountId}`;
      if (existingTxKeys.has(txKey)) { duplicates++; continue; }
      existingTxKeys.add(txKey);
      let categoryId: string | undefined;
      const matched = matchCategory(p.description, categories);
      if (matched) {
        const found = categories.find(c => c.name === matched);
        if (found) categoryId = found.id;
      }
      try {
        await addTransaction({ type: p.type as TransactionType, amount: p.amount, currency, fromAccountId: p.type === 'income' ? `x_${categoryId}` : targetAccountId, toAccountId: p.type === 'expense' ? `x_${categoryId}` : targetAccountId, categoryId, description: p.description, occurredOn: toStorageISOString(d), tags: [importBatchId], importSource: 'bank' });
        imported++;
      } catch { skipped++; }
    }
    setCounts({ imported, duplicates, skipped });
    setStep('done');
    let msg = `${imported} ${t['import.bankImported']}, ${duplicates} ${t['import.bankDuplicates']}`;
    if (skipped > 0) msg += `, ${skipped} ${t['import.bankInvalid']}`;
    toast.success(msg);
  }

  const dialogTitle = step === 'bank' ? t['import.bankChoose']
    : step === 'upload' ? t['import.bankUpload']
    : step === 'mapping' ? t['import.bankMapColumns']
    : step === 'preview' ? t['import.bankPreview']
    : t['import.bank'];

  return (
    <>
      <Card className="p-5 cursor-pointer hover:border-primary/40 transition-colors" onClick={openWizard}>
        <div className="w-12 h-12 rounded-xl bg-income/10 flex items-center justify-center mb-3"><Building2 className="w-6 h-6 text-income" /></div>
        <div className="text-base font-semibold">{t['import.bank']}</div>
        <div className="text-xs text-muted-foreground mt-1">{t['import.bankDesc']}</div>
        <div className="flex gap-1.5 mt-3"><span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-surface-2">CSV</span><span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-surface-2">OFX</span><span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-surface-2">QFX</span></div>
      </Card>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto scroll-area">
          <input ref={fileInputRef} type="file" accept=".csv,.ofx,.qfx,.txt,text/csv" className="hidden" onChange={handleFileSelect} />
          <DialogHeader><DialogTitle>{dialogTitle}</DialogTitle></DialogHeader>
          {step === 'bank' && (
            <div className="space-y-2 mt-2">
              {BANK_PRESETS.map(b => (
                <div key={b.key} className="p-4 border border-border rounded-lg hover:bg-surface-2 cursor-pointer" onClick={() => { setPreset(b); setStep('upload'); }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">{b.key === 'generic' ? t['import.bankOther'] : (locale === 'es' ? b.name : b.nameEn)}</div>
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-surface shrink-0">{b.key === 'generic' ? 'CSV · OFX' : 'CSV'}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{locale === 'es' ? b.hint : b.hintEn}</div>
                </div>
              ))}
            </div>
          )}
          {step === 'upload' && preset && (
            <div className="space-y-4 mt-2">
              <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-surface-2">
                <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">{locale === 'es' ? preset.name : preset.nameEn}</p>
                <p className="text-xs text-muted-foreground mt-1">{t['import.bankUploadHint']}</p>
              </div>
            </div>
          )}
          {step === 'mapping' && (
            <div className="space-y-4 mt-2">
              <div className="text-sm text-muted-foreground">{locale === 'es' ? `${rows.length} filas` : `${rows.length} rows`}</div>
              <div className="space-y-3">
                {MAP_FIELDS.map(f => (
                  <div key={f.key} className="grid grid-cols-2 gap-3 items-center">
                    <div className="text-sm font-medium">{f.label}{f.required && <span className="text-expense ml-1">*</span>}</div>
                    <Select value={mapping[f.key] ?? ''} onValueChange={v => setMapping(m => ({ ...m, [f.key]: v }))}>
                      <SelectTrigger className="h-11"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <Button className="w-full h-11" disabled={!mapping.date || (!mapping.amount && !(mapping.debit && mapping.credit))} onClick={handleContinueToPreview}>{locale === 'es' ? 'Continuar' : 'Continue'}</Button>
            </div>
          )}
          {step === 'preview' && previewData && (
            <div className="space-y-4 mt-2">
              <div className="flex flex-wrap gap-1.5">
                <span className="text-xs px-2 py-1 rounded-md bg-surface-2">{parsed.length} {t['import.bankDetected']}</span>
                <span className="text-xs px-2 py-1 rounded-md bg-surface-2">{t['import.bankRange']}: {formatDate(parseLocalDate(previewData.min), locale)} → {formatDate(parseLocalDate(previewData.max), locale)}</span>
                <span className="text-xs px-2 py-1 rounded-md bg-income-soft text-income">{previewData.income} {locale === 'es' ? 'ingresos' : 'income'}</span>
                <span className="text-xs px-2 py-1 rounded-md bg-expense-soft text-expense">{previewData.expense} {locale === 'es' ? 'gastos' : 'expenses'}</span>
                {isOfx && <span className="text-xs px-2 py-1 rounded-md bg-surface-2">{t['import.bankOfxAuto']}</span>}
                {isOfx && ofxCurrency && ofxCurrency !== targetCurrency && (
                  <span className="text-xs px-2 py-1 rounded-md bg-warning-soft text-warning">
                    {locale === 'es' ? `El estado de cuenta está en ${ofxCurrency} y la cuenta destino en ${targetCurrency} — verifica antes de importar` : `Statement is in ${ofxCurrency} but target account is in ${targetCurrency} — double-check before importing`}
                  </span>
                )}
                {previewData.duplicates > 0 && <span className="text-xs px-2 py-1 rounded-md bg-warning-soft text-warning">{previewData.duplicates} {t['import.bankDuplicates']}</span>}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">{locale === 'es' ? 'Fecha' : 'Date'}</TableHead>
                    <TableHead className="text-xs">{locale === 'es' ? 'Descripción' : 'Description'}</TableHead>
                    <TableHead className="text-xs text-right">{locale === 'es' ? 'Monto' : 'Amount'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.slice(0, 8).map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{formatDate(parseLocalDate(p.date), locale)}</TableCell>
                      <TableCell className="text-xs max-w-[220px] truncate">{p.description}</TableCell>
                      <TableCell className={`text-xs text-right tabular-nums ${p.type === 'income' ? 'text-income' : 'text-expense'}`}>{p.type === 'income' ? '+' : '−'}{formatMoney(p.amount, targetCurrency, locale)}</TableCell>
                    </TableRow>
                  ))}
                  {parsed.length > 8 && (
                    <TableRow><TableCell colSpan={3} className="text-xs text-muted-foreground text-center">+{parsed.length - 8} {locale === 'es' ? 'más' : 'more'}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{t['import.bankTarget']}</Label>
                <Select value={targetAccountId} onValueChange={setTargetAccountId}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button className="w-full h-11" disabled={!targetAccountId} onClick={handleCommit}>{t['import.bankImport']}</Button>
            </div>
          )}
          {step === 'done' && (
            <div className="space-y-4 mt-2 text-center py-4">
              <div className="w-16 h-16 rounded-full bg-income/10 flex items-center justify-center mx-auto"><CheckCircle2 className="w-8 h-8 text-income" /></div>
              <h3 className="text-lg font-semibold">{locale === 'es' ? '¡Importación completada!' : 'Import completed!'}</h3>
              <div className="bg-surface-2 rounded-lg p-4 text-sm space-y-1 max-w-sm mx-auto text-left">
                <div className="flex justify-between"><span className="text-muted-foreground">{t['import.bankImported']}:</span><span className="font-semibold text-income">{counts.imported}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t['import.bankDuplicates']}:</span><span>{counts.duplicates}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t['import.bankInvalid']}:</span><span>{counts.skipped}</span></div>
              </div>
              <Button className="h-11" onClick={() => handleOpenChange(false)}>{locale === 'es' ? 'Cerrar' : 'Close'}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
