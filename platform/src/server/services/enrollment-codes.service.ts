import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { enrollmentCodeBatches, enrollmentCodes, profiles, students, users } from '@/server/db/schema'
import type { CodeStatus } from '@/server/db/schema/enums'
import type { Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { codePrefix, generateEnrollmentCode, hashEnrollmentCode } from '@/server/lib/codes'
import { AppError } from '@/server/lib/errors'
import { assertGroupAccess } from './groups.service'

export interface GenerateCodesInput {
  groupId: string
  count: number
  expiresAt?: Date | null
  label?: string | null
}

export interface GeneratedCode {
  id: string
  code: string
  expiresAt: Date | null
}

/**
 * يولّد أكواداً فريدة. الكود الصريح يُرجَع مرة واحدة فقط هنا (للطباعة/التصدير)؛
 * قاعدة البيانات تحفظ الـhash والبادئة فقط.
 */
export async function generateCodes(db: Db, actor: Actor, input: GenerateCodesInput) {
  const g = await assertGroupAccess(db, actor, input.groupId)
  const count = Math.floor(input.count)
  if (!Number.isFinite(count) || count < 1 || count > 500) throw new AppError('VALIDATION', { field: 'count' })

  return db.transaction(async (tx) => {
    const [batch] = await tx
      .insert(enrollmentCodeBatches)
      .values({ workspaceId: g.workspaceId, groupId: g.id, label: input.label ?? null, count, createdByUserId: actor.userId })
      .returning({ id: enrollmentCodeBatches.id })
    if (!batch) throw new AppError('INTERNAL')

    const generated: GeneratedCode[] = []
    const seen = new Set<string>()
    // حلقة مع إعادة المحاولة عند التصادم (نادر جداً: 31^7 احتمال)
    while (generated.length < count) {
      const code = generateEnrollmentCode()
      if (seen.has(code)) continue
      seen.add(code)
      try {
        const [row] = await tx
          .insert(enrollmentCodes)
          .values({
            workspaceId: g.workspaceId,
            groupId: g.id,
            batchId: batch.id,
            codeHash: hashEnrollmentCode(code),
            codePrefix: codePrefix(code),
            expiresAt: input.expiresAt ?? null,
            createdByUserId: actor.userId
          })
          .returning({ id: enrollmentCodes.id })
        if (row) generated.push({ id: row.id, code, expiresAt: input.expiresAt ?? null })
      } catch (err) {
        // تصادم hash → أعد المحاولة بكود آخر
        if (String(err).includes('unique')) continue
        throw err
      }
    }

    await writeAudit(tx, {
      actorUserId: actor.userId,
      workspaceId: g.workspaceId,
      action: 'codes.generate',
      entityType: 'enrollment_code_batch',
      entityId: batch.id,
      newValue: { groupId: g.id, count, label: input.label ?? null, expiresAt: input.expiresAt?.toISOString() ?? null }
    })
    return { batchId: batch.id, codes: generated, groupName: g.name }
  })
}

export async function listCodes(db: Db, actor: Actor, groupId: string, status?: CodeStatus) {
  const g = await assertGroupAccess(db, actor, groupId)
  return db
    .select({
      id: enrollmentCodes.id,
      codePrefix: enrollmentCodes.codePrefix,
      status: enrollmentCodes.status,
      expiresAt: enrollmentCodes.expiresAt,
      usedAt: enrollmentCodes.usedAt,
      createdAt: enrollmentCodes.createdAt,
      batchId: enrollmentCodes.batchId,
      batchLabel: enrollmentCodeBatches.label,
      usedByName: profiles.fullName,
      usedByEmail: users.email
    })
    .from(enrollmentCodes)
    .leftJoin(enrollmentCodeBatches, eq(enrollmentCodeBatches.id, enrollmentCodes.batchId))
    .leftJoin(students, eq(students.id, enrollmentCodes.usedByStudentId))
    .leftJoin(users, eq(users.id, students.userId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(enrollmentCodes.groupId, g.id), status ? eq(enrollmentCodes.status, status) : undefined))
    .orderBy(desc(enrollmentCodes.createdAt))
}

export async function listBatches(db: Db, actor: Actor, groupId: string) {
  const g = await assertGroupAccess(db, actor, groupId)
  return db
    .select()
    .from(enrollmentCodeBatches)
    .where(eq(enrollmentCodeBatches.groupId, g.id))
    .orderBy(desc(enrollmentCodeBatches.createdAt))
}

export async function disableCode(db: Db, actor: Actor, codeId: string) {
  const [c] = await db.select().from(enrollmentCodes).where(eq(enrollmentCodes.id, codeId)).limit(1)
  if (!c) throw new AppError('NOT_FOUND')
  await assertGroupAccess(db, actor, c.groupId)
  if (c.status !== 'ACTIVE') throw new AppError('VALIDATION', { reason: 'code not active' })
  await db.transaction(async (tx) => {
    await tx.update(enrollmentCodes).set({ status: 'DISABLED', disabledAt: new Date() }).where(eq(enrollmentCodes.id, c.id))
    await writeAudit(tx, {
      actorUserId: actor.userId,
      workspaceId: c.workspaceId,
      action: 'codes.disable',
      entityType: 'enrollment_code',
      entityId: c.id,
      oldValue: { status: c.status },
      newValue: { status: 'DISABLED' }
    })
  })
}

/** إلغاء دفعة كاملة: تعطيل كل الأكواد غير المستعملة فيها. */
export async function cancelBatch(db: Db, actor: Actor, batchId: string) {
  const [b] = await db.select().from(enrollmentCodeBatches).where(eq(enrollmentCodeBatches.id, batchId)).limit(1)
  if (!b) throw new AppError('NOT_FOUND')
  await assertGroupAccess(db, actor, b.groupId)
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(enrollmentCodes)
      .set({ status: 'DISABLED', disabledAt: new Date() })
      .where(and(eq(enrollmentCodes.batchId, b.id), inArray(enrollmentCodes.status, ['ACTIVE', 'EXPIRED'])))
      .returning({ id: enrollmentCodes.id })
    await tx.update(enrollmentCodeBatches).set({ cancelledAt: new Date() }).where(and(eq(enrollmentCodeBatches.id, b.id), isNull(enrollmentCodeBatches.cancelledAt)))
    await writeAudit(tx, {
      actorUserId: actor.userId,
      workspaceId: b.workspaceId,
      action: 'codes.cancel_batch',
      entityType: 'enrollment_code_batch',
      entityId: b.id,
      newValue: { disabled: updated.length }
    })
    return { disabled: updated.length }
  })
}

export function codesToCsv(rows: { code: string; expiresAt: Date | null }[], groupName: string): string {
  const header = 'code,group,expires_at'
  const lines = rows.map((r) => `${r.code},"${groupName.replace(/"/g, '""')}",${r.expiresAt ? r.expiresAt.toISOString() : ''}`)
  return '﻿' + [header, ...lines].join('\n')
}
