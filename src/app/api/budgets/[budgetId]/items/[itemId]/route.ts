import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { db } from '@/lib/db';

// PATCH /api/budgets/[budgetId]/items/[itemId] — update plannedAmount and/or alertThresholdPct
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ budgetId: string; itemId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { budgetId, itemId } = await params;

  // Verify the budget belongs to the user
  const budget = await db.budget.findFirst({
    where: { id: budgetId, userId: session.user.id },
  });

  if (!budget) {
    return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
  }

  // Verify the item belongs to this budget
  const item = await db.budgetItem.findFirst({
    where: { id: itemId, budgetId },
  });

  if (!item) {
    return NextResponse.json({ error: 'Budget item not found' }, { status: 404 });
  }

  const body = await req.json();
  const { plannedAmount, alertThresholdPct } = body;

  const updated = await db.budgetItem.update({
    where: { id: itemId },
    data: {
      ...(plannedAmount !== undefined && { plannedAmount: Number(plannedAmount) }),
      ...(alertThresholdPct !== undefined && {
        alertThresholdPct: Math.min(100, Math.max(1, parseInt(alertThresholdPct) || 80)),
      }),
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/budgets/[budgetId]/items/[itemId] — delete a budget item
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ budgetId: string; itemId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { budgetId, itemId } = await params;

  const budget = await db.budget.findFirst({
    where: { id: budgetId, userId: session.user.id },
  });

  if (!budget) {
    return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
  }

  const item = await db.budgetItem.findFirst({
    where: { id: itemId, budgetId },
  });

  if (!item) {
    return NextResponse.json({ error: 'Budget item not found' }, { status: 404 });
  }

  await db.budgetItem.delete({ where: { id: itemId } });

  return NextResponse.json({ success: true });
}
