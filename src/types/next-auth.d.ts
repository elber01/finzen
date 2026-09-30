import type { DefaultSession } from 'next-auth';

/**
 * NextAuth module augmentation — FinZen.
 * El session callback en `auth-options.ts` inyecta `user.id` desde el JWT;
 * esta declaración hace que el tipo sea visible en toda la app
 * (API routes usan `session.user.id` como userId de Prisma).
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
  }
}
