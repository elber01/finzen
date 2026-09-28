import { createHash, randomBytes } from 'crypto';
import { db, ensureDb } from '@/lib/db';

export interface ApiKeyUser {
  userId: string;
  email: string;
  name: string;
  permissions: string[];
}

/**
 * Generate a new API key string.
 * Format: fz_<32 hex chars>
 */
export function generateApiKeyString(): string {
  return 'fz_' + randomBytes(16).toString('hex');
}

/**
 * Hash an API key string for storage.
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Get the display prefix (first 8 chars) for an API key.
 */
export function getKeyPrefix(key: string): string {
  return key.substring(0, 8) + '...';
}

/**
 * Validate an API key from the Authorization header.
 * Returns the user info if valid, null otherwise.
 */
export async function validateApiKey(authHeader: string | null): Promise<ApiKeyUser | null> {
  if (!authHeader) return null;

  // Accept "Bearer fz_..." or just "fz_..."
  const key = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!key.startsWith('fz_')) return null;

  // Ensure DB schema is initialized (Vercel serverless cold start)
  await ensureDb();

  const keyHash = hashApiKey(key);

  const apiKey = await db.apiKey.findUnique({
    where: { keyHash },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  if (!apiKey || !apiKey.isActive) return null;
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

  // Update lastUsedAt
  await db.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    userId: apiKey.user.id,
    email: apiKey.user.email,
    name: apiKey.user.name || '',
    permissions: apiKey.permissions.split(',').map(p => p.trim()),
  };
}

/**
 * Check if an API key user has a specific permission.
 */
export function hasPermission(user: ApiKeyUser | null, permission: string): boolean {
  if (!user) return false;
  return user.permissions.includes(permission);
}
