# FinZen — Finanzas personales y del hogar

App de gestión de finanzas personales multi-moneda (USD, DOP, EUR, USDT, BTC), con
español/inglés, modo claro/oscuro, OCR de recibos, API para agentes de IA y motor de alertas.

> 📘 **Desarrollo sostenible:**
> - [`AGENTS.md`](./AGENTS.md) — reglas operativas y convenciones (leer ANTES de tocar código)
> - [`MEMORY.md`](./MEMORY.md) — memoria del proyecto: decisiones, estado y deuda técnica
> - [`worklog.md`](./worklog.md) — historial detallado fase por fase

## Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **UI:** Tailwind CSS 4 + shadcn/ui + Radix
- **Estado:** Zustand
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

bun run db:generate   # genera el cliente Prisma

bun run dev           # http://localhost:3000
```

En desarrollo sin `DATABASE_URL`, la app usa SQLite local (`file:`) con seed automático.
En **producción la app se rehúsa a arrancar sin Turso** y **sin `NEXTAUTH_SECRET`**
(fail-fast) — una lambda mal configurada perdería datos o firmaría sesiones con
un secreto desconocido (auditoría 27-sep-2026, P0-1).

## Scripts

| Comando | Descripción |
|---|---|
| `bun run dev` | Servidor de desarrollo (puerto 3000) |
| `bun run lint` | ESLint |
| `bun run typecheck` | TypeScript estricto (`tsc --noEmit`) |
| `bun run build` | Build de producción (standalone) |
| `bun run vercel-build` | Build para Vercel |
| `bun run db:push` | Aplica schema.prisma a la DB de `DATABASE_URL` |
| `bun run verify` | Barrera de calidad completa: lint + typecheck + build |

**Antes de dar por terminada cualquier tarea:** `bun run verify` (o `bun run lint && bun run typecheck && bun run build`).

## Variables de entorno

Ver `.env.example`. En Vercel configura como mínimo:

- `DATABASE_URL` — `libsql://...?authToken=...` (Production **y** Preview)
- `NEXTAUTH_SECRET` — `openssl rand -base64 32` (**obligatoria**: fail-fast sin ella)

## Estructura

```
prisma/schema.prisma     # 8 modelos (User, Session, Account, Category, Transaction, Budget, BudgetItem, ApiKey)
src/app/api/             # API routes (auth, accounts, transactions, budgets, v1/*)
src/components/finzen/   # Vistas (dashboard, transacciones, cuentas, presupuestos, ...)
src/lib/db.ts            # PrismaClient: Turso (prod) / file SQLite (dev) con fail-fast
src/lib/finzen/          # i18n, monedas/FX, categorías seed, OCR, lógica financiera
src/lib/auth/            # NextAuth options, API keys (SHA-256), verificación v1
src/store/finzen-store.ts # Estado global (Zustand) — frontera de tipos del cliente
scripts/                 # Utilidades ESM (migración a Turso, keys, seeds)
```

## API pública para agentes de IA

Los usuarios generan API keys en Ajustes → Integración con Agentes IA:

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/v1/expenses` | Registrar gasto (acepta `account_id`) |
| `GET` | `/api/v1/expenses` | Listar gastos (`?limit=&month=`) |
| `PATCH`/`DELETE` | `/api/v1/expenses/:id` | Editar / borrar gasto |
| `POST`/`GET` | `/api/v1/incomes` | Registrar / listar ingresos |
| `PATCH`/`DELETE` | `/api/v1/incomes/:id` | Editar / borrar ingreso |
| `POST` | `/api/v1/accounts` | Crear cuenta (asset/liability) — el agente mantiene el net worth |
| `GET` | `/api/v1/accounts` | Listar cuentas (`?type=&currency=`) |
| `PATCH`/`DELETE` | `/api/v1/accounts/:id` | Editar saldo/campos (ajuste directo) · Borrar (`409` si tiene transacciones) |
| `GET` | `/api/v1/summary` | Resumen mensual: gastos + ingresos + net por categoría |

Autenticación: header `Authorization: Bearer fz_...` o `x-api-key`.
Errores siempre con shape `{ success: false, error: "<codigo_snake>" }`.

## Estado del proyecto

**Calidad (29-sep-2026):** `lint` ✓ `typecheck` ✓ `build` ✓ — ver `MEMORY.md` §4
para el detalle de la última sesión y §5 para la deuda técnica conocida
(P0-1 divergencia de DB y P0-2 sheet de transacción ya corregidos).
