import { and, asc, eq, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { appSettings, courseProducts, courses, orderItems, orders, profiles, teacherPayouts, teacherWorkspaces } from '@/server/db/schema'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { ttlDelete, ttlMemo } from '@/server/lib/ttl-cache'
import { monthRange } from '@/lib/assistant-pay'
import { cleanTeacherShare, shareOf, type TeacherShareConfig } from '@/lib/teacher-share'

const KEY = 'teacher.share'
/** دفعات النصيب في teacher_payouts تُعرف بملاحظتها (الجدول نفسه لسوق الأساتذة المعطّل) */
const noteOf = (month: string) => `SHARE:${month}`

export async function getTeacherShareConfig(db: Db): Promise<TeacherShareConfig> {
  return ttlMemo(KEY, 15_000, async () => {
    const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, KEY)).limit(1)
    return cleanTeacherShare(row?.value)
  })
}

export async function setTeacherShareConfig(db: Db, actor: Actor, input: unknown): Promise<TeacherShareConfig> {
  assertRole(actor, 'SUPER_ADMIN')
  const before = await getTeacherShareConfig(db)
  const next = cleanTeacherShare(input)
  await db.insert(appSettings).values({ key: KEY, value: next }).onConflictDoUpdate({ target: appSettings.key, set: { value: next, updatedAt: new Date() } })
  ttlDelete(KEY)
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'settings.teacher_share', entityType: 'settings', entityId: null, oldValue: { ...before }, newValue: { ...next } })
  return next
}

export interface ShareLine {
  orderNumber: string
  deliveredAt: Date | null
  title: string
  amountDzd: number
  method: string
  card: boolean
  baseDzd: number
  shareDzd: number
}
export interface TeacherShareMonth {
  workspaceId: string
  teacherName: string
  partner: boolean
  month: string
  config: TeacherShareConfig
  lines: ShareLine[]
  card: { grossDzd: number; baseDzd: number; shareDzd: number }
  other: { grossDzd: number; shareDzd: number }
  totalShareDzd: number
  payout: { amountDzd: number; paidAt: Date | null } | null
}

/** مبيعات دورات مساحة في شهر (طلبات سُلّمت فيه)، بنصيب كلّ سطر */
async function salesLines(db: Db, workspaceIds: string[], month: string, cfg: TeacherShareConfig): Promise<Map<string, ShareLine[]>> {
  const range = monthRange(month)
  if (!range) throw new AppError('VALIDATION', { field: 'month' })
  const out = new Map<string, ShareLine[]>()
  if (!workspaceIds.length) return out
  // السطر يُنسب لدورته (course_id، مثبَّت وقت الشراء)؛ والطلبات القديمة بلا course_id لروابط المنتج (أقدم ربط)
  const own = await db.select({ id: courses.id, workspaceId: courses.workspaceId }).from(courses).where(inArray(courses.workspaceId, workspaceIds))
  const courseWs = new Map(own.map((c) => [c.id, c.workspaceId]))
  const links = courseWs.size
    ? await db.select({ productId: courseProducts.productId, courseId: courseProducts.courseId }).from(courseProducts).where(inArray(courseProducts.courseId, [...courseWs.keys()])).orderBy(asc(courseProducts.createdAt))
    : []
  const productWs = new Map<string, string>()
  for (const l of links) if (!productWs.has(l.productId)) productWs.set(l.productId, courseWs.get(l.courseId)!)
  if (!courseWs.size) return out
  const conds = [inArray(orderItems.courseId, [...courseWs.keys()])]
  if (productWs.size) conds.push(and(isNull(orderItems.courseId), inArray(orderItems.productId, [...productWs.keys()]))!)
  const rows = await db
    .select({ productId: orderItems.productId, courseId: orderItems.courseId, title: orderItems.title, line: orderItems.lineTotalDzd, number: orders.number, deliveredAt: orders.deliveredAt, method: orders.paymentMethod })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(or(...conds), eq(orders.status, 'DELIVERED'), gte(orders.deliveredAt, range.start), lt(orders.deliveredAt, range.end), sql`${orderItems.lineTotalDzd} > 0`))
    .orderBy(asc(orders.deliveredAt))
  for (const r of rows) {
    const ws = (r.courseId ? courseWs.get(r.courseId) : undefined) ?? (r.productId ? productWs.get(r.productId) : undefined)
    if (!ws) continue
    const s = shareOf(r.line, r.method, cfg)
    const list = out.get(ws) ?? []
    list.push({ orderNumber: r.number, deliveredAt: r.deliveredAt, title: r.title, amountDzd: r.line, method: r.method, card: s.card, baseDzd: s.baseDzd, shareDzd: s.shareDzd })
    out.set(ws, list)
  }
  return out
}

function summarize(lines: ShareLine[]) {
  const card = { grossDzd: 0, baseDzd: 0, shareDzd: 0 }
  const other = { grossDzd: 0, shareDzd: 0 }
  for (const l of lines) {
    if (l.card) {
      card.grossDzd += l.amountDzd
      card.baseDzd += l.baseDzd
      card.shareDzd += l.shareDzd
    } else {
      other.grossDzd += l.amountDzd
      other.shareDzd += l.shareDzd
    }
  }
  return { card, other, totalShareDzd: card.shareDzd + other.shareDzd }
}

async function payoutsFor(db: Db, workspaceIds: string[], month: string) {
  if (!workspaceIds.length) return new Map<string, { amountDzd: number; paidAt: Date | null }>()
  const rows = await db
    .select({ workspaceId: teacherPayouts.workspaceId, amountDzd: teacherPayouts.amountDzd, paidAt: teacherPayouts.paidAt })
    .from(teacherPayouts)
    .where(and(inArray(teacherPayouts.workspaceId, workspaceIds), eq(teacherPayouts.note, noteOf(month))))
  return new Map(rows.map((r) => [r.workspaceId, { amountDzd: r.amountDzd, paidAt: r.paidAt }]))
}

/** كشف شهر لأستاذ: الأستاذ يرى مساحته وحدها، والمالك أيّ مساحة */
export async function teacherShareMonth(db: Db, actor: Actor, input: { workspaceId?: string | null; month: string }): Promise<TeacherShareMonth> {
  let workspaceId: string
  if (actor.role === 'TEACHER') {
    if (!actor.workspaceId || (input.workspaceId && input.workspaceId !== actor.workspaceId)) throw new AppError('FORBIDDEN')
    workspaceId = actor.workspaceId
  } else {
    assertRole(actor, 'SUPER_ADMIN')
    assertUuid(input.workspaceId ?? null)
    workspaceId = input.workspaceId!
  }
  const cfg = await getTeacherShareConfig(db)
  const [[ws], lines, payouts] = await Promise.all([
    db.select({ name: teacherWorkspaces.name, ownerName: profiles.fullName }).from(teacherWorkspaces).leftJoin(profiles, eq(profiles.userId, teacherWorkspaces.ownerUserId)).where(eq(teacherWorkspaces.id, workspaceId)).limit(1),
    salesLines(db, [workspaceId], input.month, cfg),
    payoutsFor(db, [workspaceId], input.month)
  ])
  const partner = cfg.partners.includes(workspaceId)
  const l = partner ? (lines.get(workspaceId) ?? []) : []
  return { workspaceId, teacherName: ws?.ownerName || ws?.name || '', partner, month: input.month, config: cfg, lines: l, ...summarize(l), payout: payouts.get(workspaceId) ?? null }
}

export interface TeacherDueRow {
  workspaceId: string
  teacherName: string
  partner: boolean
  salesDzd: number
  shareDzd: number
  lines: number
  payout: { amountDzd: number; paidAt: Date | null } | null
}

/** المالك: كلّ الأساتذة (مساحاتهم) ومستحقّاتهم في الشهر */
export async function teacherDues(db: Db, actor: Actor, month: string): Promise<{ rows: TeacherDueRow[]; config: TeacherShareConfig; totalDueDzd: number }> {
  assertRole(actor, 'SUPER_ADMIN')
  const cfg = await getTeacherShareConfig(db)
  const wss = await db
    .select({ id: teacherWorkspaces.id, name: teacherWorkspaces.name, ownerName: profiles.fullName })
    .from(teacherWorkspaces)
    .leftJoin(profiles, eq(profiles.userId, teacherWorkspaces.ownerUserId))
    .where(eq(teacherWorkspaces.status, 'ACTIVE'))
    .orderBy(asc(teacherWorkspaces.createdAt))
  const ids = wss.map((w) => w.id)
  const [lines, payouts] = await Promise.all([salesLines(db, ids, month, cfg), payoutsFor(db, ids, month)])
  const rows = wss.map((w) => {
    const l = lines.get(w.id) ?? []
    const partner = cfg.partners.includes(w.id)
    return { workspaceId: w.id, teacherName: w.ownerName || w.name, partner, salesDzd: l.reduce((s, x) => s + x.amountDzd, 0), shareDzd: partner ? summarize(l).totalShareDzd : 0, lines: l.length, payout: payouts.get(w.id) ?? null }
  })
  return { rows, config: cfg, totalDueDzd: rows.reduce((s, r) => s + r.shareDzd, 0) }
}

/** المالك: «مدفوع» لنصيب أستاذ في شهر (يُحفظ المبلغ يوم الدفع) أو إلغاؤه */
export async function setTeacherSharePaid(db: Db, actor: Actor, workspaceId: string, month: string, paid: boolean): Promise<void> {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(workspaceId)
  const range = monthRange(month)
  if (!range) throw new AppError('VALIDATION', { field: 'month' })
  const [existing] = await db.select({ id: teacherPayouts.id, amountDzd: teacherPayouts.amountDzd }).from(teacherPayouts).where(and(eq(teacherPayouts.workspaceId, workspaceId), eq(teacherPayouts.note, noteOf(month)))).limit(1)
  if (paid) {
    if (existing) throw new AppError('PAYOUT_ALREADY_RECORDED')
    const m = await teacherShareMonth(db, actor, { workspaceId, month })
    const [row] = await db
      .insert(teacherPayouts)
      .values({ workspaceId, amountDzd: m.totalShareDzd, periodStart: range.start, periodEnd: range.end, status: 'PAID', paidAt: new Date(), note: noteOf(month), createdByUserId: actor.userId })
      .returning({ id: teacherPayouts.id })
    await writeAudit(db, { actorUserId: actor.userId, workspaceId, action: 'teacher.share_paid', entityType: 'teacher_payout', entityId: row!.id, newValue: { month, amountDzd: m.totalShareDzd } })
  } else {
    if (!existing) throw new AppError('NOT_FOUND')
    await db.delete(teacherPayouts).where(eq(teacherPayouts.id, existing.id))
    await writeAudit(db, { actorUserId: actor.userId, workspaceId, action: 'teacher.share_unpaid', entityType: 'teacher_payout', entityId: existing.id, oldValue: { month, amountDzd: existing.amountDzd } })
  }
}
