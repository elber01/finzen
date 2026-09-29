'use client';

import { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileSpreadsheet, CheckCircle2, Download, Upload, FileText, Database } from 'lucide-react';
import { toast } from 'sonner';
import { useFinZenStore } from '@/store/finzen-store';
import { translations } from '@/lib/finzen/i18n';
import { CURRENCIES, type CurrencyCode } from '@/lib/finzen/currency';
import { parseLocalDate, toLocalDateString, toStorageISOString, matchCategory } from '@/lib/finzen/date-utils';
import { OcrFlow } from '@/components/finzen/ocr-flow';
import { Building2 } from 'lucide-react';
import type { Transaction } from '@/store/finzen-store';

function parseCSVLine(line: string): string[] {
  const result: string[] = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) { const ch = line[i]; if (ch === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; } else if (ch === ',' && !inQ) { result.push(cur); cur = ''; } else cur += ch; }
  result.push(cur); return result.map(s => s.trim());
}
type Step = 'upload' | 'mapping' | 'done';

export function ImportView() {
  const store = useFinZenStore();
  const { locale, accounts, categories, baseCurrency } = store;
  const t = translations[locale];
  const [step, setStep] = useState<Step>('upload');
  const [importOpen, setImportOpen] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [allRows, setAllRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [targetAccountId, setTargetAccountId] = useState('');
  const [importedCount, setImportedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const CANONICAL_FIELDS = [
    { key: 'date', label: locale === 'es' ? 'Fecha' : 'Date', required: true },
    { key: 'amount', label: locale === 'es' ? 'Monto' : 'Amount', required: true },
    { key: 'description', label: locale === 'es' ? 'Descripción' : 'Description', required: false },
    { key: 'category', label: locale === 'es' ? 'Categoría' : 'Category', required: false },
    { key: 'type', label: locale === 'es' ? 'Tipo' : 'Type', required: false },
  ];

  function resetWizard() { setStep('upload'); setHeaders([]); setAllRows([]); setMapping({}); setImportedCount(0); }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = String(ev.target?.result ?? '');
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length < 2) { toast.error(locale === 'es' ? 'Archivo vacío' : 'Empty file'); return; }
        const ph = parseCSVLine(lines[0]);
        const pr = lines.slice(1).map(line => { const v = parseCSVLine(line); const r: Record<string,string> = {}; ph.forEach((h,i) => { r[h] = v[i] ?? ''; }); return r; });
        setHeaders(ph); setAllRows(pr);
        const lookup: Record<string,string[]> = { date: ['date','fecha'], amount: ['amount','monto','value'], description: ['description','descripción','detalle','concepto'], category: ['category','categoría'], type: ['type','tipo'] };
        const autoMap: Record<string,string> = {};
        Object.entries(lookup).forEach(([can, cands]) => { const m = ph.find(h => cands.some(c => h.toLowerCase().trim() === c)); if (m) autoMap[can] = m; });
        setMapping(autoMap); setStep('mapping');
      } catch { toast.error(locale === 'es' ? 'Error CSV' : 'CSV error'); }
    };
    reader.readAsText(file);
  }

  async function handleCommit() {
    if (!targetAccountId) { toast.error(locale === 'es' ? 'Selecciona cuenta' : 'Select account'); return; }
    let imported = 0, skipped = 0, duplicates = 0, uncategorized = 0;
    const importBatchId = `csv_${Date.now()}`;
    // Build a set of existing transactions for duplicate detection
    const existingTxKeys = new Set<string>();
    store.transactions.forEach(tx => {
      const datePart = tx.occurredOn.split('T')[0];
      const key = `${datePart}|${tx.amount}|${(tx.description || '').toLowerCase().trim()}|${tx.fromAccountId}`;
      existingTxKeys.add(key);
    });
    for (const row of allRows) {
      const dateStr = row[mapping.date]; const amountStr = row[mapping.amount];
      if (!dateStr || !amountStr) { skipped++; continue; }
      const d = parseLocalDate(dateStr); if (isNaN(d.getTime())) { skipped++; continue; }
      const cleaned = amountStr.replace(/[^\d.,-]/g, '').replace(',', '.');
      const amount = Math.abs(Number(cleaned)); if (!amount || amount <= 0) { skipped++; continue; }
      const desc = mapping.description ? row[mapping.description] : 'Imported';
      const dateKey = toLocalDateString(d);
      // Check for duplicates (exact match: date + amount + description + account)
      const txKey = `${dateKey}|${amount}|${desc.toLowerCase().trim()}|${targetAccountId}`;
      if (existingTxKeys.has(txKey)) { duplicates++; continue; }
      existingTxKeys.add(txKey);
      const isNeg = cleaned.startsWith('-');
      let type = isNeg ? 'expense' : 'income';
      if (mapping.type && row[mapping.type]) { const tv = row[mapping.type].toLowerCase(); if (tv.includes('ingreso') || tv.includes('income')) type = 'income'; else if (tv.includes('gasto') || tv.includes('expense')) type = 'expense'; }
      // Category matching — use fuzzy matching, NEVER silently default
      let categoryId: string | undefined;
      if (mapping.category && row[mapping.category]) {
        const matched = matchCategory(row[mapping.category], categories);
        if (matched) {
          const found = categories.find(c => c.name === matched);
          if (found) categoryId = found.id;
        } else {
          uncategorized++;
        }
      }
      try {
        await store.addTransaction({ type: type as any, amount, currency: baseCurrency as CurrencyCode, fromAccountId: type === 'income' ? `x_${categoryId}` : targetAccountId, toAccountId: type === 'expense' ? `x_${categoryId}` : targetAccountId, categoryId, description: desc, occurredOn: toStorageISOString(d), tags: [importBatchId], importSource: 'csv' });
        imported++;
      } catch { skipped++; }
    }
    setImportedCount(imported); setStep('done');
    let msg = locale === 'es' ? `${imported} importadas` : `${imported} imported`;
    if (duplicates > 0) msg += locale === 'es' ? `, ${duplicates} duplicados omitidos` : `, ${duplicates} duplicates skipped`;
    if (uncategorized > 0) msg += locale === 'es' ? `, ${uncategorized} sin categoría` : `, ${uncategorized} uncategorized`;
    if (skipped > 0) msg += locale === 'es' ? `, ${skipped} inválidas` : `, ${skipped} invalid`;
    toast.success(msg);
  }

  function exportData(format: 'csv' | 'json') {
    if (store.transactions.length === 0 && store.accounts.length === 0) { toast.error(locale === 'es' ? 'No hay datos' : 'No data'); return; }
    let content: string; let mime: string; let ext: string;
    if (format === 'json') { content = JSON.stringify({ exportedAt: new Date().toISOString(), accounts: store.accounts, transactions: store.transactions }, null, 2); mime = 'application/json'; ext = 'json'; }
    else { const h = ['Date','Type','Amount','Currency','Description','Category','Account']; const rows = store.transactions.map((tx: Transaction) => { const cat = categories.find(c => c.id === tx.categoryId); const acct = accounts.find(a => a.id === tx.fromAccountId) ?? accounts.find(a => a.id === tx.toAccountId); return [new Date(tx.occurredOn).toISOString().split('T')[0], tx.type, String(tx.amount), tx.currency, `"${(tx.description||'').replace(/"/g,'""')}"`, `"${cat ? (locale==='es'?(cat.nameEs||cat.name):(cat.nameEn||cat.name)) : ''}"`, `"${acct?.name ?? ''}"`].join(','); }); content = [h.join(','), ...rows].join('\n'); mime = 'text/csv'; ext = 'csv'; }
    const blob = new Blob([content], { type: mime }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `finzen-export-${new Date().toISOString().split('T')[0]}.${ext}`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    toast.success(locale === 'es' ? `Exportado ${format.toUpperCase()}` : `Exported ${format.toUpperCase()}`);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold">{t['import.title']}</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-5 cursor-pointer hover:border-primary/40 transition-colors" onClick={() => { if (accounts.length === 0) { toast.error(locale==='es'?'Crea una cuenta':'Create account first'); return; } resetWizard(); setTargetAccountId(accounts[0].id); setImportOpen(true); }}>
          <div className="w-12 h-12 rounded-xl bg-info/10 flex items-center justify-center mb-3"><FileSpreadsheet className="w-6 h-6 text-info" /></div>
          <div className="text-base font-semibold">{t['import.csv']}</div><div className="text-xs text-muted-foreground mt-1">{t['import.csvDesc']}</div>
          <div className="flex gap-1.5 mt-3"><span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-surface-2">CSV</span><span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-surface-2">XLSX</span></div>
        </Card>
        <OcrFlow onOpenChange={() => {}} />
        <Card className="p-5 cursor-pointer hover:border-primary/40 transition-colors relative" onClick={() => toast.info(locale === 'es' ? 'Plaid — próximamente' : 'Plaid — coming soon')}>
          <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-surface-2 text-muted-foreground">
            {locale === 'es' ? 'Próximamente' : 'Soon'}
          </span>
          <div className="w-12 h-12 rounded-xl bg-income/10 flex items-center justify-center mb-3"><Building2 className="w-6 h-6 text-income" /></div>
          <div className="text-base font-semibold">{t['import.bank']}</div><div className="text-xs text-muted-foreground mt-1">{t['import.bankDesc']}</div>
        </Card>
      </div>
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3"><Download className="w-4 h-4 text-muted-foreground" /><h2 className="text-lg font-semibold">{locale === 'es' ? 'Exportar datos' : 'Export data'}</h2></div>
        <p className="text-sm text-muted-foreground mb-4">{locale === 'es' ? 'Descarga tus transacciones.' : 'Download your transactions.'}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => exportData('csv')}><FileText className="w-4 h-4 mr-1.5" />CSV</Button>
          <Button variant="outline" size="sm" onClick={() => exportData('json')}><Database className="w-4 h-4 mr-1.5" />JSON</Button>
        </div>
      </Card>
      <Dialog open={importOpen} onOpenChange={o => { if (!o) setImportOpen(false); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto scroll-area">
          <DialogHeader><DialogTitle>{locale === 'es' ? 'Importar CSV' : 'Import CSV'}</DialogTitle></DialogHeader>
          {/* File input INSIDE the Dialog so the click works from within the portal */}
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileUpload} />
          {step === 'upload' && (
            <div className="space-y-4 mt-2">
              <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-surface-2"><Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" /><p className="text-sm font-medium">{locale === 'es' ? 'Selecciona CSV' : 'Select CSV'}</p></div>
              <div className="space-y-2"><Label className="text-xs text-muted-foreground">{locale === 'es' ? 'Cuenta destino' : 'Target account'}</Label>
                <Select value={targetAccountId} onValueChange={setTargetAccountId}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
          )}
          {step === 'mapping' && (
            <div className="space-y-4 mt-2">
              <div className="text-sm text-muted-foreground">{locale === 'es' ? `Mapea columnas. ${allRows.length} filas.` : `Map columns. ${allRows.length} rows.`}</div>
              <div className="space-y-3">
                {CANONICAL_FIELDS.map(f => (
                  <div key={f.key} className="grid grid-cols-2 gap-3 items-center">
                    <div className="text-sm font-medium">{f.label}{f.required && <span className="text-expense ml-1">*</span>}</div>
                    <Select value={mapping[f.key] ?? ''} onValueChange={v => setMapping(m => ({ ...m, [f.key]: v }))}><SelectTrigger className="h-10"><SelectValue placeholder="—" /></SelectTrigger><SelectContent>{headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent></Select>
                  </div>
                ))}
              </div>
              <Button className="w-full h-11" disabled={!mapping.date || !mapping.amount} onClick={handleCommit}>{locale === 'es' ? `Importar ${allRows.length} transacciones` : `Import ${allRows.length} transactions`}</Button>
            </div>
          )}
          {step === 'done' && (
            <div className="space-y-4 mt-2 text-center py-4">
              <div className="w-16 h-16 rounded-full bg-income/10 flex items-center justify-center mx-auto"><CheckCircle2 className="w-8 h-8 text-income" /></div>
              <h3 className="text-lg font-semibold">{locale === 'es' ? '¡Importación completada!' : 'Import completed!'}</h3>
              <div className="bg-surface-2 rounded-lg p-4 text-sm space-y-1 max-w-sm mx-auto">
                <div className="flex justify-between"><span className="text-muted-foreground">{locale === 'es' ? 'Importadas' : 'Imported'}:</span><span className="font-semibold text-income">{importedCount}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{locale === 'es' ? 'Total en archivo' : 'Total in file'}:</span><span>{allRows.length}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{locale === 'es' ? 'ID de lote' : 'Batch ID'}:</span><span className="font-mono text-xs">{locale === 'es' ? 'Ver etiquetas' : 'See tags'}</span></div>
              </div>
              <Button className="h-11" onClick={() => { setImportOpen(false); resetWizard(); }}>{locale === 'es' ? 'Cerrar' : 'Close'}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
