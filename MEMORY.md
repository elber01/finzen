# MEMORY.md — Memoria viva de FinZen

> **Propósito:** que cualquier persona o agente IA que inicie una sesión nueva
> entienda el proyecto SIN leer los 282KB de `worklog.md`. Cronología detallada
> → `worklog.md`. Reglas operativas → `AGENTS.md`.
>
> **Mantenimiento:** al cerrar cada fase de trabajo, actualizar las secciones
> "Estado actual" y "Deuda técnica" con fecha.

> Diseño del sistema → `SDD.md` · Protocolo de agentes → `agent.md` ·
> Catálogo de capacidades → `skills.md`.

**Última actualización:** 22-oct-2026 (8.4 — Pass UI/HIG para producción: login ≥44px, micro-feedback, recuperación+error inline, --shadow-card, empty states, negativos semánticos)

---

## 1. Identidad del proyecto

- **Producto:** finanzas personales y del hogar, inspirado en YNAB, Monarch,
  Copilot y Rocket Money.
- **Diferenciadores:** multi-moneda real (USD/DOP/EUR/USDT/BTC), i18n es/en,
  dark mode, OCR de recibos, presupuestos con umbrales, motor de alertas y
  **API pública v1** para que agentes de IA (Claude, GPT, etc.) registren y
  consulten gastos/ingresos con una API key del usuario.
- **Origen:** partió del template `nextjs_tailwind_shadcn_ts` (de ahí el nombre
  en `package.json` — no renombrar rompe nada, pero sería cosmético).

## 2. Cronología condensada (las fases que dejaron huella)

| Fase | Qué se logró | Fecha aprox. |
|---|---|---|
| 1–4 | Arquitectura, design system, backend, frontend + OCR/CSV | inicio |
| 5 | Demo live + reset de BD limpia | — |
| 7–7.3 | Migración SQLite local → Postgres/Vercel y RESTAURACIÓN de modo edición, incomes, CRUD cuentas, presupuestos, OCR tras la migración (hubo pérdida de features) | — |
| 7.4 | Sistema de backup/restore JSON contra pérdida de datos | — |
| 7.5 | API pública con API keys + rate limit | — |
| 7.6–7.7 | Deploy a Vercel + migración de datos del sandbox a producción | — |
| 7.8 | **Turso (libSQL)** como BD persistente — antes cada lambda perdía datos | — |
| 7.9 | API v1 completa: incomes, PATCH/DELETE, `account_id`, `/api/v1/accounts`, summary con gastos+ingresos+net. E2E con curl en producción ✓ | — |
| Auditoría 27-sep-2026 | Scorecard con hallazgos P0–P3 (reportes en `/tmp/opencode/finzen-audit/`, hoy efímeros). P0-1 (BD divergente) y P0-2 (sheet pegado) corregidos; P1-4, P2-1, P2-5, P2-8, P2-9 en "UI quick wins" | 27-sep |
| **Estabilización + UX real** | Ver §4 | 29-sep-2026 |
| **8.1 — Estructura SDD** | Informe técnico-arquitectónico completo + creación de `SDD.md` (diseño + roadmap de migración), `agent.md` (protocolo de trabajo de agentes) y `skills.md`. Definición del Agente Orquestador runtime (`agents/orchestrator.md`) y reestructuración de `skills.md` como catálogo tipado de habilidades de IA (contratos Entrada/Salida por skill, `get_net_worth` añadido al vocabulario). Sin cambios de código | 1-oct-2026 |
| **8.2 — CRUD cuentas v1 + multiagentes opencode** | `POST`/`PATCH`/`DELETE /api/v1/accounts` con servicio compartido `accounts-service.ts` (nace la capa de `src/lib/services/`), guard 409 de historial (cierra SDD §7.7), flujo multiagente coordinador→planificador→implementador→revisor cableado en `.opencode/`, skills `finzen-dev-harness` + `hig-ux-ui` (HIG Apple), script `verify`. E2E 21/21 local ✓ | 22-oct-2026 |
| **8.3 — Importar desde tu banco** | Wizard de estados de cuenta: parser OFX/QFX (`ofx.ts`), presets CSV de bancos dominicanos (`bank-presets.ts`: BPD, Banreservas, BHD, APAP, genérico), `parseCSVLine` extraída a `csv.ts` compartida, dedup con fix del bug latente de ingresos (`realAccountId`), preview con tabla y advertencia de moneda distinta. Fixtures parsers 33/33 ✓ | 22-oct-2026 |
| **8.4 — Pass UI/HIG producción** | FIX 1-6 del dueño: submit login `h-11 min-h-11` (≥44px), micro-feedback en primitivas (`active:brightness-95`, `duration-150`, hover primario oscurece 8% vía token `--primary-hover`), login con "¿Olvidaste tu contraseña?" (mailto real) + error inline que conserva el email, token `--shadow-card` (tinta #00274a) en login+dashboard, empty states completos (transactions/reports/categories), negativos semánticos (`text-expense`) y hex crudo de chrome eliminado. Revisor APRUEBA · verify ✓ | 22-oct-2026 |

## 3. Decisiones de arquitectura y su porqué

| Decisión | Porqué | Dónde |
|---|---|---|
| **Double-entry con cuentas virtuales** `x_<categoryId>` | Un gasto/ingreso es una transferencia cuenta real → cuenta virtual de categoría; habilita reportes por categoría sin tabla extra | `schema.prisma`, `finance.ts` |
| **Net worth** = asset+investment+equity−liability | Las cuentas income/expense son virtuales (asientos), no riqueza | `finance.ts` |
| **Turso + fail-fast sin `DATABASE_URL` en prod** | P0-1: SQLite efímero en lambas = datos divergentes/perdidos. La app se rehúsa a arrancar mal configurada | `db.ts` |
| **`url` fija en schema.prisma** (placeholder) | Prisma valida el schema en generate; la conexión real la construye `@prisma/adapter-libsql` en runtime | `schema.prisma` |
| **NextAuth v4 + JWT (30 días) + `token.id`** | Sessions de DB no escalan en serverless; el `user.id` viaja en el JWT y se expone con augmentación de tipos | `auth-options.ts`, `types/next-auth.d.ts` |
| **API keys solo como hash SHA-256** (prefijo visible para display) | Si se filtra la BD no se filtran las keys | `api-key.ts` |
| **FX estáticas** en `currency.ts` | Simplicidad para MVP | deuda — ver §5 |
| **i18n casero** (`translations[locale]`) con next-intl instalado | El casero es suficiente y más simple; migrar a next-intl sería solo si se requiere routing por locale | `i18n.ts` |
| **React Compiler + disables puntuales** | Los memos con deps de `new Date()` no se pueden preservar; convención documentada en AGENTS.md §5 | varios `.tsx` |
| **`scripts/*.js` en ESM** | ESLint prohíbe `require()`; Bun ejecuta ESM en .js sin config | `scripts/` |
| **SDD: la spec precede al código** | `SDD.md` es la fuente de verdad del diseño; los agentes actualizan la spec antes de implementar y memorizan al cerrar (`agent.md`); cada capacidad vive documentada en `skills.md` | `SDD.md`, `agent.md`, `skills.md` |
| **Orquestador runtime como coordinador único** | El Agente Orquestador (`agents/orchestrator.md`) es el único agente que habla con el usuario final; su system prompt y el catálogo tipado `skills.md` fijan el vocabulario canónico de skills; los roles de `agent.md` §4 son agentes de desarrollo, no runtime | `agents/orchestrator.md`, `skills.md` |
| **DELETE de cuentas protege el historial (409)** | Un borrado duro deja transacciones huérfanas (SDD §7.7); el agente debe llevar saldos a 0 con PATCH, no borrar. El guard vive en el servicio y cubre v1 + ruta interna | `src/lib/services/accounts-service.ts` |
| **PATCH v1 de cuentas con campos inmutables** | `currency`/`accountType` → `422 field_not_editable`; cambiarlos rompería la semántica del net worth. `currentBalance` = ajuste directo (saldos bancarios, sin recálculo) | `accounts-service.ts`, rutas v1 |
| **Flujo multiagente coordinador→planificador→implementador→revisor** | El coordinador orquesta y es el único que cierra (harness + memoria); roles materializados como agentes de opencode con permisos (planificador/revisor read-only) | `.opencode/agent/`, `agent.md` §4 |

## 4. Estado actual (22-oct-2026)

**Barreras de calidad:** `bun run verify` (lint+typecheck+build) ✓ · E2E accounts v1 21/21 en dev ✓ · fixtures parsers bancarios 33/33 ✓.

Sesión 22-oct-2026 (8.4 — Pass UI/HIG para producción, con flujo
coordinador→implementador→revisor; revisor APRUEBA, 0 bloqueantes):
- **FIX 1:** submit del login `w-full h-11 min-h-11` — 44px garantizados
  (`.h-11` = `calc(var(--spacing)*11)` verificado en CSS compilado; el HTML
  renderizado en dev muestra las clases).
- **FIX 2 (micro-feedback):** primitivas ui/button.tsx (+`duration-150
  active:brightness-95`) y ui/input.tsx (`transition-[color,border-color,
  box-shadow] duration-150`) — pasada de integración del design system
  autorizada por el dueño. Hover del primario ahora OSCURECE 8% vía token
  nuevo `--primary-hover: color-mix(in oklab, var(--primary) 92%, black)`
  (antes `bg-primary/90` aclaraba por opacidad).
- **FIX 3 (login sin callejón):** "¿Olvidaste tu contraseña?" como mailto
  real al dueño (restablece con `scripts/reset-password.js`) — solo modo
  login; errores de credenciales/registro ahora inline (`role="alert"`,
  `aria-live`, `bg-expense-soft`/`text-expense`) SIN revelar cuál campo
  falló y CONSERVANDO el email; el error se limpia al alternar modo y al
  reintentar.
- **FIX 4 (elevación):** token `--shadow-card` (tinta rgba(0,39,74,.06/.08),
  no negro puro) aplicado a login Card, KpiCard y los 5 Cards del dashboard;
  utility `shadow-card` verificada en CSS compilado.
- **FIX 5 (0 vacíos mudos):** transactions (nuevo usuario → icono + frase +
  CTA `setAddSheetOpen(true)`; filtro vacío → mensaje simple), reports
  (early return post-hooks con Card completo + topCategories vacío →
  `reports.noExpenses`), categories-manager (frase guía al botón «Nueva»).
  +7 claves i18n (union+es+en verificados por script del revisor).
- **FIX 6 (montos):** tabular-nums ya era global (`font-feature-settings
  'tnum'` en body — confirmado); negativos ahora SIEMPRE `text-expense`
  (net savings < 0 en reports corregido; budgets ya cumplía); hex crudo de
  chrome `#6B7280` → `var(--muted-foreground)` en reports y dashboard.
- **FIX 7 (API agente):** los endpoints 8.2 ya existen y pasan 21/21 en
  dev (re-verificado esta sesión). Commit+push hecho por el agente con
  aprobación del dueño (`30f81e8` + reintento `76c2c49`), PERO **Vercel
  bloqueó ambos deployments** ("Deployment was blocked" — anti-abuso a
  nivel de CUENTA, no error de build; el build ni corrió). Producción
  sigue sirviendo el deploy del 29-sep. Pendiente de Edwin: ver el banner
  del deployment bloqueado en el dashboard Vercel (appeal/verificación de
  cuenta, revisar Billing) → redeploy → correr la batería con la key de
  Grazia para cerrar el criterio.
- Nota dev: sin `DATABASE_URL`, `next dev` usa `/tmp/finzen.db` (seed copiado
  de `db/custom.db` en el primer cold start); las keys de test deben
  generarse contra ESE archivo.

Sesión 22-oct-2026 (8.3 — "Importar desde tu banco", ejecutada con el flujo
coordinador→implementador→revisor):
- **Qué es:** wizard que reemplaza el card muerto "Plaid — próximamente"
  (Plaid real requiere API keys y no soporta los bancos dominicanos). El
  usuario descarga su estado de cuenta desde la banca del banco y lo importa:
  CSV con presets (Banco Popular, Banreservas, BHD, APAP, genérico) u
  OFX/QFX estándar — parsing local, sin servicios externos.
- **Parsers puros** (`src/lib/finzen/`): `ofx.ts` (OFX 1.x SGML y 2.x por
  regex, tolera tags sin cerrar), `bank-presets.ts` (`parseBankAmount` para
  formatos dominicanos: coma decimal, "1.234,56", "(500.00)", "RD$";
  `autoMapColumns` con normalización de acentos), `csv.ts`
  (`parseCSVLine` extraída de import-view para compartirla).
- **Wizard** (`bank-import-flow.tsx`): banco → subir archivo (detección OFX y
  de fila de header en las primeras 5 líneas) → mapeo pre-relleno editable →
  preview (chips de resumen + tabla + cuenta destino + advertencia si la
  moneda del statement OFX difiere de la cuenta) → confirmación.
- **Fix de bug latente:** el dedup del flujo CSV original jamás detectaba
  duplicados de INGRESOS (usaba `tx.fromAccountId`, que en ingresos es la
  cuenta virtual). Corregido con `realAccountId = type==='income' ?
  toAccountId : fromAccountId` en los 3 sitios (preview banco, commit banco,
  flujo CSV original).
- Moneda de las transacciones = la de la cuenta destino (mejora sobre el
  CSV wizard que usaba baseCurrency). `importSource: 'bank'`,
  `tags: bank_<banco>_<ts>`.
- **Verificación:** fixtures de parsers 33/33 (montos, acentos, header tras
  título, OFX sin closing tags, fecha inválida); revisor APRUEBA; `bun run
  verify` ✓.
- Deuda documentada en §5.9 (i18n inline y a11y del módulo import) y §5.10
  (`x_undefined`).

Sesión 22-oct-2026 (8.2 — CRUD de cuentas para el agente + multiagentes, ejecutada
con el flujo coordinador→implementador→revisor):
- **API v1:** `POST /api/v1/accounts` (201) y `PATCH`/`DELETE
  /api/v1/accounts/:id` (200; `409 account_has_transactions` +
  `transactionCount`). PATCH de `currentBalance` es ajuste directo (saldos
  bancarios, sin recálculo desde transacciones); `currency`/`accountType` →
  `422 field_not_editable`. Validaciones: `accountType` asset|liability,
  `subType` con alias `credit`→`credit_card` y el nuevo `loan`, `currency`
  DOP|USD (def DOP), `lastFour` 2-4 dígitos. **La key actual del agente
  funciona sin scope nuevo** (permiso `write` ya presente en el modelo).
- **Capa de servicios:** nace `src/lib/services/accounts-service.ts` (primer
  servicio de la Fase 1 del roadmap), compartido por v1 y la ruta interna
  `/api/accounts/[id]` — el guard 409 también protege la UI y cierra la
  deuda SDD §7.7.
- **UI:** subtype `loan` (Préstamo, icono Building2); diálogo de borrado
  explica la restricción de historial y deshabilita la acción si tiene
  transacciones; toasts con la causa real del servidor; `text-white` →
  `text-primary-foreground` en el botón destructivo (contraste dark mode).
- **Multiagentes opencode:** `.opencode/opencode.json` (default `coordinador`,
  instructions AGENTS.md+agent.md) + agentes `coordinador` (primary),
  `planificador`/`revisor` (read-only) e `implementador` en
  `.opencode/agent/`. `agent.md` §4 reescrito al flujo de 4 roles. **Requiere
  reiniciar opencode para que cargue la config.**
- **Skills opencode:** `finzen-dev-harness` (ciclo SDD + barrera `bun run
  verify`) y `hig-ux-ui` (Apple HIG mapeada a tokens/convenciones del repo)
  en `.opencode/skills/`.
- **Harness:** script `verify` = lint+typecheck+build en un comando. E2E
  `scripts/e2e-accounts-v1.js` (21 pasos con cleanup propio; 21/21 local).
- **Spec primero:** SDD §2/§3/§7.7, `skills.md` (alta de
  `create_account`/`update_account`/`delete_account`),
  `agents/orchestrator.md` (delegación + directriz de patrimonio), README
  (tabla API + `verify`).
- Revisado por subagente revisor: veredicto APRUEBA; avisos no bloqueantes
  documentados en worklog 8.2 (laxitud de `Number()` en booleanos, toasts
  mixtos es/en con mensajes del servidor en inglés, PATCH interno aún permite
  `accountType`/`currency` — divergencia de consistencia conocida).
- **Pendiente tras deploy:** correr la batería E2E en producción
  (`bun scripts/e2e-accounts-v1.js --base https://finzen-zeta.vercel.app
  --key <key de Grazia>` → 21/21 cierra el criterio del dueño).

Sesión 1-oct-2026 (documentación SDD — sin cambios de código):
- Informe técnico-arquitectónico para planificar la migración (API v1 y
  legacy `/api/agent/*`, modelo Prisma, integraciones candidatas a MCP,
  ausencia de prompts/LLM server-side, dependencia `z-ai-web-dev-sdk` sin uso).
- Creados `SDD.md` (arquitectura, contratos v1, estrategia MCP, modelo de
  datos, roadmap Fases 0–4), `agent.md` (ciclo SDD, roles multiagente,
  handoff/escalación) y `skills.md` (catálogo con estado MCP por skill).
- Creado `agents/orchestrator.md` — Agente Orquestador Principal: system
  prompt del usuario (verbatim) + contrato de delegación + reglas de
  integridad verificadas contra el código (doble entrada, net worth,
  errores snake_case, keys solo `keyPrefix`). Skills renombradas al
  vocabulario del orquestador en `skills.md` y `SDD.md` §3.
- `skills.md` reestructurado al catálogo formal del usuario ("Catálogo de
  Skills — Habilidades de IA"): secciones 1–6 (Consultas y Analítica ·
  Registro y Transacciones · Resolución y Helpers · Ingesta · Operación ·
  Desarrollo), contratos Entrada/Salida tipados por skill y formato de alta
  SDD. `get_net_worth` incorporado (antes `net_worth`) en `skills.md`,
  `SDD.md` §3 y la tabla de delegación del orquestador. Nota técnica: el
  contrato `{ userId } → { netWorth, assets, liabilities }` difiere del
  naming del legacy (`totalAssets`/`totalLiabilities`) — gana la skill al
  extraer el servicio (Fase 1).
- `MEMORY.md` actualizado según su propia convención de mantenimiento.

Sesión 29-sep-2026 (estabilización + UX con datos reales):
- **Tipos:** augmentación NextAuth (`session.user.id`), store tipado con
  `CurrencyCode`/`TransactionType`, `isSystem`+`sortOrder` en `Category`.
  `tsc` pasó de 28 errores → 0.
- **Código muerto eliminado:** filtro `memberId` (schema no lo tiene) y
  claves duplicadas en `date-utils.ts`.
- **Seguridad:** `NEXTAUTH_SECRET` ahora es **fail-fast en producción**
  (fallback solo dev y solo durante `phase-production-build`). El valor del
  fallback antiguo YA está en el historial de git — rotar en Vercel si aún
  coincide (ver §5).
- **UX sin decoración falsa:** deltas mes-vs-mes reales (`computeDelta`
  devuelve `undefined` sin base → no se muestra), sparkline del net worth
  reconstruido con flujos reales de 12 meses (`computeNetWorthHistory`),
  KpiCard con tono semántico independiente de la flecha (gasto ↑ = rojo).
- **Sesión real:** sidebar muestra nombre/email/inicial de la sesión y
  logout (desktop y móvil). "Mi Hogar" fake eliminado.
- **Auth:** i18n completo, medidor de fortaleza de contraseña, toggle de
  idioma pre-login, autocomplete correcto.
- **Shell:** transición de vistas con framer-motion (`ViewTransition`) y
  skip-to-content.
- `.gitignore`: binarios ajenos (`*.apk`, `*.tar.gz`, `*.docx`), `download/`.
  Script `typecheck` añadido a package.json. `.env` local regenerado
  (el sandbox lo pierde en reinicios — solo lleva NEXTAUTH_SECRET de dev).

**Producción (29-sep-2026):** repo `github.com/elber01/finzen` conectado por
integración Git al proyecto Vercel **finzen-zeta** (`finzen-zeta.vercel.app`).
Pipeline verificado end-to-end: push → build → deploy automático. Turso
conectado (mismo `DATABASE_URL` de las fases 7.x). Se removió
`ignoreBuildErrors` de next.config.ts (`c0f6aa9`) — el build de producción
ahora valida tipos estrictamente. El dominio `app.getfinzen.com` sigue
pendiente de repoint (§5).

## 5. Deuda técnica conocida (no apagar la alarma — priorizar)

1. **CERO tests automatizados.** Recomendación: Vitest para `lib/finzen/`
   (finance, currency, date-utils — funciones puras, baratas de testear) y
   Playwright para E2E de login + CRUD de transacciones.
2. **FX estáticas** (`FX_RATES`): convertir DOP/USDT/BTC con tasas fijas.
   Migrar a una API de tasas con caché si el usuario opera mucho en cripto.
3. **Secreto NextAuth en historial de git:** el fallback antiguo está
   expuesto en commits previos. Verificar que `NEXTAUTH_SECRET` en Vercel
   sea distinto; rotar si coincide.
4. **Dominio:** `app.getfinzen.com` aún apunta al deploy viejo; el bueno es
   `finzen-elber01s-projects.vercel.app` (repoint pendiente).
5. **Onboarding de saldos iniciales:** crear cuenta con balance ≠ 0 genera
   un "adjustment"? Flujo manual — mejorar UX de primera carga.
6. **Rate limit de la API v1:** documentado en worklog 7.5; verificar
   implementación real si el uso público crece.
7. **`package.json` name** sigue siendo `nextjs_tailwind_shadcn_ts` (cosmético).
8. **Dualidad `/api/v1` vs `/api/agent/*` (legacy):** las rutas agent duplican
   capacidades sin rate limit y con shape de error distinto (`{ error }`).
   Deprecar en la Fase 0 del roadmap de `SDD.md` §6 antes de exponer tools MCP.
9. **Módulo Importar — i18n y a11y:** strings inline es/en y `<div>`s
   clickeables sin `role="button"`/teclado, patrón preexistente replicado en
   `bank-import-flow.tsx` (import-view/ocr-flow igual). Una pasada única de
   i18n+a11y del módulo lo resuelve todo junto.
10. **`x_undefined` como cuenta virtual:** cuando el fuzzy-match de categoría
    falla, los asientos guardan `x_undefined` (convención heredada también de
    la API v1). Normalizar (categoría real "Sin categoría" o validación
    `x_<cuid>` en la API) al extraer servicios (Fase 1).
11. **Detalles visuales menores del pass 8.4:** CTAs de empty states usan
    `size="sm"` (h-9, 36px < 44px ideal táctil — consistentes con los empty
    states preexistentes) y el logo del login usa colores crudos en el SVG
    inline (`stroke="white"`, `fill="#34D399"`). Pasada visual pendiente.

## 6. Lecciones aprendidas (para no repetir errores)

- **El sandbox pierde `.env` en reinicios.** Todo lo crítico vive en Vercel;
  regenerar `.env` local es rutina (ver comando en README).
- **SQLite efímero + serverless = catastrophe silenciosa** (P0-1). Por eso
  `db.ts` hace fail-fast; no "arreglar" ese guard con un default.
- **Migraciones de plataforma pierden features:** en la 7→7.3 se perdieron
  modo edición, incomes y CRUD tras migrar; se restauraron a mano. Ante una
  migración, checklist de features primero.
- **E2E real contra producción** (curl) es la única verdad para la API v1:
  los tests de la 7.9 pillaron que `account_id` era ignorado.
- **El React Compiler es estricto:** memos con `new Date()` en deps no se
  pueden preservar — usar la convención de disable documentada, no pelearla.

## 7. Personas y contexto

- **Edwin (elber01):** dueño del producto. Usuario principal con datos reales
  en Turso (cuentas BPD/APAP/AFI en DOP/USD). Tiene una API key "Nueva grazzia"
  de la que no conoce el valor completo — si la necesita, crear una nueva
  desde Ajustes o con `scripts/gen-turso-api-key.js`.
