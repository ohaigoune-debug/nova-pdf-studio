/**
 * نقاط البيع (قرار المالك 2 نوفمبر 2026): مدارس ومكتبات شريكة تستلم باقات (كتب + دورة سنوية)،
 * وتولّد كود التفعيل لحظة بيع كل باقة — من صفحة بسيطة على الهاتف (زر واحد).
 *
 *  - الكود لا يُطبع في الكتاب: يُولَّد عند البيع، ويُستعمل مرة واحدة في /claim (كود الدورة 11 رقمًا).
 *  - لا تتجاوز النقطة مخزونها: المتبقي = الباقات المرسَلة − الأكواد المولَّدة غير الملغاة.
 *  - كل كود مولَّد بيعٌ مسجَّل على النقطة: سعر الباقة وقت البيع − عمولتها = ما تدين به للمنصة.
 *  - إلغاء كود لم يُستعمل خلال 48 ساعة يُعيد الباقة إلى العدّاد.
 *  - المشرف و«مسؤول الشركاء» يضيفان النقاط وحساباتها ويرسلانها عبر واتساب؛ العمولة والتسديدات والإيقاف للمشرف وحده.
 */
import { randomInt, randomUUID } from 'node:crypto'
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { courseCodes, courses, pointsOfSale, posMembers, posPayments, posStockMoves, products, profiles, users, wilayas } from '@/server/db/schema'
import { hashPassword } from '@/server/auth/password'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { seal, unseal } from '@/server/lib/secret-box'
import { insertSingleCourseCode } from './course-codes.service'
import { notifyMany } from './notifications.service'
import { normalizePhone } from './otp.service'

const SEAL_PURPOSE = 'pos.code'
/** مهلة إلغاء كود لم يُستعمل (الباقة أُرجعت قبل التفعيل) */
export const POS_CANCEL_WINDOW_MS = 48 * 3600 * 1000
const isPhysical = (type: string) => type === 'BOOK' || type === 'PACK'

type PosRow = typeof pointsOfSale.$inferSelect

/** المشرف أو «مسؤول الشركاء» */
function assertPartnerStaff(actor: Actor): void {
  assertRole(actor, 'SUPER_ADMIN', 'PARTNER_MANAGER')
}

async function loadPos(db: Db, posId: string): Promise<PosRow> {
  assertUuid(posId, 'NOT_FOUND')
  const [p] = await db.select().from(pointsOfSale).where(eq(pointsOfSale.id, posId)).limit(1)
  if (!p) throw new AppError('NOT_FOUND')
  return p
}

/** نقطة البيع التي ينتمي إليها حساب نقطة بيع */
export async function posOfMember(db: Db, actor: Actor): Promise<PosRow> {
  assertRole(actor, 'POINT_OF_SALE')
  const [m] = await db.select({ p: pointsOfSale }).from(posMembers).innerJoin(pointsOfSale, eq(pointsOfSale.id, posMembers.posId)).where(eq(posMembers.userId, actor.userId)).limit(1)
  if (!m) throw new AppError('FORBIDDEN')
  return m.p
}

/* ───────────── النقاط ───────────── */

export interface PosInput {
  name: string
  wilayaId?: string | null
  address?: string | null
  phone?: string | null
  listed?: boolean
  /** للمشرف وحده */
  commissionDzd?: number
  lowStockAlert?: number
  note?: string | null
}

function cleanPosInput(input: PosInput) {
  const name = input.name.trim()
  if (name.length < 2 || name.length > 120) throw new AppError('VALIDATION', { field: 'name' })
  if (input.wilayaId) assertUuid(input.wilayaId, 'VALIDATION')
  const phone = input.phone?.trim() ? normalizePhone(input.phone) : null
  return { name, wilayaId: input.wilayaId || null, address: input.address?.trim().slice(0, 300) || null, phone, listed: input.listed ?? true, note: input.note?.trim().slice(0, 500) || null }
}

export async function createPointOfSale(db: Db, actor: Actor, input: PosInput): Promise<PosRow> {
  assertPartnerStaff(actor)
  const v = cleanPosInput(input)
  const money = actor.role === 'SUPER_ADMIN' ? moneyFields(input) : {}
  const [row] = await db.insert(pointsOfSale).values({ ...v, ...money }).returning()
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'pos.create', entityType: 'point_of_sale', entityId: row!.id, newValue: { name: v.name, ...money } })
  return row!
}

function moneyFields(input: PosInput): { commissionDzd?: number; lowStockAlert?: number } {
  const out: { commissionDzd?: number; lowStockAlert?: number } = {}
  if (input.commissionDzd !== undefined) {
    if (!Number.isInteger(input.commissionDzd) || input.commissionDzd < 0 || input.commissionDzd > 1_000_000) throw new AppError('VALIDATION', { field: 'commissionDzd' })
    out.commissionDzd = input.commissionDzd
  }
  if (input.lowStockAlert !== undefined) {
    if (!Number.isInteger(input.lowStockAlert) || input.lowStockAlert < 0 || input.lowStockAlert > 1000) throw new AppError('VALIDATION', { field: 'lowStockAlert' })
    out.lowStockAlert = input.lowStockAlert
  }
  return out
}

/** تعديل البيانات؛ العمولة وحدّ التنبيه للمشرف وحده (يُتجاهلان لمسؤول الشركاء) */
export async function updatePointOfSale(db: Db, actor: Actor, posId: string, input: PosInput): Promise<PosRow> {
  assertPartnerStaff(actor)
  const cur = await loadPos(db, posId)
  const v = cleanPosInput(input)
  const money = actor.role === 'SUPER_ADMIN' ? moneyFields(input) : {}
  const [row] = await db.update(pointsOfSale).set({ ...v, ...money, updatedAt: new Date() }).where(eq(pointsOfSale.id, cur.id)).returning()
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'pos.update', entityType: 'point_of_sale', entityId: cur.id, oldValue: { name: cur.name, commissionDzd: cur.commissionDzd }, newValue: { name: v.name, ...money } })
  return row!
}

/** إيقاف نقطة (لا توليد أكواد) أو إعادتها — للمشرف وحده */
export async function setPosStatus(db: Db, actor: Actor, posId: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<void> {
  assertRole(actor, 'SUPER_ADMIN')
  const cur = await loadPos(db, posId)
  await db.update(pointsOfSale).set({ status, updatedAt: new Date() }).where(eq(pointsOfSale.id, cur.id))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'pos.status', entityType: 'point_of_sale', entityId: cur.id, oldValue: { status: cur.status }, newValue: { status } })
}

/* ───────────── الحسابات ───────────── */

/** كلمة سر تُملى بسهولة: 10 محارف بلا محارف ملتبسة (0/O، 1/l/I) */
export function generateReadablePassword(): string {
  const letters = 'abcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  let out = ''
  for (let i = 0; i < 6; i++) out += letters[randomInt(0, letters.length)]
  for (let i = 0; i < 4; i++) out += digits[randomInt(0, digits.length)]
  return out
}

/** رسالة واتساب جاهزة برابط الدخول ورقمه وكلمة سرّه */
export function credentialsWhatsapp(input: { posName: string; phone: string; password: string; appUrl?: string }): string {
  const base = (input.appUrl ?? process.env.APP_URL ?? 'https://madrasadz.com').replace(/\/+$/, '')
  const text = [`مرحبًا، هذا حساب «${input.posName}» في منصة مدرسة لبيع الباقات وتوليد أكواد التفعيل.`, `الدخول: ${base}/login`, `الهاتف: ${input.phone}`, `كلمة السر: ${input.password}`, 'بعد الدخول: زر «بعت باقة — أعطني الكود» عند كل بيع.'].join('\n')
  return `https://wa.me/213${input.phone.slice(1)}?text=${encodeURIComponent(text)}`
}

export interface PosCredentials {
  userId: string
  phone: string
  password: string
  whatsappUrl: string
}

/** حساب جديد لنقطة البيع (صاحبها أو موظفها): الدخول بالهاتف وكلمة سر مولَّدة تظهر مرة واحدة */
export async function addPosMember(db: Db, actor: Actor, posId: string, input: { fullName: string; phone: string }): Promise<PosCredentials> {
  assertPartnerStaff(actor)
  const pos = await loadPos(db, posId)
  const fullName = input.fullName.trim()
  if (fullName.length < 2 || fullName.length > 120) throw new AppError('VALIDATION', { field: 'fullName' })
  const phone = normalizePhone(input.phone)
  // الهاتف هو اسم الدخول: لا حسابا نقطة بيع بالرقم نفسه
  const [taken] = await db.select({ id: users.id }).from(users).innerJoin(profiles, eq(profiles.userId, users.id)).where(and(eq(profiles.phone, phone), eq(users.role, 'POINT_OF_SALE'), isNull(users.deletedAt))).limit(1)
  if (taken) throw new AppError('POS_PHONE_TAKEN')
  const password = generateReadablePassword()
  const email = `pos-${randomUUID()}@accounts.madrasadz.com`
  const userId = await db.transaction(async (tx) => {
    const [u] = await tx.insert(users).values({ email, passwordHash: hashPassword(password), role: 'POINT_OF_SALE' }).returning({ id: users.id })
    if (!u) throw new AppError('INTERNAL')
    await tx.insert(profiles).values({ userId: u.id, fullName, phone })
    await tx.insert(posMembers).values({ posId: pos.id, userId: u.id })
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId: null, action: 'pos.member_add', entityType: 'point_of_sale', entityId: pos.id, newValue: { userId: u.id, phoneTail: phone.slice(-4) } })
    return u.id
  })
  return { userId, phone, password, whatsappUrl: credentialsWhatsapp({ posName: pos.name, phone, password }) }
}

/** كلمة سر جديدة لحساب نقطة بيع (ضاعت أو تغيّر الموظف) */
export async function resetPosMemberPassword(db: Db, actor: Actor, userId: string): Promise<PosCredentials> {
  assertPartnerStaff(actor)
  assertUuid(userId, 'NOT_FOUND')
  const [m] = await db.select({ posId: posMembers.posId, posName: pointsOfSale.name, phone: profiles.phone }).from(posMembers).innerJoin(pointsOfSale, eq(pointsOfSale.id, posMembers.posId)).leftJoin(profiles, eq(profiles.userId, posMembers.userId)).where(eq(posMembers.userId, userId)).limit(1)
  if (!m || !m.phone) throw new AppError('NOT_FOUND')
  const password = generateReadablePassword()
  await db.update(users).set({ passwordHash: hashPassword(password), status: 'ACTIVE', updatedAt: new Date() }).where(eq(users.id, userId))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'pos.member_reset', entityType: 'point_of_sale', entityId: m.posId, newValue: { userId } })
  return { userId, phone: m.phone, password, whatsappUrl: credentialsWhatsapp({ posName: m.posName, phone: m.phone, password }) }
}

/** إيقاف حساب موظف في نقطة بيع (غادر المدرسة) أو إعادته */
export async function setPosMemberActive(db: Db, actor: Actor, userId: string, active: boolean): Promise<void> {
  assertPartnerStaff(actor)
  assertUuid(userId, 'NOT_FOUND')
  const [m] = await db.select({ posId: posMembers.posId }).from(posMembers).where(eq(posMembers.userId, userId)).limit(1)
  if (!m) throw new AppError('NOT_FOUND')
  await db.update(users).set({ status: active ? 'ACTIVE' : 'DISABLED', updatedAt: new Date() }).where(eq(users.id, userId))
  if (!active) await import('@/server/auth/session').then((s) => s.revokeAllSessions(db, userId)).catch(() => null)
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'pos.member_status', entityType: 'point_of_sale', entityId: m.posId, newValue: { userId, active } })
}

/* ───────────── المخزون ───────────── */

/** سعر الباقة في نقطة البيع = سعر الدورة مع الكتب (نفس السعر أونلاين)، وإلا سعر النسخة الرقمية، وإلا سعر الدورة */
async function bundlePriceOf(db: Db, courseId: string): Promise<{ priceDzd: number; bookProductId: string | null; title: string; workspaceId: string }> {
  const [c] = await db.select({ id: courses.id, title: courses.title, priceDzd: courses.priceDzd, digitalPriceDzd: courses.digitalPriceDzd, bookProductId: courses.bookProductId, workspaceId: courses.workspaceId, deletedAt: courses.deletedAt }).from(courses).where(eq(courses.id, courseId)).limit(1)
  if (!c || c.deletedAt) throw new AppError('COURSE_NOT_FOUND')
  const [book] = c.bookProductId ? await db.select({ priceDzd: products.priceDzd, deletedAt: products.deletedAt }).from(products).where(eq(products.id, c.bookProductId)).limit(1) : []
  const priceDzd = book && !book.deletedAt ? book.priceDzd : (c.digitalPriceDzd ?? c.priceDzd)
  return { priceDzd, bookProductId: book && !book.deletedAt ? c.bookProductId : null, title: c.title, workspaceId: c.workspaceId }
}

/** المتبقي لكل دورة في نقطة: المرسَل − الأكواد غير الملغاة */
async function stockByCourse(db: Db, posId: string): Promise<Map<string, { sent: number; sold: number }>> {
  const [moves, sold] = await Promise.all([
    db.select({ courseId: posStockMoves.courseId, sent: sql<number>`coalesce(sum(${posStockMoves.qty}), 0)::int` }).from(posStockMoves).where(eq(posStockMoves.posId, posId)).groupBy(posStockMoves.courseId),
    db.select({ courseId: courseCodes.courseId, n: sql<number>`count(*)::int` }).from(courseCodes).where(and(eq(courseCodes.posId, posId), isNull(courseCodes.cancelledAt))).groupBy(courseCodes.courseId)
  ])
  const out = new Map<string, { sent: number; sold: number }>()
  for (const m of moves) out.set(m.courseId, { sent: m.sent, sold: 0 })
  for (const s of sold) out.set(s.courseId, { sent: out.get(s.courseId)?.sent ?? 0, sold: s.n })
  return out
}

/**
 * باقات تُرسَل إلى نقطة (qty > 0) أو تُسترجع ممّا لم يُبع (qty < 0). مخزون الكتاب في المخزن يتحرّك معها
 * إن كان محدودًا (يُرفض الإرسال إن لم يكفِ).
 */
export async function movePosStock(db: Db, actor: Actor, posId: string, input: { courseId: string; qty: number; note?: string | null }): Promise<{ remaining: number }> {
  assertPartnerStaff(actor)
  const pos = await loadPos(db, posId)
  assertUuid(input.courseId, 'COURSE_NOT_FOUND')
  if (!Number.isInteger(input.qty) || input.qty === 0 || Math.abs(input.qty) > 10_000) throw new AppError('VALIDATION', { field: 'qty' })
  const bundle = await bundlePriceOf(db, input.courseId)
  await db.transaction(async (tx) => {
    await tx.select({ id: pointsOfSale.id }).from(pointsOfSale).where(eq(pointsOfSale.id, pos.id)).for('update')
    if (input.qty < 0) {
      const s = (await stockByCourse(tx, pos.id)).get(input.courseId) ?? { sent: 0, sold: 0 }
      if (s.sent - s.sold + input.qty < 0) throw new AppError('POS_RETURN_TOO_MANY', { remaining: s.sent - s.sold })
    }
    if (bundle.bookProductId) {
      const [p] = await tx.select({ id: products.id, stock: products.stock, type: products.type }).from(products).where(eq(products.id, bundle.bookProductId)).for('update').limit(1)
      if (p && isPhysical(p.type) && p.stock !== null) {
        if (input.qty > 0 && p.stock < input.qty) throw new AppError('OUT_OF_STOCK', { product: bundle.title, available: p.stock })
        await tx.update(products).set({ stock: p.stock - input.qty, updatedAt: new Date() }).where(eq(products.id, p.id))
      }
    }
    await tx.insert(posStockMoves).values({ posId: pos.id, courseId: input.courseId, qty: input.qty, note: input.note?.trim().slice(0, 300) || null, createdByUserId: actor.userId })
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId: bundle.workspaceId, action: 'pos.stock_move', entityType: 'point_of_sale', entityId: pos.id, newValue: { courseId: input.courseId, qty: input.qty } })
  })
  const s = (await stockByCourse(db, pos.id)).get(input.courseId) ?? { sent: 0, sold: 0 }
  return { remaining: s.sent - s.sold }
}

/* ───────────── البيع: الكود ───────────── */

export interface GeneratedPosCode {
  codeId: string
  code: string
  courseTitle: string
  priceDzd: number
  remaining: number
  /** رابط واتساب جاهز بالكود وطريقة التفعيل */
  shareText: string
}

/** الكود كما يُقرأ: 3-4-4 */
export const formatPosCode = (code: string) => `${code.slice(0, 3)} ${code.slice(3, 7)} ${code.slice(7)}`

function shareTextFor(code: string, courseTitle: string): string {
  const base = (process.env.APP_URL ?? 'https://madrasadz.com').replace(/\/+$/, '')
  return [`كود تفعيل «${courseTitle}» في منصة مدرسة: ${formatPosCode(code)}`, `ادخل حسابك ثم افتح ${base}/claim واكتب الكود. يُستعمل مرة واحدة.`].join('\n')
}

/**
 * «بعت باقة — أعطني الكود»: كود واحد للدورة، تحت قفل النقطة فلا يتجاوز ضغطان متزامنان المخزون.
 * السعر والعمولة يُجمَّدان في الكود وقت البيع.
 */
export async function generatePosCode(db: Db, actor: Actor, courseId: string): Promise<GeneratedPosCode> {
  const pos = await posOfMember(db, actor)
  if (pos.status !== 'ACTIVE') throw new AppError('POS_SUSPENDED')
  assertUuid(courseId, 'COURSE_NOT_FOUND')
  const bundle = await bundlePriceOf(db, courseId)
  const out = await db.transaction(async (tx) => {
    const [locked] = await tx.select().from(pointsOfSale).where(eq(pointsOfSale.id, pos.id)).for('update').limit(1)
    if (!locked || locked.status !== 'ACTIVE') throw new AppError('POS_SUSPENDED')
    const s = (await stockByCourse(tx, pos.id)).get(courseId) ?? { sent: 0, sold: 0 }
    if (s.sent - s.sold < 1) throw new AppError('POS_OUT_OF_STOCK')
    const { id, code } = await insertSingleCourseCode(tx, {
      courseId,
      batchId: pos.id,
      batchLabel: `نقطة بيع: ${locked.name}`.slice(0, 80),
      createdByUserId: actor.userId,
      extra: { posId: pos.id, salePriceDzd: bundle.priceDzd, commissionDzd: locked.commissionDzd },
      makeExtra: (c) => ({ codeSealed: seal(c, SEAL_PURPOSE) })
    })
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId: bundle.workspaceId, action: 'pos.code_generate', entityType: 'point_of_sale', entityId: pos.id, newValue: { codeId: id, courseId, priceDzd: bundle.priceDzd, commissionDzd: locked.commissionDzd } })
    return { id, code, remaining: s.sent - s.sold - 1, alertAt: locked.lowStockAlert, name: locked.name }
  })
  // تنبيه عند بلوغ حدّ التنبيه أو النفاد (مرة عند كل عتبة)
  if (out.remaining === out.alertAt || out.remaining === 0) {
    const staff = await db.select({ id: users.id }).from(users).where(and(inArray(users.role, ['SUPER_ADMIN', 'PARTNER_MANAGER']), eq(users.status, 'ACTIVE'), isNull(users.deletedAt)))
    await notifyMany(db, staff.map((u) => ({ userId: u.id, workspaceId: null, type: 'SYSTEM' as const, title: out.remaining === 0 ? `نفدت باقات «${out.name}»` : `بقي ${out.remaining} باقات عند «${out.name}»`, body: `${bundle.title} — أرسل دفعة جديدة.`, link: `/admin/points-of-sale/${pos.id}` }))).catch(() => null)
  }
  return { codeId: out.id, code: out.code, courseTitle: bundle.title, priceDzd: bundle.priceDzd, remaining: out.remaining, shareText: shareTextFor(out.code, bundle.title) }
}

/** إلغاء كود لم يُستعمل خلال 48 ساعة (أُرجعت الباقة): تعود الباقة إلى العدّاد. لصاحب النقطة أو للمشرف/المسؤول. */
export async function cancelPosCode(db: Db, actor: Actor, codeId: string, now = new Date()): Promise<void> {
  assertUuid(codeId, 'CODE_INVALID')
  const [c] = await db.select().from(courseCodes).where(eq(courseCodes.id, codeId)).limit(1)
  if (!c || !c.posId) throw new AppError('CODE_INVALID')
  if (actor.role === 'POINT_OF_SALE') {
    const pos = await posOfMember(db, actor)
    if (pos.id !== c.posId) throw new AppError('FORBIDDEN')
  } else assertPartnerStaff(actor)
  const staff = actor.role !== 'POINT_OF_SALE'
  if (c.status !== 'ACTIVE' || c.cancelledAt) throw new AppError('POS_CODE_NOT_CANCELLABLE')
  // نقطة البيع: خلال 48 ساعة فقط؛ المشرف/المسؤول: أي كود لم يُستعمل (ضاعت الباقة مثلًا)
  if (!staff && now.getTime() - c.createdAt.getTime() > POS_CANCEL_WINDOW_MS) throw new AppError('POS_CODE_NOT_CANCELLABLE')
  const [row] = await db.update(courseCodes).set({ status: 'DISABLED', cancelledAt: now }).where(and(eq(courseCodes.id, c.id), eq(courseCodes.status, 'ACTIVE'))).returning({ id: courseCodes.id })
  if (!row) throw new AppError('POS_CODE_NOT_CANCELLABLE')
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'pos.code_cancel', entityType: 'point_of_sale', entityId: c.posId, newValue: { codeId: c.id } })
}

export interface PosCodeView {
  id: string
  code: string | null
  courseTitle: string
  status: 'ACTIVE' | 'USED' | 'CANCELLED'
  priceDzd: number | null
  createdAt: Date
  usedAt: Date | null
  soldBy: string | null
  cancellable: boolean
}

/** أكواد النقطة (الأحدث أولًا) — الكود الصريح يُفكّ للنقطة نفسها وللمشرف/المسؤول فقط */
export async function listPosCodes(db: Db, actor: Actor, posId: string, limit = 100, now = new Date()): Promise<PosCodeView[]> {
  if (actor.role === 'POINT_OF_SALE') {
    const pos = await posOfMember(db, actor)
    if (pos.id !== posId) throw new AppError('FORBIDDEN')
  } else assertPartnerStaff(actor)
  const rows = await db
    .select({ c: courseCodes, courseTitle: courses.title, soldBy: profiles.fullName })
    .from(courseCodes)
    .innerJoin(courses, eq(courses.id, courseCodes.courseId))
    .leftJoin(profiles, eq(profiles.userId, courseCodes.createdByUserId))
    .where(eq(courseCodes.posId, posId))
    .orderBy(desc(courseCodes.createdAt))
    .limit(Math.min(Math.max(limit, 1), 500))
  const staff = actor.role !== 'POINT_OF_SALE'
  return rows.map((r) => {
    const status = r.c.cancelledAt ? 'CANCELLED' : r.c.status === 'USED' ? 'USED' : 'ACTIVE'
    return {
      id: r.c.id,
      code: r.c.codeSealed ? unseal(r.c.codeSealed, SEAL_PURPOSE) : null,
      courseTitle: r.courseTitle,
      status,
      priceDzd: r.c.salePriceDzd,
      createdAt: r.c.createdAt,
      usedAt: r.c.usedAt,
      soldBy: r.soldBy,
      cancellable: status === 'ACTIVE' && (staff || now.getTime() - r.c.createdAt.getTime() <= POS_CANCEL_WINDOW_MS)
    }
  })
}

/* ───────────── الحساب المالي ───────────── */

export interface PosSummary {
  stock: { courseId: string; courseTitle: string; sent: number; sold: number; remaining: number; priceDzd: number }[]
  soldCount: number
  activatedCount: number
  grossDzd: number
  commissionDzd: number
  /** ما على النقطة للمنصة = (السعر − العمولة) لكل كود غير ملغى − ما سُدّد */
  owedDzd: number
  paidDzd: number
}

export async function posSummary(db: Db, posId: string): Promise<PosSummary> {
  const [stock, [money], [paid]] = await Promise.all([
    stockByCourse(db, posId),
    db
      .select({
        sold: sql<number>`count(*)::int`,
        activated: sql<number>`count(*) filter (where ${courseCodes.status} = 'USED')::int`,
        gross: sql<number>`coalesce(sum(${courseCodes.salePriceDzd}), 0)::int`,
        commission: sql<number>`coalesce(sum(${courseCodes.commissionDzd}), 0)::int`
      })
      .from(courseCodes)
      .where(and(eq(courseCodes.posId, posId), isNull(courseCodes.cancelledAt))),
    db.select({ total: sql<number>`coalesce(sum(${posPayments.amountDzd}), 0)::int` }).from(posPayments).where(eq(posPayments.posId, posId))
  ])
  const ids = [...stock.keys()]
  const titles = ids.length ? await db.select({ id: courses.id, title: courses.title }).from(courses).where(inArray(courses.id, ids)) : []
  const prices = await Promise.all(ids.map((id) => bundlePriceOf(db, id).then((b) => [id, b.priceDzd] as const).catch(() => [id, 0] as const)))
  const priceBy = new Map(prices)
  const gross = money?.gross ?? 0
  const commission = money?.commission ?? 0
  const paidDzd = paid?.total ?? 0
  return {
    stock: ids.map((id) => {
      const s = stock.get(id)!
      return { courseId: id, courseTitle: titles.find((t) => t.id === id)?.title ?? '—', sent: s.sent, sold: s.sold, remaining: s.sent - s.sold, priceDzd: priceBy.get(id) ?? 0 }
    }),
    soldCount: money?.sold ?? 0,
    activatedCount: money?.activated ?? 0,
    grossDzd: gross,
    commissionDzd: commission,
    owedDzd: gross - commission - paidDzd,
    paidDzd
  }
}

/** تسديد من النقطة للمنصة — للمشرف وحده */
export async function recordPosPayment(db: Db, actor: Actor, posId: string, input: { amountDzd: number; note?: string | null }): Promise<void> {
  assertRole(actor, 'SUPER_ADMIN')
  const pos = await loadPos(db, posId)
  if (!Number.isInteger(input.amountDzd) || input.amountDzd <= 0 || input.amountDzd > 100_000_000) throw new AppError('VALIDATION', { field: 'amountDzd' })
  await db.insert(posPayments).values({ posId: pos.id, amountDzd: input.amountDzd, note: input.note?.trim().slice(0, 300) || null, createdByUserId: actor.userId })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'pos.payment', entityType: 'point_of_sale', entityId: pos.id, newValue: { amountDzd: input.amountDzd } })
}

export async function listPosPayments(db: Db, actor: Actor, posId: string) {
  assertPartnerStaff(actor)
  return db.select({ id: posPayments.id, amountDzd: posPayments.amountDzd, note: posPayments.note, createdAt: posPayments.createdAt }).from(posPayments).where(eq(posPayments.posId, posId)).orderBy(desc(posPayments.createdAt)).limit(100)
}

/* ───────────── القوائم ───────────── */

export interface PosListItem {
  id: string
  name: string
  wilayaName: string | null
  phone: string | null
  status: string
  listed: boolean
  commissionDzd: number
  members: number
  remaining: number
  soldCount: number
  owedDzd: number
}

export async function listPointsOfSale(db: Db, actor: Actor): Promise<PosListItem[]> {
  assertPartnerStaff(actor)
  const rows = await db
    .select({ p: pointsOfSale, wilayaName: wilayas.nameAr, wilayaCode: wilayas.code })
    .from(pointsOfSale)
    .leftJoin(wilayas, eq(wilayas.id, pointsOfSale.wilayaId))
    .orderBy(asc(wilayas.code), asc(pointsOfSale.name))
  const out: PosListItem[] = []
  for (const r of rows) {
    const [s, [m]] = await Promise.all([posSummary(db, r.p.id), db.select({ n: sql<number>`count(*)::int` }).from(posMembers).where(eq(posMembers.posId, r.p.id))])
    out.push({ id: r.p.id, name: r.p.name, wilayaName: r.wilayaName, phone: r.p.phone, status: r.p.status, listed: r.p.listed, commissionDzd: r.p.commissionDzd, members: m?.n ?? 0, remaining: s.stock.reduce((a, x) => a + x.remaining, 0), soldCount: s.soldCount, owedDzd: s.owedDzd })
  }
  return out
}

export async function getPointOfSale(db: Db, actor: Actor, posId: string) {
  assertPartnerStaff(actor)
  const pos = await loadPos(db, posId)
  const [summary, members, [w]] = await Promise.all([
    posSummary(db, pos.id),
    db
      .select({ userId: users.id, fullName: profiles.fullName, phone: profiles.phone, status: users.status, lastLoginAt: users.lastLoginAt })
      .from(posMembers)
      .innerJoin(users, eq(users.id, posMembers.userId))
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(posMembers.posId, pos.id))
      .orderBy(asc(posMembers.createdAt)),
    pos.wilayaId ? db.select({ name: wilayas.nameAr }).from(wilayas).where(eq(wilayas.id, pos.wilayaId)).limit(1) : Promise.resolve([] as { name: string }[])
  ])
  return { pos, wilayaName: w?.name ?? null, summary, members }
}

/** صفحة «نقاط البيع» العامة: النقاط الفعّالة الظاهرة، مرتّبة حسب الولاية (بلا أرقام مالية) */
export async function publicPointsOfSale(db: Db): Promise<{ wilaya: string; items: { id: string; name: string; address: string | null; phone: string | null }[] }[]> {
  const rows = await db
    .select({ id: pointsOfSale.id, name: pointsOfSale.name, address: pointsOfSale.address, phone: pointsOfSale.phone, wilayaName: wilayas.nameAr, wilayaCode: wilayas.code })
    .from(pointsOfSale)
    .leftJoin(wilayas, eq(wilayas.id, pointsOfSale.wilayaId))
    .where(and(eq(pointsOfSale.status, 'ACTIVE'), eq(pointsOfSale.listed, true)))
    .orderBy(asc(wilayas.code), asc(pointsOfSale.name))
  const groups = new Map<string, { id: string; name: string; address: string | null; phone: string | null }[]>()
  for (const r of rows) {
    const key = r.wilayaName ? `${r.wilayaCode} — ${r.wilayaName}` : 'ولايات أخرى'
    groups.set(key, [...(groups.get(key) ?? []), { id: r.id, name: r.name, address: r.address, phone: r.phone }])
  }
  return [...groups.entries()].map(([wilaya, items]) => ({ wilaya, items }))
}

export async function hasPublicPointsOfSale(db: Db): Promise<boolean> {
  const [r] = await db.select({ id: pointsOfSale.id }).from(pointsOfSale).where(and(eq(pointsOfSale.status, 'ACTIVE'), eq(pointsOfSale.listed, true))).limit(1)
  return Boolean(r)
}

/** واجهة نقطة البيع: النقطة، مخزونها، ملخّصها، وأكوادها */
export async function posHome(db: Db, actor: Actor) {
  const pos = await posOfMember(db, actor)
  const [summary, codes] = await Promise.all([posSummary(db, pos.id), listPosCodes(db, actor, pos.id, 50)])
  return { pos: { id: pos.id, name: pos.name, status: pos.status, commissionDzd: pos.commissionDzd }, summary, codes }
}
