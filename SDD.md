# FinZen — Software Design Document (SDD)

> **Rol de este documento:** fuente única de verdad del **diseño** de FinZen y
> de su migración hacia Spec-Driven Development, MCP y multiagentes.
> Bajo SDD, la spec precede al código: ningún cambio de arquitectura o
> contrato se implementa sin reflejarse aquí primero.
>
> Documentos hermanos: reglas operativas → `AGENTS.md` · protocolo de agentes
> de desarrollo → `agent.md` · agente orquestador runtime →
> `agents/orchestrator.md` · memoria viva → `MEMORY.md` · catálogo de
> capacidades → `skills.md` · cronología detallada → `worklog.md`.

## 1. Arquitectura General

- **Patrón Principal:** Monolito modular con Next.js 16 (App Router), Prisma 6 + Turso (libSQL) y API v1 orientada a integración con agentes.
- **Modelo Contable:** Doble entrada con cuentas reales (Asset, Liability, Equity, Investment) y cuentas virtuales (`x_<categoryId>`) para Ingresos y Gastos.
  - Gasto: `fromAccountId` = cuenta real → `toAccountId` = `x_<categoryId>`.
  - Ingreso: `fromAccountId` = `x_<categoryId>` → `toAccountId` = cuenta real (espejo del gasto).
  - Net worth = `asset + investment + equity − liability` (`src/lib/finzen/finance.ts`); las cuentas virtuales `income`/`expense` NO cuentan como riqueza.
- **Fail-Fast:** La aplicación exige `DATABASE_URL` válida en producción (Turso via `@prisma/adapter-libsql`) y `NEXTAUTH_SECRET`.
  - `src/lib/db.ts` se rehúsa a servir con SQLite efímero en producción (fix del hallazgo P0-1: cada lambda perdía datos). El `url` de `schema.prisma` es un placeholder de validación; la conexión real la construye el adapter en runtime.
- **Estado en cliente:** Zustand (`src/store/finzen-store.ts`) es la fuente única del cliente; sus interfaces son la frontera de tipos y deben permanecer sincronizados con `prisma/schema.prisma` (la asignación cruda en `loadData` hace que un drift compile pero rompa en runtime).
- **Capa de servicios (objetivo de la migración):** hoy la lógica de negocio vive inline en los route handlers de `src/app/api/**`. La migración la extrae a `src/lib/services/` para que API REST, UI y servidores MCP consuman las mismas funciones testeables.

## 2. Contratos de API Pública v1

- **Autenticación:** Header `X-API-Key` o `Authorization: Bearer fz_...` (validación SHA-256 + Rate Limit de 60 req/min).
  - Las keys se almacenan SOLO como hash SHA-256 (`src/lib/auth/api-key.ts`); la clave cruda nunca se loguea; permisos `read`/`read,write` (mutaciones con key sin `write` → `403 forbidden`); expiradas o desactivadas → `401`.
- **Errores:** SIEMPRE `{ success: false, error: "<codigo_snake_case>", message }`.
- **Rutas Principales:**
  - `POST /api/v1/expenses`: Registra gasto (`fromAccountId` real → `toAccountId` virtual).
  - `POST /api/v1/incomes`: Registra ingreso (`fromAccountId` virtual → `toAccountId` real).
  - `GET /api/v1/summary`: Resumen mensual consolidado (`expenses`, `income`, `net`).
  - `GET /api/v1/accounts`: Listado de cuentas del usuario (`?type=&currency=`).
  - `POST /api/v1/accounts`: Crea cuenta real (`asset`|`liability`) con `name`, `subType`, `currency` (DOP|USD), `currentBalance`, `institution`, `lastFour` → `201 { success, account }`. Permite al agente mantener el net worth (préstamos/inversiones) sin intervención humana.
  - `PATCH /api/v1/accounts/:id`: Edición parcial de campos seguros (`name`, `currentBalance`, `institution`, `lastFour`, `subType`). `currentBalance` es **ajuste directo** (los saldos de préstamos/inversiones vienen del banco; NO se recalculan desde transacciones). `currency`/`accountType` → `422 field_not_editable`.
  - `DELETE /api/v1/accounts/:id`: Protege el historial — si la cuenta tiene transacciones (`fromAccountId`/`toAccountId`) → `409 account_has_transactions` (+ `transactionCount`); vacía → borrado físico `200 { success, id, deleted: true }`.
  - Complementarias: `GET /api/v1/expenses|incomes` (`?limit` def 50 máx 200, `?month=YYYY-MM`) y `PATCH`/`DELETE /api/v1/expenses|incomes/:id`.
- **Convenciones de payload (innegociables):**
  - `amount > 0` obligatorio; `currency` `DOP`|`USD` (default `DOP`).
  - Cuentas: `accountType` `asset`|`liability` (default `asset`); `subType` `checking|savings|credit_card|cash|crypto_wallet|investment|loan` (default `checking`, alias `credit`→`credit_card`); `currentBalance` número finito (default `0`; pasivo se almacena positivo = deuda).
  - Toda la lógica de cuentas vive en `src/lib/services/accounts-service.ts` (primer servicio de la capa de la Fase 1); las rutas v1 y la interna `/api/accounts` son adaptadores delgados que comparten el servicio y su guard de integridad.
  - `category` texto libre con fuzzy-match (`name`/`nameEs`) y **autocreación** (`src/lib/finzen/v1-helpers.ts`).
  - Cuenta con prioridad `account_id` > `accountId` > `account` > default; si el usuario especificó una y no existe → `422 account_not_found` (sin fallback silencioso).
  - `date` ISO (default hoy); `importSource: 'api_v1'`; `tags: 'api_v1'`.
- **Deuda del contrato:** las rutas legacy `/api/agent/*` duplican capacidades sin rate limit y con otro shape de error (`{ error }`). Se deprecan en la Fase 0 del roadmap (§6).

## 3. Estrategia de Extensión MCP (Model Context Protocol)

- Las capacidades de `src/lib/services/` y `src/lib/finzen/v1-helpers.ts` se expondrán como Servidores MCP usando `@modelcontextprotocol/sdk`.
  - `src/lib/services/` se crea en la Fase 1 (§6) extrayendo la lógica de los route handlers; `v1-helpers.ts` ya es código de servicio reutilizable tal cual.
- Reutilización directa de la autenticación por `ApiKey` existente: una misma key del usuario autentica la API REST y las tools MCP (misma tabla `ApiKey`: hash, permisos, `isActive`, `expiresAt`, `lastUsedAt`).
- **Catálogo inicial de tools** (inventario completo con estado en `skills.md`):

  | Tool MCP | Origen de la capacidad hoy |
  |---|---|
  | `record_expense` / `record_income` | Routes v1 + `v1-helpers` (resolución fuzzy de categoría y cuenta) |
  | `create_account` / `update_account` / `delete_account` | Routes v1 `POST /api/v1/accounts` + `PATCH`/`DELETE /api/v1/accounts/:id` + servicio `src/lib/services/accounts-service.ts` |
  | `list_transactions` | `GET /api/v1/expenses|incomes` + legacy `/api/agent/transactions` |
  | `get_financial_summary` | `GET /api/v1/summary` |
  | `get_net_worth` / `budget_progress` / `alerts` | `finance.ts` + legacy `/api/agent/summary` (ya lo computa server-side) |
  | `convert_currency` | `currency.ts` — **requiere proveedor de FX con caché** (hoy tasas estáticas) |
  | `parse_receipt` | `ocr.ts` — **migrar de cliente a servidor** (hoy tesseract.js en navegador) |
  | `import_csv` | `import-view.tsx` → `POST /api/restore` (bulk idempotente) |
  | `import_bank_statement` | `ofx.ts` + `bank-presets.ts` + `bank-import-flow.tsx` (CSV con presets de bancos dominicanos y OFX/QFX estándar; dedup idéntico al de CSV) |

- **Transporte:** HTTP streamable para convivir con la app en Vercel; `stdio` solo para desarrollo local.
- **Rate limiting:** el limitador actual es en memoria (sliding window por instancia — NO compartido entre lambdas). El gateway MCP requiere un almacén compartido (Redis/Upstash o tabla en Turso) antes de la exposición pública.
- **Regla SDD para tools:** cada tool MCP nace de (1) un skill documentado en `skills.md`, (2) una función de servicio testeable en `src/lib/services/`, (3) su contrato reflejado en este documento, y (4) el nombre que invoca el Agente Orquestador (`agents/orchestrator.md`). Nunca lógica inline en el handler.

## 4. Modelo de Datos (`prisma/schema.prisma`)

8 modelos, dialecto SQLite con `previewFeatures = ["driverAdapters"]`:

| Modelo | Rol | Campos / convenciones clave |
|---|---|---|
| `User` | Dueño de todos los datos | `email` unique, `passwordHash`, `preferredLang`, `baseCurrency`, `theme` |
| `Session` | NextAuth | `sessionToken` unique (producción usa JWT; el modelo queda por compatibilidad) |
| `Account` | Cuentas reales y virtuales | `accountType` asset\|liability\|equity\|income\|expense · `subType` · `currency` · `currentBalance` |
| `Category` | Clasificación | `name`/`nameEs`/`nameEn`, `direction` income\|expense\|transfer, `isSystem`, `sortOrder`, `userId` nullable (globales del sistema) |
| `Transaction` | Asiento double-entry | `type` income\|expense\|transfer\|adjustment · `fromAccountId`/`toAccountId` (reales o `x_<categoryId>`) · `categoryId` (SetNull) · `tags` (string CSV) · `importSource` |
| `Budget` / `BudgetItem` | Presupuestos | `period`, `plannedAmount`, `alertThresholdPct` (default 80) |
| `ApiKey` | Integración IA | `keyHash` unique SHA-256 · `keyPrefix` · `permissions` (CSV) · `lastUsedAt` · `expiresAt` · `isActive` |

- La relación Account↔Transaction es **por convención de strings, sin FK** — es lo que habilita los IDs virtuales `x_<categoryId>`.
- Índices: `[userId, occurredOn]`, `[fromAccountId]`, `[categoryId]` (Transaction); `[userId]` (Account, Category, ApiKey).
- `schema.prisma` es la única fuente de verdad de datos.

## 5. Convenciones Transversales (resumen; detalle en `AGENTS.md` §5)

1. Monedas: siempre `CurrencyCode` (`USD|DOP|EUR|USDT|BTC`) + utilidades de `src/lib/finzen/currency.ts`; montos con `tabular-nums`.
2. i18n: toda string visible en `src/lib/finzen/i18n.ts` (es + en), consumida con `translations[locale]`.
3. UI: solo tokens semánticos (`bg-surface`, `var(--income)`, …). Prohibidos colores crudos y datos decorativos falsos (deltas/sparklines sin base real no se muestran).
4. Seguridad: keys solo hasheadas; jamás loguear la clave cruda; secrets fuera del código; `.env` gitignored.
5. React Compiler: disables puntuales SOLO para `react-hooks/preserve-manual-memoization` cuando las deps derivan de `new Date()`.
6. Verificación obligatoria al cerrar cualquier tarea: `bun run lint && bun run typecheck && bun run build`.

## 6. Roadmap de Migración (SDD → Servicios → MCP → Multiagentes)

| Fase | Objetivo | Criterios de salida |
|---|---|---|
| **0 — Consolidación** | Deprecar `/api/agent/*` (o redirigir a v1) · rate limit sobre almacén compartido · limpiar dependencias muertas (`z-ai-web-dev-sdk`) · Vitest para `lib/finzen/` (finance, currency, date-utils — funciones puras) | Triple verificación ✓ · tests de dominio ✓ · E2E curl v1 ✓ |
| **1 — Capa de servicios** | Extraer la lógica de `src/app/api/**` a `src/lib/services/` (transactions, accounts, budgets, alerts); los routes quedan como adaptadores delgados | Contratos v1 intactos (E2E existentes como red de seguridad) · cobertura de servicios |
| **2 — SDD formal** | Specs por feature · `skills.md` como catálogo vivo · tipos compartidos generados (fin del drift store↔Prisma) | Toda capacidad nueva nace documentada en `skills.md` antes de codificarse |
| **3 — Servidor MCP** | Tools MCP sobre `src/lib/services/` con `@modelcontextprotocol/sdk`, auth por `ApiKey`, transporte HTTP | E2E MCP con API key real · rate limit compartido operativo |
| **4 — Multiagentes** | Roles definidos en `agent.md` (arquitecto, implementador, verificador, ops) operando con skills + MCP | Un flujo completo ejecutado por agentes con verificación automática |

- Cada fase cierra con: triple verificación ✓ + tests de la fase + `MEMORY.md` actualizado + entrada en `worklog.md`.
- Ninguna fase rompe el contrato v1 existente.

## 7. Riesgos y Deuda Vigilados (detalle en `MEMORY.md` §5)

1. **Cero tests automatizados** — el mayor riesgo para delegar trabajo a agentes; la Fase 0 lo ataca primero.
2. **FX estáticas** — la tool `convert_currency` exige proveedor externo con caché.
3. **Rate limit en memoria** — inválido en serverless multi-lambda; bloqueador de la Fase 3.
4. **Secreto NextAuth en historial de git** — rotar en Vercel si aún coincide.
5. **Dualidad `/api/v1` vs `/api/agent`** — contratos divergentes; consolidar en Fase 0.
6. **Drift de tipos store↔Prisma** — asignación `any` en `loadData`; resolver con generación de tipos (Fase 2).
7. **DELETE de cuentas sin verificar referencias** — ~~deja transacciones huérfanas~~ **RESUELTO (8.2, 22-oct-2026)**: guard en el servicio compartido `accounts-service.ts`; las rutas v1 e interna `/api/accounts/:id` rechazan con `409 account_has_transactions` cuando la cuenta tiene transacciones.
