# FinZen — Catálogo de Skills (Habilidades de IA)

> **Qué es una skill:** una capacidad probada y documentada — la unidad que
> hoy se contrata vía API v1 / UI y mañana vía tools MCP (ver `SDD.md` §3).
> Este catálogo es la fuente de verdad de los contratos Entrada/Salida de
> cada skill; los nombres invocables los consume el Orquestador
> (`agents/orchestrator.md`).
>
> **Estados MCP:**
> - ✅ **lista** — ya es función de servidor reutilizable por un MCP server.
> - 🔧 **extraer** — la lógica existe pero vive inline en handlers; mover a `src/lib/services/` (Fase 1).
> - 🔄 **migrar a servidor** — hoy solo funciona en el navegador.
> - 🌐 **requiere fuente externa** — necesita un proveedor externo con caché.

## Formato de alta (SDD)

```markdown
### `<nombre_snake_case>`
- **Descripción:** qué hace.
- **Ubicación Backend:** ruta(s) de archivo (y función).
- **Entrada:** shape tipado.
- **Salida:** shape tipado.
- **Estado MCP:** lista | extraer | migrar a servidor | requiere fuente externa.
- **Verificación:** cómo se prueba (test, E2E curl, manual).
```

## 1. Consultas y Analítica

### `get_net_worth`
- **Descripción:** Calcula el patrimonio neto real del usuario.
- **Ubicación Backend:** `computeNetWorth()` en `src/lib/finzen/finance.ts` (`:14`; junto a `computeTotalAssets` `:39` y `computeTotalLiabilities` `:52`).
- **Entrada:** `{ userId: string }`
- **Salida:** `{ netWorth: number, assets: number, liabilities: number }`
- **Notas de implementación:** las funciones puras reciben `accounts[]` + `baseCurrency` (cada balance se convierte con `convertAmount`); el scoping por `userId` vive hoy inline en legacy `GET /api/agent/summary` (que retorna `netWorth, totalAssets, totalLiabilities`). El contrato de esta skill (`assets`/`liabilities`) prevalece sobre el naming del legacy al extraer el servicio (Fase 1). Cuentas `income`/`expense` = virtuales → se ignoran.
- **Estado MCP:** 🔧 extraer (funciones puras ✅; falta el servicio por `userId`).
- **Verificación:** test unitario de las funciones puras (Vitest, Fase 0) · legacy route en producción.

### `get_financial_summary`
- **Descripción:** Retorna totales de ingresos, gastos, net y desglose por categorías para un mes.
- **Ubicación Backend:** `GET /api/v1/summary`.
- **Entrada:** `{ month: "YYYY-MM" }`
- **Salida:** `{ success, month, currency, expenses: { total, count, byCategory: [{ category, total, count }] }, income: { …misma forma que expenses… }, net }`
- **Notas:** `currency` es la más frecuente entre las transacciones del mes (estadística, NO conversión); `400 invalid_month` si el formato no es `YYYY-MM`.
- **Estado MCP:** 🔧 extraer.
- **Verificación:** E2E curl fases 7.5–7.9 en producción ✓.

### `list_transactions`
- **Descripción:** Lista transacciones del usuario con filtros opcionales.
- **Ubicación Backend:** `GET /api/v1/expenses` e `GET /api/v1/incomes` (+ legacy `GET /api/agent/transactions`, con más filtros).
- **Entrada:** `{ limit?: number (def 50, máx 200), month?: "YYYY-MM" }` — el legacy añade `type`, `categoryId`, `fromDate`, `toDate`, `search`.
- **Salida:** `{ success, count, expenses|incomes: [{ id, amount, currency, category, description, date, account }] }`
- **Estado MCP:** 🔧 extraer (unificar v1 + legacy en un solo servicio).
- **Verificación:** E2E curl fases 7.5–7.9 ✓.

### `budget_progress` y `alerts`
- **Descripción:** Progreso por categoría contra el presupuesto y alertas derivadas.
- **Ubicación Backend:** server-side en legacy `GET /api/agent/summary`; motor cliente en `src/hooks/use-alerts.ts:21` (umbrales de presupuesto, spikes, forecast).
- **Entrada:** `{ month?: "YYYY-MM" (def mes actual) }`
- **Salida:** `budgetProgress: [{ category, categoryEs, icon, planned, spent, remaining, pct, threshold }]` · `alerts: [{ severity: "critical"|"warning", message }]`
- **Notas:** alertas: categoría ≥ 100% (critical), ≥ threshold (warning), savings ratio < 10% (warning).
- **Estado MCP:** 🔧 extraer (unificar motor cliente + versión server).
- **Verificación:** manual UI + respuesta del legacy route.

## 2. Registro y Transacciones

### `record_expense`
- **Descripción:** Registra un nuevo gasto asociando cuenta real y categoría.
- **Ubicación Backend:** `POST /api/v1/expenses`.
- **Entrada:** `{ amount: number, currency: "DOP"|"USD", category: string, account_id?: string, description?: string }`
- **Salida:** `201 { success, id, expense: { id, amount, currency, category, merchant, description, date, account: { id, name, currency }, account_source } }`
- **Notas de implementación:** la API acepta además `merchant`, `date` (ISO, def hoy) y alias `accountId`/`account` (nombre). Categoría por fuzzy matching (ver `resolve_category`); cuenta con prioridad `account_id` y **sin fallback silencioso** si la explícita no existe. Asiento double-entry: `fromAccountId` real → `toAccountId = x_<categoryId>`; `tags/importSource = 'api_v1'`.
- **Errores:** `401 missing_api_key|invalid_api_key` · `403 forbidden` · `422 invalid_json|invalid_amount|invalid_date|account_not_found|no_account` · `429 rate_limited` — siempre `{ success: false, error: snake_case }`.
- **Estado MCP:** 🔧 extraer.
- **Verificación:** batería E2E curl fases 7.5–7.9 (12+10 tests en producción ✓).

### `record_income`
- **Descripción:** Registra un nuevo ingreso especificando la cuenta de destino.
- **Ubicación Backend:** `POST /api/v1/incomes`.
- **Entrada:** igual que `record_expense`.
- **Salida:** `201 { success, id, income: { …misma forma que expense… } }`
- **Notas:** asiento espejo del gasto: `fromAccountId = x_<categoryId>` → `toAccountId` real; `direction: 'income'` en la autocreación de categoría.
- **Estado MCP:** 🔧 extraer.
- **Verificación:** E2E curl fase 7.9 en producción ✓.

### Cuentas (CRUD v1 — 8.2)

`create_account`
- **Descripción:** Crea una cuenta real (activo o pasivo) para que el agente mantenga el net worth sin intervención humana (préstamos, inversiones).
- **Ubicación Backend:** `POST /api/v1/accounts` + `createAccountForUser()` en `src/lib/services/accounts-service.ts`.
- **Entrada:** `{ name: string (req), accountType?: "asset"|"liability" (def "asset"), subType?: "checking"|"savings"|"credit_card"|"cash"|"crypto_wallet"|"investment"|"loan" (def "checking", alias `credit`→`credit_card`), currency?: "DOP"|"USD" (def "DOP"), currentBalance?: number (def 0, pasivo positivo = deuda), institution?: string, lastFour?: string (2–4 dígitos) }`
- **Salida:** `201 { success: true, account: { id, name, accountType, subType, currency, currentBalance, institution, lastFour } }`
- **Errores:** `401 missing_api_key|invalid_api_key` · `403 forbidden` · `422 invalid_json|invalid_name|invalid_account_type|invalid_sub_type|invalid_currency|invalid_balance|invalid_last_four|invalid_institution` · `429 rate_limited`.
- **Notas:** NO crea cuentas virtuales `income`/`expense` (esas nacen de las categorías); no hay dedup por nombre (el schema no es unique).
- **Estado MCP:** 🔧 extraer (servicio ya separado).
- **Verificación:** `scripts/e2e-accounts-v1.js` (dev y prod).

`update_account`
- **Descripción:** Edita campos seguros de una cuenta. Caso de uso principal: actualizar el saldo real de un préstamo/inversión cada mes (viene del banco, no del flujo).
- **Ubicación Backend:** `PATCH /api/v1/accounts/:id` + `updateAccountForUser()` en `src/lib/services/accounts-service.ts`.
- **Entrada:** `{ name?, currentBalance?, institution?, lastFour?, subType? }` — todos opcionales; ausente = no tocar. `currentBalance` acepta `0` (p. ej. préstamo saldado) y cualquier número finito.
- **Salida:** `200 { success: true, account: { …misma forma que create… } }`
- **Errores:** `401|403` · `404 not_found` · `422 invalid_json|invalid_name|invalid_balance|invalid_sub_type|invalid_last_four|invalid_institution|field_not_editable` (`currency`/`accountType` bloqueados para no romper la semántica del net worth).
- **Notas:** ajuste DIRECTO de saldo — jamás recalcula desde transacciones.
- **Estado MCP:** 🔧 extraer.
- **Verificación:** `scripts/e2e-accounts-v1.js`.

`delete_account`
- **Descripción:** Borra una cuenta SOLO si no tiene historial; protege las transacciones.
- **Ubicación Backend:** `DELETE /api/v1/accounts/:id` + `deleteAccountForUser()` en `src/lib/services/accounts-service.ts` (el mismo guard protege la ruta interna `/api/accounts/:id`).
- **Entrada:** `{ userId, id }` (el id viaja en la URL).
- **Salida:** `200 { success: true, id, deleted: true }` · si tiene transacciones → `409 { success: false, error: "account_has_transactions", transactionCount }` (sugerir al agente: PATCH del saldo a 0 en lugar de borrar).
- **Notas:** cierra la deuda SDD §7.7 (DELETE dejaba transacciones huérfanas).
- **Estado MCP:** 🔧 extraer.
- **Verificación:** `scripts/e2e-accounts-v1.js` (caso 409 incluido).

## 3. Resolución y Helpers

### `resolve_category`
- **Descripción:** Mapea el texto ingresado por el usuario a una categoría existente (español e inglés) o la crea si no existe.
- **Ubicación Backend:** `resolveCategoryByName()` en `src/lib/finzen/v1-helpers.ts:34`.
- **Entrada:** `{ userId: string, category?: string, direction: "expense"|"income" }`
- **Salida:** `{ id: string | null, created: boolean, name: string | null }`
- **Estrategia:** 1) match exacto `name` → 2) exacto `nameEs` → 3) contains case-insensitive (`LIKE` crudo, compatible SQLite) → 4) autocreación user-scoped con el `direction` dado. `category` vacía es válida (→ `id: null`).
- **Estado MCP:** ✅ lista.
- **Verificación:** cubierta por los E2E de `record_*` (autocreación con categoría nueva ✓).

### `resolve_account`
- **Descripción:** Resuelve una cuenta por ID (cuid) o por nombre (exacto → case-insensitive → contains).
- **Ubicación Backend:** `resolveAccount()` y `resolveAccountFromPayload()` en `src/lib/finzen/v1-helpers.ts:128`/`:181`.
- **Entrada:** `{ userId: string, payload: { account_id? | accountId? | account? } }`
- **Salida:** `{ account: { id, name, currency, accountType, subType } | null, source: "account_id" | "account" | null }`
- **Estado MCP:** ✅ lista.
- **Verificación:** E2E fase 7.9 (`account_id` respetado + `account_source` en respuesta ✓).

### `get_default_account`
- **Descripción:** Cuenta por defecto para débito/crédito cuando el payload externo no especifica una.
- **Ubicación Backend:** `getDefaultExpenseAccount()` en `src/lib/finzen/v1-helpers.ts:91`.
- **Entrada:** `{ userId: string, preferredCurrency?: string (def "DOP") }`
- **Salida:** `{ id, name, currency, subType } | null` (null si el usuario no tiene cuentas).
- **Prioridad:** asset en la moneda preferida → asset cualquiera → cualquier cuenta.
- **Estado MCP:** ✅ lista.
- **Verificación:** E2E fases 7.5–7.9 ✓.

### `convert_currency`
- **Descripción:** Convierte montos entre `USD|DOP|EUR|USDT|BTC` y formatea dinero por locale.
- **Ubicación Backend:** `convertAmount()` y `formatMoney()` en `src/lib/finzen/currency.ts:26`/`:36` (`FX_RATES` estáticas en `:18`).
- **Entrada:** `{ amount: number, from: CurrencyCode, to: CurrencyCode }` (+ `locale` para `formatMoney`).
- **Salida:** `number` (convertido) · `string` (formateado).
- **Estado MCP:** 🌐 requiere fuente externa (tasas estáticas hoy — deuda `MEMORY.md` §5.2).
- **Verificación:** test unitario (función pura, Fase 0).

## 4. Ingesta de Datos

| Skill | Ubicación | Entrada → Salida | Estado MCP |
|---|---|---|---|
| `parse_receipt` | `src/lib/finzen/ocr.ts` (`runOCR:25`, `parseReceiptText:30`, `scanReceipt:43`) + `ocr-flow.tsx` | `File` (imagen) → `{ merchant?, date?, total?, currency?, rawText, confidence }` | 🔄 migrar a servidor (tesseract.js hoy en navegador, `spa+eng`) |
| `import_csv` | `src/components/finzen/import-view.tsx` (`parseCSVLine:19`) → `POST /api/restore` | CSV de banco → bulk idempotente `{ restoredAccounts, restoredTransactions }` | 🔄 migrar a servidor (parsing hoy con `FileReader` en cliente) |
| `import_bank_statement` | `src/lib/finzen/ofx.ts` (`parseOfxStatement`) + `src/lib/finzen/bank-presets.ts` (presets BPD/Banreservas/BHD/APAP/genérico + `parseBankAmount`) + `bank-import-flow.tsx` | Estado de cuenta CSV u OFX/QFX → `{ transactions: [{ date, amount, description, type, fitid? }] }` → wizard con preview, dedup `date\|amount\|desc\|account` y commit con `importSource: 'bank'` | 🔄 migrar a servidor (parsing hoy en cliente) |
| `backup_restore` | `POST /api/restore` | `{ transactions, accounts }` → salta IDs existentes, preserva IDs, fuerza `userId` de sesión | 🔧 extraer |

## 5. Operación (`scripts/`, ESM + Bun)

| Skill | Ubicación | Uso |
|---|---|---|
| `gen_api_key` | `scripts/gen-turso-api-key.js` · `gen-readonly-key.js` · `gen-test-apikey.js` | Crear keys contra Turso/prod e imprimir la clave cruda para curl |
| `migrate_sqlite_turso` | `scripts/migrate-sqlite-to-turso.js` | Migración de datos sandbox → Turso |
| `reset_password` | `scripts/reset-password.js` | Reset de contraseña de un usuario |
| `check_db` | `scripts/check-db*.js` · `check-db-stats.js` | Inspección de BD (conteos, salud) |
| `cleanup_test_data` | `scripts/cleanup-test-data.js` · `cleanup-test-keys.js` | Limpiar keys/datos de test |

## 6. Desarrollo (recetas del repo)

| Skill | Receta |
|---|---|
| `add_view` | `AGENTS.md` §6: crear `src/components/finzen/<vista>-view.tsx` → registrar en `VIEWS`/`ViewKey` → `NAV_ITEMS`/`MORE_ITEMS` → claves en `i18n.ts` (es+en) |
| `add_endpoint_interno` | `getServerSession(authOptions)` + early return 401 sin `session.user.id` |
| `add_endpoint_v1` | `authenticateV1Request` (`src/lib/auth/v1-api.ts`) + errores `{ success: false, error: snake_case }` |
| `db_schema_change` | Editar `schema.prisma` → `bun run db:generate` → `bun run db:push` → sincronizar interfaces del store (frontera de tipos) |
| `verify_quality` | `bun run lint && bun run typecheck && bun run build` — barrera mínima obligatoria |

## Regla de alta de skills

Ninguna capacidad nueva se expone (UI, API v1 ni MCP) sin: (1) entrada en
este catálogo con el formato de alta, (2) reflejo del contrato en `SDD.md` §3
si es público, y (3) verificación definida antes de implementar. El
`estado MCP` se actualiza al avanzar las fases del roadmap (`SDD.md` §6).
Renombrar una skill exige actualizar Orquestador + `SDD.md` §3 en el mismo
cambio.
