export interface BankPreset {
  key: string;
  name: string;
  nameEn: string;
  hint: string;
  hintEn: string;
  /** null = auto-detectar separador decimal */
  decimalComma: boolean | null;
  aliases: {
    date: string[];
    description: string[];
    debit: string[];
    credit: string[];
    amount: string[];
    type: string[];
  };
}

export const BANK_PRESETS: BankPreset[] = [
  {
    key: 'bpd',
    name: 'Banco Popular Dominicano',
    nameEn: 'Banco Popular Dominicano',
    hint: 'Banca en línea → Movimientos → Exportar CSV',
    hintEn: 'Online banking → Transactions → Export CSV',
    decimalComma: true,
    aliases: {
      date: ['fecha', 'fecha movimiento'],
      description: ['descripcion', 'detalle', 'concepto', 'referencia'],
      debit: ['retiro', 'debito', 'cargo', 'cargos'],
      credit: ['deposito', 'abono', 'abonos', 'credito'],
      amount: ['monto', 'importe', 'valor', 'amount'],
      type: ['tipo', 'naturaleza'],
    },
  },
  {
    key: 'banreservas',
    name: 'Banreservas',
    nameEn: 'Banreservas',
    hint: 'Banca en línea → Detalle de movimientos → CSV',
    hintEn: 'Online banking → Transaction detail → CSV',
    decimalComma: true,
    aliases: {
      date: ['fecha', 'fecha de movimiento', 'fecha movimiento'],
      description: ['descripcion', 'detalle', 'concepto'],
      debit: ['debito', 'retiro', 'cargo'],
      credit: ['credito', 'abono', 'deposito'],
      amount: ['monto', 'importe'],
      type: ['tipo'],
    },
  },
  {
    key: 'bhd',
    name: 'Banco BHD',
    nameEn: 'Banco BHD',
    hint: 'Banca en línea → Estados de cuenta → CSV',
    hintEn: 'Online banking → Statements → CSV',
    decimalComma: true,
    aliases: {
      date: ['fecha', 'fecha operacion'],
      description: ['descripcion', 'detalle', 'concepto'],
      debit: ['debito', 'retiro', 'cargo', 'cargos'],
      credit: ['credito', 'abono', 'deposito'],
      amount: ['monto', 'importe', 'amount'],
      type: ['tipo', 'naturaleza'],
    },
  },
  {
    key: 'apap',
    name: 'APAP (Préstamos)',
    nameEn: 'APAP (Loans)',
    hint: 'Portal APAP → Pagos/Amortización → CSV',
    hintEn: 'APAP portal → Payments → CSV',
    decimalComma: true,
    aliases: {
      date: ['fecha', 'fecha de pago', 'fecha pago', 'fecha vencimiento'],
      description: ['descripcion', 'detalle', 'concepto'],
      debit: [],
      credit: [],
      amount: ['monto', 'cuota', 'importe', 'pago', 'total pagado', 'valor'],
      type: [],
    },
  },
  {
    key: 'generic',
    name: 'Otro banco',
    nameEn: 'Other bank',
    hint: 'Exporta tu estado de cuenta en CSV u OFX/QFX',
    hintEn: 'Export your statement as CSV or OFX/QFX',
    decimalComma: null,
    aliases: {
      date: ['date', 'fecha', 'fecha operacion', 'posted date'],
      description: ['description', 'descripcion', 'detalle', 'concepto', 'memo', 'name'],
      debit: ['debit', 'debito', 'retiro', 'cargo', 'withdrawal'],
      credit: ['credit', 'credito', 'deposito', 'abono', 'deposit'],
      amount: ['amount', 'monto', 'importe', 'valor'],
      type: ['type', 'tipo'],
    },
  },
];

export function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function parseBankAmount(raw: string | undefined | null, preferComma: boolean | null): number | null {
  if (raw == null || raw.trim() === '') return null;
  let s = raw.trim();
  let negative = /\(.*\)/.test(s);
  s = s.replace(/[()]/g, '');
  s = s.replace(/[\s\u00A0]/g, '').replace(/RD\$|US\$|\$|DOP|USD/g, '');
  if (s.startsWith('-')) { negative = true; s = s.slice(1); }
  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  if (hasDot && hasComma) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(/,/g, '.');
    else s = s.replace(/,/g, '');
  } else if (hasComma) {
    if (preferComma === true || /,\d{1,2}$/.test(s)) s = s.replace(/,/g, '.');
    else s = s.replace(/,/g, '');
  } else if (hasDot) {
    if (preferComma === true && /\.\d{3}(\D|$)/.test(s)) s = s.replace(/\./g, '');
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n === 0) return null;
  return negative ? -Math.abs(n) : n;
}

const CANONICAL_FIELDS: (keyof BankPreset['aliases'])[] = ['date', 'description', 'debit', 'credit', 'amount', 'type'];

export function autoMapColumns(headers: string[], preset: BankPreset): Record<string, string> {
  const result: Record<string, string> = {};
  const normalized = headers.map(normalizeHeader);
  for (const field of CANONICAL_FIELDS) {
    const aliases = preset.aliases[field];
    for (let i = 0; i < headers.length; i++) {
      const h = normalized[i];
      if (aliases.some(a => h === a || h.startsWith(a) || (a.length >= 4 && h.includes(a)))) {
        result[field] = headers[i];
        break;
      }
    }
  }
  return result;
}
