import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { db } from '@/lib/db';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { type, amount, currency, fromAccountId, toAccountId, categoryId, description, occurredOn, tags, importSource } = body;

  const existing = await db.transaction.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const updated = await db.transaction.update({
    where: { id },
    data: {
      type: type ?? existing.type,
      amount: amount !== undefined ? Number(amount) : existing.amount,
      currency: currency ?? existing.currency,
      fromAccountId: fromAccountId ?? existing.fromAccountId,
      toAccountId: toAccountId ?? existing.toAccountId,
      categoryId: categoryId ?? existing.categoryId,
      description: description ?? existing.description,
      occurredOn: occurredOn ? new Date(occurredOn) : existing.occurredOn,
      tags: Array.isArray(tags) ? tags.join(',') : (tags ?? existing.tags),
      importSource: importSource ?? existing.importSource,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const existing = await db.transaction.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await db.transaction.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
