# agent.md — Protocolo de agentes IA de FinZen (era SDD/MCP)

> **Qué define este archivo:** CÓMO trabajan los agentes IA en FinZen bajo
> Spec-Driven Development. NO duplica las reglas operativas del repo (estilo,
> comandos, prohibiciones), que viven en `AGENTS.md`, ni el diseño del
> sistema, que vive en `SDD.md`.
>
> Jerarquía de documentos: `SDD.md` (diseño) → `AGENTS.md` (reglas) →
> `skills.md` (capacidades) → `MEMORY.md` (estado) → `worklog.md` (historial).

## 1. Orden de lectura obligatorio (sesión nueva)

1. `MEMORY.md` — estado actual, deuda técnica, lecciones aprendidas.
2. `SDD.md` — las secciones de arquitectura/contratos que afecten a la tarea.
3. `skills.md` — si la tarea toca una capacidad existente o añade una nueva.
4. `AGENTS.md` — reglas operativas completas (si no están ya en contexto).

## 2. Ciclo SDD por tarea (la spec precede al código)

1. **Especificar** — antes de programar:
   - Si cambia la arquitectura o un contrato → actualizar `SDD.md`.
   - Si añade o modifica una capacidad → registrar/actualizar el skill en `skills.md`.
   - Si el cambio es puramente local → basta cumplir la spec existente.
2. **Implementar** — según la spec. Toda lógica de negocio nueva vive en
   `src/lib/services/` (o se extrae ahí al tocarla); los route handlers son
   adaptadores delgados. Nunca lógica inline en handlers nuevos.
3. **Verificar** — `bun run lint && bun run typecheck && bun run build`
   OBLIGATORIO. Si existe test del skill afectado, ejecutarlo. Prohibido
   cerrar la tarea con la barrera en rojo.
4. **Memorizar** — al cerrar: actualizar `MEMORY.md` (§Estado actual / §Deuda)
   y añadir la entrada de fase en `worklog.md`. Un agente que no escribe
   memoria condena al siguiente a repetir sus errores.

## 3. Reglas de contrato innegociables (resumen operativo)

- **Double-entry:** gasto = real → `x_<categoryId>`; ingreso = `x_<categoryId>` → real. Nunca crear una `Transaction` fuera de esta convención.
- **API v1:** errores SIEMPRE `{ success: false, error: snake_case }`.
- **Fail-fast:** no "arreglar" los guards de `db.ts` con defaults (SQLite efímero en producción = hallazgo P0-1).
- **Seguridad:** keys solo hasheadas; jamás loguear la clave cruda; secrets fuera del código y del historial.
- **UX real:** sin datos decorativos falsos — si no hay dato, no se muestra el elemento.
- **Tipos:** sin `as any` — se arregla la raíz (ej: augmentación NextAuth).
- Detalle completo de estilo y prohibiciones: `AGENTS.md` §5 y §7.

## 4. Flujo multiagente (coordinador → planificador → implementador → revisor)

Los roles de esta sección son agentes de **desarrollo**, definidos como
agentes de opencode en `.opencode/agent/`. Los agentes **runtime** del
producto — el Orquestador (`agents/orchestrator.md`), único punto de
coordinación con el usuario final — se definen en `agents/` y no participan
del ciclo de desarrollo.

| Rol | Agente opencode | Responsabilidad | Escribe código | Documenta |
|---|---|---|---|---|
| **Coordinador** | `.opencode/agent/coordinador.md` (primary, por defecto) | Contexto, descomposición, delegación, cierre con harness + memoria | Solo docs/triviales | `MEMORY.md`, `worklog.md` |
| **Planificador** | `.opencode/agent/planificador.md` (subagent, read-only) | Plan de implementación desde `SDD.md`/`skills.md`/`AGENTS.md` | No | El plan (mensaje) |
| **Implementador** | `.opencode/agent/implementador.md` (subagent) | Código según el plan aprobado + harness | Sí | Reporte de implementación |
| **Revisor** | `.opencode/agent/revisor.md` (subagent, read-only) | Harness + checklist de spec/seguridad → veredicto APRUEBA/RECHAZA | No | Reporte de verificación |

Flujo obligatorio para tareas no triviales:

1. **Coordinador** lee los documentos en el orden de §1 y descompone la tarea.
2. Delega el **plan** al planificador; el plan se presenta al dueño (Edwin)
   para aprobación antes de codear.
3. **La spec precede al código:** los cambios de contrato se reflejan en
   `SDD.md` §2/§3, `skills.md` y `agents/orchestrator.md` antes de implementar.
4. Delega la **implementación** al implementador con el plan aprobado.
5. Delega la **verificación** al revisor; el coordinador corrige hallazgos
   (directamente o re-despachando al implementador) hasta el veredicto APRUEBA.
6. **Memoriza:** `MEMORY.md` (§Estado/§Deuda) + entrada en `worklog.md`.
   El cierre solo ocurre con `bun run verify` (lint + typecheck + build) en verde.

- **Regla de conflicto:** si el código contradice la spec, gana la spec. El
  implementador escala al coordinador; no improvisa.
- **Regla de alcance:** un agente no modifica documentos fuera de su columna
  "Documenta" sin handoff explícito.
- **Ops** (scripts/BD-Turso/deploy/API keys) no es un rol separado: es una
  función transversal que el coordinador ejercita con las recetas de
  `skills.md` §5 cuando la tarea lo requiere.
- Los agentes se apoyan en los skills de `.opencode/skills/`
  (`finzen-dev-harness`, `hig-ux-ui`) y en el catálogo de capacidades
  `skills.md`.

## 5. Handoff y escalación

- **Handoff mínimo entre agentes:** tarea · spec aplicable (sección de `SDD.md`) · skills tocadas · estado de verificación · archivos modificados.
- **Parar y escalar si:**
  - Riesgo de pérdida de datos (BD) — nunca "probar" contra producción.
  - El contrato v1 quedaría roto — la tarea no se cierra.
  - `.env` desaparece tras reinicio del sandbox — regenerarlo localmente según la rutina de `README.md`; los secretos reales viven en Vercel.
  - La verificación falla por causas ambientales y no de código — reportar, no forzar.
- **Nunca:** commit de `.env`/`*.db`/binarios, push sin petición explícita del dueño, ni cambios en `src/components/ui/*` salvo integración.
