# AGENTS.md — Reglas operativas de FinZen

Guía obligatoria para **agentes IA y desarrolladores** que trabajen en este repo.
Objetivo: desarrollo sostenible — que cualquier sesión nueva produzca código
consistente, verificado y sin regresiones.

> Memoria histórica del proyecto: ver **`MEMORY.md`**.
> Estado técnico detallado por fase: ver **`worklog.md`**.

---

## 1. Qué es FinZen

App web de finanzas personales y del hogar: multi-moneda (USD/DOP/EUR/USDT/BTC),
español/inglés, claro/oscuro, OCR de recibos, presupuestos, reportes y una
**API pública v1** para agentes de IA (gastos, ingresos, resúmenes, cuentas).

## 2. Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) + React 19 + TypeScript strict |
| UI | Tailwind CSS 4 + shadcn/ui + Radix + lucide-react + recharts |
| Animación | framer-motion (`ViewTransition` en vistas del shell) |
| Estado | Zustand (`src/store/finzen-store.ts`) — fuente única en cliente |
| Datos | Prisma 6 + Turso (libSQL) en prod; SQLite `file:` en dev |
| Auth | NextAuth v4 (Credentials + JWT, 30 días) |
| Runtime | **Bun** (no npm/node) |

## 3. Comandos esenciales

```bash
bun install              # dependencias
bun run dev              # http://localhost:3000 (puerto 3000)
bun run lint             # ESLint — DEBE pasar sin errores
bun run typecheck         # tsc --noEmit — DEBE pasar sin errores
bun run build            # build de producción (Next + standalone)
bun run db:push          # aplica schema.prisma a DATABASE_URL
bun run db:generate      # regenera cliente Prisma tras editar schema
```

### Checklist de verificación — OBLIGATORIO antes de dar por terminada cualquier tarea

```bash
bun run lint && bun run typecheck && bun run build
```

Si algo falla, se arregla **antes** de cerrar la tarea. No existen tests
automatizados todavía (ver deuda en `MEMORY.md`), así que esta triple
verificación es la barrera de calidad mínima.

## 4. Arquitectura clave (leer antes de tocar)

### Double-entry con cuentas virtuales
- Cada `Transaction` mueve `fromAccountId` → `toAccountId`.
- Un ID de cuenta puede ser **real** (cuenta del usuario) o **virtual** con
  formato `x_<categoryId>` (asiento de gasto/ingreso por categoría).
- **Net worth** (`src/lib/finzen/finance.ts`): `asset + investment + equity − liability`.
  Las cuentas `income`/`expense` son virtuales y NO cuentan.
- Las **transferencias** entre cuentas reales no alteran el net worth.

### Base de datos — Turso con fail-fast
- `src/lib/db.ts`: en producción **exige** `DATABASE_URL` (`libsql://...`) y se
  rehúsa a arrancar sin ella (P0-1 de la auditoría 27-sep-2026: con SQLite
  efímero cada lambda perdería datos).
- En dev sin `DATABASE_URL` → SQLite local `file:db/custom.db` con seed.
- El `url` de `schema.prisma` es un placeholder fijo; la conexión real la
  construye el adapter `@prisma/adapter-libsql` en runtime.

### Autenticación
- Interna (rutas `/api/*`): `getServerSession(authOptions)` → `session.user.id`.
- El tipo `session.user.id` existe gracias a la augmentación en
  `src/types/next-auth.d.ts` — **no** usar `as any` para acceder a él.
- Pública (rutas `/api/v1/*`): header `Authorization: Bearer fz_...` o
  `x-api-key`; las ApiKey se almacenan solo como **hash SHA-256**
  (`src/lib/auth/api-key.ts`).

### Frontera de tipos cliente↔servidor
- Los interfaces del store (`Transaction`, `Account`, `Category`, `Budget`) son
  la frontera de tipos del cliente y **deben mantenerse sincronizados** con
  `prisma/schema.prisma`. `loadData` asigna JSON crudo (`any`), por lo que un
  drift aquí compila pero rompe en runtime.
- Monedas: SIEMPRE `CurrencyCode` (`'USD'|'DOP'|'EUR'|'USDT'|'BTC'`) y las
  utilidades de `src/lib/finzen/currency.ts` (`convertAmount`, `formatMoney`).

## 5. Convenciones de código

### UI/UX — estrictas
- **Solo tokens semánticos**: `bg-surface`, `text-muted-foreground`,
  `var(--income)`, `var(--expense)`, etc. PROHIBIDO `bg-white`, `text-gray-500`
  u otros colores crudos — rompen el dark mode y la identidad.
- **Nada de datos decorativos falsos**: deltas "+0%", sparklines inventados o
  placeholders de sesión son deuda UX. Si no hay dato real, no se muestra el
  elemento (ver `computeDelta` que devuelve `undefined` sin base de
  comparación).
- Toda string visible va en `src/lib/finzen/i18n.ts` (es + en) y se consume con
  `translations[locale]`. Nada de texto suelto bilingüe en componentes.
- Números de dinero: clase `tabular-nums` + `formatMoney`.
- Estados de carga: `Skeleton`; estados vacíos: mensaje + acción clara.
- Accesibilidad: `aria-label` en botones de icono, `aria-current` en navegación
  activa, `aria-live` en feedback dinámico.

### React Compiler (importante)
El ESLint usa React Compiler. Los `useMemo` cuyas dependencias derivan de
`new Date()` (impuro) no se pueden preservar y generan el error
`react-hooks/preserve-manual-memoization`. Convención del repo: deshabilitar
**solo esa regla, solo esa línea**:

```tsx
// eslint-disable-next-line react-hooks/preserve-manual-memoization -- deps derivan de new Date()
}, [transactions, viewYear, viewMonth, baseCurrency]);
```

### Seguridad
- **Nunca** secrets en código ni commits. `NEXTAUTH_SECRET` es fail-fast en
  producción (excepción controlada solo durante `phase-production-build`).
- `.env` es gitignored y **el sandbox lo puede perder en reinicios** — si
  desaparece, regenerarlo localmente; los secretos reales viven en Vercel.

## 6. Mapa del repo

```
prisma/schema.prisma        # 8 modelos — fuente de verdad de datos
src/app/api/                # rutas internas (sesión) + /api/v1 (API keys)
src/components/finzen/      # vistas del shell + componentes de dominio
src/components/ui/          # primitivas shadcn/ui (no editar salvo wrapper)
src/components/auth/        # formulario de login/registro
src/hooks/use-alerts.ts     # motor de alertas (presupuesto, spikes, forecast)
src/lib/finzen/             # dominio: currency, finance, i18n, ocr, date-utils
src/lib/auth/               # authOptions, api-key, verificación v1
src/store/finzen-store.ts   # estado global (Zustand) — ver §4
src/types/next-auth.d.ts    # augmentación de tipos de NextAuth
scripts/                    # utilidades de BD/keys (ESM, se corren con bun)
db/                         # SQLite local de dev + schema.sql
```

### Añadir una vista nueva
1. Crear `src/components/finzen/<vista>-view.tsx`.
2. Registrarla en `VIEWS` de `app-shell.tsx` y en `ViewKey` del store.
3. Añadirla a `NAV_ITEMS` (sidebar) y/o `MORE_ITEMS` (móvil).
4. Añadir sus claves a `i18n.ts` (es + en).

### Añadir un endpoint API
- Interno: `getServerSession(authOptions)` + early return 401 si no hay
  `session.user.id`.
- Público v1: autenticar con `authenticateApiKey` (`src/lib/auth/v1-api.ts`);
  responder SIEMPRE `{ success: false, error: "<codigo_snake>" }` en errores.

## 7. Qué NO hacer

- ❌ Commit de `.env`, `*.db`, backups o binarios ajenos al proyecto.
- ❌ Usar SQLite efímero en producción (`FINZEN_ALLOW_EPHEMERAL_DB` es solo
  para demos desechables).
- ❌ Colores crudos o texto de UI sin i18n.
- ❌ Placeholders fake en KPIs/sesión ("Mi Perfil —", "+0%").
- ❌ `as any` para esquivar tipos — arreglar la raíz (ej: augmentación).
- ❌ Tocar `src/components/ui/*` salvo integración — son primitivas estándar.
- ❌ Cerrar una tarea sin que pasen `lint` + `typecheck` + `build`.
