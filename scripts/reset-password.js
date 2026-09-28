/**
 * Reset Edwin's password so he can log back in after being logged out.
 * Uses bcryptjs (same lib as auth-options.ts).
 *
 * Run: node scripts/reset-password.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const db = new PrismaClient({ datasources: { db: { url: 'file:/home/z/my-project/db/custom.db' } } });

(async () => {
  const email = process.env.SEED_EMAIL || 'hamilton.edwin@gmail.com';
  // [security] La contraseña real nunca va en el código — pásala por env.
  const newPassword = process.env.NEW_PASSWORD;
  if (!newPassword) {
    console.error('NEW_PASSWORD env var requerida (ej: NEW_PASSWORD=xxx node scripts/reset-password.js)');
    process.exit(1);
  }

  // Generate bcrypt hash (10 rounds — matches auth-options.ts default)
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(newPassword, salt);

  const updated = await db.user.update({
    where: { email },
    data: { passwordHash: hash },
    select: { id: true, email: true, name: true },
  });

  console.log('=== PASSWORD RESET ===');
  console.log('User:', JSON.stringify(updated, null, 2));
  console.log('New password:', newPassword);
  console.log('Hash preview:', hash.substring(0, 30) + '...');
  console.log('');
  console.log('You can now log in at the app with:');
  console.log('  Email:    ', email);
  console.log('  Password: ', newPassword);

  // Also: delete all sessions for this user so any stale session is invalidated
  const delSessions = await db.session.deleteMany({
    where: { userId: updated.id },
  });
  console.log('Stale sessions deleted:', delSessions.count);

  await db.$disconnect();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
