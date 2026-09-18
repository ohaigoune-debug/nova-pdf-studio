import { and, desc, eq, inArray } from 'drizzle-orm'
import { hashPassword, isStrongEnough, verifyPassword } from '@/server/auth/password'
import { createSession, revokeAllSessions } from '@/server/auth/session'
import type { Db } from '@/server/db/connect'
import { assistantCodes, profiles, teacherAssistants, teacherWorkspaces, teachers, users } from '@/server/db/schema'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeActivity, writeAudit } from '@/server/lib/audit'
import { codePrefix, generateEnrollmentCode, hashEnrollmentCode, normalizeEnrollmentCode } from '@/server/lib/codes'
import { AppError, assertUuid } from '@/server/lib/errors'
import type { RequestMeta } from './auth.service'
import { notify } from './notifications.service'

/**
 * مساعد الأستاذ:
 * - الأستاذ يولّد كوداً مرتبطاً ببريد المساعد (يُعرض مرة واحدة).
 * - المساعد يفتح صفحة الانضمام، يدخل الكود + بريده + كلمة سر ⇒ حساب بدور ASSISTANT مرتبط بمساحة الأستاذ فوراً.
 * - صلاحياته: الحضور والغياب والسكانر والحصص وقوائم الطلاب — لا تصحيح ولا محتوى ولا إدارة أفواج.
 * - الإلغاء ينهي جلساته فوراً ويُسقط workspaceId من الفاعل.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeEmail(email: string): string {
  const e = email.trim().toLowerCase()
  if (!EMAIL_RE.test(e)) throw new AppError('VALIDATION', { field: 'email' })
  return e
}

function teacherOf(actor: Actor): { teacherId: string; workspaceId: string } {
  assertRole(actor, 'TEACHER')
  if (!actor.teacherId || !actor.workspaceId) throw new AppError('FORBIDDEN')
  return { teacherId: actor.teacherId, workspaceId: actor.workspaceId }
}

export interface AssistantCodeResult {
  id: string
  code: string
  email: string
  expiresAt: Date | null
}

/** الأستاذ يولّد كود دعوة لمساعد ببريد محدّد. كود واحد نشط لكل بريد في المساحة. */
export async function createAssistantCode(db: Db, actor: Actor, input: { email: string; expiresAt?: Date | null }): Promise<AssistantCodeResult> {
  const { teacherId, workspaceId } = teacherOf(actor)
  const email = normalizeEmail(input.email)
  if (email === actor.email.toLowerCase()) throw new AppError('VALIDATION', { field: 'email' })

  const [existingUser] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.email, email)).limit(1)
  if (existingUser && existingUser.role !== 'ASSISTANT') throw new AppError('ASSISTANT_EMAIL_TAKEN')
  if (existingUser) {
    const [active] = await db
      .select({ id: teacherAssistants.id, workspaceId: teacherAssistants.workspaceId })
      .from(teacherAssistants)
      .where(and(eq(teacherAssistants.userId, existingUser.id), eq(teacherAssistants.status, 'ACTIVE')))
      .limit(1)
    if (active) throw new AppError('ASSISTANT_ALREADY_ACTIVE')
  }

  return db.transaction(async (tx) => {
    // كود نشط واحد لكل بريد: نعطّل السابق
    await tx
      .update(assistantCodes)
      .set({ status: 'DISABLED', disabledAt: new Date() })
      .where(and(eq(assistantCodes.workspaceId, workspaceId), eq(assistantCodes.email, email), eq(assistantCodes.status, 'ACTIVE')))

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateEnrollmentCode()
      try {
        const [row] = await tx
          .insert(assistantCodes)
          .values({
            workspaceId,
            teacherId,
            email,
            codeHash: hashEnrollmentCode(code),
            codePrefix: codePrefix(code),
            expiresAt: input.expiresAt ?? null,
            createdByUserId: actor.userId
          })
          .returning({ id: assistantCodes.id })
        if (!row) throw new AppError('INTERNAL')
        await writeAudit(tx, {
          actorUserId: actor.userId,
          workspaceId,
          action: 'assistant.code_create',
          entityType: 'assistant_code',
          entityId: row.id,
          newValue: { email, expiresAt: input.expiresAt?.toISOString() ?? null }
        })
        return { id: row.id, code, email, expiresAt: input.expiresAt ?? null }
      } catch (err) {
        if (String(err).includes('unique')) continue
        throw err
      }
    }
    throw new AppError('INTERNAL')
  })
}

export interface JoinAssistantInput {
  code: string
  email: string
  fullName: string
  password: string
}

/**
 * انضمام المساعد بالكود (بلا جلسة مسبقة). يُنشئ حساب ASSISTANT أو يستعمل حساب ASSISTANT قائماً
 * (بعد التحقق من كلمة السر) إن لم تكن له عضوية نشطة. البريد يجب أن يطابق بريد الكود.
 */
export async function joinAsAssistant(db: Db, input: JoinAssistantInput, meta: RequestMeta = {}) {
  const code = normalizeEnrollmentCode(input.code)
  if (!/^[A-Z0-9]{3}-[A-Z0-9]{4}$/.test(code)) throw new AppError('CODE_INVALID')
  const email = normalizeEmail(input.email)
  const fullName = input.fullName.trim()
  if (fullName.length < 3) throw new AppError('VALIDATION', { field: 'fullName' })
  const codeHash = hashEnrollmentCode(code)

  // انتهاء الصلاحية يُعلَّم خارج المعاملة (وإلا لتراجع التحديث مع رمي الخطأ)
  const [pre] = await db.select({ id: assistantCodes.id, status: assistantCodes.status, expiresAt: assistantCodes.expiresAt }).from(assistantCodes).where(eq(assistantCodes.codeHash, codeHash)).limit(1)
  if (pre && pre.status === 'ACTIVE' && pre.expiresAt && pre.expiresAt.getTime() < Date.now()) {
    await db.update(assistantCodes).set({ status: 'EXPIRED' }).where(and(eq(assistantCodes.id, pre.id), eq(assistantCodes.status, 'ACTIVE')))
    throw new AppError('CODE_EXPIRED')
  }

  const result = await db.transaction(async (tx) => {
    const [c] = await tx.select().from(assistantCodes).where(eq(assistantCodes.codeHash, codeHash)).for('update').limit(1)
    if (!c) throw new AppError('CODE_INVALID')
    if (c.status === 'USED') throw new AppError('CODE_USED')
    if (c.status === 'DISABLED') throw new AppError('CODE_DISABLED')
    if (c.status === 'EXPIRED' || (c.expiresAt && c.expiresAt.getTime() < Date.now())) throw new AppError('CODE_EXPIRED')
    if (c.email !== email) throw new AppError('ASSISTANT_EMAIL_MISMATCH')

    const [teacher] = await tx
      .select({ id: teachers.id, userId: teachers.userId, displayName: teachers.displayName, workspaceName: teacherWorkspaces.name, workspaceStatus: teacherWorkspaces.status })
      .from(teachers)
      .innerJoin(teacherWorkspaces, eq(teacherWorkspaces.id, teachers.workspaceId))
      .where(eq(teachers.id, c.teacherId))
      .limit(1)
    if (!teacher || teacher.workspaceStatus !== 'ACTIVE') throw new AppError('CODE_INVALID')

    const [existing] = await tx
      .select({ id: users.id, role: users.role, status: users.status, passwordHash: users.passwordHash, deletedAt: users.deletedAt })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    let userId: string
    if (!existing) {
      if (!isStrongEnough(input.password)) throw new AppError('WEAK_PASSWORD')
      const [u] = await tx
        .insert(users)
        .values({ email, passwordHash: hashPassword(input.password), role: 'ASSISTANT', lastLoginAt: new Date() })
        .returning({ id: users.id })
      if (!u) throw new AppError('INTERNAL')
      await tx.insert(profiles).values({ userId: u.id, fullName })
      await writeActivity(tx, { userId: u.id, workspaceId: c.workspaceId, event: 'auth.register_assistant' })
      userId = u.id
    } else {
      if (existing.role !== 'ASSISTANT' || existing.deletedAt) throw new AppError('ASSISTANT_EMAIL_TAKEN')
      if (existing.status !== 'ACTIVE') throw new AppError('ACCOUNT_DISABLED')
      if (!verifyPassword(input.password, existing.passwordHash)) throw new AppError('INVALID_CREDENTIALS')
      const [active] = await tx
        .select({ id: teacherAssistants.id })
        .from(teacherAssistants)
        .where(and(eq(teacherAssistants.userId, existing.id), eq(teacherAssistants.status, 'ACTIVE')))
        .limit(1)
      if (active) throw new AppError('ASSISTANT_ALREADY_ACTIVE')
      await tx.update(profiles).set({ fullName }).where(eq(profiles.userId, existing.id))
      await tx.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, existing.id))
      userId = existing.id
    }

    const [membership] = await tx
      .insert(teacherAssistants)
      .values({ workspaceId: c.workspaceId, teacherId: c.teacherId, userId, status: 'ACTIVE', joinedViaCodeId: c.id })
      .returning({ id: teacherAssistants.id })
    if (!membership) throw new AppError('INTERNAL')

    await tx.update(assistantCodes).set({ status: 'USED', usedAt: new Date(), usedByUserId: userId }).where(eq(assistantCodes.id, c.id))

    await notify(tx, {
      userId: teacher.userId,
      workspaceId: c.workspaceId,
      type: 'SYSTEM',
      title: `انضم ${fullName} كمساعد لك`,
      body: 'يمكنه الآن متابعة الحضور والغياب واستعمال السكانر.',
      link: '/teacher/assistants'
    })
    await notify(tx, {
      userId,
      workspaceId: c.workspaceId,
      type: 'SYSTEM',
      title: `أصبحت مساعداً للأستاذ ${teacher.displayName}`,
      body: 'من لوحتك يمكنك متابعة الحضور والغياب وفتح السكانر.',
      link: '/assistant'
    })
    await writeAudit(tx, {
      actorUserId: userId,
      workspaceId: c.workspaceId,
      action: 'assistant.join',
      entityType: 'teacher_assistant',
      entityId: membership.id,
      newValue: { codeId: c.id, teacherId: c.teacherId }
    })
    return { userId, membershipId: membership.id, teacherName: teacher.displayName, workspaceName: teacher.workspaceName }
  })

  const session = await createSession(db, { userId: result.userId, ...meta })
  return { ...result, session }
}

export interface AssistantListItem {
  id: string
  userId: string
  fullName: string
  email: string
  status: string
  joinedAt: Date
  revokedAt: Date | null
}

export interface PendingAssistantCode {
  id: string
  email: string
  codePrefix: string
  status: string
  expiresAt: Date | null
  createdAt: Date
}

/** مساعدو الأستاذ (النشطون والملغَون) + الأكواد التي لم تُستعمل بعد. */
export async function listAssistants(db: Db, actor: Actor): Promise<{ assistants: AssistantListItem[]; pendingCodes: PendingAssistantCode[] }> {
  const { workspaceId } = teacherOf(actor)
  const rows = await db
    .select({
      id: teacherAssistants.id,
      userId: teacherAssistants.userId,
      fullName: profiles.fullName,
      email: users.email,
      status: teacherAssistants.status,
      joinedAt: teacherAssistants.createdAt,
      revokedAt: teacherAssistants.revokedAt
    })
    .from(teacherAssistants)
    .innerJoin(users, eq(users.id, teacherAssistants.userId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(teacherAssistants.workspaceId, workspaceId))
    .orderBy(desc(teacherAssistants.createdAt))
  const pending = await db
    .select({
      id: assistantCodes.id,
      email: assistantCodes.email,
      codePrefix: assistantCodes.codePrefix,
      status: assistantCodes.status,
      expiresAt: assistantCodes.expiresAt,
      createdAt: assistantCodes.createdAt
    })
    .from(assistantCodes)
    .where(and(eq(assistantCodes.workspaceId, workspaceId), inArray(assistantCodes.status, ['ACTIVE', 'EXPIRED'])))
    .orderBy(desc(assistantCodes.createdAt))
  return {
    assistants: rows.map((r) => ({ ...r, fullName: r.fullName ?? r.email })),
    pendingCodes: pending.map((p) => ({ ...p, status: p.expiresAt && p.expiresAt.getTime() < Date.now() ? 'EXPIRED' : p.status }))
  }
}

/** إلغاء مساعد: العضوية REVOKED + إنهاء كل جلساته فوراً. لا حذف. */
export async function revokeAssistant(db: Db, actor: Actor, assistantId: string) {
  const { workspaceId } = teacherOf(actor)
  assertUuid(assistantId, 'ASSISTANT_NOT_FOUND')
  return db.transaction(async (tx) => {
    const [m] = await tx.select().from(teacherAssistants).where(eq(teacherAssistants.id, assistantId)).for('update').limit(1)
    if (!m || m.workspaceId !== workspaceId) throw new AppError('ASSISTANT_NOT_FOUND')
    if (m.status !== 'ACTIVE') throw new AppError('ASSISTANT_NOT_FOUND')
    await tx
      .update(teacherAssistants)
      .set({ status: 'REVOKED', revokedAt: new Date(), revokedByUserId: actor.userId })
      .where(eq(teacherAssistants.id, m.id))
    await revokeAllSessions(tx, m.userId)
    await notify(tx, {
      userId: m.userId,
      workspaceId,
      type: 'SYSTEM',
      title: 'تم إنهاء صلاحيتك كمساعد',
      body: 'لم تعد مرتبطاً بمساحة الأستاذ. تواصل معه إن كان ذلك خطأ.',
      link: '/assistant'
    })
    await writeAudit(tx, {
      actorUserId: actor.userId,
      workspaceId,
      action: 'assistant.revoke',
      entityType: 'teacher_assistant',
      entityId: m.id,
      oldValue: { status: 'ACTIVE' },
      newValue: { status: 'REVOKED' }
    })
    return { id: m.id }
  })
}

export async function disableAssistantCode(db: Db, actor: Actor, codeId: string) {
  const { workspaceId } = teacherOf(actor)
  assertUuid(codeId)
  const [c] = await db.select().from(assistantCodes).where(eq(assistantCodes.id, codeId)).limit(1)
  if (!c || c.workspaceId !== workspaceId) throw new AppError('NOT_FOUND')
  if (c.status !== 'ACTIVE' && c.status !== 'EXPIRED') throw new AppError('VALIDATION', { reason: 'code not active' })
  await db.transaction(async (tx) => {
    await tx.update(assistantCodes).set({ status: 'DISABLED', disabledAt: new Date() }).where(eq(assistantCodes.id, c.id))
    await writeAudit(tx, {
      actorUserId: actor.userId,
      workspaceId,
      action: 'assistant.code_disable',
      entityType: 'assistant_code',
      entityId: c.id,
      oldValue: { status: c.status },
      newValue: { status: 'DISABLED' }
    })
  })
}

export interface AssistantContext {
  membershipId: string
  teacherName: string
  workspaceName: string
  joinedAt: Date
}

/** سياق المساعد الحالي (اسم الأستاذ والمساحة) — null إذا أُلغيت عضويته. */
export async function getAssistantContext(db: Db, actor: Actor): Promise<AssistantContext | null> {
  assertRole(actor, 'ASSISTANT')
  const [row] = await db
    .select({
      membershipId: teacherAssistants.id,
      teacherName: teachers.displayName,
      workspaceName: teacherWorkspaces.name,
      joinedAt: teacherAssistants.createdAt
    })
    .from(teacherAssistants)
    .innerJoin(teachers, eq(teachers.id, teacherAssistants.teacherId))
    .innerJoin(teacherWorkspaces, eq(teacherWorkspaces.id, teacherAssistants.workspaceId))
    .where(and(eq(teacherAssistants.userId, actor.userId), eq(teacherAssistants.status, 'ACTIVE')))
    .limit(1)
  return row ?? null
}
