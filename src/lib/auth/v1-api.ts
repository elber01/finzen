/**
 * v1 Public API — API key authentication + rate limiting
 * ------------------------------------------------------------------
 * These helpers are used by all /api/v1/* endpoints.
 *
 * Unlike the in-app routes (which use NextAuth sessions), the v1 routes
 * authenticate via API key. The key is sent in either:
 *   - `X-API-Key: fz_<...>`        (preferred)
 *   - `Authorization: Bearer fz_<...>`  (accepted)
 *
 * The key is validated against the ApiKey table (SHA-256 hash), and the
 * associated userId is returned so the endpoint can scope all queries
 * to that user — exactly as if the user were logged in.
 *
 * SECURITY RULES ENFORCED HERE:
 * 1. The API key string is NEVER logged. We only log the keyPrefix for audit.
 * 2. Rate limiting: 60 requests/minute per key (sliding window, in-memory).
 *    Beyond that → 429 Too Many Requests.
 * 3. Expired or deactivated keys → 401 Unauthorized.
 * 4. Keys without `write` permission cannot mutate data (403).
 */

import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { validateApiKey, hasPermission, type ApiKeyUser } from './api-key';

// ─────────────────────────────────────────────────────────────
// Rate limiter — in-memory sliding window, 60 req/min per key
// ─────────────────────────────────────────────────────────────

interface RateBucket {
  /** Timestamps of requests in the last 60s window */
  hits: number[];
}

const RATE_WINDOW_MS = 60_000; // 1 minute
const RATE_MAX_HITS = 60; // 60 req/min per key

// Map key: hash of API key -> bucket
const rateBuckets = new Map<string, RateBucket>();

// GC: evict stale buckets every 5 minutes to avoid memory leaks
const GC_INTERVAL_MS = 5 * 60_000;
let lastGc = Date.now();
function gcStaleBuckets(now: number) {
  if (now - lastGc < GC_INTERVAL_MS) return;
  lastGc = now;
  for (const [hash, bucket] of rateBuckets.entries()) {
    bucket.hits = bucket.hits.filter((t) => now - t < RATE_WINDOW_MS);
    if (bucket.hits.length === 0) rateBuckets.delete(hash);
  }
}

function checkRateLimit(keyHash: string): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  gcStaleBuckets(now);

  const bucket = rateBuckets.get(keyHash) ?? { hits: [] };
  // Drop timestamps older than the window
  bucket.hits = bucket.hits.filter((t) => now - t < RATE_WINDOW_MS);

  if (bucket.hits.length >= RATE_MAX_HITS) {
    const oldest = bucket.hits[0];
    const retryAfter = Math.ceil((RATE_WINDOW_MS - (now - oldest)) / 1000);
    return { ok: false, retryAfter: Math.max(1, retryAfter) };
  }

  bucket.hits.push(now);
  rateBuckets.set(keyHash, bucket);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Public helper: authenticate + rate-limit a v1 request
// ─────────────────────────────────────────────────────────────

export interface V1AuthResult {
  ok: boolean;
  user?: ApiKeyUser;
  /** Hash of the key — used as the rate-limit identifier (never logged raw) */
  keyHash?: string;
  response?: NextResponse;
}

function extractApiKey(req: Request): string | null {
  // 1. X-API-Key header (preferred)
  const xKey = req.headers.get('x-api-key');
  if (xKey) return xKey.trim();

  // 2. Authorization: Bearer fz_...
  const auth = req.headers.get('authorization');
  if (auth) {
    return auth.replace(/^Bearer\s+/i, '').trim();
  }

  return null;
}

/**
 * Authenticate a v1 request and apply rate limiting.
 * Returns `ok: true` with the user info if valid; otherwise returns
 * `ok: false` with a ready-to-send error `response`.
 */
export async function authenticateV1Request(req: Request): Promise<V1AuthResult> {
  const rawKey = extractApiKey(req);

  if (!rawKey) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'missing_api_key', message: 'Provide an API key via X-API-Key or Authorization: Bearer' },
        { status: 401 }
      ),
    };
  }

  // Validate against DB
  const user = await validateApiKey(rawKey);
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'invalid_api_key', message: 'API key is invalid, expired, or revoked' },
        { status: 401 }
      ),
    };
  }

  // Compute hash for rate-limit identifier (never log the raw key)
  const keyHash = createHash('sha256').update(rawKey).digest('hex');

  // Rate limit
  const rl = checkRateLimit(keyHash);
  if (!rl.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'rate_limited', message: `Too many requests. Retry in ${rl.retryAfter}s.` },
        {
          status: 429,
          headers: { 'Retry-After': String(rl.retryAfter), 'X-RateLimit-Limit': String(RATE_MAX_HITS), 'X-RateLimit-Window': '60s' },
        }
      ),
    };
  }

  return { ok: true, user, keyHash };
}

export { hasPermission };
