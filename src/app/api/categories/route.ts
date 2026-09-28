import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { db } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const categories = await db.category.findMany({
    where: {
      OR: [
        { userId: session.user.id },
        { userId: null },
      ],
    },
    orderBy: { sortOrder: 'asc' },
  });

  return NextResponse.json(categories);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { name, nameEs, nameEn, icon, color, direction } = body;

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  // Get max sortOrder for this user
  const maxSort = await db.category.aggregate({
    where: { userId: session.user.id },
    _max: { sortOrder: true },
  });

  const category = await db.category.create({
    data: {
      userId: session.user.id,
      name,
      nameEs: nameEs || name,
      nameEn: nameEn || name,
      icon: icon || '📦',
      color: color || '#6B7280',
      direction: direction || 'expense',
      isSystem: false,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });

  return NextResponse.json(category);
}
