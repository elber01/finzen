import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { db } from '@/lib/db';

// POST /api/restore — import bulk transactions from JSON
// Used to recover data lost during sandbox resets
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { transactions, accounts } = body;

  let restoredTx = 0;
  let restoredAcct = 0;

  // Restore accounts
  if (accounts && Array.isArray(accounts)) {
    for (const a of accounts) {
      const existing = await db.account.findUnique({ where: { id: a.id } });
      if (!existing) {
        await db.account.create({
          data: {
            id: a.id,
            userId: session.user.id,
            name: a.name,
            accountType: a.accountType || 'asset',
            subType: a.subType || 'checking',
            currency: a.currency || 'USD',
            currentBalance: a.currentBalance || 0,
            institution: a.institution || null,
          },
        });
        restoredAcct++;
      }
    }
  }

  // Restore transactions
  if (transactions && Array.isArray(transactions)) {
    for (const t of transactions) {
      const existing = await db.transaction.findUnique({ where: { id: t.id } });
      if (!existing) {
        try {
          await db.transaction.create({
            data: {
              id: t.id,
              userId: session.user.id,
              type: t.type,
              amount: Number(t.amount),
              currency: t.currency || 'DOP',
              fromAccountId: t.fromAccountId,
              toAccountId: t.toAccountId,
              categoryId: t.categoryId || null,
              description: t.description || '',
              occurredOn: new Date(t.occurredOn),
              tags: typeof t.tags === 'string' ? t.tags : (Array.isArray(t.tags) ? t.tags.join(',') : ''),
              importSource: t.importSource || 'csv',
            },
          });
          restoredTx++;
        } catch (e) {
          // Skip transactions with invalid foreign keys
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    restoredAccounts: restoredAcct,
    restoredTransactions: restoredTx,
  });
}
