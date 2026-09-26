import 'server-only'
import * as schema from './schema'
import { loadAiCredentials } from '@/server/services/ai-credentials.service'
import { createDatabase, type DatabaseHandle, type Db } from './connect'

export type { Db }

declare global {
   
  var __madrasaDb: Promise<DatabaseHandle> | undefined
  var __madrasaAiKey: Promise<void> | undefined
}

/**
 * قاعدة البيانات كـ Singleton (يبقى عبر HMR في التطوير).
 * يُختار المحرّك من DATABASE_URL:
 *   pglite://memory            → PGlite في الذاكرة (اختبارات)
 *   pglite://./data/pglite     → PGlite على القرص (تطوير محلي بلا خادم)
 *   postgres://...             → PostgreSQL حقيقي (إنتاج)
 */
export async function getDb(): Promise<Db> {
  if (!globalThis.__madrasaDb) {
    globalThis.__madrasaDb = createDatabase(process.env.DATABASE_URL ?? 'pglite://./data/pglite')
  }
  const handle = await globalThis.__madrasaDb
  // مفتاح الذكاء الاصطناعي المحفوظ من لوحة الإدارة يُطبَّق مرة عند الإقلاع
  globalThis.__madrasaAiKey ??= loadAiCredentials(handle.db).catch((err) => console.error('[ai] تعذّر تحميل المفتاح المحفوظ', err))
  await globalThis.__madrasaAiKey
  return handle.db
}

export { schema }
