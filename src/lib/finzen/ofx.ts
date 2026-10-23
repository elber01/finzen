import { parseBankAmount } from './bank-presets';

export interface OfxTransaction {
  date: string;
  amount: number;
  description: string;
  fitid: string | null;
}

export interface OfxStatement {
  currency: string | null;
  accountId: string | null;
  transactions: OfxTransaction[];
}

export function parseOfxStatement(text: string): OfxStatement {
  const t = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const curMatch = t.match(/<CURDEF>\s*([A-Za-z]{3})/);
  const currency = curMatch ? curMatch[1].toUpperCase() : null;
  const acctMatch = t.match(/<ACCTID>\s*([^\s<\r\n]+)/);
  const accountId = acctMatch ? acctMatch[1] : null;

  const transactions: OfxTransaction[] = [];
  const chunks = t.split('<STMTTRN>');
  for (let i = 1; i < chunks.length; i++) {
    let chunk = chunks[i];
    const endIdx = chunk.indexOf('</STMTTRN>');
    if (endIdx !== -1) chunk = chunk.slice(0, endIdx);
    const dt = chunk.match(/<DTPOSTED>\s*(\d{4})(\d{2})(\d{2})/);
    if (!dt) continue;
    const month = parseInt(dt[2], 10);
    const day = parseInt(dt[3], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    const date = `${dt[1]}-${dt[2]}-${dt[3]}`;
    const amtMatch = chunk.match(/<TRNAMT>\s*(-?[\d.,]+)/);
    if (!amtMatch) continue;
    const amount = parseBankAmount(amtMatch[1], false);
    if (amount == null) continue;
    const name = chunk.match(/<NAME>\s*([^\r\n<]+)/);
    const memo = chunk.match(/<MEMO>\s*([^\r\n<]+)/);
    const description = [name?.[1], memo?.[1]].filter((x): x is string => Boolean(x)).map(x => x.trim()).join(' · ') || 'OFX transaction';
    const fitidMatch = chunk.match(/<FITID>\s*([^\s<\r\n]+)/);
    const fitid = fitidMatch ? fitidMatch[1] : null;
    transactions.push({ date, amount, description, fitid });
  }
  return { currency, accountId, transactions };
}
