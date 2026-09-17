/* eslint-disable no-console */
import fs from 'node:fs'
import path from 'node:path'

const url = process.env.DATABASE_URL ?? 'pglite://./data/pglite'
if (!url.startsWith('pglite://')) {
  console.error('db:reset يعمل فقط مع PGlite المحلي. للإنتاج استعمل أدوات Postgres.')
  process.exit(1)
}
const dir = path.resolve(process.cwd(), url.slice('pglite://'.length))
if (fs.existsSync(dir)) {
  fs.rmSync(dir, { recursive: true, force: true })
  console.log('✔ removed', dir)
} else {
  console.log('• nothing to remove')
}
