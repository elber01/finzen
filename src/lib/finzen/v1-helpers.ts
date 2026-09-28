/**
 * Shared helpers for /api/v1/* endpoints.
 *
 * - resolveCategoryByName: given a free-text category (e.g. "Alimentación",
 *   "Food", "Aporte"), finds or auto-creates the user's category and returns
 *   its id. Supports both expense and income directions.
 * - resolveAccountForUser: resolve an account by ID (account_id field),
 *   by name, or fall back to the user's default asset account.
 * - getDefaultExpenseAccount: returns the user's default asset account.
 */

import { db } from '@/lib/db';

/**
 * Resolve a free-text category name to a categoryId.
 *
 * Strategy:
 * 1. Look for an exact match on `name` (English canonical) within the user's
 *    categories (including system categories scoped to the user).
 * 2. If not found, look for an exact match on `nameEs` (Spanish).
 * 3. If still not found, case-insensitive contains match on either field.
 * 4. Otherwise: auto-create a new user-scoped category with that
 *    name (so the user's data isn't lost — we don't reject external writes
 *    just because the category string doesn't exist yet).
 *
 * The `direction` parameter controls whether the auto-created category is
 * an expense or income category. For existing categories, direction is NOT
 * enforced (we trust the user knows what they're sending).
 *
 * Returns null if `category` is empty/null (which is allowed — the
 * transaction will then have categoryId=null, same as the in-app flow when
 * no category is selected).
 */
export async function resolveCategoryByName(
  userId: string,
  category: string | undefined,
  direction: 'expense' | 'income' = 'expense'
): Promise<{ id: string | null; created: boolean; name: string | null }> {
  if (!category || !category.trim()) {
    return { id: null, created: false, name: null };
  }

  const trimmed = category.trim();

  // 1. Exact match on name (canonical). SQLite's default string equality is
  //    case-sensitive for non-ASCII but case-insensitive for ASCII.
  const byName = await db.category.findFirst({
    where: { userId, name: trimmed },
    select: { id: true, name: true },
  });
  if (byName) return { id: byName.id, created: false, name: byName.name };

  // 2. Exact match on nameEs
  const byNameEs = await db.category.findFirst({
    where: { userId, nameEs: trimmed },
    select: { id: true, name: true, nameEs: true },
  });
  if (byNameEs) return { id: byNameEs.id, created: false, name: byNameEs.nameEs || byNameEs.name };

  // 3. Case-insensitive contains match using LOWER() (SQLite-compatible).
  //    We use raw SQL because Prisma's `mode: 'insensitive'` is Postgres-only.
  const lowerTrimmed = trimmed.toLowerCase();
  const contains: any = await db.$queryRaw`SELECT id, name, nameEs FROM Category WHERE userId = ${userId} AND (LOWER(name) LIKE ${'%' + lowerTrimmed + '%'} OR LOWER(nameEs) LIKE ${'%' + lowerTrimmed + '%'}) LIMIT 1`;
  if (contains && contains.length > 0) {
    return { id: contains[0].id, created: false, name: contains[0].nameEs || contains[0].name };
  }

  // 4. Auto-create a new category for this user with the requested direction
  const created = await db.category.create({
    data: {
      userId,
      name: trimmed,
      nameEs: trimmed,
      direction,
      isSystem: false,
    },
    select: { id: true, name: true },
  });
  return { id: created.id, created: true, name: created.name };
}

/**
 * Returns the user's default account to debit/credit when an external API
 * request doesn't specify one. Prefers, in order:
 *   1. Asset account in the preferred currency (cash/checking)
 *   2. Asset account in any currency
 *   3. Any asset account
 *
 * Returns null if the user has no asset accounts.
 */
export async function getDefaultExpenseAccount(
  userId: string,
  preferredCurrency: string = 'DOP'
) {
  // 1. Asset account in the preferred currency
  const inCurrency = await db.account.findFirst({
    where: { userId, accountType: 'asset', currency: preferredCurrency },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, currency: true, subType: true },
  });
  if (inCurrency) return inCurrency;

  // 2. Any asset account
  const anyAsset = await db.account.findFirst({
    where: { userId, accountType: 'asset' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, currency: true, subType: true },
  });
  if (anyAsset) return anyAsset;

  // 3. Any account at all
  const any = await db.account.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, currency: true, subType: true },
  });
  return any;
}

/**
 * Resolve an account by name OR id (case-insensitive on name).
 * Returns null if not found / doesn't belong to the user.
 *
 * Accepts:
 *  - A cuid-like ID (20+ alphanumeric chars), or
 *  - An account name (case-insensitive match on exact name first, then partial contains).
 */
export async function resolveAccount(
  userId: string,
  accountIdOrName?: string | null
) {
  if (!accountIdOrName || !accountIdOrName.trim()) return null;

  const trimmed = accountIdOrName.trim();

  // If it looks like a cuid, look up by id
  if (/^[a-z0-9]{20,}$/i.test(trimmed)) {
    return db.account.findFirst({
      where: { id: trimmed, userId },
      select: { id: true, name: true, currency: true, accountType: true, subType: true },
    });
  }

  // Otherwise treat as name — try exact match first, then case-insensitive
  const exact = await db.account.findFirst({
    where: { userId, name: trimmed },
    select: { id: true, name: true, currency: true, accountType: true, subType: true },
  });
  if (exact) return exact;

  const lowerTrimmed = trimmed.toLowerCase();
  const lowerMatch: any = await db.$queryRaw`SELECT id, name, currency, accountType, subType FROM Account WHERE userId = ${userId} AND LOWER(name) = ${lowerTrimmed} LIMIT 1`;
  if (lowerMatch && lowerMatch.length > 0) {
    const r = lowerMatch[0];
    return { id: r.id, name: r.name, currency: r.currency, accountType: r.accountType, subType: r.subType };
  }

  // Partial contains match
  const containsMatch: any = await db.$queryRaw`SELECT id, name, currency, accountType, subType FROM Account WHERE userId = ${userId} AND LOWER(name) LIKE ${'%' + lowerTrimmed + '%'} LIMIT 1`;
  if (containsMatch && containsMatch.length > 0) {
    const r = containsMatch[0];
    return { id: r.id, name: r.name, currency: r.currency, accountType: r.accountType, subType: r.subType };
  }

  return null;
}

/**
 * Resolve an account from a payload that may contain `account_id`, `accountId`,
 * or `account` (id or name). This is the public-API-friendly entry point.
 *
 * Resolution order:
 *   1. If `account_id` (or `accountId`) is provided and looks like a cuid,
 *      look it up by id. If not found, returns null (don't silently fall back
 *      to default — the user explicitly asked for a specific account).
 *   2. If `account` is provided (id or name), resolve via resolveAccount().
 *   3. Otherwise, return null (caller should fall back to default).
 *
 * Returns { account, source } where `source` is 'account_id' | 'account' | null.
 */
export async function resolveAccountFromPayload(
  userId: string,
  payload: { account_id?: string | null; accountId?: string | null; account?: string | null }
): Promise<{ account: any | null; source: 'account_id' | 'account' | null }> {
  // 1. account_id (preferred field name per the user's spec)
  if (payload.account_id && payload.account_id.trim()) {
    const acc = await resolveAccount(userId, payload.account_id);
    if (acc) return { account: acc, source: 'account_id' };
    // Not found — caller will get null and decide what to do
    return { account: null, source: 'account_id' };
  }
  // 1b. accountId (alternative casing)
  if (payload.accountId && payload.accountId.trim()) {
    const acc = await resolveAccount(userId, payload.accountId);
    if (acc) return { account: acc, source: 'account_id' };
    return { account: null, source: 'account_id' };
  }
  // 2. account (name or id, free-form)
  if (payload.account && payload.account.trim()) {
    const acc = await resolveAccount(userId, payload.account);
    if (acc) return { account: acc, source: 'account' };
    return { account: null, source: 'account' };
  }
  // 3. Nothing provided
  return { account: null, source: null };
}
