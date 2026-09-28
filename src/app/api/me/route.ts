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
