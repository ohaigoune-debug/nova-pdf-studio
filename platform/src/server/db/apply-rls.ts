/**
 * تطبيق سياسات Row Level Security على PostgreSQL/Supabase: `npm run db:rls`
 * لا يعمل على PGlite المحلي (لا حاجة له في التطوير).
 */
import fs from 'node:fs'
import path from 'node:path'
import { Pool } from 'pg'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url || url.startsWith('pglite://')) {
    console.error('db:rls يتطلب DATABASE_URL لقاعدة PostgreSQL حقيقية.')
    process.exit(1)
  }
  const sql = fs.readFileSync(path.resolve(process.cwd(), 'src/server/db/rls.sql'), 'utf8')
  const pool = new Pool({ connectionString: url })
  try {
    await pool.query(sql)
    console.log('✔ RLS policies applied')
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
