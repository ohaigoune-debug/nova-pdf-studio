/**
 * نسخة الواجهة من SqliteDatabase (نفس الواجهة العامة للنسخة المكتبية في src/modules/database/main/sqlite.ts)
 * لكن الحفظ يتم عبر "مخزن" قابل للتبديل بدل node:fs:
 *   - على iOS: ملف في مجلد Library الخاص بالتطبيق عبر @capacitor/filesystem (كتابة ذرّية: مؤقت ثم إعادة تسمية)
 *   - في الاختبارات: الذاكرة أو نظام الملفات المحلي
 * المستودعات الأصلية (العملاء، المنتجات، الفواتير، الضرائب...) تعمل فوقها دون أي تعديل.
 */
import initSqlJs, { type Database as SqlJsDatabase, type SqlValue } from 'sql.js'
import { AppError } from '@shared/errors'

export type Row = Record<string, unknown>
export type Param = string | number | boolean | null | undefined | Uint8Array | Date
export type Params = Param[] | Record<string, Param>

export interface RunResult {
  changes: number
  lastInsertRowid: number
}

/** مكان حفظ ملف القاعدة. */
export interface DbStorage {
  read(): Promise<Uint8Array | null>
  write(bytes: Uint8Array): Promise<void>
}

const PERSIST_DEBOUNCE_MS = 200

function toSqlValue(value: Param): SqlValue {
  if (value === undefined) return null
  if (typeof value === 'boolean') return value ? 1 : 0
  if (value instanceof Date) return value.toISOString()
  return value as SqlValue
}

function convertParams(params?: Params): SqlValue[] | Record<string, SqlValue> | undefined {
  if (params === undefined) return undefined
  if (Array.isArray(params)) return params.map(toSqlValue)
  const out: Record<string, SqlValue> = {}
  for (const [key, value] of Object.entries(params)) {
    out[key.startsWith('$') || key.startsWith(':') || key.startsWith('@') ? key : `$${key}`] = toSqlValue(value)
  }
  return out
}

export interface OpenOptions {
  storage?: DbStorage | null
  /** موضع ملف sql-wasm.wasm داخل التطبيق (في المتصفح). */
  wasmUrl?: string
}

export class SqliteDatabase {
  private persistTimer: ReturnType<typeof setTimeout> | null = null
  private dirty = false
  private transactionDepth = 0
  private closed = false
  private persistChain: Promise<void> = Promise.resolve()
  readonly filePath: string | null

  private constructor(
    private db: SqlJsDatabase,
    private readonly storage: DbStorage | null,
    private readonly SQL: Awaited<ReturnType<typeof initSqlJs>>
  ) {
    this.filePath = storage ? 'device' : null
  }

  static async open(options: OpenOptions = {}): Promise<SqliteDatabase> {
    const SQL = await initSqlJs(options.wasmUrl ? { locateFile: (file: string) => `${options.wasmUrl!.replace(/\/$/, '')}/${file}` } : undefined)
    const existing = options.storage ? await options.storage.read() : null
    const db = existing && existing.length ? new SQL.Database(existing) : new SQL.Database()
    const instance = new SqliteDatabase(db, options.storage ?? null, SQL)
    instance.exec('PRAGMA foreign_keys = ON;')
    return instance
  }

  run(sql: string, params?: Params): RunResult {
    this.assertOpen()
    try {
      this.db.run(sql, convertParams(params))
      const changes = this.db.getRowsModified()
      const idRow = this.db.exec('SELECT last_insert_rowid() AS id')
      const lastInsertRowid = Number(idRow[0]?.values[0]?.[0] ?? 0)
      this.markDirty()
      return { changes, lastInsertRowid }
    } catch (error) {
      throw AppError.wrap(error)
    }
  }

  all<T = Row>(sql: string, params?: Params): T[] {
    this.assertOpen()
    const stmt = this.db.prepare(sql)
    try {
      if (params !== undefined) stmt.bind(convertParams(params))
      const rows: T[] = []
      while (stmt.step()) rows.push(stmt.getAsObject() as T)
      return rows
    } catch (error) {
      throw AppError.wrap(error)
    } finally {
      stmt.free()
    }
  }

  get<T = Row>(sql: string, params?: Params): T | undefined {
    return this.all<T>(sql, params)[0]
  }

  exec(sql: string): void {
    this.assertOpen()
    try {
      this.db.exec(sql)
      this.markDirty()
    } catch (error) {
      throw AppError.wrap(error)
    }
  }

  transaction<T>(fn: () => T): T {
    this.assertOpen()
    if (this.transactionDepth > 0) {
      this.transactionDepth++
      try {
        return fn()
      } finally {
        this.transactionDepth--
      }
    }
    this.db.exec('BEGIN')
    this.transactionDepth = 1
    try {
      const result = fn()
      this.db.exec('COMMIT')
      this.transactionDepth = 0
      this.markDirty()
      return result
    } catch (error) {
      try {
        this.db.exec('ROLLBACK')
      } catch {
        /* الخطأ الأصلي أهم */
      }
      this.transactionDepth = 0
      throw AppError.wrap(error)
    }
  }

  private markDirty(): void {
    if (!this.storage) return
    this.dirty = true
    if (this.transactionDepth > 0) return
    if (this.persistTimer) clearTimeout(this.persistTimer)
    this.persistTimer = setTimeout(() => void this.flush().catch(() => undefined), PERSIST_DEBOUNCE_MS)
  }

  flush(): Promise<void> {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer)
      this.persistTimer = null
    }
    if (!this.storage || !this.dirty) return this.persistChain
    this.dirty = false
    const bytes = this.db.export()
    const storage = this.storage
    this.persistChain = this.persistChain.then(async () => {
      try {
        await storage.write(bytes)
      } catch (error) {
        this.dirty = true
        throw AppError.wrap(error)
      }
    })
    return this.persistChain
  }

  exportBytes(): Uint8Array {
    this.assertOpen()
    return this.db.export()
  }

  replaceWith(bytes: Uint8Array): void {
    this.assertOpen()
    this.db.close()
    this.db = new this.SQL.Database(bytes)
    this.exec('PRAGMA foreign_keys = ON;')
    this.dirty = true
    this.markDirty()
  }

  async close(): Promise<void> {
    if (this.closed) return
    await this.flush()
    this.closed = true
    this.db.close()
  }

  private assertOpen(): void {
    if (this.closed) throw new AppError('DB_ERROR', 'errors.DB_CLOSED')
  }
}
