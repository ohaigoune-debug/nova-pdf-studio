/**
 * تلاميذ دورة معيّنة (قرار المالك 21 نوفمبر 2026): يختار المشرف دورة من قائمة، فيرى عدد المسجَّلين فيها
 * وتفصيلهم (المصدر، الولاية، الشعبة)، ومداخيلها (فواتير طلباتها ومبيعات نقاط البيع)،
 * ويصدّر القائمة (CSV يفتحه Excel) أو يطبع كشفها أو فواتيرها دفعة واحدة.
 *
 * «مسجَّل الآن» = اشتراك ACTIVE لم ينته أجله. المنتهي = EXPIRED أو ACTIVE تجاوز أجله.
 * المداخيل المفوترة = مجموع فواتير الطلبات (غير الملغاة) التي فعّلت هذه الدورة — قد تشمل الكتاب والتوصيل.
 * الفواتير اليدوية لا ترتبط بدورة، فلا تدخل هنا.
 */
import { and, asc, desc, eq, gte, ilike, isNull, lt, or, sql, type SQL } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { courseEnrollments, courses, invoices, levels, profiles, students, streams, users, wilayas, type EnrollmentSource, type InvoiceRow } from '@/server/db/schema'
import { ENROLLMENT_SOURCES } from '@/server/db/schema/enums'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { toCsv } from '@/server/services/reports.service'
import { ENROLLMENT_SOURCE_AR } from '@/server/services/courses.service'
import { monthRange } from '@/server/services/invoices.service'

export const ROSTER_STATUSES = ['ACTIVE', 'EXPIRED', 'REVOKED', 'ALL'] as const
export type RosterStatus = (typeof ROSTER_STATUSES)[number]
export const ROSTER_STATUS_AR: Record<RosterStatus, string> = { ACTIVE: 'مسجَّل الآن', EXPIRED: 'انتهى اشتراكه', REVOKED: 'ملغى', ALL: 'الكل' }
/** ما يظهر في الصفحة؛ التصدير والطباعة يشملان حتى ROSTER_EXPORT_MAX */
export const ROSTER_PAGE_MAX = 300
export const ROSTER_EXPORT_MAX = 20_000
/** الفواتير في مستند طباعة واحد (أكثر من ذلك: صفِّ بالشهر) */
export const COURSE_INVOICES_PRINT_MAX = 300

export interface RosterFilters {
  courseId: string
  status?: RosterStatus | null
  source?: EnrollmentSource | null
  /** شهر التفعيل YYYY-MM (بتوقيت الجزائر)؛ فارغ = كل الفترات */
  month?: string | null
  q?: string | null
}

export interface CourseOption {
  id: string
  title: string
  status: string
  active: number
  total: number
}

export interface RosterRow {
  enrollmentId: string
  studentId: string
  fullName: string
  phone: string | null
  guardianPhone: string | null
  wilaya: string | null
  level: string | null
  stream: string | null
  source: EnrollmentSource
  status: Exclude<RosterStatus, 'ALL'>
  activatedAt: Date
  expiresAt: Date | null
  invoiceId: string | null
  invoiceNumber: string | null
  invoiceTotalDzd: number | null
  invoiceCancelled: boolean
  posName: string | null
  posPriceDzd: number | null
}

export interface RosterStats {
  total: number
  active: number
  expired: number
  revoked: number
  /** مسجَّلون جدد في الشهر الجاري (أو في الشهر المختار) */
  newInMonth: number
  bySource: { source: EnrollmentSource; label: string; n: number }[]
  byWilaya: { name: string; n: number }[]
  byStream: { name: string; n: number }[]
  invoiced: { count: number; totalDzd: number }
  /** اشتراكات جاءت من طلب ولم تصدر لها فاتورة بعد (طلب لم يُسلَّم أو فاتورة لم تُصدَر) */
  orderWithoutInvoice: number
  pos: { count: number; totalDzd: number }
}

/* --------------------------------- أدوات --------------------------------- */

const isActiveSql = sql`(${courseEnrollments.status} = 'ACTIVE' and (${courseEnrollments.expiresAt} is null or ${courseEnrollments.expiresAt} > now()))`
const isExpiredSql = sql`(${courseEnrollments.status} = 'EXPIRED' or (${courseEnrollments.status} = 'ACTIVE' and ${courseEnrollments.expiresAt} <= now()))`

function statusWhere(status: RosterStatus | null | undefined): SQL | undefined {
  if (status === 'ACTIVE') return isActiveSql
  if (status === 'EXPIRED') return isExpiredSql
  if (status === 'REVOKED') return eq(courseEnrollments.status, 'REVOKED')
  return undefined
}

function monthWhere(month: string | null | undefined): SQL | undefined {
  const r = month ? monthRange(month) : null
  return r ? and(gte(courseEnrollments.activatedAt, r.from), lt(courseEnrollments.activatedAt, r.to)) : undefined
}

function thisMonthAlgiers(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit' }).format(now).slice(0, 7)
}

const rowsOf = <T>(raw: unknown): T[] => (Array.isArray(raw) ? (raw as T[]) : ((raw as { rows?: T[] }).rows ?? []))

export function parseRosterFilters(sp: Record<string, string | undefined>): Omit<RosterFilters, 'courseId'> {
  const status = (ROSTER_STATUSES as readonly string[]).includes(sp.status ?? '') ? (sp.status as RosterStatus) : 'ACTIVE'
  const source = (ENROLLMENT_SOURCES as readonly string[]).includes(sp.source ?? '') ? (sp.source as EnrollmentSource) : null
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month ?? '') ? sp.month! : null
  const q = sp.q?.trim().slice(0, 80) || null
  return { status, source, month, q }
}

/* -------------------------------- القائمة -------------------------------- */

/** الدورات للقائمة المنسدلة، مع عدد المسجَّلين الآن والإجمالي (الأكثر تسجيلًا أولًا) */
export async function courseOptions(db: Db, actor: Actor): Promise<CourseOption[]> {
  assertRole(actor, 'SUPER_ADMIN')
  const rows = await db
    .select({
      id: courses.id,
      title: courses.title,
      status: courses.status,
      active: sql<number>`count(${courseEnrollments.id}) filter (where ${isActiveSql})`,
      total: sql<number>`count(${courseEnrollments.id})`
    })
    .from(courses)
    .leftJoin(courseEnrollments, eq(courseEnrollments.courseId, courses.id))
    .where(isNull(courses.deletedAt))
    .groupBy(courses.id)
    .orderBy(desc(sql`count(${courseEnrollments.id}) filter (where ${isActiveSql})`), asc(courses.title))
  return rows.map((r) => ({ ...r, active: Number(r.active), total: Number(r.total) }))
}

async function loadCourse(db: Db, courseId: string) {
  assertUuid(courseId, 'COURSE_NOT_FOUND')
  const [c] = await db.select({ id: courses.id, title: courses.title, status: courses.status }).from(courses).where(eq(courses.id, courseId)).limit(1)
  if (!c) throw new AppError('COURSE_NOT_FOUND')
  return c
}

function rosterWhere(f: RosterFilters): SQL | undefined {
  const q = f.q?.trim()
  const digits = q?.replace(/\D/g, '') ?? ''
  const where = and(
    eq(courseEnrollments.courseId, f.courseId),
    isNull(users.deletedAt),
    statusWhere(f.status),
    f.source ? eq(courseEnrollments.source, f.source) : undefined,
    monthWhere(f.month),
    q
      ? or(
          ilike(profiles.fullName, `%${q}%`),
          digits.length >= 3 ? ilike(profiles.phone, `%${digits}%`) : undefined,
          digits.length >= 3 ? ilike(students.guardianPhone, `%${digits}%`) : undefined
        )
      : undefined
  )
  return where
}

/** عدد النتائج بالتصفية نفسها (الصفحة تعرض أوّلها فقط) */
async function rosterCount(db: Db, f: RosterFilters): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)` })
    .from(courseEnrollments)
    .innerJoin(students, eq(students.id, courseEnrollments.studentId))
    .innerJoin(users, eq(users.id, students.userId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(rosterWhere(f))
  return Number(r?.n ?? 0)
}

async function rosterRows(db: Db, f: RosterFilters, limit: number): Promise<RosterRow[]> {
  const where = rosterWhere(f)
  const rows = await db
    .select({
      enrollmentId: courseEnrollments.id,
      studentId: courseEnrollments.studentId,
      fullName: profiles.fullName,
      phone: profiles.phone,
      guardianPhone: students.guardianPhone,
      wilaya: wilayas.nameAr,
      level: levels.nameAr,
      stream: streams.nameAr,
      source: courseEnrollments.source,
      rawStatus: courseEnrollments.status,
      activatedAt: courseEnrollments.activatedAt,
      expiresAt: courseEnrollments.expiresAt,
      invoiceId: invoices.id,
      invoiceNumber: invoices.number,
      invoiceTotalDzd: invoices.totalDzd,
      invoiceStatus: invoices.status,
      posName: sql<string | null>`(select p.name from course_codes c join points_of_sale p on p.id = c.pos_id
        where c.course_id = ${courseEnrollments.courseId} and c.used_by_student_id = ${courseEnrollments.studentId} and c.pos_id is not null
        order by c.used_at desc nulls last limit 1)`,
      posPriceDzd: sql<number | null>`(select c.sale_price_dzd from course_codes c
        where c.course_id = ${courseEnrollments.courseId} and c.used_by_student_id = ${courseEnrollments.studentId} and c.pos_id is not null
        order by c.used_at desc nulls last limit 1)`
    })
    .from(courseEnrollments)
    .innerJoin(students, eq(students.id, courseEnrollments.studentId))
    .innerJoin(users, eq(users.id, students.userId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .leftJoin(wilayas, eq(wilayas.id, students.wilayaId))
    .leftJoin(levels, eq(levels.id, students.levelId))
    .leftJoin(streams, eq(streams.id, students.streamId))
    .leftJoin(invoices, eq(invoices.orderId, courseEnrollments.orderId))
    .where(where)
    .orderBy(desc(courseEnrollments.activatedAt))
    .limit(limit)
  const now = Date.now()
  return rows.map(({ rawStatus, invoiceStatus, ...r }) => ({
    ...r,
    fullName: r.fullName ?? '',
    source: r.source as EnrollmentSource,
    status: rawStatus === 'REVOKED' ? 'REVOKED' : rawStatus === 'EXPIRED' || (r.expiresAt && r.expiresAt.getTime() <= now) ? 'EXPIRED' : 'ACTIVE',
    invoiceCancelled: invoiceStatus === 'CANCELLED',
    posPriceDzd: r.posPriceDzd == null ? null : Number(r.posPriceDzd)
  }))
}

async function rosterStats(db: Db, f: RosterFilters): Promise<RosterStats> {
  const base = and(eq(courseEnrollments.courseId, f.courseId), monthWhere(f.month))
  const monthForNew = f.month ?? thisMonthAlgiers()
  const nm = monthRange(monthForNew)!
  const r = monthRange(f.month ?? '')
  const posPeriod = r ? sql`and c.created_at >= ${r.from.toISOString()}::timestamptz and c.created_at < ${r.to.toISOString()}::timestamptz` : sql``
  const [[agg], bySource, byWilaya, byStream, [inv], posRaw] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where ${isActiveSql})`,
        expired: sql<number>`count(*) filter (where ${isExpiredSql})`,
        revoked: sql<number>`count(*) filter (where ${courseEnrollments.status} = 'REVOKED')`,
        newInMonth: sql<number>`count(*) filter (where ${courseEnrollments.activatedAt} >= ${nm.from.toISOString()}::timestamptz and ${courseEnrollments.activatedAt} < ${nm.to.toISOString()}::timestamptz)`,
        orderWithoutInvoice: sql<number>`count(*) filter (where ${courseEnrollments.orderId} is not null and ${isActiveSql}
          and not exists (select 1 from invoices i where i.order_id = ${courseEnrollments.orderId} and i.status = 'ISSUED'))`
      })
      .from(courseEnrollments)
      .where(base),
    db
      .select({ source: courseEnrollments.source, n: sql<number>`count(*)` })
      .from(courseEnrollments)
      .where(and(base, isActiveSql))
      .groupBy(courseEnrollments.source)
      .orderBy(desc(sql`count(*)`)),
    db
      .select({ name: sql<string>`coalesce(${wilayas.nameAr}, 'غير محدّدة')`, n: sql<number>`count(*)` })
      .from(courseEnrollments)
      .innerJoin(students, eq(students.id, courseEnrollments.studentId))
      .leftJoin(wilayas, eq(wilayas.id, students.wilayaId))
      .where(and(base, isActiveSql))
      .groupBy(wilayas.nameAr)
      .orderBy(desc(sql`count(*)`))
      .limit(8),
    db
      .select({ name: sql<string>`coalesce(${streams.nameAr}, 'غير محدّدة')`, n: sql<number>`count(*)` })
      .from(courseEnrollments)
      .innerJoin(students, eq(students.id, courseEnrollments.studentId))
      .leftJoin(streams, eq(streams.id, students.streamId))
      .where(and(base, isActiveSql))
      .groupBy(streams.nameAr)
      .orderBy(desc(sql`count(*)`))
      .limit(8),
    db
      .select({ n: sql<number>`count(${invoices.id})`, total: sql<number>`coalesce(sum(${invoices.totalDzd}), 0)` })
      .from(courseEnrollments)
      .innerJoin(invoices, and(eq(invoices.orderId, courseEnrollments.orderId), eq(invoices.status, 'ISSUED')))
      .where(base),
    db.execute(sql`select count(*)::int as n, coalesce(sum(c.sale_price_dzd), 0)::int as total from course_codes c
      where c.course_id = ${f.courseId}::uuid and c.pos_id is not null and c.status <> 'DISABLED' and c.cancelled_at is null ${posPeriod}`)
  ])
  const [pos] = rowsOf<{ n: number; total: number }>(posRaw)
  const n = (v: unknown) => Number(v ?? 0)
  return {
    total: n(agg?.total),
    active: n(agg?.active),
    expired: n(agg?.expired),
    revoked: n(agg?.revoked),
    newInMonth: n(agg?.newInMonth),
    orderWithoutInvoice: n(agg?.orderWithoutInvoice),
    bySource: bySource.map((s) => ({ source: s.source as EnrollmentSource, label: ENROLLMENT_SOURCE_AR[s.source as EnrollmentSource] ?? s.source, n: n(s.n) })),
    byWilaya: byWilaya.map((w) => ({ name: w.name, n: n(w.n) })),
    byStream: byStream.map((w) => ({ name: w.name, n: n(w.n) })),
    invoiced: { count: n(inv?.n), totalDzd: n(inv?.total) },
    pos: { count: n(pos?.n), totalDzd: n(pos?.total) }
  }
}

/** صفحة الإدارة: الدورة + الإحصاءات + أول ROSTER_PAGE_MAX تلميذ حسب التصفية */
export async function courseRoster(db: Db, actor: Actor, f: RosterFilters) {
  assertRole(actor, 'SUPER_ADMIN')
  const course = await loadCourse(db, f.courseId)
  const [stats, rows, matched] = await Promise.all([rosterStats(db, f), rosterRows(db, f, ROSTER_PAGE_MAX), rosterCount(db, f)])
  return { course, stats, rows, matched }
}

/** للطباعة: كل الصفوف (حتى ROSTER_EXPORT_MAX) */
export async function courseRosterForPrint(db: Db, actor: Actor, f: RosterFilters) {
  assertRole(actor, 'SUPER_ADMIN')
  const course = await loadCourse(db, f.courseId)
  const [stats, rows] = await Promise.all([rosterStats(db, f), rosterRows(db, f, ROSTER_EXPORT_MAX)])
  return { course, stats, rows }
}

/** فواتير طلبات هذه الدورة (غير الملغاة) للطباعة دفعة واحدة — الأقدم أولًا */
export async function courseInvoicesForPrint(db: Db, actor: Actor, f: RosterFilters, limit = COURSE_INVOICES_PRINT_MAX): Promise<{ course: { id: string; title: string }; invoices: InvoiceRow[]; more: boolean }> {
  assertRole(actor, 'SUPER_ADMIN')
  const course = await loadCourse(db, f.courseId)
  const rows = await db
    .select({ inv: invoices })
    .from(courseEnrollments)
    .innerJoin(invoices, and(eq(invoices.orderId, courseEnrollments.orderId), eq(invoices.status, 'ISSUED')))
    .where(and(eq(courseEnrollments.courseId, f.courseId), statusWhere(f.status), f.source ? eq(courseEnrollments.source, f.source) : undefined, monthWhere(f.month)))
    .orderBy(asc(invoices.issuedAt), asc(invoices.seq))
    .limit(limit + 1)
  return { course, invoices: rows.slice(0, limit).map((r) => r.inv), more: rows.length > limit }
}

const fmtDate = (d: Date | null) => (d ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers' }).format(d) : '')

/** CSV يفتحه Excel بالعربية (BOM)؛ يُسجَّل في سجلّ النشاط لأنه يحمل هواتف التلاميذ */
export async function courseRosterCsv(db: Db, actor: Actor, f: RosterFilters): Promise<{ filename: string; csv: string; count: number }> {
  assertRole(actor, 'SUPER_ADMIN')
  const course = await loadCourse(db, f.courseId)
  const rows = await rosterRows(db, f, ROSTER_EXPORT_MAX)
  const header = ['#', 'الاسم واللقب', 'الهاتف', 'هاتف الوليّ', 'الولاية', 'المستوى', 'الشعبة', 'مصدر التسجيل', 'نقطة البيع', 'سعر نقطة البيع (دج)', 'تاريخ التفعيل', 'ينتهي في', 'الحالة', 'رقم الفاتورة', 'مبلغ الفاتورة (دج)']
  const body = rows.map((r, i) => [
    i + 1,
    r.fullName,
    r.phone ?? '',
    r.guardianPhone ?? '',
    r.wilaya ?? '',
    r.level ?? '',
    r.stream ?? '',
    ENROLLMENT_SOURCE_AR[r.source] ?? r.source,
    r.posName ?? '',
    r.posPriceDzd ?? '',
    fmtDate(r.activatedAt),
    fmtDate(r.expiresAt),
    ROSTER_STATUS_AR[r.status],
    r.invoiceNumber ? (r.invoiceCancelled ? `${r.invoiceNumber} (ملغاة)` : r.invoiceNumber) : '',
    r.invoiceNumber && !r.invoiceCancelled ? r.invoiceTotalDzd ?? '' : ''
  ])
  await writeAudit(db, {
    actorUserId: actor.userId,
    action: 'course.roster_export',
    entityType: 'course',
    entityId: course.id,
    newValue: { rows: rows.length, status: f.status ?? 'ACTIVE', source: f.source ?? null, month: f.month ?? null, q: f.q ? true : false }
  })
  const slug = course.title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40) || 'course'
  return { filename: `تلاميذ-${slug}-${fmtDate(new Date())}.csv`, csv: toCsv(header, body), count: rows.length }
}
