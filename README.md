# FinZen — Finanzas personales y del hogar

App de gestión de finanzas personales multi-moneda (USD, DOP, EUR, USDT, BTC), con
español/inglés, modo claro/oscuro, OCR de recibos, API para agentes de IA y motor de alertas.

## Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **UI:** Tailwind CSS 4 + shadcn/ui + Radix
- **Estado:** Zustand + React Query
- **Datos:** Prisma 6 + **Turso (libSQL)** — hosted; SQLite local solo en desarrollo
- **Auth:** NextAuth v4 (Credentials, JWT)
- **Runtime:** Bun

## Requisitos

- Bun ≥ 1.4
- Una base de datos Turso (gratuita en [turso.tech](https://turso.tech))

## Setup

```bash
bun install

cp .env.example .env
# → completa DATABASE_URL (libsql://...) y NEXTAUTH_SECRET

bun run prisma:generate  # genera el cliente Prisma

bun run dev              # http://localhost:3000
```

En desarrollo sin `DATABASE_URL`, la app usa SQLite local (`file:`) con seed automático.
En **producción sin Turso la app se rehúsa a arrancar** (fail-fast) — con SQLite efímero
cada lambda de Vercel tendría su propia DB y se perderían datos (auditoría 27-sep-2026, P0-1).

## Scripts

| Comando | Descripción |
|---|---|
| `bun run dev` | Servidor de desarrollo (puerto 3000) |
| `bun run vercel-build` | Build para Vercel (standalone) |
| `bun run db:push` | Aplica schema.prisma a la DB de `DATABASE_URL` |
| `bun run lint` | ESLint |

## Variables de entorno

Ver `.env.example`. En Vercel configura como mínimo:

- `DATABASE_URL` — `libsql://...?authToken=...` (Production **y** Preview)
- `NEXTAUTH_SECRET` — `openssl rand -base64 32`

## Estructura

```
prisma/schema.prisma     # 9 modelos (User, Account, Category, Transaction, Budget, ApiKey, ...)
src/app/api/             # API routes (auth, accounts, transactions, budgets, v1/*)
src/components/finzen/   # Vistas (dashboard, transacciones, cuentas, presupuestos, ...)
src/lib/db.ts            # PrismaClient: Turso (prod) / file SQLite (dev) con fail-fast
src/lib/finzen/          # i18n, monedas/FX, categorías seed, OCR
scripts/                 # Utilidades (migración a Turso, keys, etc.)
```

## API pública para agentes de IA

Los usuarios generan API keys en Ajustes → Integración con Agentes IA:

```
POST /api/v1/expenses    — registrar gasto      (key con permiso write)
GET  /api/v1/expenses    — listar gastos        (?limit=&month=)
GET  /api/v1/summary     — resumen mensual      (?month=YYYY-MM)
```

Autenticación: header `Authorization: Bearer fz_...` o `x-api-key`.

## Estado del proyecto

Ver `worklog.md` (historial detallado) y los reportes de auditoría de 27-sep-2026
(`/tmp/opencode/finzen-audit/`): scorecard, hallazgos P0–P3 y kit de remediación.
P0-1 (divergencia de DB) y P0-2 (sheet de transacción pegado) ya están corregidos en este repo.
