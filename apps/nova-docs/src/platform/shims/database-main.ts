/**
 * بديل @modules/database/main للتطبيق: نفس الدوال (openDatabase/getDatabase/nowIso/bool/...) ونفس الترحيلات
 * (MIGRATIONS من المشروع الأصلي)، فيبقى مخطط القاعدة متطابقًا مع نسخة Windows ويمكن نقل النسخ الاحتياطية بينهما.
 */
import { runMigrations } from '@modules/database/main/migrations'
import { logger } from './logger'
import { type DbStorage, SqliteDatabase } from './sqlite-browser'

let instance: SqliteDatabase | null = null

export async function openDatabase(storage: DbStorage | null, wasmUrl?: string): Promise<SqliteDatabase> {
  if (instance) return instance
  const db = await SqliteDatabase.open({ storage, wasmUrl })
  // runMigrations مكتوب للنسخة المكتبية؛ الواجهة العامة متطابقة
  const report = runMigrations(db as never)
  if (report.applied.length) logger.info('database migrations applied', report)
  await db.flush()
  instance = db
  return db
}

export function getDatabase(): SqliteDatabase {
  if (!instance) throw new Error('database not opened')
  return instance
}

export function hasDatabase(): boolean {
  return instance !== null
}

export async function closeDatabase(): Promise<void> {
  if (!instance) return
  await instance.close()
  instance = null
}

/** جداول لا بد أن توجد في أي نسخة احتياطية من NOVA (Windows أو iOS). */
const REQUIRED_TABLES = ['invoices', 'customers', 'products']

/**
 * استعادة نسخة احتياطية بأمان: إن لم يكن الملف قاعدة NOVA صالحة (ملف SQLite آخر، تالف…) نُرجع البيانات
 * الحالية كما كانت ونرمي خطأ — لا تُفقد بيانات المستخدم أبدًا بسبب ملف خاطئ.
 */
export function replaceDatabase(bytes: Uint8Array): void {
  const db = getDatabase()
  const previous = db.exportBytes()
  try {
    db.replaceWith(bytes)
    const tables = new Set(db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'").map((r) => r.name))
    const missing = REQUIRED_TABLES.filter((t) => !tables.has(t))
    if (missing.length) throw Object.assign(new Error(`not a NOVA backup (missing: ${missing.join(', ')})`), { messageKey: 'ios.backup.invalid' })
    runMigrations(db as never)
  } catch (e) {
    db.replaceWith(previous)
    throw e
  }
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function bool(value: unknown): boolean {
  return value === 1 || value === true || value === '1'
}
