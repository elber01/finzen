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
  const { name, nameEs, nameEn, icon, color, direction } = body;

  // Verify ownership
  const existing = await db.category.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const updated = await db.category.update({
    where: { id },
    data: {
      name: name ?? existing.name,
      nameEs: nameEs ?? existing.nameEs,
      nameEn: nameEn ?? existing.nameEn,
      icon: icon ?? existing.icon,
      color: color ?? existing.color,
      direction: direction ?? existing.direction,
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

  // Verify ownership
  const existing = await db.category.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // System categories cannot be deleted
  if (existing.isSystem) {
    return NextResponse.json(
      { error: 'System categories cannot be deleted' },
      { status: 403 }
    );
  }

  // Check if category has transactions
  const txCount = await db.transaction.count({
    where: { categoryId: id, userId: session.user.id },
  });

  if (txCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${txCount} transactions use this category. Reassign them first.` },
      { status: 409 }
    );
  }

  // Check budget items
  const budgetItemCount = await db.budgetItem.count({
    where: { categoryId: id },
  });

  if (budgetItemCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${budgetItemCount} budget items use this category. Remove them first.` },
      { status: 409 }
    );
  }

  await db.category.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
