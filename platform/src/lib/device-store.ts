/**
 * تخزين محلي على جهاز الطالب: المسودات وطابور الإرسال في IndexedDB بدل الخادم.
 * الخادم لا يحفظ إلا الإجابة النهائية، فتبقى قاعدة البيانات خفيفة مهما كثر الطلاب.
 */

const DB_NAME = 'madrasa-device'
const DB_VERSION = 1
const DRAFTS = 'drafts'
const OUTBOX = 'outbox'

/** عدد محاولات الإرسال قبل إسقاط العنصر من الطابور */
export const MAX_ATTEMPTS = 5

export interface DeviceDraft {
  assignmentId: string
  text: string
  updatedAt: number
}

export interface OutboxEntry {
  assignmentId: string
  title: string
  text: string
  queuedAt: number
  attempts: number
}

type StoredRow = DeviceDraft | OutboxEntry

interface Backend {
  get(store: string, key: string): Promise<unknown>
  put(store: string, value: StoredRow): Promise<void>
  del(store: string, key: string): Promise<void>
  all(store: string): Promise<unknown[]>
}

/** بديل في الذاكرة عند تعطّل IndexedDB (تصفّح خاص، أو تشغيل خارج المتصفح) */
const tables: Record<string, Map<string, StoredRow>> = { [DRAFTS]: new Map(), [OUTBOX]: new Map() }
const memoryBackend: Backend = {
  async get(store, key) {
    return tables[store]?.get(key) ?? null
  },
  async put(store, value) {
    tables[store]?.set(value.assignmentId, value)
  },
  async del(store, key) {
    tables[store]?.delete(key)
  },
  async all(store) {
    return [...(tables[store]?.values() ?? [])]
  }
}

function factory(): IDBFactory | null {
  try {
    return typeof indexedDB === 'undefined' ? null : indexedDB
  } catch {
    return null
  }
}

function openDb(idb: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = idb.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const name of [DRAFTS, OUTBOX]) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'assignmentId' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('indexeddb blocked'))
  })
}

let handle: Promise<IDBDatabase> | null = null

function ask<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return handle!.then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode)
        const req = run(tx.objectStore(store))
        req.onsuccess = () => resolve(req.result as T)
        req.onerror = () => reject(req.error)
      })
  )
}

const idbBackend: Backend = {
  get: (store, key) => ask<unknown>(store, 'readonly', (s) => s.get(key)),
  put: (store, value) => ask<void>(store, 'readwrite', (s) => s.put(value)),
  del: (store, key) => ask<void>(store, 'readwrite', (s) => s.delete(key)),
  all: (store) => ask<unknown[]>(store, 'readonly', (s) => s.getAll())
}

let chosen: Promise<Backend> | null = null

function backend(): Promise<Backend> {
  if (!chosen) {
    const idb = factory()
    chosen = idb
      ? openDb(idb).then(
          (db) => {
            handle = Promise.resolve(db)
            return idbBackend
          },
          () => memoryBackend
        )
      : Promise.resolve(memoryBackend)
  }
  return chosen
}

/** المسودة المحفوظة على الجهاز تفوز على نص الخادم متى كانت أحدث منه */
export function pickDraftText(serverText: string, local: DeviceDraft | null, serverSavedAt = 0): string {
  if (!local || !local.text.trim()) return serverText
  if (!serverText.trim()) return local.text
  return local.updatedAt > serverSavedAt ? local.text : serverText
}

export async function readDraft(assignmentId: string): Promise<DeviceDraft | null> {
  const b = await backend()
  return ((await b.get(DRAFTS, assignmentId)) as DeviceDraft | null) ?? null
}

export async function writeDraft(assignmentId: string, text: string, now = Date.now()): Promise<void> {
  const b = await backend()
  await b.put(DRAFTS, { assignmentId, text, updatedAt: now } satisfies DeviceDraft)
}

export async function clearDraft(assignmentId: string): Promise<void> {
  const b = await backend()
  await b.del(DRAFTS, assignmentId)
}

/** يضع الإجابة في طابور الجهاز لتُرسل تلقائياً عند عودة الشبكة */
export async function queueSubmission(assignmentId: string, title: string, text: string, now = Date.now()): Promise<void> {
  const b = await backend()
  await b.put(OUTBOX, { assignmentId, title, text, queuedAt: now, attempts: 0 } satisfies OutboxEntry)
}

export async function listQueued(): Promise<OutboxEntry[]> {
  const b = await backend()
  return ((await b.all(OUTBOX)) as OutboxEntry[]).sort((x, y) => x.queuedAt - y.queuedAt)
}

export async function dequeue(assignmentId: string): Promise<void> {
  const b = await backend()
  await b.del(OUTBOX, assignmentId)
}

/** يسجّل محاولة إرسال فاشلة ويُسقط العنصر بعد استنفاد المحاولات */
export async function recordFailure(assignmentId: string): Promise<{ dropped: boolean }> {
  const b = await backend()
  const entry = (await b.get(OUTBOX, assignmentId)) as OutboxEntry | null
  if (!entry) return { dropped: false }
  const attempts = entry.attempts + 1
  if (attempts >= MAX_ATTEMPTS) {
    await b.del(OUTBOX, assignmentId)
    return { dropped: true }
  }
  await b.put(OUTBOX, { ...entry, attempts })
  return { dropped: false }
}

/** للاختبارات فقط: يعيد الحالة إلى الصفر */
export function resetDeviceStoreForTests(): void {
  for (const table of Object.values(tables)) table.clear()
  chosen = null
  handle = null
}
