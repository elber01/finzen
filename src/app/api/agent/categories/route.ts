import { NextResponse } from 'next/server';
import { validateApiKey, hasPermission } from '@/lib/auth/api-key';
import { db } from '@/lib/db';

/**
 * GET /api/agent/categories
 * Returns all categories for the authenticated API key user.
 * Useful for AI agents to know what categories exist before creating transactions.
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

  const categories = await db.category.findMany({
    where: { userId: user.userId },
    orderBy: { sortOrder: 'asc' },
  });

  return NextResponse.json({
    count: categories.length,
    categories: categories.map(c => ({
      id: c.id,
      name: c.name,
      nameEs: c.nameEs,
      nameEn: c.nameEn,
      icon: c.icon,
      color: c.color,
      direction: c.direction, // income | expense | transfer
      isSystem: c.isSystem,
    })),
  });
}
