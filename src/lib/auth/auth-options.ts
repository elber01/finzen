import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { db, ensureDb } from '@/lib/db';

// [security] Resolución del secreto de NextAuth:
// - Si NEXTAUTH_SECRET está definida → se usa (única ruta válida en producción).
// - En producción SIN la variable → fail-fast: la app se rehúsa a arrancar.
//   Firmar sesiones con un secreto conocido invalida la autenticación.
// - En desarrollo SIN la variable → fallback local (el sandbox puede perder
//   el .env en reinicios). Este valor estuvo en git históricamente; es solo
//   para dev, NUNCA debe llegar a producción.
const DEV_FALLBACK_SECRET = 'VyzXVzZYEiiKvANc0kLZZ8NdTF5x9m77YHs/wkAz/NU=';

function resolveAuthSecret(): string {
  const envSecret = process.env.NEXTAUTH_SECRET;
  if (envSecret) return envSecret;
  // `next build` importa los módulos de ruta para recolectar metadata;
  // no hay runtime real ni sesiones que firmar — no fallar ahí.
  // El fail-fast aplica cuando la app ATIENDE requests en producción.
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return DEV_FALLBACK_SECRET;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[finzen] NEXTAUTH_SECRET no está definida. Es obligatoria en producción. ' +
      'Genérala con: openssl rand -base64 32 — y configúrala en el entorno ' +
      '(p. ej. Vercel → Settings → Environment Variables). La app se rehúsa a ' +
      'arrancar con un secreto desconocido/fallback (auditoría 27-sep-2026, P0).'
    );
  }
  console.warn(
    '[finzen] NEXTAUTH_SECRET no definida — usando fallback de desarrollo. ' +
    'NO apto para producción.'
  );
  return DEV_FALLBACK_SECRET;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Ensure DB schema is initialized (Vercel serverless cold start)
        await ensureDb();

        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });

        if (!user) {
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: resolveAuthSecret(),
};
