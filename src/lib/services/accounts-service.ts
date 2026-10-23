/**
 * Accounts service — shared business layer for account CRUD.
 *
 * This is the first service of the Phase 1 service layer (see SDD). Both the
 * public API (/api/v1/accounts*) and the internal session routes
 * (/api/accounts*) delegate their mutations here so that validation rules and
 * invariants are enforced in exactly one place.
 *
 * Key invariant enforced here: an account that has linked transactions can
 * NEVER be deleted (409 account_has_transactions) — deleting it would orphan
 * the double-entry history and silently rewrite the user's past. To retire an
 * account from the net worth, PATCH its balance to 0 instead. This closes the
 * debt documented in SDD §7.7.
 *
 * `accountType` and `currency` are immutable after creation: changing them
 * would alter the net worth semantics of every historical transaction
 * (field_not_editable). Delete + recreate is the supported path.
 */

import type { Account } from '@prisma/client';
import { db } from '@/lib/db';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

export const ACCOUNT_TYPES = ['asset', 'liability'] as const;
export const SUB_TYPES = [
  'checking',
  'savings',
  'credit_card',
  'cash',
  'crypto_wallet',
  'investment',
  'loan',
] as const;
/** Legacy aliases accepted in input and normalized on write. */
export const SUB_TYPE_ALIASES: Record<string, (typeof SUB_TYPES)[number]> = {
  credit: 'credit_card',
};
export const CURRENCIES = ['DOP', 'USD'] as const;

// ─────────────────────────────────────────────────────────────
// Public shapes
// ─────────────────────────────────────────────────────────────

export interface AccountPublic {
  id: string;
  name: string;
  accountType: string;
  subType: string | null;
  currency: string;
  currentBalance: number;
  institution: string | null;
  lastFour: string | null;
}

export type AccountErrorCode =
  | 'invalid_name'
  | 'invalid_account_type'
  | 'invalid_sub_type'
  | 'invalid_currency'
  | 'invalid_balance'
  | 'invalid_institution'
  | 'invalid_last_four'
  | 'field_not_editable'
  | 'not_found'
  | 'account_has_transactions';

export type AccountMutationResult =
  | { ok: true; account: AccountPublic }
  | { ok: false; code: AccountErrorCode; message: string };

export type DeleteAccountResult =
  | { ok: true; id: string }
  | {
      ok: false;
      code: 'not_found' | 'account_has_transactions';
      message: string;
      transactionCount?: number;
    };

// ─────────────────────────────────────────────────────────────
// Internal helpers — narrow `unknown` inputs, no `any`
// ─────────────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isInList(list: readonly unknown[], v: unknown): boolean {
  return list.includes(v);
}

/** Normalize a subType value. Returns 'invalid' if not a known sub type. */
function normalizeSubType(
  value: unknown
): { ok: true; subType: (typeof SUB_TYPES)[number] | null } | { ok: false } {
  if (value === null) return { ok: true, subType: null };
  if (typeof value !== 'string') return { ok: false };
  const t = value.trim();
  if (t === '') return { ok: false };
  const aliased = SUB_TYPE_ALIASES[t] ?? t;
  if (!isInList(SUB_TYPES, aliased)) return { ok: false };
  return { ok: true, subType: aliased };
}

interface FieldChecks {
  /** number of editable fields found in the input */
  presentCount: number;
  name?: string;
  currentBalance?: number;
  institution?: string | null;
  lastFour?: string | null;
  subType?: string | null;
  error?: { code: AccountErrorCode; message: string };
}

/**
 * Validate the editable fields of a patch. Only fields present
 * (!== undefined) are checked; `presentCount` lets the caller decide
 * idempotency (empty patch → no-op).
 */
function checkEditableFields(patch: Record<string, unknown>): FieldChecks {
  const out: FieldChecks = { presentCount: 0 };

  if (patch.name !== undefined) {
    out.presentCount++;
    if (typeof patch.name !== 'string' || patch.name.trim() === '') {
      out.error = { code: 'invalid_name', message: 'name must be a non-empty string' };
      return out;
    }
    out.name = patch.name.trim();
  }

  if (patch.currentBalance !== undefined) {
    out.presentCount++;
    const n = Number(patch.currentBalance);
    if (!Number.isFinite(n)) {
      out.error = {
        code: 'invalid_balance',
        message: 'currentBalance must be a finite number (0 and negatives are valid)',
      };
      return out;
    }
    out.currentBalance = n;
  }

  if (patch.institution !== undefined) {
    out.presentCount++;
    if (patch.institution === null) {
      out.institution = null;
    } else if (typeof patch.institution === 'string') {
      const t = patch.institution.trim();
      out.institution = t === '' ? null : t;
    } else {
      out.error = { code: 'invalid_institution', message: 'institution must be a string or null' };
      return out;
    }
  }

  if (patch.lastFour !== undefined) {
    out.presentCount++;
    if (patch.lastFour === null) {
      out.lastFour = null;
    } else if (typeof patch.lastFour === 'string' && /^\d{2,4}$/.test(patch.lastFour.trim())) {
      out.lastFour = patch.lastFour.trim();
    } else {
      out.error = { code: 'invalid_last_four', message: 'lastFour must be 2-4 digits or null' };
      return out;
    }
  }

  if (patch.subType !== undefined) {
    out.presentCount++;
    const st = normalizeSubType(patch.subType);
    if (!st.ok) {
      out.error = {
        code: 'invalid_sub_type',
        message: `subType must be one of: ${SUB_TYPES.join(', ')} (or null)`,
      };
      return out;
    }
    out.subType = st.subType;
  }

  return out;
}

function toPublic(a: Account): AccountPublic {
  return {
    id: a.id,
    name: a.name,
    accountType: a.accountType,
    subType: a.subType,
    currency: a.currency,
    currentBalance: a.currentBalance,
    institution: a.institution,
    lastFour: a.lastFour,
  };
}

// ─────────────────────────────────────────────────────────────
// A) CREATE
// ─────────────────────────────────────────────────────────────

export async function createAccountForUser(
  userId: string,
  input: unknown
): Promise<AccountMutationResult> {
  const body = isRecord(input) ? input : {};

  // name — required, non-empty
  if (typeof body.name !== 'string' || body.name.trim() === '') {
    return { ok: false, code: 'invalid_name', message: 'name is required and must be a non-empty string' };
  }
  const name = body.name.trim();

  // accountType — default 'asset'
  let accountType: (typeof ACCOUNT_TYPES)[number] = 'asset';
  if (body.accountType !== undefined) {
    if (typeof body.accountType !== 'string' || !isInList(ACCOUNT_TYPES, body.accountType)) {
      return {
        ok: false,
        code: 'invalid_account_type',
        message: `accountType must be one of: ${ACCOUNT_TYPES.join(', ')}`,
      };
    }
    accountType = body.accountType as (typeof ACCOUNT_TYPES)[number];
  }

  // subType — default 'checking'; null allowed (stays null)
  let subType: string | null = 'checking';
  if (body.subType !== undefined) {
    const st = normalizeSubType(body.subType);
    if (!st.ok) {
      return {
        ok: false,
        code: 'invalid_sub_type',
        message: `subType must be one of: ${SUB_TYPES.join(', ')} (or null)`,
      };
    }
    subType = st.subType;
  }

  // currency — default 'DOP'
  let currency: (typeof CURRENCIES)[number] = 'DOP';
  if (body.currency !== undefined) {
    if (typeof body.currency !== 'string' || !isInList(CURRENCIES, body.currency.toUpperCase())) {
      return {
        ok: false,
        code: 'invalid_currency',
        message: `currency must be one of: ${CURRENCIES.join(', ')}`,
      };
    }
    currency = body.currency.toUpperCase() as (typeof CURRENCIES)[number];
  }

  // currentBalance — default 0; must be finite (0 and negatives valid)
  let currentBalance = 0;
  if (body.currentBalance !== undefined) {
    const n = Number(body.currentBalance);
    if (!Number.isFinite(n)) {
      return {
        ok: false,
        code: 'invalid_balance',
        message: 'currentBalance must be a finite number (0 and negatives are valid; a positive liability = debt)',
      };
    }
    currentBalance = n;
  }

  // institution — default null; string trimmed, empty → null
  let institution: string | null = null;
  if (body.institution !== undefined) {
    if (typeof body.institution === 'string') {
      const t = body.institution.trim();
      institution = t === '' ? null : t;
    } else {
      return { ok: false, code: 'invalid_institution', message: 'institution must be a string or null' };
    }
  }

  // lastFour — default null; 2-4 digits or null
  let lastFour: string | null = null;
  if (body.lastFour !== undefined) {
    if (body.lastFour === null) {
      lastFour = null;
    } else if (typeof body.lastFour === 'string' && /^\d{2,4}$/.test(body.lastFour.trim())) {
      lastFour = body.lastFour.trim();
    } else {
      return { ok: false, code: 'invalid_last_four', message: 'lastFour must be 2-4 digits or null' };
    }
  }

  const created = await db.account.create({
    data: {
      userId,
      name,
      accountType,
      subType,
      currency,
      currentBalance,
      institution,
      lastFour,
    },
  });

  return { ok: true, account: toPublic(created) };
}

// ─────────────────────────────────────────────────────────────
// B) UPDATE (PATCH)
// ─────────────────────────────────────────────────────────────

export async function updateAccountForUser(
  userId: string,
  id: string,
  patch: unknown
): Promise<AccountMutationResult> {
  // 1. Ownership
  const existing = await db.account.findFirst({ where: { id, userId } });
  if (!existing) {
    return { ok: false, code: 'not_found', message: 'Account not found or not owned by your user' };
  }

  const body = isRecord(patch) ? patch : {};

  // 2. Immutable fields — changing them would rewrite net worth semantics
  if (body.accountType !== undefined) {
    return {
      ok: false,
      code: 'field_not_editable',
      message: 'accountType cannot be edited (it would break net worth semantics). Delete and recreate the account instead.',
    };
  }
  if (body.currency !== undefined) {
    return {
      ok: false,
      code: 'field_not_editable',
      message: 'currency cannot be edited (it would break net worth semantics). Delete and recreate the account instead.',
    };
  }

  // 3. Editable fields (only those present)
  const fields = checkEditableFields(body);
  if (fields.error) {
    return { ok: false, code: fields.error.code, message: fields.error.message };
  }

  // 4. Empty patch → idempotent 200 with the existing account
  if (fields.presentCount === 0) {
    return { ok: true, account: toPublic(existing) };
  }

  // 5. Apply — currentBalance is a DIRECT adjustment, never recomputed
  const updated = await db.account.update({
    where: { id: existing.id },
    data: {
      ...(fields.name !== undefined ? { name: fields.name } : {}),
      ...(fields.currentBalance !== undefined ? { currentBalance: fields.currentBalance } : {}),
      ...(fields.institution !== undefined ? { institution: fields.institution } : {}),
      ...(fields.lastFour !== undefined ? { lastFour: fields.lastFour } : {}),
      ...(fields.subType !== undefined ? { subType: fields.subType } : {}),
    },
  });

  return { ok: true, account: toPublic(updated) };
}

// ─────────────────────────────────────────────────────────────
// C) DELETE (with transaction guard)
// ─────────────────────────────────────────────────────────────

export async function deleteAccountForUser(
  userId: string,
  id: string
): Promise<DeleteAccountResult> {
  // 1. Ownership
  const existing = await db.account.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) {
    return { ok: false, code: 'not_found', message: 'Account not found or not owned by your user' };
  }

  // 2. Guard — an account with linked transactions must never be deleted
  const count = await db.transaction.count({
    where: { OR: [{ fromAccountId: id }, { toAccountId: id }] },
  });
  if (count > 0) {
    return {
      ok: false,
      code: 'account_has_transactions',
      transactionCount: count,
      message: `Account has ${count} linked transaction(s). Set its balance to 0 via PATCH instead of deleting, to preserve history.`,
    };
  }

  // 3. Safe to delete
  await db.account.delete({ where: { id: existing.id } });
  return { ok: true, id: existing.id };
}
