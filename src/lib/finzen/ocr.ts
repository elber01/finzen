'use client';

import Tesseract from 'tesseract.js';

export interface ParsedReceipt {
  merchant?: string;
  date?: string;
  total?: number;
  currency?: string;
  rawText: string;
  confidence: number;
}

function parseAmount(str: string): number {
  const cleaned = str.trim().replace(/[^\d.,]/g, '');
  if (!cleaned) return NaN;
  const hasDot = cleaned.includes('.');
  const hasComma = cleaned.includes(',');
  if (hasDot && hasComma) { const ld = cleaned.lastIndexOf('.'); const lc = cleaned.lastIndexOf(','); if (lc > ld) return Number(cleaned.replace(/\./g, '').replace(',', '.')); return Number(cleaned.replace(/,/g, '')); }
  if (hasComma) { const p = cleaned.split(','); if (p.length === 2 && p[1].length === 2) return Number(cleaned.replace(',', '.')); return Number(cleaned.replace(/,/g, '')); }
  if (hasDot) { const p = cleaned.split('.'); if (p.length === 2 && p[1].length === 2) return Number(cleaned); return Number(cleaned.replace(/\./g, '')); }
  return Number(cleaned);
}

export async function runOCR(file: File, lang: string = 'spa+eng', onProgress?: (p: number) => void): Promise<{ text: string; confidence: number }> {
  const { data } = await Tesseract.recognize(file, lang, { logger: (m: any) => { if (m.status === 'recognizing text' && m.progress !== undefined && onProgress) onProgress(m.progress); } });
  return { text: data.text, confidence: data.confidence };
}

export function parseReceiptText(text: string): ParsedReceipt {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const result: ParsedReceipt = { rawText: text, confidence: 0 };
  for (const line of lines.slice(0, 5)) { if (!line.match(/^\d/) && !line.match(/^(total|subtotal|iva|tax|fecha|date)/i) && line.length >= 3 && line.length <= 40) { result.merchant = line.replace(/[^a-zA-Z0-9áéíóúñ\s&.()-]/g, '').trim(); if (result.merchant.length >= 3) break; } }
  const dp = [/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/, /(\d{4}-\d{2}-\d{2})/];
  for (const p of dp) { const m = text.match(p); if (m) { const d = new Date(m[1]); if (!isNaN(d.getTime())) { result.date = d.toISOString().split('T')[0]; break; } } }
  const tp = [/total\s+a\s+pagar\s*:?\s*(?:RD\$|US\$|\$)?\s*([\d.,]+)/i, /total\s*:?\s*(?:RD\$|US\$|\$)?\s*([\d.,]+)/i];
  for (const p of tp) { const m = text.match(p); if (m) { const n = parseAmount(m[1]); if (!isNaN(n) && n > 0) { result.total = n; break; } } }
  if (!result.total) { const all = text.match(/(?:RD\$|US\$|\$)\s*([\d.,]+)/gi) || []; let max = 0; for (const a of all) { const n = parseAmount(a.replace(/.*\$\s*/, '')); if (!isNaN(n) && n > max) max = n; } if (max > 0) result.total = max; }
  if (/\bRD\$\b|\bDOP\b/i.test(text)) result.currency = 'DOP'; else if (/\bUS\$\b|\bUSD\b/i.test(text)) result.currency = 'USD'; else if (/\b€\b|\bEUR\b/i.test(text)) result.currency = 'EUR';
  return result;
}

export async function scanReceipt(file: File, locale: string = 'es', onProgress?: (p: number) => void): Promise<ParsedReceipt> {
  const { text, confidence } = await runOCR(file, locale === 'es' ? 'spa+eng' : 'eng', onProgress);
  const parsed = parseReceiptText(text); parsed.confidence = confidence; return parsed;
}
