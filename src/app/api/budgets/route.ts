import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { db } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const budgets = await db.budget.findMany({
    where: { userId: session.user.id },
    include: { items: { include: { category: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(budgets);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { name, period, startDate, endDate, items } = body;

  const now = new Date();
  const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // [i18n fix] El nombre auto ("September 2026") debe respetar el idioma del usuario
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { preferredLang: true },
  });
  const monthLocale = user?.preferredLang === 'en' ? 'en-US' : 'es-DO';

  const budget = await db.budget.create({
    data: {
      userId: session.user.id,
      name: name || `${now.toLocaleString(monthLocale, { month: 'long' })} ${now.getFullYear()}`,
      period: period || 'monthly',
      startDate: start,
      endDate: end,
      items: items ? {
        create: items.map((item: any) => ({
          categoryId: item.categoryId,
          plannedAmount: Number(item.plannedAmount),
          alertThresholdPct: item.alertThresholdPct || 80,
        })),
      } : undefined,
    },
    include: { items: { include: { category: true } } },
  });

  return NextResponse.json(budget);
}
