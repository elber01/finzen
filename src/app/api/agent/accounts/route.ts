import { NextResponse } from 'next/server';
import { validateApiKey, hasPermission } from '@/lib/auth/api-key';
import { db } from '@/lib/db';

/**
 * GET /api/agent/accounts
 * Returns all accounts for the authenticated API key user.
 * 
 * Headers: Authorization: Bearer fz_xxxxx
 */

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  const user = await validateApiKey(authHeader);

  if (!user) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });
  }
  if (!hasPermission(user, 'read')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const accounts = await db.account.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({
    count: accounts.length,
    accounts: accounts.map(a => ({
      id: a.id,
      name: a.name,
      type: a.accountType,
      subType: a.subType,
      currency: a.currency,
      balance: a.currentBalance,
      institution: a.institution,
    })),
  });
}
