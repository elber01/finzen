---
name: hig-ux-ui
description: Use when improving, reviewing or building FinZen UI/UX — vistas, componentes, diálogos, navegación, dark mode, accesibilidad o i18n. Trigger words: design, UX, UI, HIG, Apple, interfaz, usabilidad, accesibilidad, dark mode, mejora visual. Metodología Apple Human Interface Guidelines adaptada a los tokens y reglas del repo.
---

# HIG Apple aplicado a FinZen

Guía para diseñar/revisar UI de FinZen con la metodología de las *Human
Interface Guidelines* de Apple, traducida a los tokens y reglas REALES de este
repo. Fuente oficial: developer.apple.com/design/human-interface-guidelines.

## 1. Los tres principios HIG → su traducción FinZen

### Claridad (Clarity)
- El texto es la interfaz: jerarquía clara (título → dato → metadata).
- Dinero SIEMPRE con clase `tabular-nums` + `formatMoney` (alineación estable
  de dígitos, formato por locale).
- Color con significado: ingresos `text-income` / `var(--income)`, gastos y
  deudas `text-expense` / `var(--expense)` — nunca un rojo/verde arbitrario.
- `text-muted-foreground` SOLO para texto secundario; el dato principal usa
  `text-foreground` con peso mayor.

### Deferencia (Deference)
- El contenido es el protagonista; el chrome cede. Sin datos decorativos
  falsos: si no hay dato real, el elemento NO se muestra (`computeDelta`
  devuelve `undefined` → no se renderiza el delta — replicar ese patrón).
- Superficies planas y tranquilas: `bg-surface` / `bg-surface-2`; gradiente
  sutil solo en tarjetas hero (`bg-gradient-to-br from-surface to-surface-2`).
- Estados vacíos: mensaje honesto + UNA acción clara (ver empty state de
  accounts-view: icono + título + descripción + botón "Crear cuenta").

### Profundidad (Depth)
- Jerarquía por capas: página → `Card` → `Dialog`/`Sheet`; sin sombras
  inventadas — la elevación del design system.
- Movimiento con propósito: transiciones de vista con framer-motion
  (`ViewTransition`), ~200–300ms, easing suave. La animación explica
  jerarquía, no decora.
- Confirmación para acciones destructivas: `AlertDialog` (ver delete de
  accounts-view) con el nombre del objeto afectado en el texto.

## 2. Reglas duras del repo (equivalentes HIG)

- **SOLO tokens semánticos.** Paleta dual claro/oscuro en `src/app/globals.css`
  (`--surface`, `--surface-2`, `--income`, `--income-soft`, `--expense`,
  `--expense-soft` + primitivas Radix: `background`, `foreground`,
  `muted-foreground`, `primary`…). PROHIBIDO `bg-white`, `bg-black`,
  `text-gray-*`, hex crudos o colores Tailwind directos — rompen dark mode.
- **Dark mode es first-class:** todo cambio debe verse correcto en ambos
  temas. Si un color no existe como token, se añade a `globals.css`, no inline.
- **i18n es innegociable:** toda string visible vive en
  `src/lib/finzen/i18n.ts` (es + en) y se consume con `translations[locale]`.
  Nada de texto bilingüe suelto en componentes. Excepción actual tolerada:
  metadatos inline es/en tipo `SUB_TYPE_META` (seguir ese patrón si aplica).
- **Accesibilidad:** targets táctiles ≥ 44px (inputs/botones `h-11`; iconos
  `min-w-[40px] min-h-[40px]` con `p-2`); `aria-label` en todo botón de icono;
  `aria-current` en navegación activa; `aria-live` en feedback dinámico;
  `focus-visible` del design system; contraste delegado a los tokens.

## 3. Estados del sistema (feedback HIG)

- **Carga:** `Skeleton` — jamás spinners bloqueantes ni pantallas en blanco.
  El store inicia `loading: true` para cubrir el primer render.
- **Éxito/Error:** toasts con `sonner` mostrando la causa REAL del servidor,
  no mensajes genéricos ("Error al eliminar" → incluir `err.message`).
- **Manipulación directa:** el store hace updates optimistas con rollback
  (ver `addTransaction`/`deleteTransaction`) — el usuario ve el efecto al
  instante y el sistema corrige si falla.

## 4. Checklist de revisión por vista

1. Colores crudos: buscar `bg-(white|black)`, `text-(gray|slate|zinc|neutral|stone)-`, `#[0-9a-fA-F]{3,6}` en el diff → cero matches.
2. Ambos temas (claro/oscuro) verificados en la vista tocada.
3. Ambos idiomas (es/en) sin texto suelto; claves nuevas en `i18n.ts`.
4. Dinero: `tabular-nums` + `formatMoney` en cada monto.
5. A11y: labels, targets ≥ 44px, `aria-*` según §2.
6. Sin decoración falsa: deltas, sparklines y KPIs solo con datos reales.
7. Empty state con acción clara; carga con Skeleton; error con causa real.
8. Acciones destructivas con confirmación (`AlertDialog`).

## 5. Al añadir vistas nuevas

Seguir la receta de `AGENTS.md` §6 (VIEWS/ViewKey/NAV_ITEMS/i18n) y aplicar
desde el inicio los principios §1–§3 — no como retoque posterior.
