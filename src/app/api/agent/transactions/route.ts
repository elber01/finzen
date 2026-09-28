import { NextResponse } from 'next/server';
import { validateApiKey, hasPermission } from '@/lib/auth/api-key';
import { db } from '@/lib/db';

/**
 * GET /api/agent/transactions
 * Returns transactions for the authenticated API key user.
 * 
 * Headers: Authorization: Bearer fz_xxxxx
 * 
 * Query params:
 *   - limit: number (default 50, max 500)
 *   - type: income | expense | transfer
 *   - categoryId: string
 *   - fromDate: YYYY-MM-DD
 *   - toDate: YYYY-MM-DD
 *   - search: string (searches description)
 * 
 * POST /api/agent/transactions
 * Creates a new transaction.
 * 
 * Body:
 *   - type: income | expense | transfer (required)
 *   - amount: number (required)
 *   - currency: string (default: user's base currency)
 *   - fromAccountId: string (required)
 *   - toAccountId: string (required for transfer, or x_<categoryId> for expense)
 *   - categoryId: string (optional)
 *   - description: string
 *   - date: YYYY-MM-DD (default: today)
 *   - tags: string[]
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

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 500);
  const type = searchParams.get('type');
  const categoryId = searchParams.get('categoryId');
  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');
  const search = searchParams.get('search');

  const where: any = { userId: user.userId };
  if (type) where.type = type;
  if (categoryId) where.categoryId = categoryId;
  if (fromDate || toDate) {
    where.occurredOn = {};
    if (fromDate) where.occurredOn.gte = new Date(fromDate + 'T12:00:00');
    if (toDate) where.occurredOn.lte = new Date(toDate + 'T23:59:59');
  }
  if (search) where.description = { contains: search };

  const transactions = await db.transaction.findMany({
    where,
    include: {
      category: { select: { id: true, name: true, nameEs: true, icon: true, color: true } },
    },
    orderBy: { occurredOn: 'desc' },
    take: limit,
  });

  return NextResponse.json({
    count: transactions.length,
    transactions: transactions.map(tx => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      currency: tx.currency,
      description: tx.description,
      date: tx.occurredOn.toISOString().split('T')[0],
      categoryId: tx.categoryId,
      category: tx.category ? {
        name: tx.category.name,
        nameEs: tx.category.nameEs,
        icon: tx.category.icon,
        color: tx.category.color,
      } : null,
      tags: tx.tags ? tx.tags.split(',') : [],
      importSource: tx.importSource,
    })),
  });
}

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization');
  const user = await validateApiKey(authHeader);

  if (!user) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });
  }
  if (!hasPermission(user, 'write')) {
    return NextResponse.json({ error: 'Insufficient permissions (write required)' }, { status: 403 });
  }

  const body = await req.json();
  const { type, amount, currency, fromAccountId, toAccountId, categoryId, description, date, tags } = body;

  if (!type || !amount || !fromAccountId) {
    return NextResponse.json({ error: 'type, amount, and fromAccountId are required' }, { status: 400 });
  }

  if (amount <= 0) {
    return NextResponse.json({ error: 'amount must be positive' }, { status: 400 });
  }

  // Get user's base currency if not specified
  const userRecord = await db.user.findUnique({
    where: { id: user.userId },
    select: { baseCurrency: true },
  });

  // Parse date safely (timezone-safe)
  const dateStr = date || new Date().toISOString().split('T')[0];
  const occurredOn = dateStr.includes('T')
    ? new Date(dateStr)
    : new Date(dateStr + 'T12:00:00');

  const resolvedToAccountId = toAccountId || (type === 'expense' && categoryId ? `x_${categoryId}` : fromAccountId);

  try {
    const transaction = await db.transaction.create({
      data: {
        userId: user.userId,
        type,
        amount: Number(amount),
        currency: currency || userRecord?.baseCurrency || 'USD',
        fromAccountId,
        toAccountId: resolvedToAccountId,
        categoryId: categoryId || null,
        description: description || '',
        occurredOn,
        tags: Array.isArray(tags) ? tags.join(',') : (tags || ''),
        importSource: 'api',
      },
      include: { category: true },
    });

    return NextResponse.json({
      success: true,
      id: transaction.id,
      type: transaction.type,
      amount: transaction.amount,
      currency: transaction.currency,
      description: transaction.description,
      date: transaction.occurredOn.toISOString().split('T')[0],
      category: transaction.category ? {
        name: transaction.category.name,
        nameEs: transaction.category.nameEs,
        icon: transaction.category.icon,
      } : null,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
  }
}
