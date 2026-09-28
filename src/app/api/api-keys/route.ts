import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { db } from '@/lib/db';
import { generateApiKeyString, hashApiKey, getKeyPrefix } from '@/lib/auth/api-key';

// GET — list all API keys for the authenticated user
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const keys = await db.apiKey.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      permissions: true,
      lastUsedAt: true,
      expiresAt: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(keys);
}

// POST — create a new API key
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { name, permissions, expiresAt } = body;

  if (!name || !name.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const keyString = generateApiKeyString();
  const keyHash = hashApiKey(keyString);
  const keyPrefix = getKeyPrefix(keyString);

  const apiKey = await db.apiKey.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      keyHash,
      keyPrefix,
      permissions: permissions || 'read,write',
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  // Return the full key ONCE — it won't be shown again
  return NextResponse.json({
    id: apiKey.id,
    name: apiKey.name,
    key: keyString,  // Full key — only shown once!
    keyPrefix: apiKey.keyPrefix,
    permissions: apiKey.permissions,
    createdAt: apiKey.createdAt,
  });
}
