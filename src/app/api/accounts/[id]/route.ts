import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { db } from '@/lib/db';
import { deleteAccountForUser } from '@/lib/services/accounts-service';

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
  const { name, subType, accountType, currency, currentBalance, institution } = body;

  const existing = await db.account.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const updated = await db.account.update({
    where: { id },
    data: {
      name: name ?? existing.name,
      accountType: accountType ?? existing.accountType,
      subType: subType ?? existing.subType,
      currency: currency ?? existing.currency,
      currentBalance: currentBalance !== undefined ? Number(currentBalance) : existing.currentBalance,
      institution: institution ?? existing.institution,
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

  // Delegate to the service layer — refuses to delete accounts with linked
  // transactions (409) to preserve the double-entry history.
  const result = await deleteAccountForUser(session.user.id, id);
  if (!result.ok) {
    if (result.code === 'not_found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: result.message, code: result.code, transactionCount: result.transactionCount },
      { status: 409 }
    );
  }

  return NextResponse.json({ success: true });
}
