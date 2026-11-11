/**
 * كاش ختم PDF (الموجة أ · 5): الفتح الثاني لا يختم، الصلاحية تُفحص قبل الكاش دائماً،
 * كل مشاهد له نسخته، استبدال الملف أو تغيّر نص الختم يُبطل النسخة، التنظيف (30 يوماً + سقف LRU)،
 * وETag/304 خلف مفتاح بيئة مُطفأ افتراضياً.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { extractText, getDocumentProxy } from 'unpdf'
import { resolveActor, createSession } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import type { DatabaseHandle } from '@/server/db/connect'
import { contentTargets, files, users } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { etagMatches, getOrCreateStamped, stampCacheDir, stampCacheKey, stampCacheMaxBytes, sweepStampCache, type StampKeyInput } from '@/server/lib/pdf-stamp-cache'
import { storage } from '@/server/lib/storage'
import { createContent } from '@/server/services/content.service'
import { generateCodes } from '@/server/services/enrollment-codes.service'
import { redeemEnrollmentCode } from '@/server/services/enrollment.service'
import { uploadFile } from '@/server/services/files.service'
import { createGroup } from '@/server/services/groups.service'
import { runCleanupJob } from '@/server/services/maintenance.service'
import { ANON_VIEWER, MEDIA_URL_TTL_SECONDS, PDF_STAMP_VERSION, signMediaUrl, signPdfMediaUrl, stampPdf, verifyMediaSignature } from '@/server/services/media.service'
import { GET } from '@/app/api/v1/media/[fileId]/route'
import { makeAdmin, makeStudent, makeTeacher, setupDb } from './helpers'

vi.mock('@/server/db/client', () => ({ getDb: vi.fn() }))
// الجلسة الحقيقية: الرمز يُحلّ عبر resolveActor نفسه (حساب محظور/جلسة ملغاة ⇒ null كما في الإنتاج)
let token: string | null = null
vi.mock('@/server/auth/current-user', async () => {
  const { resolveActor: resolve } = await import('@/server/auth/session')
  const { getDb: db } = await import('@/server/db/client')
  return { getCurrentActor: vi.fn(async () => (token ? resolve(await db(), token) : null)) }
})
// عدّاد الختم الفعلي: الدالة الأصلية تعمل كما هي
vi.mock('@/server/services/media.service', async (orig) => {
  const actual = await orig<typeof import('@/server/services/media.service')>()
  return { ...actual, stampPdf: vi.fn(actual.stampPdf) }
})

let h: DatabaseHandle
let teacher: Actor
let studentA: Actor
let studentB: Actor
let outsider: Actor
let tokens: Record<string, string>
let fileId: string
let contentId: string
let groupId: string
const ROOT = path.join(os.tmpdir(), `stamp-cache-test-${process.pid}-${Date.now()}`)
const stamps = () => vi.mocked(stampPdf).mock.calls.length

async function makePdf(pages: number, label = 'Lesson'): Promise<Buffer> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage([400, 500]).drawText(`${label} ${i + 1}`, { x: 40, y: 450, size: 20 })
  return Buffer.from(await doc.save())
}

async function open(as: Actor | null, opts: { url?: string; headers?: Record<string, string>; file?: string; content?: string } = {}) {
  token = as ? tokens[as.userId]! : null
  const f = opts.file ?? fileId
  const url = opts.url ?? signMediaUrl(f, opts.content ?? contentId, as?.userId ?? ANON_VIEWER)
  return GET(new Request(`https://madrasadz.com${url}`, { headers: opts.headers }), { params: Promise.resolve({ fileId: f }) })
}
const bytesOf = async (res: Response) => Buffer.from(await res.arrayBuffer())
const textOf = async (pdf: Buffer) => String((await extractText(await getDocumentProxy(new Uint8Array(pdf)), { mergePages: true })).text)

function cacheFiles(): string[] {
  const dir = stampCacheDir()
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).flatMap((s) => fs.readdirSync(path.join(dir, s)).map((n) => path.join(dir, s, n)))
}

beforeAll(async () => {
  process.env.UPLOADS_DIR = path.join(ROOT, 'uploads')
  delete process.env.PDF_STAMP_CACHE_DIR
  delete process.env.PDF_STAMP_CACHE_MAX_MB
  delete process.env.PDF_PRIVATE_REVALIDATE
  h = await setupDb()
  vi.mocked(getDb).mockResolvedValue(h.db)
  const admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin, 'أستاذ الكاش')
  studentA = await makeStudent(h.db, 'تلميذ أ')
  studentB = await makeStudent(h.db, 'تلميذ ب')
  outsider = await makeStudent(h.db, 'تلميذ خارج الفوج')
  tokens = {}
  for (const a of [teacher, studentA, studentB, outsider]) tokens[a.userId] = (await createSession(h.db, { userId: a.userId })).token
  const group = await createGroup(h.db, teacher, { name: 'فوج الكاش' })
  groupId = group.id
  const codes = await generateCodes(h.db, teacher, { groupId: group.id, count: 2 })
  await redeemEnrollmentCode(h.db, studentA, codes.codes[0]!.code)
  await redeemEnrollmentCode(h.db, studentB, codes.codes[1]!.code)
  fileId = (await uploadFile(h.db, teacher, { originalName: 'summary.pdf', mimeType: 'application/pdf', bytes: await makePdf(2) })).id
  contentId = (await createContent(h.db, teacher, { type: 'PDF', title: 'ملخص محمي', visibility: 'GROUP_ONLY', groupIds: [group.id], fileId, publish: true })).id
})

afterAll(async () => {
  await h?.close()
  fs.rmSync(ROOT, { recursive: true, force: true })
})

beforeEach(() => {
  vi.mocked(stampPdf).mockClear()
})

describe('كاش ختم PDF: المسار', () => {
  it('الفتح الأول يختم ويحفظ ذرّياً، والثاني لنفس التلميذ لا يختم ويرجع البايتات نفسها (no-store بلا ETag افتراضياً)', async () => {
    const first = await open(studentA)
    expect(first.status).toBe(200)
    expect(first.headers.get('cache-control')).toBe('private, no-store')
    expect(first.headers.get('etag')).toBeNull()
    const a1 = await bytesOf(first)
    expect(Number(first.headers.get('content-length'))).toBe(a1.length)
    expect(stamps()).toBe(1)
    // داخل مجلد المرفوعات (نفس الـvolume)، ملف واحد نهائي ولا ملف مؤقت
    expect(stampCacheDir()).toBe(path.join(ROOT, 'uploads', '.stamp-cache'))
    expect(cacheFiles()).toHaveLength(1)
    expect(cacheFiles()[0]).toMatch(/[a-f0-9]{64}\.pdf$/)

    const second = await open(studentA)
    expect(second.status).toBe(200)
    expect(second.headers.get('cache-control')).toBe('private, no-store')
    const a2 = await bytesOf(second)
    expect(Number(second.headers.get('content-length'))).toBe(a2.length)
    expect(a2.equals(a1)).toBe(true)
    expect(stamps()).toBe(1)
    expect(await textOf(a2)).toContain(studentA.email)
  })

  it('التلميذ ب لا يستلم نسخة أ أبداً: نسخته مختومة ببريده هو', async () => {
    const b = await bytesOf(await open(studentB))
    expect(stamps()).toBe(1)
    const text = await textOf(b)
    expect(text).toContain(studentB.email)
    expect(text).not.toContain(studentA.email)
    // ونسخة أ ما زالت ببريد أ
    const a = await textOf(await bytesOf(await open(studentA)))
    expect(a).toContain(studentA.email)
    expect(a).not.toContain(studentB.email)
    expect(stamps()).toBe(1)
    expect(cacheFiles()).toHaveLength(2)
  })

  it('غير المخوَّل لا يحصل على شيء ولو وُجدت نسخة محفوظة لغيره', async () => {
    // خارج الفوج، برابط موقّع له هو
    const out = await open(outsider)
    expect(out.status).toBe(404)
    expect((await out.text()).includes('%PDF')).toBe(false)
    // خارج الفوج يستعمل رابط التلميذ أ (التوقيع مرتبط بالهوية)
    expect((await open(outsider, { url: signMediaUrl(fileId, contentId, studentA.userId) })).status).toBe(404)
    // زائر بلا جلسة، برابطه وبرابط أ
    expect((await open(null)).status).toBe(404)
    expect((await open(null, { url: signMediaUrl(fileId, contentId, studentA.userId) })).status).toBe(404)
    // رابط منتهٍ
    expect((await open(studentA, { url: signMediaUrl(fileId, contentId, studentA.userId, MEDIA_URL_TTL_SECONDS, Date.now() - 5 * 3600_000) })).status).toBe(404)
    expect(stamps()).toBe(0)
  })

  it('سحب الصلاحية أو حظر الحساب أو إلغاء الجلسة يُغلق الملف فوراً رغم وجود نسخته في الكاش', async () => {
    expect((await open(studentA)).status).toBe(200)
    // سحب استهداف الفوج
    const target = await h.db.select().from(contentTargets).where(and(eq(contentTargets.contentId, contentId), eq(contentTargets.groupId, groupId)))
    expect(target).toHaveLength(1)
    await h.db.delete(contentTargets).where(eq(contentTargets.contentId, contentId))
    expect((await open(studentA)).status).toBe(404)
    await h.db.insert(contentTargets).values(target)
    expect((await open(studentA)).status).toBe(200)
    // حظر الحساب
    await h.db.update(users).set({ status: 'DISABLED' }).where(eq(users.id, studentA.userId))
    expect((await open(studentA)).status).toBe(404)
    await h.db.update(users).set({ status: 'ACTIVE' }).where(eq(users.id, studentA.userId))
    expect((await open(studentA)).status).toBe(200)
    // جلسة غير صالحة
    const good = tokens[studentA.userId]!
    tokens[studentA.userId] = 'not-a-session'
    expect((await open(studentA)).status).toBe(404)
    tokens[studentA.userId] = good
    expect(await resolveActor(h.db, good)).not.toBeNull()
    expect(stamps()).toBe(0)
  })

  it('فتحات متزامنة لمفتاح جديد تختم مرة واحدة', async () => {
    const res = await Promise.all(Array.from({ length: 5 }, () => open(teacher)))
    expect(res.map((r) => r.status)).toEqual([200, 200, 200, 200, 200])
    const bodies = await Promise.all(res.map(bytesOf))
    for (const b of bodies) expect(b.equals(bodies[0]!)).toBe(true)
    expect(stamps()).toBe(1)
    expect(cacheFiles().filter((f) => f.endsWith('.part'))).toHaveLength(0)
  })

  it('استبدال الملف المصدر يُبطل النسخة المحفوظة (حجم الكائن، ثم بصمة الصف)', async () => {
    const before = await bytesOf(await open(studentA))
    expect(stamps()).toBe(0)
    const [row] = await h.db.select().from(files).where(eq(files.id, fileId))
    // 1) الكائن استُبدل في التخزين
    await storage().put(row!.storageKey, await makePdf(3, 'Replaced'))
    const after = await bytesOf(await open(studentA))
    expect(stamps()).toBe(1)
    expect(after.equals(before)).toBe(false)
    expect((await PDFDocument.load(after)).getPageCount()).toBe(3)
    expect(await textOf(after)).toContain('Replaced')
    // 2) تغيّرت بصمة الصف بلا تغيّر الحجم
    await h.db.update(files).set({ checksum: 'sha256:new-version' }).where(eq(files.id, fileId))
    await open(studentA)
    expect(stamps()).toBe(2)
    await open(studentA)
    expect(stamps()).toBe(2)
  })

  it('تغيّر نص الختم (بريد التلميذ) يُبطل النسخة المحفوظة', async () => {
    await open(studentA)
    expect(stamps()).toBe(0)
    const newEmail = `renamed-${Date.now()}@test.dz`
    await h.db.update(users).set({ email: newEmail }).where(eq(users.id, studentA.userId))
    const fresh = await bytesOf(await open(studentA))
    expect(stamps()).toBe(1)
    const text = await textOf(fresh)
    expect(text).toContain(newEmail)
    expect(text).not.toContain(studentA.email)
    await h.db.update(users).set({ email: studentA.email }).where(eq(users.id, studentA.userId))
  })

  it('ملف ناقص أو مؤقت في المجلد لا يُخدَم، وعطل الكاش لا يمنع التسليم', async () => {
    await open(studentB) // الملف استُبدل أعلاه: نسخة ب الجديدة تُحفظ الآن
    vi.mocked(stampPdf).mockClear()
    const before = await bytesOf(await open(studentB))
    expect(stamps()).toBe(0)
    const entry = cacheFiles().find((f) => fs.readFileSync(f).equals(before))!
    // انقطاع أثناء الكتابة يترك .part فقط: لا يُقرأ أبداً
    fs.renameSync(entry, `${entry}.123.abcdef.part`)
    const again = await bytesOf(await open(studentB))
    expect(stamps()).toBe(1)
    expect(again.equals(before)).toBe(true)
    // ملف نهائي فارغ (لا يحدث مع rename الذرّي) يُتجاهل ويُعاد الختم
    fs.writeFileSync(entry, '')
    expect((await bytesOf(await open(studentB))).equals(before)).toBe(true)
    expect(stamps()).toBe(2)
    // مجلد كاش غير قابل للكتابة: الرد يصل مختوماً
    fs.writeFileSync(path.join(ROOT, 'not-a-dir'), 'x')
    process.env.PDF_STAMP_CACHE_DIR = path.join(ROOT, 'not-a-dir', 'cache')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const res = await open(studentB)
    expect(res.status).toBe(200)
    expect((await bytesOf(res)).equals(before)).toBe(true)
    expect(stamps()).toBe(3)
    warn.mockRestore()
    delete process.env.PDF_STAMP_CACHE_DIR
    // PDF_STAMP_CACHE_MAX_MB=0 يعطّل الكاش: ختم في كل فتح
    process.env.PDF_STAMP_CACHE_MAX_MB = '0'
    await open(studentB)
    await open(studentB)
    expect(stamps()).toBe(5)
    delete process.env.PDF_STAMP_CACHE_MAX_MB
  })

  it('ملف يسمح الأستاذ بتنزيله لا يُختم ولا يدخل الكاش (كما كان)', async () => {
    const n = cacheFiles().length
    const free = await createContent(h.db, teacher, { type: 'PDF', title: 'ملف حر', visibility: 'GROUP_ONLY', groupIds: [groupId], fileId, allowDownload: true, publish: true })
    const res = await open(studentA, { content: free.id })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    await res.arrayBuffer()
    expect(stamps()).toBe(0)
    expect(cacheFiles().length).toBe(n)
  })
})

describe('إعادة التحقق الخاصة ETag/304 — مفتاح PDF_PRIVATE_REVALIDATE', () => {
  it('مُطفأ (الافتراضي): no-store، لا ETag، وIf-None-Match لا يُنتج 304، والرابط كما كان', async () => {
    const res = await open(studentA, { headers: { 'if-none-match': '*' } })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    expect(res.headers.get('etag')).toBeNull()
    await res.arrayBuffer()
    const now = Date.now()
    expect(signPdfMediaUrl(fileId, contentId, studentA.userId, now)).toBe(signMediaUrl(fileId, contentId, studentA.userId, MEDIA_URL_TTL_SECONDS, now))
  })

  it('مُفعَّل: private, no-cache + ETag قوي، و304 بعد التحقق الكامل فقط، ولا يتقاطع بين التلاميذ', async () => {
    process.env.PDF_PRIVATE_REVALIDATE = '1'
    try {
      const first = await open(studentA)
      expect(first.status).toBe(200)
      expect(first.headers.get('cache-control')).toBe('private, no-cache')
      const etag = first.headers.get('etag')!
      expect(etag).toMatch(/^"[a-f0-9]{64}"$/)
      const body = await bytesOf(first)
      expect(body.length).toBeGreaterThan(0)

      const again = await open(studentA, { headers: { 'if-none-match': etag } })
      expect(again.status).toBe(304)
      expect(again.headers.get('etag')).toBe(etag)
      expect(again.headers.get('cache-control')).toBe('private, no-cache')
      expect((await again.arrayBuffer()).byteLength).toBe(0)

      // وسم تلميذ آخر لا يطابق: ب يستلم نسخته كاملة بوسم مختلف
      const b = await open(studentB, { headers: { 'if-none-match': etag } })
      expect(b.status).toBe(200)
      expect(b.headers.get('etag')).not.toBe(etag)
      expect(await textOf(await bytesOf(b))).toContain(studentB.email)

      // غير المخوَّل: 404 لا 304، حتى مع الوسم الصحيح أو *
      expect((await open(outsider, { headers: { 'if-none-match': etag } })).status).toBe(404)
      expect((await open(outsider, { url: signMediaUrl(fileId, contentId, studentA.userId), headers: { 'if-none-match': '*' } })).status).toBe(404)
      expect((await open(null, { headers: { 'if-none-match': '*' } })).status).toBe(404)
      // سحب الصلاحية بعد التخزين في المتصفح: 404 لا 304
      const target = await h.db.select().from(contentTargets).where(eq(contentTargets.contentId, contentId))
      await h.db.delete(contentTargets).where(eq(contentTargets.contentId, contentId))
      expect((await open(studentA, { headers: { 'if-none-match': etag } })).status).toBe(404)
      await h.db.insert(contentTargets).values(target)
      // حظر الحساب: 404 لا 304
      await h.db.update(users).set({ status: 'DISABLED' }).where(eq(users.id, studentA.userId))
      expect((await open(studentA, { headers: { 'if-none-match': etag } })).status).toBe(404)
      await h.db.update(users).set({ status: 'ACTIVE' }).where(eq(users.id, studentA.userId))

      // استبدال الملف يغيّر الوسم ⇒ 200 بالمحتوى الجديد
      const [row] = await h.db.select().from(files).where(eq(files.id, fileId))
      await storage().put(row!.storageKey, await makePdf(4, 'Again'))
      const changed = await open(studentA, { headers: { 'if-none-match': etag } })
      expect(changed.status).toBe(200)
      expect(changed.headers.get('etag')).not.toBe(etag)
      expect((await PDFDocument.load(await bytesOf(changed))).getPageCount()).toBe(4)

      // الرابط ثابت داخل الساعة ويتحقق، وصلاحيته بين 4 و5 ساعات
      const t0 = Date.UTC(2026, 10, 24, 9, 5, 0)
      const u1 = signPdfMediaUrl(fileId, contentId, studentA.userId, t0)
      const u2 = signPdfMediaUrl(fileId, contentId, studentA.userId, t0 + 40 * 60_000)
      expect(u2).toBe(u1)
      expect(signPdfMediaUrl(fileId, contentId, studentA.userId, t0 + 60 * 60_000)).not.toBe(u1)
      const q = new URL(u1, 'http://x').searchParams
      const ttl = Number(q.get('exp')) - Math.floor(t0 / 1000)
      expect(ttl).toBeGreaterThanOrEqual(MEDIA_URL_TTL_SECONDS)
      expect(ttl).toBeLessThanOrEqual(MEDIA_URL_TTL_SECONDS + 3600)
      expect(verifyMediaSignature(fileId, contentId, studentA.userId, q.get('exp'), q.get('sig'), t0)).toBe(true)
      expect(verifyMediaSignature(fileId, contentId, studentB.userId, q.get('exp'), q.get('sig'), t0)).toBe(false)
    } finally {
      delete process.env.PDF_PRIVATE_REVALIDATE
    }
  })

  it('etagMatches: قائمة، وسم ضعيف، نجمة', () => {
    expect(etagMatches(null, '"a"')).toBe(false)
    expect(etagMatches('"b"', '"a"')).toBe(false)
    expect(etagMatches('"b", W/"a"', '"a"')).toBe(true)
    expect(etagMatches('*', '"a"')).toBe(true)
  })
})

describe('مفتاح الكاش والتنظيف', () => {
  const base: StampKeyInput = { fileId: 'f1', storageKey: 'ws/2026-11/x.pdf', checksum: 'c1', sizeBytes: 10, updatedAt: new Date('2026-11-01T00:00:00Z'), storedSize: 10, viewerId: 'u1', watermark: ['a@test.dz', '2026-11-11 · abcdef12'], stampVersion: PDF_STAMP_VERSION }

  it('كل ما يحدّد البايتات يغيّر المفتاح', () => {
    const k = stampCacheKey(base)
    expect(k).toMatch(/^[a-f0-9]{64}$/)
    expect(stampCacheKey({ ...base })).toBe(k)
    const variants: Partial<StampKeyInput>[] = [
      { fileId: 'f2' },
      { storageKey: 'ws/2026-11/y.pdf' },
      { checksum: 'c2' },
      { checksum: null },
      { sizeBytes: 11 },
      { updatedAt: new Date('2026-11-02T00:00:00Z') },
      { storedSize: 11 },
      { storedSize: null },
      { viewerId: 'u2' },
      { watermark: ['b@test.dz', '2026-11-11 · abcdef12'] },
      { watermark: ['a@test.dz', '2026-11-12 · abcdef12'] },
      { watermark: ['a@test.dz2026-11-11 · abcdef12'] },
      { stampVersion: 'next' }
    ]
    const keys = new Set(variants.map((v) => stampCacheKey({ ...base, ...v })))
    expect(keys.size).toBe(variants.length)
    expect(keys.has(k)).toBe(false)
  })

  it('السقف الافتراضي 2 GB ويُضبط بـ PDF_STAMP_CACHE_MAX_MB', () => {
    expect(stampCacheMaxBytes()).toBe(2048 * 1024 * 1024)
    process.env.PDF_STAMP_CACHE_MAX_MB = '100'
    expect(stampCacheMaxBytes()).toBe(100 * 1024 * 1024)
    process.env.PDF_STAMP_CACHE_MAX_MB = 'abc'
    expect(stampCacheMaxBytes()).toBe(2048 * 1024 * 1024)
    delete process.env.PDF_STAMP_CACHE_MAX_MB
  })

  it('التنظيف: ما لم يُفتح منذ 30 يوماً يُحذف، السقف يُفرض بحذف الأقدم فتحاً، والفتح يجدّد العمر', async () => {
    process.env.PDF_STAMP_CACHE_DIR = path.join(ROOT, 'sweep')
    try {
      const day = 86_400_000
      const now = Date.now()
      const key = (n: number) => stampCacheKey({ ...base, viewerId: `sweep-${n}` })
      const file = (k: string) => path.join(stampCacheDir(), k.slice(0, 2), `${k}.pdf`)
      const age = (k: string, ms: number) => fs.utimesSync(file(k), new Date(now - ms), new Date(now - ms))
      for (let i = 0; i < 5; i++) await getOrCreateStamped(key(i), async () => Buffer.alloc(1000, i))
      age(key(0), 31 * day)
      age(key(1), 20 * day)
      age(key(2), 10 * day)
      age(key(3), 5 * day)
      age(key(4), 1 * day)
      // ملف مؤقت منقطع قديم وآخر حديث (كتابة جارية)
      const stale = `${file(key(4))}.1.aaaaaa.part`
      const live = `${file(key(4))}.2.bbbbbb.part`
      fs.writeFileSync(stale, 'x')
      fs.utimesSync(stale, new Date(now - 2 * 3600_000), new Date(now - 2 * 3600_000))
      fs.writeFileSync(live, 'x')

      // فتح المفتاح 1 (عمره 20 يوماً) يجدّد «آخر فتح» ولا يستدعي الختم
      const produce = vi.fn(async () => Buffer.alloc(1))
      const hit = await getOrCreateStamped(key(1), produce)
      expect(hit.hit).toBe(true)
      expect(hit.size).toBe(1000)
      await new Response(hit.body as BodyInit).arrayBuffer()
      expect(produce).not.toHaveBeenCalled()
      expect(now - fs.statSync(file(key(1))).mtimeMs).toBeLessThan(60_000)

      const s1 = await sweepStampCache(now)
      expect(s1).toMatchObject({ files: 4, bytes: 4000, removed: 2 })
      expect(fs.existsSync(file(key(0)))).toBe(false)
      expect(fs.existsSync(stale)).toBe(false)
      expect(fs.existsSync(live)).toBe(true)

      // سقف 2500 بايت ⇒ يبقى الأحدث فتحاً: 1 (فُتح الآن) و4 (أمس)
      const s2 = await sweepStampCache(now, { maxBytes: 2500 })
      expect(s2).toMatchObject({ files: 2, bytes: 2000, removed: 2, removedBytes: 2000 })
      expect(fs.existsSync(file(key(2)))).toBe(false)
      expect(fs.existsSync(file(key(3)))).toBe(false)
      expect(fs.existsSync(file(key(1)))).toBe(true)
      expect(fs.existsSync(file(key(4)))).toBe(true)

      // مهمة الصيانة اليومية CLEANUP هي التي تستدعيه
      age(key(4), 40 * day)
      expect(await runCleanupJob(h.db)).toMatchObject({ stampCache: 1 })
      expect(fs.existsSync(file(key(4)))).toBe(false)
      fs.rmSync(live)
    } finally {
      delete process.env.PDF_STAMP_CACHE_DIR
    }
  })

  it('الكتابة تفرض السقف دون انتظار المهمة اليومية', async () => {
    process.env.PDF_STAMP_CACHE_DIR = path.join(ROOT, 'ceiling')
    process.env.PDF_STAMP_CACHE_MAX_MB = '1'
    try {
      // 12 نسخة × 200 KB = 2.4 MB تحت سقف 1 MB
      for (let i = 0; i < 12; i++) {
        await getOrCreateStamped(stampCacheKey({ ...base, viewerId: `ceil-${i}` }), async () => Buffer.alloc(200 * 1024, i))
        await new Promise((r) => setTimeout(r, 15))
      }
      await sweepStampCache() // ينتظر أي تنظيف خلفي جارٍ ثم يثبّت الحالة
      const total = cacheFiles().reduce((n, f) => n + fs.statSync(f).size, 0)
      expect(total).toBeLessThanOrEqual(1024 * 1024)
      expect(total).toBeGreaterThan(0)
    } finally {
      delete process.env.PDF_STAMP_CACHE_DIR
      delete process.env.PDF_STAMP_CACHE_MAX_MB
    }
  })
})

describe('حجم الناتج والقياس على ملف حقيقي من المستودع', () => {
  const FIXTURE = 'content/lessons/pdf/4AM/MATH/U1-L1.pdf'

  it('الحفظ بتيارات الكائنات أصغر، ويفتحه قارئ الصفحات (unpdf/pdf.js) صفحةً صفحة', async () => {
    const original = fs.readFileSync(FIXTURE)
    const lines = ['student@test.dz', '2026-11-11 · abcdef12']
    const stamped = await stampPdf(original, lines)
    // المرجع: نفس الختم محفوظاً بالطريقة القديمة (بلا تيارات كائنات)
    const legacy = Buffer.from(await (await PDFDocument.load(stamped, { updateMetadata: false })).save({ useObjectStreams: false }))
    expect(stamped.length).toBeLessThan(legacy.length)
    // الختم حتمي: نفس المدخلات ⇒ نفس البايتات (شرط ETag القوي)
    expect((await stampPdf(original, lines)).equals(stamped)).toBe(true)
    const pdf = await getDocumentProxy(new Uint8Array(stamped))
    const src = await getDocumentProxy(new Uint8Array(original))
    expect(pdf.numPages).toBe(src.numPages)
    for (let i = 1; i <= pdf.numPages; i++) {
      const ops = (await (await pdf.getPage(i)).getOperatorList()).fnArray.length
      const srcOps = (await (await src.getPage(i)).getOperatorList()).fnArray.length
      expect(ops).toBeGreaterThan(srcOps)
    }
    expect(await textOf(stamped)).toContain('student@test.dz')
    console.info(`[قياس] ${FIXTURE}: الأصل ${original.length} بايت · مختوم قديم ${legacy.length} · مختوم جديد ${stamped.length} (${(((legacy.length - stamped.length) / legacy.length) * 100).toFixed(1)}% أصغر)`)
  })

  it('ملف حقيقي عبر المسار: الفتح الثاني والثالث لا يختمان ويرجعان البايتات نفسها', async () => {
    const big = (await uploadFile(h.db, teacher, { originalName: 'real.pdf', mimeType: 'application/pdf', bytes: fs.readFileSync(FIXTURE) })).id
    const c = await createContent(h.db, teacher, { type: 'PDF', title: 'ملف حقيقي', visibility: 'GROUP_ONLY', groupIds: [groupId], fileId: big, publish: true })
    const one = async () => {
      const res = await open(studentB, { file: big, content: c.id })
      expect(res.status).toBe(200)
      return bytesOf(res)
    }
    const first = await one()
    expect(stamps()).toBe(1)
    expect((await one()).equals(first)).toBe(true)
    expect((await one()).equals(first)).toBe(true)
    expect(stamps()).toBe(1)
    expect(await textOf(first)).toContain(studentB.email)
  })
})

describe('النسخ الاحتياطي يستثني الكاش', () => {
  it('dump_uploads في scripts/backup.sh يؤرشف المرفوعات دون .stamp-cache', () => {
    const script = fs.readFileSync('scripts/backup.sh', 'utf8')
    const fn = script.match(/^dump_uploads\(\) \{\n[\s\S]*?\n\}\n/m)?.[0]
    expect(fn).toBeTruthy()
    const src = path.join(ROOT, 'backup-src')
    fs.mkdirSync(path.join(src, 'uploads', 'ws1', '2026-11'), { recursive: true })
    fs.mkdirSync(path.join(src, 'uploads', '.stamp-cache', 'ab'), { recursive: true })
    fs.writeFileSync(path.join(src, 'uploads', 'ws1', '2026-11', 'lesson.pdf'), 'original')
    fs.writeFileSync(path.join(src, 'uploads', '.stamp-cache', 'ab', 'abcd.pdf'), 'stamped')
    const out = path.join(ROOT, 'uploads-test.tar.gz')
    execFileSync('sh', ['-c', `set -eu\n${fn}\ndump_uploads "$1"`, 'sh', out], { env: { ...process.env, UPLOADS_SRC: src } })
    const list = execFileSync('tar', ['tzf', out]).toString()
    expect(list).toContain('uploads/ws1/2026-11/lesson.pdf')
    expect(list).not.toContain('.stamp-cache')
    expect(fs.existsSync(`${out}.part`)).toBe(false)
  })
})
