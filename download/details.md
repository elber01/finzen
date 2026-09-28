# FinZen — Documento Detallado del Proyecto

> **Propósito:** Este documento describe TODO lo que tiene el proyecto actualmente, las cosas que no se han implementado, los problemas conocidos, y las áreas de mejora. Está diseñado para que Claude (o cualquier asistente de IA) pueda analizar el estado completo y ayudar a mejorar la experiencia.

---

## 1. RESUMEN EJECUTIVO

**FinZen** es una aplicación de gestión de finanzas personales y familiares construida con Next.js 16, TypeScript, Tailwind CSS 4, shadcn/ui, Prisma ORM (SQLite), y NextAuth.js. Soporta multi-moneda (USD, DOP, EUR, USDT, BTC), idioma español/inglés, modo claro/oscuro, y incluye OCR de recibos con Tesseract.js.

**Estado actual:** Funcional con base de datos real + autenticación de usuarios. La app se puede usar desde cualquier dispositivo con un login. Sin embargo, hay limitaciones del entorno sandbox que causan pérdida de datos, y varias funcionalidades de la especificación original (Phases 1-4) no están implementadas en la versión actual.

---

## 2. STACK TECNOLÓGICO

| Componente | Tecnología | Versión |
|---|---|---|
| Framework | Next.js (App Router) | 16.1.3 |
| Lenguaje | TypeScript | 5.x |
| UI Framework | React | 19.x |
| Estilos | Tailwind CSS | 4.x |
| Componentes UI | shadcn/ui (New York) + Radix Primitives | — |
| Gráficos | Recharts | 2.15.4 |
| Estado (cliente) | Zustand | 5.x |
| Estado (servidor) | Fetch API + store async | — |
| Base de datos | SQLite (via Prisma) | 6.19.2 |
| ORM | Prisma | 6.19.2 |
| Autenticación | NextAuth.js v4 (Credentials provider) | 4.24.11 |
| Hash de contraseñas | bcryptjs | 3.0.3 |
| OCR | Tesseract.js | 7.0.0 |
| Iconos | lucide-react | 0.525.0 |
| Fechas | date-fns | 4.1.0 |
| Notificaciones | sonner | 2.0.6 |
| Forms | react-hook-form + zod | — |
| Drag & Drop | @dnd-kit/core | 6.3.1 |
| Runtime | Bun | 1.3.14 |

---

## 3. ARQUITECTURA

### 3.1 Estructura de Carpetas

```
src/
├── app/
│   ├── api/                          # API Routes (Next.js Route Handlers)
│   │   ├── auth/
│   │   │   ├── [...nextauth]/route.ts    # NextAuth handler
│   │   │   └── register/route.ts         # User registration
│   │   ├── accounts/
│   │   │   ├── route.ts                  # GET (list) + POST (create)
│   │   │   └── [id]/route.ts             # PATCH (update) + DELETE
│   │   ├── transactions/
│   │   │   ├── route.ts                  # GET (list, limit=1000) + POST (create)
│   │   │   └── [id]/route.ts             # PATCH (update) + DELETE
│   │   ├── budgets/route.ts              # GET (list) + POST (create with items)
│   │   ├── categories/route.ts           # GET (list)
│   │   ├── me/route.ts                   # GET (profile) + PATCH (update prefs)
│   │   └── restore/route.ts              # POST (bulk import from JSON)
│   ├── globals.css                   # Design tokens (light/dark)
│   ├── layout.tsx                     # Root layout (Theme + Session + Toaster)
│   ├── login/page.tsx                 # Login/register page
│   └── page.tsx                       # Main page (auth gate → AppShell)
├── components/
│   ├── providers/
│   │   ├── theme-provider.tsx         # next-themes wrapper
│   │   └── session-provider.tsx       # NextAuth SessionProvider
│   ├── auth/
│   │   └── auth-form.tsx              # Login/register form
│   ├── finzen/
│   │   ├── app-shell.tsx              # Main layout orchestrator
│   │   ├── sidebar.tsx                # Desktop sidebar (collapsible)
│   │   ├── bottom-tab-bar.tsx         # Mobile bottom nav + "Más" sheet
│   │   ├── add-transaction-sheet.tsx  # Transaction form (add + edit + delete)
│   │   ├── transaction-row.tsx        # Clickable transaction row
│   │   ├── dashboard-view.tsx         # KPIs + cash flow chart + donut + alerts
│   │   ├── transactions-view.tsx      # Filterable list, grouped by day
│   │   ├── accounts-view.tsx          # Account cards + create/edit/delete
│   │   ├── budgets-view.tsx           # Budget progress bars + create/delete
│   │   ├── reports-view.tsx           # Charts + top categories
│   │   ├── import-view.tsx            # CSV import wizard + export + OCR card
│   │   ├── ocr-flow.tsx               # OCR wizard (upload → scan → review → save)
│   │   ├── settings-view.tsx          # Theme/lang/currency + export + logout
│   │   └── kpi-card.tsx               # Reusable KPI card with sparkline
│   └── ui/                            # shadcn/ui primitives (50+ components)
├── lib/
│   ├── auth/
│   │   └── auth-options.ts            # NextAuth config (with hardcoded fallback)
│   ├── finzen/
│   │   ├── currency.ts                # FX rates + formatMoney + convertAmount
│   │   ├── default-categories.ts      # 13 seed categories
│   │   ├── i18n.ts                    # Spanish + English dictionaries
│   │   ├── mock-data.ts               # Legacy seed data (partially used)
│   │   └── ocr.ts                     # Tesseract.js wrapper + receipt parser
│   ├── db.ts                          # Prisma client (with hardcoded fallback)
│   └── utils.ts                       # cn() utility
├── store/
│   └── finzen-store.ts                # Zustand store (async API-calling actions)
└── hooks/
    ├── use-toast.ts                   # Legacy toast hook
    └── use-mobile.ts                  # Mobile detection

prisma/
├── schema.prisma                      # 7 models: User, Session, Account, Category, Transaction, Budget, BudgetItem
└── seed.ts                            # Seed script (per-user categories)

.zscripts/
├── dev.sh                             # Dev server startup (includes env restore)
├── backup-db.sh                       # JSON backup of all DB data
├── restore-db.sh                      # JSON restore from backup
└── restore-env.sh                     # Restore NEXTAUTH_SECRET in .env
```

### 3.2 Esquema de Base de Datos (Prisma)

```prisma
model User {
  id             String   @id @default(cuid())
  email          String   @unique
  name           String?
  passwordHash   String
  preferredLang  String   @default("es")     // es | en
  baseCurrency   String   @default("USD")     // USD | DOP | EUR | USDT | BTC
  theme          String   @default("system")  // light | dark | system
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  // Relations: accounts, transactions, budgets, categories, sessions
}

model Account {
  id             String  @id @default(cuid())
  userId         String
  name           String
  accountType    String  @default("asset")   // asset | liability | equity | income | expense
  subType        String?                      // checking | savings | credit_card | cash | crypto_wallet | investment
  currency       String  @default("USD")
  currentBalance Float   @default(0)
  institution    String?
  lastFour       String?
}

model Category {
  id         String  @id @default(cuid())
  userId     String?
  name       String
  nameEs     String?
  nameEn     String?
  icon       String?
  color      String?
  direction  String  @default("expense")     // income | expense | transfer
  isSystem   Boolean @default(false)
  sortOrder  Int     @default(0)
}

model Transaction {
  id            String   @id @default(cuid())
  userId        String
  type          String                           // income | expense | transfer | adjustment
  amount        Float
  currency      String   @default("USD")
  fromAccountId String                            // real account ID or virtual "x_categoryId"
  toAccountId   String                            // real account ID or virtual "x_categoryId"
  categoryId    String?
  description   String?
  occurredOn    DateTime
  tags          String   @default("")             // comma-separated
  importSource  String?                           // manual | csv | ocr | plaid
}

model Budget {
  id        String   @id @default(cuid())
  userId    String
  name      String
  period    String   @default("monthly")
  startDate DateTime
  endDate   DateTime
  items     BudgetItem[]
}

model BudgetItem {
  id                String  @id @default(cuid())
  budgetId          String
  categoryId        String
  plannedAmount     Float
  alertThresholdPct Int     @default(80)
}
```

### 3.3 API Endpoints

| Ruta | Método | Autenticación | Propósito |
|---|---|---|---|
| `/api/auth/register` | POST | No | Crear usuario + seed categorías |
| `/api/auth/[...nextauth]` | GET/POST | No | Login, logout, sesión |
| `/api/me` | GET | Sí | Obtener perfil del usuario |
| `/api/me` | PATCH | Sí | Actualizar preferencias (idioma, moneda, tema) |
| `/api/categories` | GET | Sí | Listar categorías del usuario |
| `/api/accounts` | GET | Sí | Listar cuentas (todas) |
| `/api/accounts` | POST | Sí | Crear cuenta |
| `/api/accounts/[id]` | PATCH | Sí | Editar cuenta |
| `/api/accounts/[id]` | DELETE | Sí | Eliminar cuenta (cascade: elimina transacciones) |
| `/api/transactions` | GET | Sí | Listar transacciones (limit=1000) |
| `/api/transactions` | POST | Sí | Crear transacción |
| `/api/transactions/[id]` | PATCH | Sí | Editar transacción |
| `/api/transactions/[id]` | DELETE | Sí | Eliminar transacción |
| `/api/budgets` | GET | Sí | Listar presupuestos con items |
| `/api/budgets` | POST | Sí | Crear presupuesto con items |
| `/api/restore` | POST | Sí | Importar datos masivamente (backup restore) |

### 3.4 Store (Zustand)

El store ya NO usa `persist` middleware. Todas las acciones son **async** y llaman a la API:

```typescript
// Cargar todos los datos al montar
loadData: () => Promise<void>

// Transaction CRUD
addTransaction: (tx) => Promise<void>
updateTransaction: (id, patch) => Promise<void>
deleteTransaction: (id) => Promise<void>

// Account CRUD
addAccount: (account) => Promise<void>
updateAccount: (id, patch) => Promise<void>
deleteAccount: (id) => Promise<void>

// Budget CRUD
addBudgetItem: (item) => Promise<void>
deleteBudgetItem: (id) => Promise<void>

// Preferences
updatePreferences: (prefs) => Promise<void>
```

---

## 4. FUNCIONALIDADES IMPLEMENTADAS ✅

### 4.1 Autenticación
- [x] Registro de usuarios (email + password + nombre)
- [x] Login con NextAuth.js (Credentials provider)
- [x] Hash de contraseñas con bcrypt (12 rounds)
- [x] Sesiones JWT (30 días de expiración)
- [x] Logout (botón en Settings)
- [x] Hardcoded fallback secret (para prevenir pérdida de .env)

### 4.2 Cuentas
- [x] Crear cuenta (nombre, tipo, moneda, saldo, institución)
- [x] Editar cuenta (diálogo pre-poblado)
- [x] Eliminar cuenta (con confirmación + advertencia de transacciones vinculadas)
- [x] 6 tipos: checking, savings, credit_card, cash, crypto_wallet, investment
- [x] 5 monedas: USD, DOP, EUR, USDT, BTC
- [x] Cuentas de inversión se muestran como patrimonio (no ingreso)
- [x] Conversión automática a moneda base para totales

### 4.3 Transacciones
- [x] Crear transacción (gasto, ingreso, transferencia)
- [x] Modelo double-entry: gasto = cuenta → categoría; ingreso = categoría → cuenta
- [x] Editar transacción (click en la fila → formulario pre-poblado)
- [x] Eliminar transacción (botón Delete con confirmación)
- [x] Mostrar monto en moneda original (no convertir)
- [x] Agrupar por día (HOY, AYER, fecha)
- [x] Filtros: fecha (este mes, mes pasado, trimestre, año, año pasado), categoría, miembro, cuenta
- [x] Búsqueda por descripción
- [x] Tags (string comma-separated)
- [x] Categorías auto-matched en importación CSV

### 4.4 Dashboard
- [x] Patrimonio Neto (suma de saldos de todas las cuentas)
- [x] KPIs: Ingresos, Gastos, Ratio de Ahorro (mes actual)
- [x] Gráfico de flujo de caja (12 meses, dinámico desde transacciones)
- [x] Donut de distribución de gastos por categoría
- [x] Lista de transacciones recientes (5 últimas)
- [x] Panel de alertas (vacío por ahora, placeholder)
- [x] Estado vacío cuando no hay datos ("¡Bienvenido a FinZen!")

### 4.5 Presupuestos
- [x] Crear partida presupuestaria (categoría + monto + umbral de alerta)
- [x] Eliminar partida (con confirmación)
- [x] Barras de progreso con colores (verde < 80%, ámbar 80-100%, rojo > 100%)
- [x] Validación de categoría duplicada
- [x] Vista general con progreso total
- [x] Estado vacío

### 4.6 Reportes
- [x] Totales: Ingresos, Gastos, Ahorro Neto
- [x] Gráfico de barras: Ingresos vs Gastos (6 meses)
- [x] Top 5 categorías con barras de progreso
- [x] Filtros de rango: 6M, 1Y, All
- [x] Estado vacío para gráfico

### 4.7 Importar/Exportar
- [x] Importar CSV (wizard: upload → auto-mapeo de columnas → commit)
- [x] OCR de recibos (Tesseract.js: upload → scanning → review → save)
- [x] Auto-detección de categoría desde nombre del comercio
- [x] Auto-detección de moneda desde símbolos (RD$, US$, €)
- [x] Parser de montos (formato latino y inglés)
- [x] Exportar CSV (descarga real con Blob)
- [x] Exportar JSON (descarga real con Blob)

### 4.8 Ajustes (Settings)
- [x] Cambiar tema (claro/oscuro/sistema) — sincroniza con DB
- [x] Cambiar idioma (español/inglés) — sincroniza con DB
- [x] Cambiar moneda base — sincroniza con DB
- [x] Exportar datos (CSV/JSON)
- [x] Eliminar todos los datos (con confirmación)
- [x] Cerrar sesión
- [x] Info de perfil, hogar, categorías, seguridad, conexiones bancarias (read-only)

### 4.9 UI/UX
- [x] Responsive: sidebar en desktop, bottom tab bar en móvil
- [x] Botón "Más" en móvil para acceder a Presupuestos, Reportes, Importar, Ajustes
- [x] FAB central para agregar transacción
- [x] Modo claro/oscuro con CSS variables
- [x] Inter font (Geist) con tabular-nums para números
- [x] i18n: español + inglés (130+ strings)
- [x] Formato de moneda locale-aware (RD$, $, €, ₮, ₿)
- [x] Fechas relativas (Hoy, Ayer, Hace N días)
- [x] Toast notifications (sonner)
- [x] Loading states (spinner)
- [x] Empty states con íconos y CTAs

### 4.10 Seguridad
- [x] Autenticación requerida en todos los endpoints (excepto register y nextauth)
- [x] Aislamiento por usuario (todas las queries scoped a session.user.id)
- [x] Contraseñas hasheadas con bcrypt
- [x] Sesiones JWT en cookies httpOnly
- [x] Validación de propiedad de cuenta antes de crear transacciones

---

## 5. FUNCIONALIDADES NO IMPLEMENTADAS ❌

### 5.1 Especificadas en Phases 1-4 pero NO implementadas

| Funcionalidad | Fase | Descripción |
|---|---|---|
| **OAuth2 (Google/Apple)** | Phase 1 | Solo está el provider de Credentials (email/password). No hay login social. |
| **2FA / WebAuthn** | Phase 1 | No hay autenticación de dos factores ni biometría. |
| **Alertas/Recommendation Engine** | Phase 2-3 | El panel de alertas en el Dashboard está vacío. Las 5 reglas (budget threshold, expense spike, savings suggestion, cash flow forecast, unusual transaction) no están implementadas. |
| **Transacciones Recurrentes** | Phase 3 | No hay modelo RecurringTransaction ni cron job para materializarlas. |
| **Plaid Bank Connection** | Phase 1-4 | Solo hay un placeholder con toast "próximamente". No hay integración real con Plaid. |
| **Multi-miembro Household** | Phase 1-2 | El miembro está hardcoded a "Me" (id: 'me'). No hay modelo Household ni gestión de miembros. |
| **CRUD de Categorías** | Phase 3 | Las categorías son read-only (sembradas al registrar). No se pueden crear, editar, eliminar ni reordenar. |
| **Editar Partidas de Presupuesto** | Phase 6 | Solo se pueden crear y eliminar partidas. No se puede editar el monto o umbral de una partida existente. |
| **Split Transactions** | Phase 3 | No hay soporte para dividir una transacción en múltiples categorías. |
| **Exportar con filtros** | Phase 4 | La exportación CSV/JSON descarga TODAS las transacciones, no respeta los filtros activos. |
| **XLSX Import** | Phase 4 | Solo se importa CSV. No se soporta Excel (.xlsx). |
| **Attachments de Recibos** | Phase 4 | No se puede adjuntar una imagen de recibo a una transacción manual. El OCR guarda la transacción pero no la imagen. |
| **Audit Log** | Phase 3 | No hay tabla de audit_log ni registro de acciones del usuario. |
| **FX Rate Auto-refresh** | Phase 3 | Las tasas de cambio están hardcoded en currency.ts. No se actualizan desde una API. |
| **Crypto Price Feed** | Phase 1 | No hay precios en tiempo real de BTC/USDT. |
| **PWA / Offline** | Phase 4 | No hay manifest ni service worker. La app requiere conexión. |
| **Storybook** | Phase 4 | No hay stories de componentes. |
| **E2E Tests** | Phase 4 | No hay tests de Playwright. |
| **Dark/Light mode sync con DB** | Parcial | El tema se guarda en next-themes (localStorage) Y en la DB, pero la sincronización no es perfecta. |

### 5.2 Especificadas pero implementadas parcialmente

| Funcionalidad | Estado | Problema |
|---|---|---|
| **Multi-moneda** | Parcial | Las tasas FX están hardcoded (DOP=60.5, EUR=0.92, BTC=0.0000145). No se actualizan. |
| **Budget Edit** | Parcial | Solo create + delete. No hay diálogo de edición para partidas existentes. |
| **Settings sub-páginas** | Parcial | Perfil, Hogar, Categorías, Seguridad, Conexiones Bancarias muestran info pero no son funcionales (no abren diálogos ni páginas). |
| **Tags en transacciones** | Parcial | El campo tags existe pero no se muestran ni filtran en la UI. Solo se guardan. |
| **Filtros de Transacciones** | Parcial | El filtro "Todos" no existe (solo: este mes, mes pasado, trimestre, año, año pasado). |
| **CSV Import — preview** | Parcial | No hay tabla de preview antes de confirmar la importación. |

---

## 6. PROBLEMAS CONOCIDOS ⚠️

### 6.1 Críticos

| # | Problema | Causa | Impacto | Solución |
|---|---|---|---|---|
| 1 | **Pérdida de datos al reiniciar sandbox** | El archivo `db/custom.db` se resetea cuando el sandbox reinicia | Se pierden TODAS las transacciones, cuentas y presupuestos | Backup JSON creado, pero no es automático. El usuario debe exportar datos regularmente. |
| 2 | **`.env` pierde NEXTAUTH_SECRET** | El sandbox sobrescribe el archivo `.env` | El login falla (error 401) hasta que se restaura | Hardcoded fallback en `auth-options.ts` (implementado en Phase 7.3) |
| 3 | **Archivos se pierden al reiniciar** | `ocr-flow.tsx`, `ocr.ts`, y `tesseract.js` desaparecen | El módulo de Importar crashea (module not found) | Recrear archivos manualmente. No hay solución permanente. |
| 4 | **Contraseña se resetea** | Cuando el DB se resetea, los usuarios se recrean | El usuario no puede entrar con su contraseña | Resetear manualmente con script de Node.js |

### 6.2 UX/UI

| # | Problema | Descripción | Prioridad |
|---|---|---|---|
| 5 | **Textos se cortan en móvil** | Algunos títulos y montos no tienen responsive breakpoints (usan `text-2xl` sin `sm:`) | Alta |
| 6 | **Gráfico de dashboard muy estrecho en móvil** | 12 meses en 390px de ancho hace que las barras sean muy finas | Media |
| 7 | **Bottom tab bar puede tapar contenido** | El padding inferior (`pb-24`) puede no ser suficiente en algunos dispositivos | Baja |
| 8 | **No hay Pull-to-refresh** | El usuario no puede recargar datos manualmente (debe navegar a otra vista y volver) | Media |
| 9 | **No hay confirmación al salir del formulario** | Si el usuario cierra el sheet de transacción sin guardar, pierde los datos ingresados | Media |
| 10 | **El selector de fecha es un calendar popup** | En móvil sería mejor un input type="date" nativo | Baja |
| 11 | **No hay skeleton loading** | Durante la carga de datos se muestra un spinner simple, no skeletons | Baja |
| 12 | **Los filtros de Transacciones no muestran conteo** | No se muestra cuántas transacciones hay con el filtro actual | Baja |

### 6.3 Funcionales

| # | Problema | Descripción | Prioridad |
|---|---|---|---|
| 13 | **El dashboard solo muestra KPIs del mes actual** | No hay forma de ver KPIs de meses anteriores sin ir a Reportes | Media |
| 14 | **Las cuentas de pasivo (hipoteca) se suman al patrimonio** | La cuenta APAP Hipoteca tiene saldo 0, pero si tuviera saldo negativo se sumaría en vez de restarse | Alta |
| 15 | **No se pueden crear categorías personalizadas** | Las 13 categorías son fijas (sembradas al registrarse) | Media |
| 16 | **El presupuesto se calcula solo para el mes actual** | No se puede ver el progreso del presupuesto de meses anteriores | Baja |
| 17 | **La importación CSV no valida duplicados** | Si importas el mismo archivo dos veces, se crean transacciones duplicadas | Media |
| 18 | **El OCR puede tardar 15+ segundos** | Tesseract.js es lento la primera vez (descarga datos de idioma) | Baja |
| 19 | **No hay paginación en Transacciones** | Se cargan hasta 1000 transacciones de golpe, sin paginación infinita | Baja |
| 20 | **El logout no limpia el estado del store** | Después de logout, el store sigue teniendo datos en memoria hasta que se recarga | Baja |

### 6.4 Técnicos

| # | Problema | Descripción | Prioridad |
|---|---|---|---|
| 21 | **No hay manejo de errores en la UI** | Los errores de API se muestran como toast genérico, sin detalles ni opciones de retry | Media |
| 22 | **No hay optimistic updates** | Todas las operaciones esperan la respuesta del servidor antes de actualizar la UI | Media |
| 23 | **No hay tests** | No hay tests unitarios, de integración ni E2E | Baja |
| 24 | **No hay CI/CD** | No hay pipeline de GitHub Actions | Baja |
| 25 | **`mock-data.ts` aún existe** | El archivo de mock data sigue importado por algunos componentes legacy | Baja |
| 26 | **Las tasas FX están hardcoded** | `FX_RATES` en `currency.ts` tiene valores fijos, no se actualizan | Media |
| 27 | **No hay rate limiting** | Los endpoints de API no tienen rate limiting | Baja |
| 28 | **No hay logging estructurado** | No hay sistema de logs (pino, winston) para debugging en producción | Baja |

---

## 7. DISEÑO Y TOKENS

### 7.1 Paleta de Colores

**Light Mode:**
| Token | Hex | Uso |
|---|---|---|
| `--background` | `#FFFFFF` | Fondo de página |
| `--surface` | `#FAFAFA` | Tarjetas, paneles |
| `--surface-2` | `#F4F4F5` | Inputs, hovers |
| `--foreground` | `#0F172A` | Texto principal |
| `--foreground-muted` | `#64748B` | Texto secundario |
| `--border` | `#E2E8F0` | Bordes, divisores |
| `--primary` | `#1E3A5F` | Navy (CTA, activos) |
| `--income` | `#059669` | Verde (ingresos) |
| `--expense` | `#F43F5E` | Rosa (gastos) |
| `--warning` | `#F59E0B` | Ámbar (alertas) |
| `--info` | `#3B82F6` | Azul (info) |
| `--btc` | `#F7931A` | Bitcoin |
| `--usdt` | `#26A17B` | Tether |

**Dark Mode:**
| Token | Hex | Uso |
|---|---|---|
| `--background` | `#0B0F1A` | Fondo oscuro |
| `--surface` | `#151B2B` | Tarjetas |
| `--surface-2` | `#1F2738` | Inputs |
| `--foreground` | `#F1F5F9` | Texto principal |
| `--primary` | `#60A5FA` | Navy claro |
| `--income` | `#34D399` | Verde claro |
| `--expense` | `#FB7185` | Rosa claro |

### 7.2 Tipografía

- **Sans:** Geist (variable font from next/font/google)
- **Mono:** Geist Mono (para números tabulares)
- **Feature settings:** `cv11`, `ss03`, `tnum` (tabular numbers)
- **Scale:**
  - display-2xl: 48px (hero KPI)
  - display-xl: 36px
  - display-lg: 28px
  - heading-lg: 22px
  - heading-md: 18px
  - body-lg: 16px
  - body-md: 14px (default)
  - body-sm: 13px
  - caption: 12px

### 7.3 Navegación

**Desktop (≥1024px):**
- Sidebar izquierdo (280px expandido, 64px colapsado)
- Toggle con botón o Cmd/Ctrl+B
- Nav items: Panel, Transacciones, Cuentas, Presupuestos, Reportes, Importar, Ajustes
- Footer del sidebar: toggle de tema, toggle de idioma, info de usuario

**Móvil (<1024px):**
- Top bar con logo + toggle de idioma + toggle de tema
- Bottom tab bar (72px de alto):
  - Panel | Transacciones | [FAB +] | Cuentas | Más
- Botón "Más" abre un bottom sheet con: Presupuestos, Reportes, Importar, Ajustes

---

## 8. MODELO DE DATOS — DOUBLE-ENTRY

La app usa un modelo de contabilidad de doble entrada simplificado:

| Tipo | From | To | Descripción |
|---|---|---|---|
| **Gasto** | Cuenta real (asset) | Cuenta virtual (`x_categoryId`) | Dinero sale de tu cuenta hacia una categoría de gasto |
| **Ingreso** | Cuenta virtual (`x_categoryId`) | Cuenta real (asset) | Dinero llega desde una categoría de ingreso (salario, freelance) |
| **Transferencia** | Cuenta real (asset) | Cuenta real (asset) | Dinero se mueve entre tus cuentas |

Las cuentas virtuales (`x_categoryId`) NO existen en la tabla Account — son strings que representan la categoría como origen/destino del dinero.

---

## 9. I18N (Internacionalización)

- **Diccionario:** `src/lib/finzen/i18n.ts` con 130+ strings en español e inglés
- **Moneda:** `Intl.NumberFormat` con locale es-DO o en-US
- **Fechas:** `Intl.DateTimeFormat` y date-fns con locales
- **Símbolos de moneda:**
  - USD → `$` (en) / `US$` (es)
  - DOP → `RD$` (ambos)
  - EUR → `€`
  - USDT → `₮`
  - BTC → `₿`

---

## 10. SEGURIDAD

| Aspecto | Estado | Notas |
|---|---|---|
| Autenticación | ✅ | NextAuth.js con Credentials provider |
| Hash de passwords | ✅ | bcryptjs con 12 rounds |
| Sesiones | ✅ | JWT en cookies httpOnly, 30 días |
| Aislamiento de datos | ✅ | Todas las queries scoped a userId |
| Encriptación en tránsito | ⚠️ | No hay HTTPS configurado (sandbox usa HTTP) |
| Encriptación en reposo | ❌ | SQLite sin encriptación |
| Rate limiting | ❌ | No implementado |
| CORS | ⚠️ | Default de Next.js |
| CSP | ❌ | No configurado |
| Audit log | ❌ | No implementado |
| 2FA | ❌ | No implementado |
| OAuth social | ❌ | No implementado |

---

## 11. WORKLOG — RESUMEN DE FASES

| Fase | Título | Estado | Descripción |
|---|---|---|---|
| 1 | Architecture & Tech Stack | ✅ | Propuesta completa de stack tecnológico |
| 2 | UI/UX System Design | ✅ | Design tokens, componentes, wireframes |
| 3 | Backend & API Endpoints | ✅ | 90+ endpoints especificados, Prisma schema |
| 4 | Frontend + OCR/CSV Integration | ✅ | Especificación completa del frontend |
| 5 | Live Demo Build | ✅ | App funcional con datos mock (localStorage) |
| 5.1 | Bug Fixes: Theme + Fonts | ✅ | Toggle de tema, fuentes móviles |
| 5.2 | Typography Consistency | ✅ | Auditoría y corrección de tamaños de fuente |
| 5.3 | Font-Family Bug | ✅ | Fix de Geist font no aplicándose |
| 6 | Data Persistence + CRUD | ✅ | Persistencia en localStorage + CRUD completo |
| 6.1 | Mobile Nav + Settings | ✅ | Bottom tab bar rediseñado, Settings funcional |
| 6.2 | Income Flow + Amount Display | ✅ | Fix del flujo de ingreso, mostrar moneda original |
| 6.3 | Reports Chart Fix | ✅ | Gráfico dinámico desde transacciones reales |
| 6.4 | OCR Receipt Scanning | ✅ | Tesseract.js integrado |
| 6.5 | OCR Card Blocked | ✅ | OCR abre sin requerir cuenta |
| 7 | DB Migration: SQLite + Auth | ✅ | Migración a SQLite con NextAuth |
| 7.1 | Restore Edit Mode + Income | ✅ | Restaurar edit/delete + flujo de ingreso |
| 7.2 | Full Functionality Restoration | ✅ | Accounts, Budgets, Import, Settings async |
| 7.3 | Full Restoration (3rd time) | ✅ | Chart 12 meses, API limit 1000, auth fallback |
| 7.4 | Data Loss Prevention | ✅ | Backup/restore JSON system |

**NOTA:** Las fases 5.1–6.5 se perdieron durante las migraciones y reinicios del sandbox. Fueron redocumentadas en el worklog pero el código fue sobreescrito múltiples veces.

---

## 12. ÁREAS DE MEJORA PRIORITARIAS

### Prioridad ALTA
1. **Solucionar la persistencia de datos** — El problema #1 es que los datos se pierden al reiniciar el sandbox. Considerar migrar a una DB externa (Neon, Supabase) o usar Prisma con PostgreSQL remoto.
2. **Fix responsive en móvil** — Varios textos se cortan. Auditar todos los componentes en viewport 390×844.
3. **Cuentas de pasivo** — La hipoteca debería restarse del patrimonio, no sumarse. Implementar `accountType: 'liability'` que reste su saldo.
4. **Alertas/Recommendation Engine** — El panel de alertas está vacío. Implementar las 5 reglas especificadas en Phase 3.
5. **CRUD de categorías** — Permitir crear, editar, eliminar y reordenar categorías personalizadas.

### Prioridad MEDIA
6. **Optimistic updates** — Actualizar la UI inmediatamente al guardar, sin esperar la respuesta del servidor.
7. **Paginación infinita en Transacciones** — Cargar 50 transacciones a la vez con scroll infinito.
8. **Validación de duplicados en CSV import** — Evitar importar la misma transacción dos veces.
9. **Editar partidas de presupuesto** — Actualizar monto y umbral sin tener que eliminar y crear.
10. **OAuth2 (Google/Apple)** — Login social para mejorar la experiencia.
11. **FX rates dinámicos** — Consumir API de tasas de cambio (ECB, OpenExchangeRates).
12. **PWA** — Manifest + service worker para uso offline.

### Prioridad BAJA
13. **Tests** — Unit tests (Vitest), E2E tests (Playwright)
14. **Storybook** — Documentación de componentes
15. **Plaid integration** — Conexión real con bancos
16. **Multi-miembro household** — Gestión de miembros del hogar
17. **Transacciones recurrentes** — Crear reglas RRULE que generen transacciones automáticamente
18. **Split transactions** — Dividir una transacción en múltiples categorías
19. **Attachments** — Adjuntar imágenes de recibos a transacciones
20. **Audit log** — Registro de acciones del usuario

---

## 13. CREDENCIALES DE ACCESO

> [security] Las contraseñas en texto plano fueron ELIMINADAS de este documento (27-sep-2026).
> Nunca guardes credenciales reales en repos. Usa variables de entorno o un gestor de contraseñas.
> La cuenta de desarrollo "Test" se puede recrear con el script `prisma/seed.ts`.

| Usuario | Email | Contraseña | Moneda base |
|---|---|---|---|
| Edwin | hamilton.edwin@gmail.com | — (rotada; no documentar aquí) | DOP |
| Test | test@finzen.com | — (usar seed.ts para recrear) | USD |

---

## 14. CÓMO USAR ESTE DOCUMENTO CON CLAUDE

Para que Claude (o cualquier IA) pueda ayudar a mejorar la app:

1. **Comparte este archivo** (`details.md`) completo
2. **Comparte el `worklog.md`** para el historial detallado de cambios
3. **Comparte los archivos de código** relevantes que quieras mejorar
4. **Especifica el área** que quieres trabajar (ej: "mejorar el responsive del dashboard en móvil")
5. **Menciona los problemas** de la sección 6 que quieres resolver primero

### Prompt sugerido para Claude:
> "Tengo esta app de finanzas personales (FinZen) construida con Next.js 16 + Prisma + NextAuth. Adjunto el documento `details.md` con el estado completo del proyecto. Necesito ayuda con: [ESPECIFICAR QUÉ QUIERES MEJORAR]. El código está en TypeScript con Tailwind CSS 4 y shadcn/ui."

---

*Documento generado el 2026-07-02. Última actualización: Phase 7.4.*
