import path from 'node:path'
import type { ExtractTablesWithRelations } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from './schema'

export type Schema = typeof schema
/** نوع موحّد لقاعدة البيانات أو للمعاملة (Transaction) — الخدمات تقبل كليهما */
export type Db = PgDatabase<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>

export interface DatabaseHandle {
  db: Db
  kind: 'pglite' | 'postgres'
  close: () => Promise<void>
}

const MIGRATIONS_FOLDER = path.join(process.cwd(), 'drizzle')

/**
 * ينشئ اتصالاً ويطبّق الـMigrations.
 * PGlite: دائماً (آمن ومتكرر). Postgres: فقط إذا AUTO_MIGRATE=1 أو في الاختبارات.
 */
export async function createDatabase(url: string): Promise<DatabaseHandle> {
  if (url.startsWith('pglite://')) {
    const target = url.slice('pglite://'.length)
    const { PGlite } = await import('@electric-sql/pglite')
    const { drizzle } = await import('drizzle-orm/pglite')
    const { migrate } = await import('drizzle-orm/pglite/migrator')
    let client
    if (target === 'memory' || target === '') {
      client = new PGlite()
    } else {
      const dir = path.resolve(process.cwd(), target)
      const fs = await import('node:fs')
      fs.mkdirSync(path.dirname(dir), { recursive: true })
      client = new PGlite(dir)
    }
    const db = drizzle(client, { schema })
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
    return {
      db: db as unknown as Db,
      kind: 'pglite',
      close: () => client.close()
    }
  }

  const { Pool } = await import('pg')
  const { drizzle } = await import('drizzle-orm/node-postgres')
  const { migrate } = await import('drizzle-orm/node-postgres/migrator')
  const pool = new Pool({ connectionString: url, max: Number(process.env.DATABASE_POOL_MAX ?? 10) })
  const db = drizzle(pool, { schema })
  if (process.env.AUTO_MIGRATE === '1' || process.env.NODE_ENV === 'test') {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
  }
  return {
    db: db as unknown as Db,
    kind: 'postgres',
    close: () => pool.end()
  }
}
