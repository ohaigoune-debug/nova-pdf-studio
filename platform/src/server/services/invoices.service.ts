/**
 * الفواتير (قرار المالك 16 نوفمبر 2026): تلقائيًا عند تسليم الطلب + يدويًا من الإدارة؛ يراها المشرف والتلميذ.
 *
 * - الرقم: «البادئة-السنة-التسلسل» (F-2026-000001)، تسلسل سنوي بعدّاد ذرّي — لا رقمان متطابقان ولا قفز بالسباق.
 * - طلب واحد ⇒ فاتورة واحدة (فهرس فريد): إعادة «سُلِّم» أو webhook مكرّر لا يصدر فاتورة ثانية.
 * - لا حذف: الإرجاع أو الخطأ ⇒ «ملغاة» بسبب، ويبقى رقمها في التسلسل.
 * - المطبوع مجمَّد وقت الإصدار (الأسطر، المبالغ، بيانات البائع).
 * - طلب مجاني (المجموع 0) لا فاتورة له.
 * - بيانات البائع (الاسم، العنوان، الأرقام القانونية، التذييل، البادئة) من لوحة الإدارة، لا من الكود.
 */
import { and, asc, count, desc, eq, gte, ilike, isNull, lt, or, sql, sum, type SQL } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import {
  appSettings,
  courseEnrollments,
  invoiceCounters,
  invoices,
  INVOICE_PAYMENT_METHODS,
  onlinePayments,
  orderItems,
  orders,
  profiles,
  students,
  users,
  type InvoiceLine,
  type InvoicePaymentMethod,
  type InvoiceRow,
  type InvoiceSeller
} from '@/server/db/schema'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'

/* --------------------------------- الإعدادات --------------------------------- */

export interface InvoiceSettings {
  /** اسم البائع كما يُطبع (قرار المالك: «حيقون أسامة») */
  sellerName: string
  /** رقم التعريف الجبائي NIF */
  nif: string
  /** رقم الحساب البنكي (RIB) أو البريدي */
  bankAccount: string
  footer: string
  /** بادئة الرقم: حروف لاتينية وأرقام (F، MDZ…) */
  prefix: string
}

const SETTINGS_KEY = 'invoice.settings'
export const INVOICE_SETTINGS_DEFAULTS: InvoiceSettings = { sellerName: 'حيقون أسامة', nif: '', bankAccount: '', footer: 'شكرًا لثقتكم.', prefix: 'F' }
const LIMITS: Record<keyof InvoiceSettings, number> = { sellerName: 120, nif: 30, bankAccount: 40, footer: 300, prefix: 8 }
const PREFIX_RE = /^[A-Z0-9]{1,8}$/
/** أرقام ومسافات فقط (NIF)، وأرقام وحروف لاتينية ومسافات وشرطات (RIB / CCP «… clé …») */
const FORMAT: Partial<Record<keyof InvoiceSettings, RegExp>> = { nif: /^[0-9 ]*$/, bankAccount: /^[0-9A-Za-z \-]*$/ }

export async function invoiceSettings(db: Db): Promise<InvoiceSettings> {
  const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, SETTINGS_KEY)).limit(1)
  const saved = (row?.value ?? {}) as Partial<Record<keyof InvoiceSettings, unknown>>
  const out = { ...INVOICE_SETTINGS_DEFAULTS }
  for (const k of Object.keys(out) as (keyof InvoiceSettings)[]) if (typeof saved[k] === 'string') out[k] = saved[k] as string
  if (!PREFIX_RE.test(out.prefix)) out.prefix = INVOICE_SETTINGS_DEFAULTS.prefix
  return out
}

export async function setInvoiceSettings(db: Db, actor: Actor, input: Partial<Record<keyof InvoiceSettings, unknown>>): Promise<InvoiceSettings> {
  assertRole(actor, 'SUPER_ADMIN')
  const prev = await invoiceSettings(db)
  const next = { ...prev }
  for (const k of Object.keys(LIMITS) as (keyof InvoiceSettings)[]) {
    const v = input[k]
    if (v === undefined) continue
    if (typeof v !== 'string' || v.trim().length > LIMITS[k]) throw new AppError('VALIDATION', { field: k })
    const t = v.trim().replace(/\s+/g, ' ')
    if (FORMAT[k] && !FORMAT[k]!.test(t)) throw new AppError('VALIDATION', { field: k })
    next[k] = k === 'footer' ? v.trim() : t
  }
  next.prefix = next.prefix.toUpperCase()
  if (!PREFIX_RE.test(next.prefix)) throw new AppError('VALIDATION', { field: 'prefix' })
  if (!next.sellerName) throw new AppError('VALIDATION', { field: 'sellerName' })
  await db.insert(appSettings).values({ key: SETTINGS_KEY, value: next }).onConflictDoUpdate({ target: appSettings.key, set: { value: next, updatedAt: new Date() } })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'settings.invoice', entityType: 'settings', entityId: null, oldValue: { ...prev }, newValue: { ...next } })
  return next
}

const sellerOf = (s: InvoiceSettings): InvoiceSeller => ({ name: s.sellerName, nif: s.nif, bankAccount: s.bankAccount, footer: s.footer })

/* ---------------------------------- الإصدار ---------------------------------- */

/** سنة الإصدار بتوقيت الجزائر (UTC+1، بلا توقيت صيفي) */
export const invoiceYear = (d: Date) => new Date(d.getTime() + 3_600_000).getUTCFullYear()
export const formatInvoiceNumber = (prefix: string, year: number, seq: number) => `${prefix}-${year}-${String(seq).padStart(6, '0')}`

async function nextSeq(tx: Db, year: number): Promise<number> {
  const [r] = await tx
    .insert(invoiceCounters)
    .values({ year, last: 1 })
    .onConflictDoUpdate({ target: invoiceCounters.year, set: { last: sql`${invoiceCounters.last} + 1` } })
    .returning({ last: invoiceCounters.last })
  return r!.last
}

interface IssueInput {
  source: 'ORDER' | 'MANUAL'
  orderId?: string | null
  userId: string | null
  studentId: string | null
  customerName: string
  customerPhone: string | null
  studentCode: string | null
  lines: InvoiceLine[]
  shippingDzd: number
  discountDzd: number
  paymentMethod: InvoicePaymentMethod
  paymentRef?: string | null
  paymentReceiptUrl?: string | null
  note?: string | null
  issuedAt: Date
  createdByUserId: string | null
}

async function insertInvoice(db: Db, input: IssueInput): Promise<InvoiceRow> {
  const settings = await invoiceSettings(db)
  const subtotal = input.lines.reduce((s, l) => s + l.totalDzd, 0)
  const total = Math.max(0, subtotal + input.shippingDzd - input.discountDzd)
  const year = invoiceYear(input.issuedAt)
  return db.transaction(async (tx) => {
    const seq = await nextSeq(tx, year)
    const [row] = await tx
      .insert(invoices)
      .values({
        number: formatInvoiceNumber(settings.prefix, year, seq),
        year,
        seq,
        source: input.source,
        orderId: input.orderId ?? null,
        userId: input.userId,
        studentId: input.studentId,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        studentCode: input.studentCode,
        lines: input.lines,
        subtotalDzd: subtotal,
        shippingDzd: input.shippingDzd,
        discountDzd: Math.min(input.discountDzd, subtotal + input.shippingDzd),
        totalDzd: total,
        paymentMethod: input.paymentMethod,
        paymentRef: input.paymentRef?.trim() || null,
        paymentReceiptUrl: input.paymentReceiptUrl ?? null,
        seller: sellerOf(settings),
        note: input.note?.trim() || null,
        issuedAt: input.issuedAt,
        createdByUserId: input.createdByUserId
      })
      .returning()
    await writeAudit(tx, { actorUserId: input.createdByUserId, workspaceId: null, action: 'invoice.issue', entityType: 'invoice', entityId: row!.id, newValue: { number: row!.number, total, source: input.source, orderId: input.orderId ?? null } })
    return row!
  })
}

const codeOf = (userId: string | null | undefined) => (userId ? userId.slice(0, 8) : null)

/** التلميذ المعنيّ بالطلب: المستفيد إن اشترى الوليّ، وإلا صاحب الحساب إن كان تلميذًا */
async function studentForOrder(db: Db, o: { userId: string; beneficiaryStudentId: string | null }) {
  if (o.beneficiaryStudentId) {
    const [s] = await db.select({ id: students.id, userId: students.userId }).from(students).where(eq(students.id, o.beneficiaryStudentId)).limit(1)
    if (s) return s
  }
  const [s] = await db.select({ id: students.id, userId: students.userId }).from(students).where(eq(students.userId, o.userId)).limit(1)
  return s ?? null
}

/**
 * الدفع بالبطاقة يمرّ بنظام فوترة eFawtara (Guiddini): الفاتورة تحمل رقم المعاملة عنده ورابط إيصاله الموقَّع
 * (لا ينتهي ويُفتح بلا مفاتيح) — من آخر دفعة «مدفوعة» تحقّق منها الخادم عند البوابة.
 */
async function eFawtaraProof(db: Db, orderId: string): Promise<{ ref: string | null; receiptUrl: string | null }> {
  const [p] = await db
    .select({ ref: onlinePayments.gatewayRef, raw: onlinePayments.gatewayResponse })
    .from(onlinePayments)
    .where(and(eq(onlinePayments.orderId, orderId), eq(onlinePayments.status, 'PAID')))
    .orderBy(desc(onlinePayments.paidAt))
    .limit(1)
  if (!p) return { ref: null, receiptUrl: null }
  const href = (p.raw as { data?: { links?: { href?: unknown } } } | null)?.data?.links?.href
  return { ref: p.ref, receiptUrl: typeof href === 'string' && /^https:\/\//.test(href) ? href : null }
}

/**
 * فاتورة الطلب المُسلَّم (تلقائيًا من محرّك حالات الطلب، أو من «أصدر الفواتير الناقصة»).
 * idempotent: للطلب فاتورة ⇒ تُعاد كما هي. طلب غير مُسلَّم أو مجموعه 0 ⇒ null.
 */
export async function issueInvoiceForOrder(db: Db, orderId: string): Promise<InvoiceRow | null> {
  const [existing] = await db.select().from(invoices).where(eq(invoices.orderId, orderId)).limit(1)
  if (existing) return existing
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  if (!o || o.status !== 'DELIVERED' || o.subtotalDzd <= 0) return null
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).orderBy(asc(orderItems.createdAt))
  const student = await studentForOrder(db, o)
  const method = (INVOICE_PAYMENT_METHODS as readonly string[]).includes(o.paymentMethod) ? (o.paymentMethod as InvoicePaymentMethod) : 'OTHER'
  const proof = method === 'ONLINE' ? await eFawtaraProof(db, o.id) : { ref: null, receiptUrl: null }
  try {
    return await insertInvoice(db, {
      source: 'ORDER',
      orderId: o.id,
      userId: o.userId,
      studentId: student?.id ?? null,
      customerName: o.customerName,
      customerPhone: o.phone,
      studentCode: codeOf(student?.userId ?? o.userId),
      lines: items.map((i) => ({ title: i.title, qty: i.qty, unitDzd: i.unitPriceDzd, totalDzd: i.lineTotalDzd })),
      shippingDzd: o.shippingDzd,
      discountDzd: o.creditDzd,
      paymentMethod: method,
      paymentRef: proof.ref,
      paymentReceiptUrl: proof.receiptUrl,
      issuedAt: o.deliveredAt ?? new Date(),
      createdByUserId: null
    })
  } catch (e) {
    // سباق نادر (تسليمان في اللحظة نفسها): الفهرس الفريد يمنع الثانية — نعيد الأولى
    const [again] = await db.select().from(invoices).where(eq(invoices.orderId, orderId)).limit(1)
    if (again) return again
    throw e
  }
}

/** إرجاع الطلب ⇒ فاتورته «ملغاة» (يبقى رقمها) */
export async function cancelInvoiceForOrder(db: Db, orderId: string, reason: string, actorUserId: string | null = null): Promise<InvoiceRow | null> {
  const [inv] = await db.select().from(invoices).where(and(eq(invoices.orderId, orderId), eq(invoices.status, 'ISSUED'))).limit(1)
  if (!inv) return null
  return markCancelled(db, inv, reason, actorUserId)
}

async function markCancelled(db: Db, inv: InvoiceRow, reason: string, actorUserId: string | null): Promise<InvoiceRow> {
  const [row] = await db.update(invoices).set({ status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason.trim().slice(0, 300), updatedAt: new Date() }).where(eq(invoices.id, inv.id)).returning()
  await writeAudit(db, { actorUserId, workspaceId: null, action: 'invoice.cancel', entityType: 'invoice', entityId: inv.id, oldValue: { status: inv.status }, newValue: { status: 'CANCELLED', reason } })
  return row!
}

/* --------------------------------- الإدارة --------------------------------- */

export interface ManualInvoiceInput {
  /** حساب التلميذ (اختياري): يملأ الاسم والهاتف والرمز، ويرى التلميذ الفاتورة من «حسابي» */
  studentId?: string | null
  customerName?: string | null
  customerPhone?: string | null
  lines: { title: string; qty: number; unitDzd: number }[]
  shippingDzd?: number
  discountDzd?: number
  paymentMethod: InvoicePaymentMethod
  /** رقم المعاملة عند eFawtara إن دُفعت بالبطاقة خارج طلب المنصة */
  paymentRef?: string | null
  note?: string | null
}

const intIn = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

export async function createManualInvoice(db: Db, actor: Actor, input: ManualInvoiceInput): Promise<InvoiceRow> {
  assertRole(actor, 'SUPER_ADMIN')
  if (!(INVOICE_PAYMENT_METHODS as readonly string[]).includes(input.paymentMethod)) throw new AppError('VALIDATION', { field: 'paymentMethod' })
  const lines = (input.lines ?? []).filter((l) => l.title?.trim())
  if (!lines.length || lines.length > 30) throw new AppError('VALIDATION', { field: 'lines' })
  for (const l of lines) if (!intIn(l.qty, 1, 1000) || !intIn(l.unitDzd, 0, 10_000_000) || l.title.trim().length > 200) throw new AppError('VALIDATION', { field: 'lines' })
  const shipping = input.shippingDzd ?? 0
  const discount = input.discountDzd ?? 0
  if (!intIn(shipping, 0, 1_000_000)) throw new AppError('VALIDATION', { field: 'shippingDzd' })
  if (!intIn(discount, 0, 10_000_000)) throw new AppError('VALIDATION', { field: 'discountDzd' })
  const paymentRef = input.paymentRef?.trim() || null
  if (paymentRef && (paymentRef.length > 60 || !/^[0-9A-Za-z_\-]+$/.test(paymentRef))) throw new AppError('VALIDATION', { field: 'paymentRef' })
  let student: { id: string; userId: string; fullName: string | null; phone: string | null } | null = null
  if (input.studentId) {
    assertUuid(input.studentId, 'VALIDATION')
    const [s] = await db
      .select({ id: students.id, userId: students.userId, fullName: profiles.fullName, phone: profiles.phone })
      .from(students)
      .leftJoin(profiles, eq(profiles.userId, students.userId))
      .where(eq(students.id, input.studentId))
      .limit(1)
    if (!s) throw new AppError('VALIDATION', { field: 'studentId' })
    student = s
  }
  const customerName = input.customerName?.trim() || student?.fullName?.trim() || ''
  if (!customerName || customerName.length > 120) throw new AppError('VALIDATION', { field: 'customerName' })
  const mapped = lines.map((l) => ({ title: l.title.trim(), qty: l.qty, unitDzd: l.unitDzd, totalDzd: l.qty * l.unitDzd }))
  if (discount > mapped.reduce((s, l) => s + l.totalDzd, 0) + shipping) throw new AppError('VALIDATION', { field: 'discountDzd' })
  return insertInvoice(db, {
    source: 'MANUAL',
    userId: student?.userId ?? null,
    studentId: student?.id ?? null,
    customerName,
    customerPhone: input.customerPhone?.trim() || student?.phone || null,
    studentCode: codeOf(student?.userId),
    lines: mapped,
    shippingDzd: shipping,
    discountDzd: discount,
    paymentMethod: input.paymentMethod,
    paymentRef,
    note: input.note,
    issuedAt: new Date(),
    createdByUserId: actor.userId
  })
}

export async function cancelInvoice(db: Db, actor: Actor, id: string, reason: string): Promise<InvoiceRow> {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(id, 'INVOICE_NOT_FOUND')
  if (!reason?.trim()) throw new AppError('VALIDATION', { field: 'reason' })
  const [inv] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1)
  if (!inv) throw new AppError('INVOICE_NOT_FOUND')
  if (inv.status === 'CANCELLED') return inv
  return markCancelled(db, inv, reason, actor.userId)
}

/** الطلبات المُسلَّمة بلا فاتورة (قبل هذه الميزة، أو فشل نادر): تُصدر بترتيب تاريخ التسليم */
export async function issueMissingInvoices(db: Db, actor: Actor, limit = 500): Promise<{ issued: number; remaining: number }> {
  assertRole(actor, 'SUPER_ADMIN')
  const missing = and(eq(orders.status, 'DELIVERED'), sql`${orders.subtotalDzd} > 0`, sql`not exists (select 1 from invoices i where i.order_id = ${orders.id})`)
  const rows = await db.select({ id: orders.id }).from(orders).where(missing).orderBy(asc(orders.deliveredAt), asc(orders.createdAt)).limit(limit)
  let issued = 0
  for (const r of rows) if (await issueInvoiceForOrder(db, r.id)) issued++
  const [left] = await db.select({ n: count() }).from(orders).where(missing)
  return { issued, remaining: Number(left?.n ?? 0) }
}

export interface InvoiceListFilters {
  q?: string | null
  status?: 'ISSUED' | 'CANCELLED' | null
  /** YYYY-MM */
  month?: string | null
  limit?: number
}

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/

/** حدود الشهر بتوقيت الجزائر */
export function monthRange(month: string): { from: Date; to: Date } | null {
  const m = MONTH_RE.exec(month)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  return { from: new Date(Date.UTC(y, mo - 1, 1) - 3_600_000), to: new Date(Date.UTC(y, mo, 1) - 3_600_000) }
}

export async function listInvoices(db: Db, actor: Actor, f: InvoiceListFilters = {}) {
  assertRole(actor, 'SUPER_ADMIN')
  const range = f.month ? monthRange(f.month) : null
  const q = f.q?.trim()
  const where: (SQL | undefined)[] = [
    f.status ? eq(invoices.status, f.status) : undefined,
    range ? and(gte(invoices.issuedAt, range.from), lt(invoices.issuedAt, range.to)) : undefined,
    q ? or(ilike(invoices.number, `%${q}%`), ilike(invoices.customerName, `%${q}%`), ilike(invoices.customerPhone, `%${q}%`), ilike(invoices.studentCode, `%${q}%`)) : undefined
  ]
  return db
    .select({ id: invoices.id, number: invoices.number, customerName: invoices.customerName, customerPhone: invoices.customerPhone, studentCode: invoices.studentCode, totalDzd: invoices.totalDzd, paymentMethod: invoices.paymentMethod, status: invoices.status, source: invoices.source, issuedAt: invoices.issuedAt, orderId: invoices.orderId })
    .from(invoices)
    .where(and(...where))
    .orderBy(desc(invoices.issuedAt), desc(invoices.seq))
    .limit(Math.min(f.limit ?? 200, 500))
}

export interface InvoiceSummary {
  /** حسابات التلاميذ المسجَّلة (غير المحذوفة) */
  registeredStudents: number
  /** تلاميذ لهم اشتراك دورة ساري */
  studentsWithActiveCourse: number
  /** فواتير صادرة غير ملغاة في الفترة، ومجموعها */
  invoices: number
  revenueDzd: number
  cancelled: number
  /** طلبات مُسلَّمة بلا فاتورة بعد */
  missing: number
}

export async function invoiceSummary(db: Db, actor: Actor, month?: string | null): Promise<InvoiceSummary> {
  assertRole(actor, 'SUPER_ADMIN')
  const range = month ? monthRange(month) : null
  const inRange = range ? and(gte(invoices.issuedAt, range.from), lt(invoices.issuedAt, range.to)) : undefined
  const [[reg], [act], [iss], [can], [miss]] = await Promise.all([
    db.select({ n: count() }).from(students).innerJoin(users, eq(users.id, students.userId)).where(and(eq(users.role, 'STUDENT'), isNull(users.deletedAt))),
    db.select({ n: sql<number>`count(distinct ${courseEnrollments.studentId})` }).from(courseEnrollments).where(and(eq(courseEnrollments.status, 'ACTIVE'), or(isNull(courseEnrollments.expiresAt), sql`${courseEnrollments.expiresAt} > now()`))),
    db.select({ n: count(), total: sum(invoices.totalDzd) }).from(invoices).where(and(eq(invoices.status, 'ISSUED'), inRange)),
    db.select({ n: count() }).from(invoices).where(and(eq(invoices.status, 'CANCELLED'), inRange)),
    db.select({ n: count() }).from(orders).where(and(eq(orders.status, 'DELIVERED'), sql`${orders.subtotalDzd} > 0`, sql`not exists (select 1 from invoices i where i.order_id = ${orders.id})`))
  ])
  return {
    registeredStudents: Number(reg?.n ?? 0),
    studentsWithActiveCourse: Number(act?.n ?? 0),
    invoices: Number(iss?.n ?? 0),
    revenueDzd: Number(iss?.total ?? 0),
    cancelled: Number(can?.n ?? 0),
    missing: Number(miss?.n ?? 0)
  }
}

/* -------------------------------- الاطّلاع -------------------------------- */

/** المشرف: كل الفواتير. التلميذ (أو الوليّ): فواتير حسابه أو التي هو مستفيدها فقط. غيرهما: لا شيء */
export async function getInvoiceForViewer(db: Db, actor: Actor, id: string): Promise<InvoiceRow> {
  assertUuid(id, 'INVOICE_NOT_FOUND')
  const [inv] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1)
  if (!inv) throw new AppError('INVOICE_NOT_FOUND')
  if (actor.role === 'SUPER_ADMIN') return inv
  const mine = inv.userId === actor.userId || (actor.studentId != null && inv.studentId === actor.studentId)
  if (!mine) throw new AppError('INVOICE_NOT_FOUND')
  return inv
}

export async function listMyInvoices(db: Db, actor: Actor) {
  const own = actor.studentId ? or(eq(invoices.userId, actor.userId), eq(invoices.studentId, actor.studentId)) : eq(invoices.userId, actor.userId)
  return db
    .select({ id: invoices.id, number: invoices.number, totalDzd: invoices.totalDzd, status: invoices.status, issuedAt: invoices.issuedAt, lines: invoices.lines })
    .from(invoices)
    .where(own)
    .orderBy(desc(invoices.issuedAt))
    .limit(200)
}

/** للبحث عن تلميذ في نموذج الفاتورة اليدوية (الاسم أو الهاتف أو البريد) */
export async function findStudentsForInvoice(db: Db, actor: Actor, q: string) {
  assertRole(actor, 'SUPER_ADMIN')
  const term = q.trim()
  if (term.length < 2) return []
  return db
    .select({ id: students.id, fullName: profiles.fullName, phone: profiles.phone, email: users.email, userId: students.userId })
    .from(students)
    .innerJoin(users, eq(users.id, students.userId))
    .leftJoin(profiles, eq(profiles.userId, students.userId))
    .where(and(isNull(users.deletedAt), or(ilike(profiles.fullName, `%${term}%`), ilike(profiles.phone, `%${term}%`), ilike(sql`coalesce(${users.email}, '')`, `%${term}%`))))
    .limit(10)
}

export { PAYMENT_METHOD_AR } from '@/lib/invoice-labels'
