import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { db } from '@/lib/db';

// DELETE — revoke an API key
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const existing = await db.apiKey.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await db.apiKey.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

// PATCH — update key (rename, change permissions, deactivate)
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
  const { name, permissions, isActive } = body;

  const existing = await db.apiKey.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const updated = await db.apiKey.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(permissions !== undefined && { permissions }),
      ...(isActive !== undefined && { isActive }),
    },
    select: { id: true, name: true, permissions: true, isActive: true },
  });

  return NextResponse.json(updated);
}
