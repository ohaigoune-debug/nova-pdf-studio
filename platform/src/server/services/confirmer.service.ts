import { and, desc, eq, gte, sql } from 'drizzle-orm'
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

/** كل تغيير حالة قام به موظف (من سجلّ التدقيق الذي يكتبه محرّك الحالات): من، متى، أي طلب، من أي حالة إلى أي حالة */
export async function listConfirmerActivity(db: Db, actor: Actor, limit = 100) {
  assertRole(actor, 'SUPER_ADMIN')
  const rows = await db
    .select({ id: auditLogs.id, at: auditLogs.createdAt, employeeId: users.id, employeeName: profiles.fullName, employeeEmail: users.email, orderId: auditLogs.entityId, orderNumber: orders.number, oldValue: auditLogs.oldValue, newValue: auditLogs.newValue })
    .from(auditLogs)
    .innerJoin(users, eq(users.id, auditLogs.actorUserId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .leftJoin(orders, eq(orders.id, auditLogs.entityId))
    .where(and(eq(auditLogs.action, 'store.order_status'), eq(users.role, 'CONFIRMER')))
    .orderBy(desc(auditLogs.createdAt))
    .limit(Math.min(Math.max(Math.trunc(limit), 1), 300))
  return rows.map((r) => ({
    id: r.id,
    at: r.at,
    employeeId: r.employeeId,
    employee: r.employeeName ?? r.employeeEmail,
    orderId: r.orderId,
    orderNumber: r.orderNumber,
    from: (r.oldValue as { status?: string } | null)?.status ?? null,
    to: (r.newValue as { status?: string } | null)?.status ?? null,
    reason: (r.newValue as { reason?: string | null } | null)?.reason ?? null
  }))
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
