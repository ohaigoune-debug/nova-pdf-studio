import { desc, eq } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { profiles, users } from '@/server/db/schema'
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
