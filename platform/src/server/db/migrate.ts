 
import { createDatabase } from './connect'

async function main() {
  const url = process.env.DATABASE_URL ?? 'pglite://./data/pglite'
  process.env.AUTO_MIGRATE = '1'
  const handle = await createDatabase(url)
  console.log(`✔ migrations applied (${handle.kind})`)
  await handle.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
