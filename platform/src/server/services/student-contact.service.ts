import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from '@/server/db/connect'
import { students } from '@/server/db/schema'
import { studentIdOf, type Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'

export const guardianContactSchema = z.object({
  guardianPhone: z.string().trim().transform((v) => v.replace(/[\s\-().]/g, '').replace(/^\+?213/, '0')).refine((v) => /^0[5-7]\d{8}$/.test(v), 'أدخل رقم هاتف جزائري صحيحاً (05 / 06 / 07)')
})

/** Contact only: never changes the student's verified phone, identity, or entitlements. */
export async function updateGuardianContact(db: Db, actor: Actor, input: unknown): Promise<void> {
  const studentId = studentIdOf(actor)
  const parsed = guardianContactSchema.safeParse(input)
  if (!parsed.success) throw new AppError('VALIDATION')
  const updated = await db.update(students).set({ guardianPhone: parsed.data.guardianPhone }).where(and(eq(students.id, studentId), eq(students.userId, actor.userId))).returning({ id: students.id })
  if (!updated.length) throw new AppError('FORBIDDEN')
}
