import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { auditLogs, orders, profiles, users } from '@/server/db/schema'
import { hashPassword, isStrongEnough } from '@/server/auth/password'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError } from '@/server/lib/errors'
import { normalizePhone } from './otp.service'

export interface CreateConfirmerInput {
  email: string
  password: string
  fullName: string
  phone: string
}

/** حساب موظف الطلبات بلا مساحة أستاذ أو ملف تلميذ؛ الدور لا يؤخذ من المتصفح. */
export async function createConfirmer(db: Db, actor: Actor, input: CreateConfirmerInput): Promise<{ userId: string }> {
  assertRole(actor, 'SUPER_ADMIN')
  const email = input.email.trim().toLowerCase()
  const fullName = input.fullName.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new AppError('VALIDATION', { field: 'email' })
  if (fullName.length < 3 || fullName.length > 120) throw new AppError('VALIDATION', { field: 'fullName' })
  if (!isStrongEnough(input.password)) throw new AppError('WEAK_PASSWORD')
  const phone = normalizePhone(input.phone)
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (existing) throw new AppError('EMAIL_TAKEN')
  return db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({ email, passwordHash: hashPassword(input.password), role: 'CONFIRMER' }).returning({ id: users.id })
    if (!user) throw new AppError('INTERNAL')
    await tx.insert(profiles).values({ userId: user.id, fullName, phone })
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId: null, action: 'confirmer.create', entityType: 'user', entityId: user.id, newValue: { role: 'CONFIRMER' } })
    return { userId: user.id }
  })
}

export async function listConfirmers(db: Db, actor: Actor) {
  assertRole(actor, 'SUPER_ADMIN')
  return db.select({ id: users.id, email: users.email, status: users.status, fullName: profiles.fullName, phone: profiles.phone, createdAt: users.createdAt })
    .from(users).leftJoin(profiles, eq(profiles.userId, users.id)).where(eq(users.role, 'CONFIRMER')).orderBy(desc(users.createdAt))
}

/** إجراءات الموظف المسجَّلة في التدقيق: الحالة، وتعديلات الطلب (قرار المالك 2026-10-28)، وكود التفعيل */
const ACTIVITY_ACTIONS = ['store.order_status', 'store.order_stream', 'store.order_amount', 'store.customer_ban', 'course.activation_code_sent'] as const
export type ConfirmerActivityKind = 'status' | 'stream' | 'amount' | 'ban' | 'code'
const KIND: Record<(typeof ACTIVITY_ACTIONS)[number], ConfirmerActivityKind> = { 'store.order_status': 'status', 'store.order_stream': 'stream', 'store.order_amount': 'amount', 'store.customer_ban': 'ban', 'course.activation_code_sent': 'code' }

/** كل ما قام به موظف (من سجلّ التدقيق): من، متى، أي طلب، وما الذي تغيّر */
export async function listConfirmerActivity(db: Db, actor: Actor, limit = 100) {
  assertRole(actor, 'SUPER_ADMIN')
  const rows = await db
    .select({ id: auditLogs.id, at: auditLogs.createdAt, action: auditLogs.action, employeeId: users.id, employeeName: profiles.fullName, employeeEmail: users.email, entityId: auditLogs.entityId, orderNumber: orders.number, oldValue: auditLogs.oldValue, newValue: auditLogs.newValue })
    .from(auditLogs)
    .innerJoin(users, eq(users.id, auditLogs.actorUserId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .leftJoin(orders, eq(orders.id, auditLogs.entityId))
    .where(and(inArray(auditLogs.action, [...ACTIVITY_ACTIONS]), eq(users.role, 'CONFIRMER')))
    .orderBy(desc(auditLogs.createdAt))
    .limit(Math.min(Math.max(Math.trunc(limit), 1), 300))
  return rows.map((r) => {
    const oldV = (r.oldValue ?? {}) as Record<string, unknown>
    const newV = (r.newValue ?? {}) as Record<string, unknown>
    const kind = KIND[r.action as (typeof ACTIVITY_ACTIONS)[number]] ?? 'status'
    const detail = kind === 'amount' ? `المبلغ ${String(oldV.totalDzd ?? '?')} ← ${String(newV.totalDzd ?? '?')} دج`
      : kind === 'stream' ? 'تغيير الشعبة'
        : kind === 'ban' ? 'حظر الزبون'
          : kind === 'code' ? 'كود تفعيل الدورة'
            : null
    return {
      id: r.id,
      at: r.at,
      kind,
      employeeId: r.employeeId,
      employee: r.employeeName ?? r.employeeEmail,
      // الحظر يُسجَّل على حساب الزبون؛ رقم الطلب محفوظ في القيمة الجديدة
      orderId: kind === 'ban' ? (typeof newV.orderId === 'string' ? newV.orderId : null) : r.entityId,
      orderNumber: kind === 'ban' ? (typeof newV.orderNumber === 'string' ? newV.orderNumber : null) : r.orderNumber ?? (typeof newV.orderNumber === 'string' ? newV.orderNumber : null),
      from: kind === 'status' ? ((oldV.status as string | undefined) ?? null) : null,
      to: kind === 'status' ? ((newV.status as string | undefined) ?? null) : null,
      detail,
      reason: (newV.reason as string | null | undefined) ?? null
    }
  })
}

/** ملخّص كل موظف منذ تاريخ: عدد الطلبات التي أكّدها أو ألغاها أو سجّل فيها «لا يردّ/لاحقاً» */
export async function confirmerStats(db: Db, actor: Actor, since: Date) {
  assertRole(actor, 'SUPER_ADMIN')
  const status = sql`${auditLogs.newValue}->>'status'`
  const rows = await db
    .select({
      employeeId: users.id,
      confirmed: sql<number>`(count(*) filter (where ${status} = 'CONFIRMED'))::int`,
      cancelled: sql<number>`(count(*) filter (where ${status} = 'CANCELLED'))::int`,
      followUp: sql<number>`(count(*) filter (where ${status} in ('NO_ANSWER', 'CALL_LATER')))::int`
    })
    .from(auditLogs)
    .innerJoin(users, eq(users.id, auditLogs.actorUserId))
    .where(and(eq(auditLogs.action, 'store.order_status'), eq(users.role, 'CONFIRMER'), gte(auditLogs.createdAt, since)))
    .groupBy(users.id)
  return new Map(rows.map((r) => [r.employeeId, { confirmed: Number(r.confirmed), cancelled: Number(r.cancelled), followUp: Number(r.followUp) }]))
}
