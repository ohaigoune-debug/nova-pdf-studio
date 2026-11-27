/**
 * كشف التسريب (3 نوفمبر 2026): من العلامة المائية الظاهرة في فيديو أو ملف مسرَّب إلى الحساب الذي شاهده.
 *
 * ما تكتبه المنصة على المحتوى:
 *  - فيديو يوتيوب في التطبيق: الاسم + «التاريخ · رمز الحساب» (أول 8 خانات من معرّف الحساب).
 *  - فيديو يوتيوب في الموقع وملفات PDF: البريد + «التاريخ · رمز الحساب».
 *  - فيديو Bunny: الاسم + «…آخر 4 أرقام الهاتف · التاريخ».
 *  - ملفات PDF أيضًا (27 نوفمبر 2026): «رمز النسخة» صغير معتم يشبه رقم الوثيقة («Ref. 7K3Q-29»)، ووسم خفي
 *    في بيانات الملف ونصّه الشفاف — يبقى بعد حذف العلامة المائية الظاهرة (انظر leak-ref.ts و scanLeakedPdf).
 *  - دروسنا الجاهزة للبصمة: «أرقام التهميش» الخاصة بكل تلميذ، تُجمع بترتيبها: (51) (95) (82) (18).
 * فيقبل البحث: أرقام التهميش، أو رمز النسخة، أو رمز الحساب، أو آخر 4 أرقام الهاتف، أو البريد، أو الاسم؛ مع تاريخ اختياري يضيّق النتائج
 * إلى من شاهد فعلًا في ذلك اليوم. للمشرف العام وحده، وكل بحث يُسجَّل في سجل التدقيق.
 */
import { and, desc, eq, gte, ilike, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { content, courseEnrollments, courses, mediaViews, profiles, sessions, students, users, userEmailText } from '@/server/db/schema'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError } from '@/server/lib/errors'
import { LEAK_REF_TAG, footnotesMatch, formatLeakRef, leakFootnotesOf, leakRefOf, normalizeLeakRef, parseFootnoteNumbers } from '@/server/lib/leak-ref'

export type LeakQueryKind = 'fn' | 'ref' | 'code' | 'phone' | 'email' | 'name'

export interface LeakQuery {
  kind: LeakQueryKind
  value: string
  /** يوم المشاهدة YYYY-MM-DD كما في العلامة (بتوقيت UTC، كما تكتبه المنصة) */
  date: string | null
}

const MAX_MATCHES = 20

/** يفهم ما نُسخ من العلامة: «4b21efbc» أو «…1234» أو بريد أو اسم، مع تاريخ إن وُجد في النص نفسه */
export function parseLeakQuery(raw: string, dateInput?: string | null): LeakQuery {
  const text = raw.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).trim()
  const found = /(\d{4}-\d{2}-\d{2})/.exec(text)?.[1] ?? null
  const date = (dateInput?.trim() || found || null)
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AppError('VALIDATION', { field: 'date' })
  const rest = text.replace(/\d{4}-\d{2}-\d{2}/g, ' ').replace(/[·•|]/g, ' ').trim()
  // أرقام التهميش: «51 95 82 18» أو «(51) (95) (82)» — تُحفظ مفصولة بمسافة
  const fn = parseFootnoteNumbers(rest)
  if (fn) return { kind: 'fn', value: fn.join(' '), date }
  // رمز النسخة: «Ref. 7K3Q-29» أو «7K3Q-29» أو «mdz-ref:7K3Q29» أو 6 خانات تجمع حرفًا ورقمًا
  const refRaw =
    /(?:mdz-ref:|ref\.?\s*)([0-9a-z]{4}[\s\-–]?[0-9a-z]{2})(?![0-9a-z])/i.exec(rest)?.[1] ??
    /(?:^|\s)([0-9a-z]{4}[-–][0-9a-z]{2})(?:\s|$)/i.exec(rest)?.[1] ??
    /(?:^|\s)((?=[0-9a-z]*\d)(?=[0-9a-z]*[a-z])[0-9a-z]{6})(?:\s|$)/i.exec(rest)?.[1]
  const ref = refRaw ? normalizeLeakRef(refRaw) : null
  if (ref) return { kind: 'ref', value: ref, date }
  const code = /(?:^|\s)([0-9a-f]{8})(?:\s|$)/i.exec(rest)?.[1]
  if (code) return { kind: 'code', value: code.toLowerCase(), date }
  const email = /([^\s@]+@[^\s@]+\.[^\s@]+)/.exec(rest)?.[1]
  if (email) return { kind: 'email', value: email.toLowerCase(), date }
  const phone = /(?:^|[\s….])(\d{4})(?:\s|$)/.exec(rest)?.[1]
  if (phone) return { kind: 'phone', value: phone, date }
  const name = rest.replace(/\s+/g, ' ').trim()
  if (name.length < 3 || name.length > 120) throw new AppError('VALIDATION', { field: 'q' })
  return { kind: 'name', value: name, date }
}

export interface LeakMatch {
  userId: string
  code: string
  /** رمز النسخة كما يُكتب على الصفحة «7K3Q-29» */
  ref: string
  /** أول أربعة من أرقام التهميش الخاصة به، بترتيب ظهورها */
  footnotes: number[]
  fullName: string
  email: string
  phone: string | null
  role: string
  status: string
  createdAt: Date
  lastLoginAt: Date | null
  courses: { title: string; active: boolean }[]
  /** مشاهدات اليوم المطلوب إن حُدّد، وإلا آخر المشاهدات */
  views: { contentTitle: string; startedAt: Date; lastSeenAt: Date; secondsWatched: number; ip: string | null; userAgent: string | null; device: string }[]
  devices: { deviceName: string | null; ip: string | null; lastSeenAt: Date; active: boolean }[]
  viewedOnDate: boolean
}

function dayRange(date: string): { from: Date; to: Date } {
  const from = new Date(`${date}T00:00:00.000Z`)
  if (Number.isNaN(from.getTime())) throw new AppError('VALIDATION', { field: 'date' })
  return { from, to: new Date(from.getTime() + 86_400_000) }
}

export async function traceLeak(db: Db, actor: Actor, query: LeakQuery, now: Date = new Date()): Promise<{ query: LeakQuery; matches: LeakMatch[]; truncated: boolean }> {
  assertRole(actor, 'SUPER_ADMIN')
  const cols = { id: users.id, email: userEmailText, role: users.role, status: users.status, createdAt: users.createdAt, lastLoginAt: users.lastLoginAt, fullName: profiles.fullName, phone: profiles.phone }
  // رمز النسخة وأرقام التهميش لا تُعكس: تُحسب لكل حساب وتُقارن (بحث نادر للمشرف وحده).
  // 8 أرقام متصلة قد تكون رمز حساب أو أرقام تهميش ملتصقة («51958218») فيُبحث بالاثنين.
  const seen = query.kind === 'fn' ? query.value.split(' ').map(Number) : query.kind === 'code' && /^\d{8}$/.test(query.value) ? query.value.match(/\d{2}/g)!.map(Number) : null
  const derivedIds =
    query.kind === 'ref' || seen
      ? (await db.select({ id: users.id }).from(users).where(isNull(users.deletedAt))).filter((u) => (query.kind === 'ref' ? leakRefOf(u.id) === query.value : footnotesMatch(u.id, seen!))).map((u) => u.id)
      : []
  const derived = derivedIds.length ? inArray(users.id, derivedIds) : sql`false`
  const where =
    query.kind === 'ref' || query.kind === 'fn' ? derived
      : query.kind === 'code' ? (seen ? or(sql`${users.id}::text like ${query.value + '%'}`, derived) : sql`${users.id}::text like ${query.value + '%'}`)
      : query.kind === 'phone' ? sql`regexp_replace(coalesce(${profiles.phone}, ''), '\\D', '', 'g') like ${'%' + query.value}`
        : query.kind === 'email' ? eq(users.email, query.value)
          : ilike(profiles.fullName, `%${query.value.replace(/[%_\\]/g, (c) => '\\' + c)}%`)
  let candidates = await db.select(cols).from(users).leftJoin(profiles, eq(profiles.userId, users.id)).where(and(where, isNull(users.deletedAt))).orderBy(desc(users.lastLoginAt)).limit(200)

  const range = query.date ? dayRange(query.date) : null
  let watchedThatDay = new Set<string>()
  if (range && candidates.length) {
    const rows = await db
      .selectDistinct({ userId: mediaViews.userId })
      .from(mediaViews)
      .where(and(inArray(mediaViews.userId, candidates.map((c) => c.id)), lt(mediaViews.startedAt, range.to), gte(mediaViews.lastSeenAt, range.from)))
    watchedThatDay = new Set(rows.map((r) => r.userId))
    // آخر 4 أرقام أو اسم شائع: من شاهد ذلك اليوم أولًا، والباقي بعدهم
    candidates = [...candidates.filter((c) => watchedThatDay.has(c.id)), ...candidates.filter((c) => !watchedThatDay.has(c.id))]
  }
  const truncated = candidates.length > MAX_MATCHES
  const picked = candidates.slice(0, MAX_MATCHES)
  const ids = picked.map((c) => c.id)

  const [enrolled, viewRows, sessionRows] = ids.length
    ? await Promise.all([
        db
          .select({ userId: students.userId, title: courses.title, expiresAt: courseEnrollments.expiresAt, status: courseEnrollments.status })
          .from(courseEnrollments)
          .innerJoin(students, eq(students.id, courseEnrollments.studentId))
          .innerJoin(courses, eq(courses.id, courseEnrollments.courseId))
          .where(inArray(students.userId, ids)),
        db
          .select({ userId: mediaViews.userId, title: content.title, startedAt: mediaViews.startedAt, lastSeenAt: mediaViews.lastSeenAt, secondsWatched: mediaViews.secondsWatched, ip: mediaViews.ip, userAgent: mediaViews.userAgent, viewerKey: mediaViews.viewerKey })
          .from(mediaViews)
          .innerJoin(content, eq(content.id, mediaViews.contentId))
          .where(and(inArray(mediaViews.userId, ids), ...(range ? [lt(mediaViews.startedAt, range.to), gte(mediaViews.lastSeenAt, range.from)] : [])))
          .orderBy(desc(mediaViews.lastSeenAt))
          .limit(ids.length * 30),
        db
          .select({ userId: sessions.userId, deviceName: sessions.deviceName, ip: sql<string | null>`host(${sessions.ip})`, lastSeenAt: sessions.lastSeenAt, revokedAt: sessions.revokedAt, expiresAt: sessions.expiresAt })
          .from(sessions)
          .where(inArray(sessions.userId, ids))
          .orderBy(desc(sessions.lastSeenAt))
          .limit(ids.length * 10)
      ])
    : [[], [], []]

  const matches: LeakMatch[] = picked.map((c) => ({
    userId: c.id,
    code: c.id.slice(0, 8),
    ref: formatLeakRef(leakRefOf(c.id)),
    footnotes: leakFootnotesOf(c.id).slice(0, 4),
    fullName: c.fullName ?? '',
    email: c.email,
    phone: c.phone ?? null,
    role: c.role,
    status: c.status,
    createdAt: c.createdAt,
    lastLoginAt: c.lastLoginAt,
    courses: enrolled.filter((e) => e.userId === c.id).map((e) => ({ title: e.title, active: e.status === 'ACTIVE' && (!e.expiresAt || e.expiresAt > now) })),
    views: viewRows
      .filter((v) => v.userId === c.id)
      .slice(0, 30)
      .map((v) => ({ contentTitle: v.title, startedAt: v.startedAt, lastSeenAt: v.lastSeenAt, secondsWatched: v.secondsWatched, ip: v.ip, userAgent: v.userAgent, device: v.viewerKey.startsWith('ios-') ? 'iPhone (التطبيق)' : 'متصفح' })),
    devices: sessionRows
      .filter((s) => s.userId === c.id)
      .slice(0, 10)
      .map((s) => ({ deviceName: s.deviceName, ip: s.ip, lastSeenAt: s.lastSeenAt, active: !s.revokedAt && s.expiresAt > now })),
    viewedOnDate: watchedThatDay.has(c.id)
  }))

  // من بحث عن من، وبأي قرينة — دون نسخ البيانات الشخصية إلى السجل
  await writeAudit(db, {
    actorUserId: actor.userId,
    action: 'leak.trace',
    entityType: 'user',
    entityId: matches.length === 1 ? matches[0]!.userId : null,
    newValue: { kind: query.kind, date: query.date, matches: matches.length }
  })
  return { query, matches, truncated }
}

export const LEAK_SEARCH_LIMIT = MAX_MATCHES

/** أقصى حجم لملف مسرَّب يُفحص (الكتب الكاملة تتجاوز حدّ إجراءات الخادم 10MB، لذلك يمرّ عبر مسار API) */
export const LEAK_SCAN_MAX_BYTES = 80 * 1024 * 1024
const LEAK_SCAN_MAX_PAGES = 400

export interface LeakScanResult {
  /** رمز النسخة المكتشف (بلا شرطة) */
  ref: string | null
  /** رمز الحساب (8 خانات) وتاريخ المشاهدة من العلامة المائية إن بقيت */
  code: string | null
  date: string | null
  email: string | null
  /** أين وُجدت القرينة */
  source: 'metadata' | 'text' | null
  /** ما يُلصق في خانة البحث */
  query: string | null
}

/**
 * يقرأ ملف PDF مسرَّبًا ويستخرج قرائن صاحبه: الوسم الخفي في بيانات الملف أولًا، ثم نص الصفحات
 * (النص الشفاف + رمز النسخة + العلامة المائية إن بقيت). الصورة أو لقطة الشاشة لا تُفحص هنا:
 * يُقرأ رمز «Ref.» الظاهر فيها بالعين ويُلصق في البحث.
 */
export async function scanLeakedPdf(bytes: Uint8Array): Promise<LeakScanResult> {
  const result: LeakScanResult = { ref: null, code: null, date: null, email: null, source: null, query: null }
  if (bytes.byteLength > LEAK_SCAN_MAX_BYTES || Buffer.from(bytes.subarray(0, 5)).toString('ascii') !== '%PDF-') throw new AppError('VALIDATION', { field: 'file' })
  const tagRe = new RegExp(`${LEAK_REF_TAG}:([0-9A-Z]{6})`, 'i')
  try {
    const { PDFDocument } = await import('pdf-lib')
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })
    const tag = tagRe.exec(doc.getKeywords() ?? '')?.[1]
    const ref = tag ? normalizeLeakRef(tag) : null
    if (ref) Object.assign(result, { ref, source: 'metadata' })
  } catch {
    // ملف تالف أو مشفّر: نكمل بقراءة النص
  }
  let text = ''
  try {
    const { extractText, getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(new Uint8Array(bytes))
    if (pdf.numPages <= LEAK_SCAN_MAX_PAGES) text = (await extractText(pdf, { mergePages: true })).text
    else {
      const parts: string[] = []
      for (const i of [1, 2, 3, pdf.numPages]) {
        const page = await pdf.getPage(i)
        parts.push(((await page.getTextContent()).items as { str?: string }[]).map((t) => t.str ?? '').join(' '))
      }
      text = parts.join(' ')
    }
  } catch {
    text = ''
  }
  if (!result.ref) {
    const raw = tagRe.exec(text)?.[1] ?? /Ref\.\s*([0-9A-Z]{4}-[0-9A-Z]{2})/.exec(text)?.[1]
    const ref = raw ? normalizeLeakRef(raw) : null
    if (ref) Object.assign(result, { ref, source: 'text' })
  }
  // العلامة المائية إن بقيت: «البريد   التاريخ · رمز الحساب» — البريد يُؤخذ من جوارها فقط لا من نص الدرس
  const mark = /(?:([^\s@]+@[^\s@]+\.[a-z]{2,})\s+)?(\d{4}-\d{2}-\d{2})\s*·\s*([0-9a-f]{8})\b/i.exec(text)
  if (mark) Object.assign(result, { email: mark[1]?.toLowerCase() ?? null, date: mark[2], code: mark[3]!.toLowerCase(), source: result.source ?? 'text' })
  result.query = result.ref ? `Ref. ${formatLeakRef(result.ref)}` : result.code ? `${result.date} · ${result.code}` : result.email
  return result
}

/** فحص ملف مسرَّب بطلب المشرف العام: الملف لا يُحفظ، ويُسجَّل الفحص ونتيجته دون بيانات شخصية */
export async function scanLeakedPdfFor(db: Db, actor: Actor, bytes: Uint8Array): Promise<LeakScanResult> {
  assertRole(actor, 'SUPER_ADMIN')
  const result = await scanLeakedPdf(bytes)
  await writeAudit(db, { actorUserId: actor.userId, action: 'leak.scan', entityType: 'file', entityId: null, newValue: { found: !!(result.ref || result.code), source: result.source, sizeBytes: bytes.byteLength } })
  return result
}
