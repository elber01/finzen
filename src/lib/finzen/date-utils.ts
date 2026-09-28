// Date utilities for FinZen — timezone-safe for America/Santo_Domingo

/**
 * Parse a date string (YYYY-MM-DD or DD/MM/YYYY or MM/DD/YYYY) as a LOCAL date.
 * Returns a Date object set to midnight LOCAL time (not UTC).
 * This prevents the "off by one day" bug when the server is in UTC
 * but the user is in America/Santo_Domingo (UTC-4).
 */
export function parseLocalDate(dateStr: string): Date {
  // Try YYYY-MM-DD (ISO format, most common from CSVs)
  const isoMatch = dateStr.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0, 0);
  }

  // Try DD/MM/YYYY (Latin American format)
  const ddmmyyyy = dateStr.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0, 0);
  }

  // Try MM/DD/YYYY (US format)
  const mmddyyyy = dateStr.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mmddyyyy) {
    const [, month, day, year] = mmddyyyy;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0, 0);
  }

  // Fallback: let JS try to parse it
  const fallback = new Date(dateStr);
  if (!isNaN(fallback.getTime())) {
    // Set to noon to avoid timezone edge cases
    fallback.setHours(12, 0, 0, 0);
    return fallback;
  }

  return new Date(NaN); // Invalid date
}

/**
 * Convert a Date to a YYYY-MM-DD string using LOCAL date components.
 * This is the inverse of parseLocalDate.
 */
export function toLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convert a Date to an ISO string that preserves the LOCAL date.
 * Sets time to noon UTC to avoid midnight timezone shifts.
 */
export function toStorageISOString(d: Date): string {
  // Use noon UTC to avoid any timezone shifting the date
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();
  return new Date(Date.UTC(year, month, day, 12, 0, 0, 0)).toISOString();
}

/**
 * Format a relative date string that NEVER shows negative values.
 * If the date is in the future or today, returns "Hoy" / "Today".
 */
export function formatRelativeDateSafe(
  date: Date | string,
  locale: string = 'es'
): string {
  let d: Date;
  if (typeof date === 'string') {
    // Parse the stored date. If it's an ISO string, extract just the date part
    // to avoid timezone issues
    const datePart = date.split('T')[0];
    d = parseLocalDate(datePart);
  } else {
    d = new Date(date);
    d.setHours(12, 0, 0, 0); // Normalize to noon
  }

  const now = new Date();
  now.setHours(12, 0, 0, 0); // Normalize to noon for comparison

  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (locale === 'es') {
    if (diffDays <= 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return new Intl.DateTimeFormat('es-DO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  }

  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/**
 * Normalize a category name for matching.
 * - Trims whitespace
 * - Removes extra spaces
 * - Converts to lowercase
 * - Removes accents (á → a, ñ → n)
 * - Removes trailing punctuation
 */
export function normalizeCategoryName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/\s+/g, ' ') // Normalize spaces
    .replace(/[.,;:]+$/, '') // Remove trailing punctuation
    .trim();
}

/**
 * Default category aliases for fuzzy matching.
 * Maps common Spanish/English variations to canonical names.
 */
export const CATEGORY_ALIASES: Record<string, string> = {
  // Food
  'comida': 'Food', 'alimentacion': 'Food', 'alimentos': 'Food',
  'supermercado': 'Food', 'super': 'Food', 'groceries': 'Food',
  'restaurante': 'Food', 'restaurantes': 'Food', 'restaurant': 'Food',
  'cafe': 'Food', 'cafeteria': 'Food',
  // Housing
  'vivienda': 'Housing', 'casa': 'Housing', 'renta': 'Housing',
  'alquiler': 'Housing', 'rent': 'Housing', 'hipoteca': 'Housing',
  'mantenimiento': 'Housing', 'condominio': 'Housing',
  // Transport
  'transporte': 'Transport', 'transport': 'Transport',
  'gasolina': 'Transport', 'combustible': 'Transport', 'gas': 'Transport',
  'uber': 'Transport', 'taxi': 'Transport', 'bus': 'Transport',
  // Leisure
  'ocio': 'Leisure', 'entretenimiento': 'Leisure', 'entretenimiento': 'Leisure',
  'cine': 'Leisure', 'peliculas': 'Leisure', 'movies': 'Leisure',
  'entretenimiento': 'Leisure',
  // Utilities
  'servicios': 'Utilities', 'utilities': 'Utilities',
  'luz': 'Utilities', 'electricidad': 'Utilities', 'electric': 'Utilities',
  'agua': 'Utilities', 'internet': 'Utilities', 'telefono': 'Utilities',
  // Health
  'salud': 'Health', 'health': 'Health',
  'medicamentos': 'Health', 'medico': 'Health', 'doctor': 'Health',
  'farmacia': 'Health', 'pharmacy': 'Health',
  // Shopping
  'compras': 'Shopping', 'shopping': 'Shopping',
  'ropa': 'Shopping', 'clothes': 'Shopping', 'tienda': 'Shopping',
  // Income
  'salario': 'Salary', 'salary': 'Salary', 'sueldo': 'Salary',
  'pago': 'Salary', 'nomina': 'Salary',
  'freelance': 'Freelance', 'independiente': 'Freelance',
  'ingreso pasivo': 'Passive Income', 'pasivo': 'Passive Income',
  'reembolso': 'Refund', 'refund': 'Refund', 'devolucion': 'Refund',
  // Investment
  'inversion': 'Investment', 'investment': 'Investment',
  'inversiones': 'Investment', 'crypto': 'Investment',
  'btc': 'Investment', 'bitcoin': 'Investment',
  // Other
  'otros': 'Other', 'other': 'Other', 'varios': 'Other',
  'gastos varios': 'Other',
};

/**
 * Try to match a category name to a known category.
 * Returns the category name if found, or null if no match.
 */
export function matchCategory(
  inputName: string,
  knownCategories: { name: string; nameEs?: string | null; nameEn?: string | null }[]
): string | null {
  const normalized = normalizeCategoryName(inputName);

  // 1. Exact match against known categories
  for (const cat of knownCategories) {
    if (normalizeCategoryName(cat.name) === normalized) return cat.name;
    if (cat.nameEs && normalizeCategoryName(cat.nameEs) === normalized) return cat.name;
    if (cat.nameEn && normalizeCategoryName(cat.nameEn) === normalized) return cat.name;
  }

  // 2. Alias lookup
  const aliased = CATEGORY_ALIASES[normalized];
  if (aliased) {
    for (const cat of knownCategories) {
      if (normalizeCategoryName(cat.name) === normalizeCategoryName(aliased)) return cat.name;
      if (cat.nameEs && normalizeCategoryName(cat.nameEs) === normalizeCategoryName(aliased)) return cat.name;
      if (cat.nameEn && normalizeCategoryName(cat.nameEn) === normalizeCategoryName(aliased)) return cat.name;
    }
  }

  // 3. Partial match (input starts with a known category name or vice versa)
  for (const cat of knownCategories) {
    const catNorm = normalizeCategoryName(cat.name);
    const catEsNorm = cat.nameEs ? normalizeCategoryName(cat.nameEs) : '';
    const catEnNorm = cat.nameEn ? normalizeCategoryName(cat.nameEn) : '';
    if (
      (catNorm.length >= 3 && (normalized.includes(catNorm) || catNorm.includes(normalized))) ||
      (catEsNorm.length >= 3 && (normalized.includes(catEsNorm) || catEsNorm.includes(normalized))) ||
      (catEnNorm.length >= 3 && (normalized.includes(catEnNorm) || catEnNorm.includes(normalized)))
    ) {
      return cat.name;
    }
  }

  return null; // No match found
}
