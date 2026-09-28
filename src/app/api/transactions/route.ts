import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { db } from '@/lib/db';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '1000');

  const transactions = await db.transaction.findMany({
    where: { userId: session.user.id },
    orderBy: { occurredOn: 'desc' },
    take: limit,
    include: {
      category: true,
    },
  });

  return NextResponse.json(transactions);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { type, amount, currency, fromAccountId, toAccountId, categoryId, description, occurredOn, tags, importSource } = body;

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }

  if (!fromAccountId || !toAccountId) {
    return NextResponse.json({ error: 'Source and destination required' }, { status: 400 });
  }

  // For real accounts (not virtual "x_categoryId"), verify ownership
  if (!fromAccountId.startsWith('x_')) {
    const account = await db.account.findFirst({
      where: { id: fromAccountId, userId: session.user.id },
    });
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }
  }

  const transaction = await db.transaction.create({
    data: {
      userId: session.user.id,
      type,
      amount: Number(amount),
      currency: currency || 'USD',
      fromAccountId,
      toAccountId,
      categoryId: categoryId || null,
      description: description || '',
      occurredOn: new Date(occurredOn.includes('T') ? occurredOn : occurredOn + 'T12:00:00'),
      tags: Array.isArray(tags) ? tags.join(',') : (tags || ''),
      importSource: importSource || 'manual',
    },
  });

  return NextResponse.json(transaction);
}
