import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { db } from '@/lib/db';

// Get current user profile (including preferences)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      preferredLang: true,
      baseCurrency: true,
      theme: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(user);
}

// Update user preferences (lang, currency, theme)
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { preferredLang, baseCurrency, theme, name } = body;

  const updated = await db.user.update({
    where: { id: session.user.id },
    data: {
      preferredLang: preferredLang ?? undefined,
      baseCurrency: baseCurrency ?? undefined,
      theme: theme ?? undefined,
      name: name ?? undefined,
    },
    select: {
      id: true,
      email: true,
      name: true,
      preferredLang: true,
      baseCurrency: true,
      theme: true,
    },
  });

  return NextResponse.json(updated);
}

// Delete account permanently (settings → danger zone).
// El schema no tiene FKs — la cascada es manual. Orden: dependencias primero.
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id as string;

  try {
    await db.transaction.deleteMany({ where: { userId } });

    const budgets = await db.budget.findMany({ where: { userId }, select: { id: true } });
    if (budgets.length > 0) {
      await db.budgetItem.deleteMany({ where: { budgetId: { in: budgets.map((b) => b.id) } } });
    }
    await db.budget.deleteMany({ where: { userId } });

    await db.account.deleteMany({ where: { userId } });
    await db.category.deleteMany({ where: { userId } });
    await db.apiKey.deleteMany({ where: { userId } });
    await db.session.deleteMany({ where: { userId } });

    await db.user.delete({ where: { id: userId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[finzen] DELETE /api/me failed:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
