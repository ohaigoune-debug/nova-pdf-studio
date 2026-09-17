'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { createTeacher, setUserStatus } from '@/server/services/admin.service'

const teacherSchema = z.object({
  fullName: z.string().trim().min(3, 'أدخل الاسم الكامل'),
  email: z.string().trim().email('أدخل بريداً صحيحاً'),
  phone: z.string().trim().optional(),
  password: z.string().min(8, 'كلمة السر 8 أحرف على الأقل'),
  workspaceName: z.string().trim().optional(),
  subject: z.string().trim().optional()
})

export async function createTeacherAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = teacherSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    await createTeacher(await getDb(), actor, parsed.data)
    return undefined
  })
  if (!result.ok) return result
  revalidatePath('/admin/teachers')
  redirect('/admin/teachers')
}

export async function setUserStatusAction(userId: string, status: 'ACTIVE' | 'DISABLED'): Promise<ActionResult> {
  const result = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    await setUserStatus(await getDb(), actor, userId, status)
    return undefined
  })
  if (result.ok) revalidatePath('/admin', 'layout')
  return result
}
