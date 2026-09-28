import { PrismaClient } from '@prisma/client'
import { readFileSync, existsSync, writeFileSync, mkdirSync, accessSync, constants } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
// Note: We import PrismaLibSQL (the adapter factory) from @prisma/adapter-libsql.
// The factory accepts a CONFIG object ({url, authToken}) — not a pre-instantiated
// libsql client — and internally calls @libsql/client's createClient(config).
import { PrismaLibSQL } from '@prisma/adapter-libsql'

/**
 * DATABASE_URL resolution — three modes:
 *
 * 1. **Turso / libSQL (production)**: if `DATABASE_URL` starts with `libsql:`,
 *    use the `@prisma/adapter-libsql` driver. This is the persistent path —
 *    writes survive cold starts because Turso is a real (serverless) DB.
 *
 * 2. **Local file SQLite (sandbox dev)**: if `DATABASE_URL` starts with `file:`,
 *    use Prisma's default SQLite driver against that file. This is the
 *    sandbox dev path.
 *
 * 3. **Vercel fallback (no env var)**: detect a writable tmp dir (Vercel
 *    serverless has `/tmp` writable) and use a bundled `db/seed.db` as the
 *    initial data. Writes don't survive cold starts in this mode — only
 *    useful when Turso isn't configured.
 *
 * The Turso mode (1) is the recommended production path because it gives
 * real persistence without any cold-start penalty.
 */

// Use OS tmpdir() — in Vercel serverless this is /tmp on Linux
const OS_TMP = tmpdir() || '/tmp'
const TMP_DB_PATH = join(OS_TMP, 'finzen.db')

function detectWritableDir(): string {
  const candidates = [OS_TMP, '/tmp', process.cwd(), join(process.cwd(), 'db'), '.']
  for (const dir of candidates) {
    try {
      try { mkdirSync(dir, { recursive: true }) } catch {}
      const testFile = join(dir, `.finzen-write-test-${Date.now()}.txt`)
      writeFileSync(testFile, 'ok', { flag: 'w' })
      try { writeFileSync(testFile, '', { flag: 'w' }) } catch {}
      return dir
    } catch {}
  }
  return process.cwd()
}

const WRITABLE_DIR = detectWritableDir()
const RESOLVED_DB_PATH = join(WRITABLE_DIR, 'finzen.db')

const ENV_DATABASE_URL = process.env.DATABASE_URL
const USES_LIBSQL = ENV_DATABASE_URL?.startsWith('libsql:') ?? false

const DATABASE_URL =
  ENV_DATABASE_URL || `file:${RESOLVED_DB_PATH}`

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  __finzenDbInitialized?: boolean
}

/**
 * Initialize the SQLite DB on cold start.
 *
 * Strategy (Vercel serverless):
 * 1. If `/tmp/finzen.db` already exists and is non-empty, skip (warm instance).
 * 2. Otherwise, look for the bundled seed DB at `/var/task/db/seed.db` (or
 *    other candidate paths) and COPY it to `/tmp/finzen.db`. The seed DB
 *    is the sandbox's `db/custom.db` and contains:
 *      - 2 users (Edwin + test)
 *      - 246 transactions
 *      - 6 accounts
 *      - 30 categories
 *      - 1 API key ("Nueva grazzia" / fz_9b35a...)
 *      - 1 budget
 *    This way Edwin's data is available on every cold start.
 * 3. If the seed DB can't be found, fall back to creating an empty DB
 *    and applying schema.sql + seeding minimal data (the legacy path).
 * 4. Always check if Edwin has an API key; if not, generate a fresh
 *    "production demo" key and LOG it to the runtime logs so we can
 *    retrieve it via `vercel logs <deploy>`.
 *
 * Idempotent via global flag.
 */
async function ensureSchemaIfVercel(prisma: PrismaClient): Promise<void> {
  if (globalForPrisma.__finzenDbInitialized) return

  try {
    // Re-evaluate DATABASE_URL at runtime (Vercel env vars are injected here)
    const runtimeDbUrl = process.env.DATABASE_URL || ''
    const isLibsql = runtimeDbUrl.startsWith('libsql:')
    console.log(`[finzen] ensureSchema starting. DB URL: ${runtimeDbUrl.substring(0, 60)}${runtimeDbUrl.length > 60 ? '...' : ''}${isLibsql ? ' (libsql/Turso)' : ' (file SQLite)'}`)
    console.log(`[finzen] process.cwd(): ${process.cwd()}`)

    // ── Turso path: external persistent DB, no need to copy seed files ──
    // Just check that we can query the DB (schema is created via
    // `prisma db push` from the sandbox before deploying).
    if (isLibsql) {
      try {
        // Simple health check — count users
        const userCount = await prisma.user.count()
        console.log(`[finzen] Turso DB healthy. Users: ${userCount}`)
      } catch (e: any) {
        console.error(`[finzen] Turso health check failed: ${e?.message?.substring(0, 300)}`)
      }
      globalForPrisma.__finzenDbInitialized = true
      console.log('[finzen] DB initialization complete (Turso mode)')
      return
    }

    // ── File SQLite path: copy seed DB to /tmp on cold start ──────────
    const seedCandidatePaths = [
      join(process.cwd(), 'db/seed.db'),
      join(process.cwd(), 'seed.db'),
      '/var/task/db/seed.db',
      '/var/task/seed.db',
      join(process.cwd(), 'db/custom.db'),
      '/var/task/db/custom.db',
    ]

    let seedDbPath: string | null = null
    for (const p of seedCandidatePaths) {
      try {
        if (existsSync(p)) {
          const stat = readFileSync(p)
          if (stat.length > 0) {
            seedDbPath = p
            console.log(`[finzen] Found seed DB at ${p} (${stat.length} bytes)`)
            break
          }
        }
      } catch {}
    }

    // Check if /tmp/finzen.db is empty (size 0) — if so, populate from seed
    let needsPopulation = true
    if (existsSync(RESOLVED_DB_PATH)) {
      const stat = readFileSync(RESOLVED_DB_PATH)
      if (stat.length > 0) {
        needsPopulation = false
        console.log(`[finzen] /tmp/finzen.db already exists (${stat.length} bytes) — skipping seed`)
      }
    }

    if (needsPopulation) {
      if (seedDbPath) {
        // Copy the seed DB to /tmp
        const seedData = readFileSync(seedDbPath)
        writeFileSync(RESOLVED_DB_PATH, seedData)
        console.log(`[finzen] ✅ Copied seed DB (${seedData.length} bytes) to ${RESOLVED_DB_PATH}`)
      } else {
        // Fall back to creating an empty DB + applying schema.sql
        console.warn('[finzen] No seed DB found — creating empty DB from schema.sql')
        try {
          writeFileSync(RESOLVED_DB_PATH, '', { flag: 'w' })
        } catch (e: any) {
          console.error(`[finzen] Failed to create DB file: ${e?.message}`)
        }

        // Apply schema.sql
        const schemaCandidatePaths = [
          join(process.cwd(), 'db/schema.sql'),
          join(process.cwd(), 'schema.sql'),
          '/var/task/db/schema.sql',
          '/var/task/schema.sql',
        ]
        let schemaSql: string | null = null
        for (const p of schemaCandidatePaths) {
          try {
            if (existsSync(p)) {
              schemaSql = readFileSync(p, 'utf-8')
              console.log(`[finzen] Loaded schema.sql from ${p}`)
              break
            }
          } catch {}
        }
        if (schemaSql) {
          const noComments = schemaSql
            .split('\n')
            .filter((line) => !line.trim().startsWith('--'))
            .join('\n')
          const statements = noComments
            .split(';')
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
          console.log(`[finzen] Found ${statements.length} DDL statements to execute`)
          for (const stmt of statements) {
            try {
              await prisma.$executeRawUnsafe(stmt)
            } catch (e: any) {
              const msg = String(e?.message || '')
              if (!msg.includes('already exists')) {
                console.error('[finzen] DDL error:', msg.substring(0, 200))
              }
            }
          }
        }
      }
    }

    // ── Step 2: ensure Edwin's user exists (idempotent seed if missing) ──
    const existing = await prisma.user.findUnique({
      where: { email: 'hamilton.edwin@gmail.com' },
      select: { id: true },
    })

    let userId: string
    if (existing) {
      userId = existing.id
      console.log('[finzen] Edwin user already present:', userId)
    } else {
      const { default: bcrypt } = await import('bcryptjs')
      // [security] La contraseña del seed NUNCA debe ser la real de producción.
      // En local se puede overridear con FINZEN_DEV_SEED_PASSWORD en .env.
      const passwordHash = await bcrypt.hash(process.env.FINZEN_DEV_SEED_PASSWORD || 'finzen-dev-only', 10)
      const user = await prisma.user.create({
        data: {
          email: 'hamilton.edwin@gmail.com',
          name: 'Edwin',
          passwordHash,
          baseCurrency: 'DOP',
          preferredLang: 'es',
        },
        select: { id: true },
      })
      userId = user.id
      console.log('[finzen] Seeded new Edwin user:', userId)
    }

    // ── Step 3: ensure Edwin has at least one API key ─────────────
    // If the seed DB was copied, Edwin already has "Nueva grazzia" (fz_9b35a...).
    // We still generate a fresh "production demo" key so the user has a
    // known full key for curl testing — LOG it to the runtime logs so we
    // can retrieve it.
    const existingKeys = await prisma.apiKey.findMany({
      where: { userId },
      select: { id: true, name: true, keyPrefix: true, isActive: true },
    })
    console.log(`[finzen] Edwin has ${existingKeys.length} existing API key(s):`)
    for (const k of existingKeys) {
      console.log(`  - ${k.name} (${k.keyPrefix}) active=${k.isActive}`)
    }

    const hasDemoKey = existingKeys.some((k) => k.name === 'Production demo key')
    if (!hasDemoKey) {
      const { createHash, randomBytes } = await import('crypto')
      const rawKey = 'fz_prod_demo_' + randomBytes(8).toString('hex')
      const keyHash = createHash('sha256').update(rawKey).digest('hex')
      await prisma.apiKey.create({
        data: {
          userId,
          name: 'Production demo key',
          keyHash,
          keyPrefix: rawKey.substring(0, 12) + '...',
          permissions: 'read,write',
        },
      })
      console.log(`[finzen] ✅ Created fresh production demo API key: ${rawKey}`)
      console.log(`[finzen]    (Use with: curl -H "X-API-Key: ${rawKey}" https://finzen-elber01s-projects.vercel.app/api/v1/expenses)`)
    } else {
      console.log('[finzen] Production demo key already exists for Edwin')
    }

    globalForPrisma.__finzenDbInitialized = true
    console.log('[finzen] DB initialization complete')
  } catch (e: any) {
    console.error('[finzen] ensureSchema failed:', e?.message?.substring(0, 500))
    globalForPrisma.__finzenDbInitialized = true
  }
}

function createPrismaClient(): PrismaClient {
  // Re-read DATABASE_URL at function call time (not at module load time).
  // Next.js standalone bundle in Vercel evaluates env vars at runtime, but
  // they may not be available at module-eval time during the build phase.
  const runtimeDbUrl = process.env.DATABASE_URL || ''
  const isLibsql = runtimeDbUrl.startsWith('libsql:')
  console.log(`[finzen] Creating PrismaClient. URL: ${runtimeDbUrl.substring(0, 50)}${runtimeDbUrl.length > 50 ? '...' : ''} libsql=${isLibsql}`)

  // ── Turso / libSQL path ────────────────────────────────────────
  // When DATABASE_URL is a libsql:// URL, use the @prisma/adapter-libsql
  // driver to talk to Turso over HTTP. This is the production path with
  // real persistence — writes survive cold starts.
  if (isLibsql) {
    try {
      console.log('[finzen] Creating libsql client with URL from env (length ' + runtimeDbUrl.length + ')')
      // IMPORTANT: PrismaLibSQL accepts a CONFIG object ({ url, authToken }),
      // NOT a libsql client instance. Internally it calls @libsql/client's
      // createClient(config) to create its own client. So we pass the URL
      // config directly, not a pre-instantiated client.
      const libsqlConfig: { url: string; authToken?: string; syncUrl?: string; syncInterval?: number; offline?: boolean } = {
        url: runtimeDbUrl,
      }

      // If the URL contains ?authToken=, libsql's createClient parses it.
      // But to be defensive, we extract it and pass it as a separate field.
      try {
        const urlObj = new URL(runtimeDbUrl)
        const authToken = urlObj.searchParams.get('authToken')
        if (authToken) {
          // Remove authToken from the URL and pass separately
          urlObj.searchParams.delete('authToken')
          libsqlConfig.url = urlObj.toString()
          libsqlConfig.authToken = authToken
        }
      } catch {
        // URL parsing might fail for some formats; keep original
      }

      const adapter = new PrismaLibSQL(libsqlConfig as any)
      console.log('[finzen] ✅ Using libsql adapter (Turso), URL: ' + libsqlConfig.url)
      // IMPORTANT: do NOT pass `datasources` when using `adapter` —
      // Prisma Driver Adapters handle the connection entirely.
      // The schema.prisma's url is a hardcoded "file:./db/placeholder.db"
      // just to satisfy build-time validation; it's not used at runtime.
      return new PrismaClient({ adapter, log: ['error', 'warn'] })
    } catch (e: any) {
      // [P0-1 fix] En producción NUNCA caer silenciosamente al SQLite
      // efímero si el adapter falla — mejor fallar ruidosamente.
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          `[finzen] El adapter libsql/Turso falló al inicializar en producción: ${e?.message}. ` +
            'Rehusando el fallback a SQLite efímero. Revisa DATABASE_URL y las credenciales de Turso.'
        )
      }
      console.error('[finzen] libsql adapter failed (dev), falling back to file SQLite:', e?.message)
    }
  }

  // ── File SQLite path (sandbox dev / Vercel fallback) ──────────
  const fallbackUrl = runtimeDbUrl || `file:${RESOLVED_DB_PATH}`
  return new PrismaClient({
    log: ['error', 'warn'],
    datasources: {
      db: {
        url: fallbackUrl,
      },
    },
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

export async function ensureDb(): Promise<void> {
  // ── [P0-1 fix] Fail-fast en producción ────────────────────────────────
  // Auditoría 27-sep-2026: con SQLite efímero, cada lambda de Vercel tiene
  // su PROPIA base de datos → sesiones divergentes, usuarios que ven la app
  // "vacía" y datos que se pierden al reciclarse la lambda. La única DB
  // válida en producción es una hosted (Turso/libSQL). Rehusamos servir de
  // otra forma: es mejor un error visible que una pérdida silenciosa.
  const runtimeDbUrl = process.env.DATABASE_URL || ''
  const isLibsql = runtimeDbUrl.startsWith('libsql:')
  if (
    process.env.NODE_ENV === 'production' &&
    !isLibsql &&
    !process.env.FINZEN_ALLOW_EPHEMERAL_DB
  ) {
    throw new Error(
      '[finzen] PRODUCCIÓN SIN DB HOSTED: DATABASE_URL no es libsql:// (Turso). ' +
        'Rehusando servir con SQLite efímero (cada lambda tendría su propia DB y se ' +
        'perderían datos — ver auditoría P0-1). Configura DATABASE_URL=libsql://... ' +
        'en Vercel → Project → Settings → Environment Variables.'
    )
  }
  if (!globalForPrisma.__finzenDbInitialized) {
    await ensureSchemaIfVercel(db)
  }
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
