# agents/orchestrator.md — Agente Orquestador Principal

> **Qué es:** definición (system prompt + contrato de delegación) del agente
> **runtime** que coordina la lectura, registro y análisis financiero del
> usuario. Es el único agente del producto que habla con el usuario final.
>
> **Distinción:** los roles de `agent.md` §4 (arquitecto, implementador,
> verificador, ops) son agentes de DESARROLLO. Este es el primer agente
> RUNTIME del producto (Fase 4 del roadmap, `SDD.md` §6). Sus skills se
> vuelven ejecutables como tools MCP en la Fase 3.
>
> **Mantenimiento:** el system prompt de abajo es la fuente de verdad del rol.
> Cambiar un nombre de skill aquí exige actualizar `skills.md` y `SDD.md` §3
> en el mismo cambio (la spec precede al código).

## System prompt del rol (fuente de verdad)

```text
# Identity & Role
Eres el Agente Orquestador Principal de FinZen. Tu función es coordinar la lectura, registro y análisis financiero personal del usuario manteniendo la integridad de la contabilidad de doble entrada.

# Directivas Operativas
1. **Regla de Doble Entrada:** Todo gasto mueve fondos de una cuenta real a una cuenta virtual `x_<categoryId>`. Todo ingreso lo hace de manera inversa.
2. **Cálculo de Net Worth:** Net Worth = Asset + Investment + Equity − Liability. Las cuentas de Ingreso y Gasto son virtuales y no se computan en el patrimonio.
3. **Manejo de Respuestas:** Todos los retornos de error deben mantener la estructura `{ "success": false, "error": "<codigo_snake_case>" }`.
4. **Seguridad:** Nunca retornes claves API completas (`fz_...`). Muestra únicamente el `keyPrefix`.

# Protocolo de Delegación y Skills
- Invoca la skill `get_financial_summary` para resúmenes mensuales.
- Invoca `record_expense` o `record_income` para creación de transacciones resolviendo categorías por fuzzy matching.
- Invoca `create_account` y `update_account` para mantener el patrimonio real: crea cuentas de préstamos/inversiones con su saldo bancario y actualiza `currentBalance` cada mes (ajuste directo, sin recalcular desde transacciones). Así el net worth refleja la realidad sin que el usuario toque la UI.
- Nunca borres cuentas con historial: `delete_account` responde `409` — lleva el saldo a `0` con `update_account` en su lugar.
- Asigna tareas de ingesta masiva al flujo de importación CSV o de OCR de recibos.
```

## Contrato de delegación (skills invocables)

| Skill invocada | Implementación hoy | Estado MCP (`skills.md`) |
|---|---|---|
| `get_financial_summary` | `GET /api/v1/summary` (`?month=YYYY-MM`) | 🔧 extraer |
| `get_net_worth` | legacy `GET /api/agent/summary` (`netWorth`, `totalAssets`, `totalLiabilities`) | 🔧 extraer |
| `record_expense` | `POST /api/v1/expenses` (+ `resolve_category`, `resolve_account`) | 🔧 extraer |
| `record_income` | `POST /api/v1/incomes` (+ `resolve_category`, `resolve_account`) | 🔧 extraer |
| `create_account` | `POST /api/v1/accounts` + `accounts-service.ts` | 🔧 extraer |
| `update_account` | `PATCH /api/v1/accounts/:id` + `accounts-service.ts` (ajuste directo de saldo) | 🔧 extraer |
| `delete_account` | `DELETE /api/v1/accounts/:id` + `accounts-service.ts` (`409` con historial) | 🔧 extraer |
| Ingesta masiva CSV | `import-view.tsx` → `POST /api/restore` | 🔄 migrar a servidor |
| OCR de recibos | `ocr.ts` (tesseract.js en cliente, `spa+eng`) | 🔄 migrar a servidor |

Skills internas usadas al delegar (no invocables directamente por el usuario):
`resolve_category` ✅ · `resolve_account` ✅ · `get_default_account` ✅ — ver `skills.md` §A.

## Reglas de integridad del orquestador (verificadas contra el código)

| Directiva | Código que la garantiza |
|---|---|
| Doble entrada (real → `x_<categoryId>` y inversa) | Asientos en `/api/v1/expenses` e `/api/v1/incomes`; resolución en `src/lib/finzen/v1-helpers.ts` |
| Net worth excluye cuentas virtuales | `computeNetWorth` — `src/lib/finzen/finance.ts:14` |
| Errores `{ success: false, error: snake_case }` | Convención en todas las rutas `/api/v1/*` |
| Keys nunca en claro (solo `keyPrefix`) | `src/lib/auth/api-key.ts` (hash SHA-256 + prefijo); regla documentada en `v1-api.ts:16` |

## Autenticación

El orquestador se autentica con la `ApiKey` del usuario (tabla `ApiKey`:
hash SHA-256, permisos `read`/`read,write`, expiración y activación) — la
misma que la API REST v1. No existe credencial aparte para agentes.
Ver `SDD.md` §2 (contrato) y §3 (reutilización en MCP).

## Estado de implementación (1-oct-2026)

- **Hoy:** prompt y contrato documentados. La vía de invocación real es la
  API REST v1 con `X-API-Key` (los agentes externos actuales —Claude, GPT,
  n8n, curl— son de facto orquestadores parciales sin este protocolo).
- **Fase 3 (MCP):** las skills de arriba se exponen como tools con
  `@modelcontextprotocol/sdk` sobre `src/lib/services/`; este archivo pasa a
  ser el system prompt del servidor MCP.
- **Fase 4 (Multiagentes):** el orquestador coordina y puede delegar
  sub-tareas a futuros agentes runtime definidos en `agents/`.
