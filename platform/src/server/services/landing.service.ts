/**
 * صفحات الهبوط (قرار المالك 17 نوفمبر 2026): صفحة عامة لكل دورة على /go/<slug> لجلب التلاميذ من الترويج.
 * - المشرف ينشئها بزر من صفحة الدورة: تُملأ من الدورة (العنوان، السعر، العرضان، التوصيل) ويضيف الفيديو والأسئلة.
 * - لكل مصدر رابط (?src=ig, fb, yt...): الزيارة تُعدّ يوميًا، والكعكة تنسب الطلب الذي يليه إلى الصفحة والمصدر.
 * - الطلبات تصل إلى طابور الطلبات المعتاد، وعليها اسم الصفحة والمصدر.
 */
import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { courses, landingPages, landingVisits, orders, type LandingFaq } from '@/server/db/schema'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError } from '@/server/lib/errors'

/** كعكة النسبة: «معرّف الصفحة:المصدر» — 30 يومًا، فيُنسب الطلب ولو عاد التلميذ بعد أيام */
export const LANDING_COOKIE = 'mdz_landing'
export const LANDING_COOKIE_DAYS = 30

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,39}$/
const SOURCE_RE = /^[a-z0-9_-]{1,24}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** المصادر المعروفة (رابط جاهز لكل منها في الإدارة)؛ أي رمز آخر صالح يُقبل ويظهر كما هو */
export const SOURCE_LABELS: Record<string, string> = {
  ig: 'إنستغرام',
  fb: 'فيسبوك',
  yt: 'يوتيوب',
  tt: 'تيك توك',
  wa: 'واتساب',
  sms: 'رسائل SMS',
  direct: 'مباشر'
}
export const SHARE_SOURCES = ['ig', 'fb', 'yt', 'tt', 'wa'] as const

export const sourceLabel = (s: string | null | undefined) => (s ? (SOURCE_LABELS[s] ?? s) : SOURCE_LABELS.direct!)

export const DEFAULT_BULLETS = ['حصص مباشرة داخل المنصة', 'دروس مسجّلة تشاهدها متى شئت', 'ملخصات وملفات PDF', 'قسم افتراضي خاص بدورتك', 'تمارين وتتبّع لتقدّمك', 'سلسلة كتب جديدة تصلك إلى بيتك']

/** أسئلة مقترحة تظهر في الاستمارة (الأجوبة يكتبها المشرف — لا تُنشر أسئلة بلا جواب) */
export const SUGGESTED_FAQ = ['متى تبدأ الحصص؟', 'كيف أشاهد الدروس؟', 'كيف أدفع ومتى يصل الكتاب؟']

export function normalizeSource(raw: string | null | undefined): string {
  const s = (raw ?? '').trim().toLowerCase()
  return SOURCE_RE.test(s) ? s : 'direct'
}

export function normalizeSlug(raw: string | null | undefined): string | null {
  const s = (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return SLUG_RE.test(s) ? s : null
}

/** رابط تضمين آمن من رابط يوتيوب (عادي، قصير، shorts) أو Bunny؛ null لغيرهما */
export function videoEmbedUrl(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim()
  if (!v) return null
  let u: URL
  try {
    u = new URL(v)
  } catch {
    return null
  }
  if (u.protocol !== 'https:') return null
  const host = u.hostname.replace(/^www\.|^m\./, '')
  const yt = (id: string | null | undefined) => (id && /^[\w-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1` : null)
  if (host === 'youtu.be') return yt(u.pathname.slice(1))
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') return yt(u.searchParams.get('v'))
    const m = /^\/(?:shorts|embed|live)\/([\w-]{11})/.exec(u.pathname)
    return yt(m?.[1])
  }
  if (host === 'iframe.mediadelivery.net' || host === 'player.mediadelivery.net') {
    const m = /^\/(?:embed|play)\/(\d+)\/([0-9a-f-]{36})/i.exec(u.pathname)
    return m ? `https://iframe.mediadelivery.net/embed/${m[1]}/${m[2]}?autoplay=false&preload=false&responsive=true` : null
  }
  return null
}

export interface LandingInput {
  slug: string
  headline: string
  subheadline?: string | null
  videoUrl?: string | null
  bullets: string[]
  about?: string | null
  faq: LandingFaq[]
  active: boolean
}

export type LandingRow = typeof landingPages.$inferSelect

function cleanInput(input: LandingInput) {
  const slug = normalizeSlug(input.slug)
  if (!slug) throw new AppError('VALIDATION', { field: 'slug' })
  const headline = input.headline.trim().slice(0, 140)
  if (headline.length < 3) throw new AppError('VALIDATION', { field: 'headline' })
  const videoUrl = input.videoUrl?.trim() || null
  if (videoUrl && !videoEmbedUrl(videoUrl)) throw new AppError('VALIDATION', { field: 'videoUrl' })
  return {
    slug,
    headline,
    subheadline: input.subheadline?.trim().slice(0, 240) || null,
    videoUrl,
    bullets: input.bullets.map((b) => b.trim().slice(0, 120)).filter(Boolean).slice(0, 10),
    about: input.about?.trim().slice(0, 800) || null,
    faq: input.faq
      .map((f) => ({ q: f.q.trim().slice(0, 200), a: f.a.trim().slice(0, 1000) }))
      .filter((f) => f.q && f.a)
      .slice(0, 12),
    active: Boolean(input.active)
  }
}

async function freeSlug(db: Db, base: string): Promise<string> {
  const taken = new Set((await db.select({ slug: landingPages.slug }).from(landingPages).where(sql`${landingPages.slug} like ${`${base}%`}`)).map((r) => r.slug))
  if (!taken.has(base)) return base
  for (let i = 2; i < 100; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`
  return `${base}-${Date.now().toString(36)}`
}

/** «bac2027» من موسم «2026/2027»؛ وإلا «course» */
function baseSlug(season: string | null | undefined): string {
  const year = /(\d{4})\s*$/.exec(season ?? '')?.[1]
  return year ? `bac${year}` : 'course'
}

/** زر «إنشاء صفحة هبوط» في صفحة الدورة: صفحة متوقفة مملوءة من الدورة، يكمّلها المشرف ثم يشغّلها */
export async function createLandingForCourse(db: Db, actor: Actor, courseId: string): Promise<LandingRow> {
  assertRole(actor, 'SUPER_ADMIN')
  const [c] = await db.select({ id: courses.id, title: courses.title, season: courses.season }).from(courses).where(and(eq(courses.id, courseId), sql`${courses.deletedAt} is null`)).limit(1)
  if (!c) throw new AppError('COURSE_NOT_FOUND')
  const slug = await freeSlug(db, baseSlug(c.season))
  const [row] = await db
    .insert(landingPages)
    .values({ slug, courseId: c.id, headline: c.title.slice(0, 140), subheadline: 'اللغة العربية وآدابها مع الدكتور حيقون أسامة', bullets: DEFAULT_BULLETS, faq: [], active: false, createdBy: actor.userId })
    .returning()
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'landing.create', entityType: 'landing', entityId: row!.id, newValue: { slug, courseId: c.id } })
  return row!
}

export async function updateLanding(db: Db, actor: Actor, id: string, input: LandingInput): Promise<LandingRow> {
  assertRole(actor, 'SUPER_ADMIN')
  const data = cleanInput(input)
  const [before] = await db.select().from(landingPages).where(eq(landingPages.id, id)).limit(1)
  if (!before) throw new AppError('NOT_FOUND')
  if (data.slug !== before.slug) {
    const [clash] = await db.select({ id: landingPages.id }).from(landingPages).where(and(eq(landingPages.slug, data.slug), ne(landingPages.id, id))).limit(1)
    if (clash) throw new AppError('VALIDATION', { field: 'slug', reason: 'taken' })
  }
  const [row] = await db
    .update(landingPages)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(landingPages.id, id))
    .returning()
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'landing.update', entityType: 'landing', entityId: id, oldValue: { slug: before.slug, active: before.active }, newValue: { slug: data.slug, active: data.active } })
  return row!
}

export async function landingById(db: Db, actor: Actor, id: string): Promise<LandingRow | null> {
  assertRole(actor, 'SUPER_ADMIN')
  const [row] = await db.select().from(landingPages).where(eq(landingPages.id, id)).limit(1)
  return row ?? null
}

export async function landingsForCourse(db: Db, actor: Actor, courseId: string): Promise<LandingRow[]> {
  assertRole(actor, 'SUPER_ADMIN')
  return db.select().from(landingPages).where(eq(landingPages.courseId, courseId)).orderBy(asc(landingPages.createdAt))
}

/** الصفحة العامة: المشغّلة فقط (والمشرف يعاينها وهي متوقفة) */
export async function landingBySlug(db: Db, slug: string, opts: { preview?: boolean } = {}): Promise<(LandingRow & { courseSlug: string; courseStatus: string }) | null> {
  const s = normalizeSlug(slug)
  if (!s) return null
  const [row] = await db
    .select({ landing: landingPages, courseSlug: courses.slug, courseStatus: courses.status })
    .from(landingPages)
    .innerJoin(courses, eq(courses.id, landingPages.courseId))
    .where(and(eq(landingPages.slug, s), sql`${courses.deletedAt} is null`))
    .limit(1)
  if (!row || (!row.landing.active && !opts.preview)) return null
  return { ...row.landing, courseSlug: row.courseSlug, courseStatus: row.courseStatus }
}

/** زيارة واحدة (الكعكة تمنع عدّ المتصفح نفسه أكثر من مرة في اليوم) */
export async function recordLandingVisit(db: Db, landingId: string, source: string): Promise<void> {
  const day = new Date().toISOString().slice(0, 10)
  await db
    .insert(landingVisits)
    .values({ landingId, day, source: normalizeSource(source), visits: 1 })
    .onConflictDoUpdate({ target: [landingVisits.landingId, landingVisits.day, landingVisits.source], set: { visits: sql`${landingVisits.visits} + 1` } })
}

/** «معرّف:مصدر» من الكعكة → نسبة صالحة لصفحة موجودة، أو null */
export async function attributionFromCookie(db: Db, raw: string | null | undefined): Promise<{ landingId: string; source: string } | null> {
  const [id, src] = (raw ?? '').split(':')
  if (!id || !UUID_RE.test(id)) return null
  const [row] = await db.select({ id: landingPages.id }).from(landingPages).where(eq(landingPages.id, id)).limit(1)
  return row ? { landingId: row.id, source: normalizeSource(src) } : null
}

export interface LandingSourceStats {
  source: string
  label: string
  visits: number
  orders: number
  delivered: number
}

/** لكل مصدر: الزوار، والطلبات (غير الملغاة)، والمسلَّم منها */
export async function landingStats(db: Db, actor: Actor, landingIds: string[]): Promise<Map<string, LandingSourceStats[]>> {
  assertRole(actor, 'SUPER_ADMIN')
  const out = new Map<string, LandingSourceStats[]>()
  if (!landingIds.length) return out
  const visits = await db
    .select({ landingId: landingVisits.landingId, source: landingVisits.source, n: sql<number>`sum(${landingVisits.visits})::int` })
    .from(landingVisits)
    .where(inArray(landingVisits.landingId, landingIds))
    .groupBy(landingVisits.landingId, landingVisits.source)
  const ords = await db
    .select({
      landingId: orders.landingId,
      source: sql<string>`coalesce(${orders.trafficSource}, 'direct')`,
      n: sql<number>`count(*) filter (where ${orders.status} <> 'CANCELLED')::int`,
      delivered: sql<number>`count(*) filter (where ${orders.status} = 'DELIVERED')::int`
    })
    .from(orders)
    .where(inArray(orders.landingId, landingIds))
    .groupBy(orders.landingId, sql`coalesce(${orders.trafficSource}, 'direct')`)
  const key = (l: string, s: string) => `${l}|${s}`
  const acc = new Map<string, LandingSourceStats & { landingId: string }>()
  const get = (l: string, s: string) => {
    const k = key(l, s)
    if (!acc.has(k)) acc.set(k, { landingId: l, source: s, label: sourceLabel(s), visits: 0, orders: 0, delivered: 0 })
    return acc.get(k)!
  }
  for (const v of visits) get(v.landingId, v.source).visits = Number(v.n)
  for (const o of ords) if (o.landingId) Object.assign(get(o.landingId, o.source), { orders: Number(o.n), delivered: Number(o.delivered) })
  for (const s of acc.values()) out.set(s.landingId, [...(out.get(s.landingId) ?? []), s])
  for (const [k, list] of out) out.set(k, list.sort((a, b) => b.visits - a.visits || b.orders - a.orders))
  return out
}

/** كل صفحات الهبوط مع اسم الدورة (لقائمة الإدارة) */
export async function listLandings(db: Db, actor: Actor): Promise<(LandingRow & { courseTitle: string })[]> {
  assertRole(actor, 'SUPER_ADMIN')
  const rows = await db
    .select({ landing: landingPages, courseTitle: courses.title })
    .from(landingPages)
    .innerJoin(courses, eq(courses.id, landingPages.courseId))
    .orderBy(desc(landingPages.active), desc(landingPages.createdAt))
  return rows.map((r) => ({ ...r.landing, courseTitle: r.courseTitle }))
}

/** اسم الصفحة لعرضه على الطلب في الإدارة */
export async function landingSlugsById(db: Db, ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const list = [...new Set(ids.filter((x): x is string => Boolean(x)))]
  if (!list.length) return new Map()
  const rows = await db.select({ id: landingPages.id, slug: landingPages.slug }).from(landingPages).where(inArray(landingPages.id, list))
  return new Map(rows.map((r) => [r.id, r.slug]))
}

/**
 * جاء من صفحة هبوط ثم سجّل (أو دخل): شريط «أكمل طلب دورتك» في صفحة «اليوم» حتى يطلب أو يشترك.
 * لا شيء إن كانت الصفحة متوقفة، أو الدورة غير منشورة، أو له اشتراك نشط أو طلب مفتوح لها.
 */
export async function landingResumeFor(db: Db, actor: Actor, raw: string | null | undefined): Promise<{ courseTitle: string; href: string } | null> {
  if (actor.role !== 'STUDENT' || !actor.studentId) return null
  const attr = await attributionFromCookie(db, raw)
  if (!attr) return null
  const [row] = await db
    .select({ courseId: courses.id, slug: courses.slug, title: courses.title, bookProductId: courses.bookProductId })
    .from(landingPages)
    .innerJoin(courses, eq(courses.id, landingPages.courseId))
    .where(and(eq(landingPages.id, attr.landingId), eq(landingPages.active, true), eq(courses.status, 'PUBLISHED'), sql`${courses.deletedAt} is null`))
    .limit(1)
  if (!row) return null
  const { hasActiveEnrollment, openCourseOrder } = await import('./course-purchase.service')
  if (await hasActiveEnrollment(db, row.courseId, actor.studentId)) return null
  if (await openCourseOrder(db, actor.userId, row.courseId)) return null
  // المعرّف قد يكون عربيًا: يُرمَّز (التحويل بعد التسجيل يضعه في ترويسة HTTP)
  return { courseTitle: row.title, href: `/student/courses/${encodeURIComponent(row.slug)}${row.bookProductId ? '/order' : ''}` }
}
