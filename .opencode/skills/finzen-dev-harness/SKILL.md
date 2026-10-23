---
name: finzen-dev-harness
description: Use when starting, executing or closing any development task in the FinZen repo — the SDD cycle (especificar, implementar, verificar, memorizar) and the quality harness (bun run verify = lint + typecheck + build) that every task must pass. Trigger words: tarea nueva, cerrar tarea, verificar, harness, SDD, ciclo, memorizar, MEMORY.md, worklog, calidad.
---

# Ciclo SDD + Harness de calidad — FinZen

Todo trabajo en este repo sigue el ciclo Spec-Driven Development de `agent.md` §2
y se cierra con el harness en verde. Este skill es el procedimiento operativo.

## 1. Orden de lectura obligatorio (sesión nueva)

1. `MEMORY.md` — estado actual, deuda técnica, lecciones aprendidas.
2. `SDD.md` — secciones de arquitectura/contratos que afecten la tarea.
3. `skills.md` — capacidades existentes tocadas o nuevas.
4. `AGENTS.md` — reglas operativas completas.

## 2. El ciclo por tarea

1. **Especificar** (la spec precede al código):
   - Cambia arquitectura o contrato v1 → actualizar `SDD.md` §2/§3 primero.
   - Añade/modifica una capacidad → registrar el skill en `skills.md`
     (formato de alta) y en la tabla de delegación de `agents/orchestrator.md`.
   - Cambio puramente local → basta cumplir la spec existente.
2. **Implementar** según la spec: lógica de negocio en `src/lib/services/`,
   handlers delgados, convenciones de `AGENTS.md` §5.
3. **Verificar:** `bun run verify` — OBLIGATORIO en verde. Si existe E2E del
   skill afectado (p. ej. `scripts/e2e-*.js`), ejecutarlo. Prohibido cerrar
   con la barrera en rojo.
4. **Memorizar** (el paso que casi todos olvidan):
   - `MEMORY.md`: §4 "Estado actual" (fecha + resumen de la sesión) y §5
     "Deuda técnica" si algo quedó pendiente.
   - `worklog.md`: entrada de fase al final del archivo con formato de las
     existentes (Task ID, Agent, Date, Status, Problema, Cambios, Archivos,
     Verificación).
   - "Un agente que no escribe memoria condena al siguiente a repetir sus
     errores."

## 3. El harness (barrera de calidad mínima)

```bash
bun run verify   # = lint + typecheck + build — UN comando, tres barreras
```

- `lint` — ESLint con React Compiler: memos con deps de `new Date()` usan el
  disable puntual documentado (AGENTS.md §5), nunca reglas apagadas por bloque.
- `typecheck` — `tsc --noEmit` strict. El build de producción también valida
  tipos (se removió `ignoreBuildErrors`).
- `build` — Next standalone; también valida tipos estrictamente.
- No existen tests automatizados aún (deuda `MEMORY.md` §5.1) — por eso las
  baterías E2E con curl/scripts son la red de seguridad de la API v1.

## 4. Escalación (parar y reportar, no forzar)

- Riesgo de pérdida de datos (BD) — nunca "probar" contra producción.
- El contrato v1 quedaría roto — la tarea no se cierra.
- `.env` desapareció tras reinicio del sandbox — rutina de `README.md`.
- Verificación falla por causas ambientales, no de código.

## 5. Prohibido en el cierre

- Commit/push sin petición explícita del dueño (Edwin).
- Commit de `.env`, `*.db`, backups o binarios ajenos.
- Cerrar tarea sin `bun run verify` en verde o sin memoria actualizada.
