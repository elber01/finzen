export function parseCSVLine(line: string): string[] {
  const result: string[] = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) { const ch = line[i]; if (ch === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; } else if (ch === ',' && !inQ) { result.push(cur); cur = ''; } else cur += ch; }
  result.push(cur); return result.map(s => s.trim());
}
