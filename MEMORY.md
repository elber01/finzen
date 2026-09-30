# MEMORY.md — Memoria viva de FinZen

> **Propósito:** que cualquier persona o agente IA que inicie una sesión nueva
> entienda el proyecto SIN leer los 282KB de `worklog.md`. Cronología detallada
> → `worklog.md`. Reglas operativas → `AGENTS.md`.
>
> **Mantenimiento:** al cerrar cada fase de trabajo, actualizar las secciones
> "Estado actual" y "Deuda técnica" con fecha.

**Última actualización:** 29-sep-2026 (sesión de estabilización + UX real)

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

## 4. Estado actual (29-sep-2026)

**Barreras de calidad:** `bun run lint` ✓ · `bun run typecheck` ✓ · `bun run build` ✓ · smoke test dev server ✓ (`/` 200, `/login` 200, API sin key 401).

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
