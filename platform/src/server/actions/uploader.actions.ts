'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { createContentUploader, setUploaderCourses } from '@/server/services/course-staff.service'

const courseIds = (fd: FormData) => fd.getAll('courseIds').filter((x): x is string => typeof x === 'string' && Boolean(x))

/** المشرف: حساب «رافع محتوى» جديد مع الدورات المسندة إليه */
export async function createUploaderAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = z
    .object({ email: z.string().trim().email('بريد غير صحيح').max(254), password: z.string().min(8, '8 أحرف على الأقل').max(200), fullName: z.string().trim().min(3, 'الاسم الكامل').max(120), phone: z.string().trim().min(9, 'رقم الهاتف').max(20), courseIds: z.array(z.string().uuid()).max(200) })
    .safeParse({ email: fd.get('email') ?? '', password: fd.get('password') ?? '', fullName: fd.get('fullName') ?? '', phone: fd.get('phone') ?? '', courseIds: courseIds(fd) })
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    await createContentUploader(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data)
    return undefined
  })
  if (r.ok) revalidatePath('/admin/employees')
  return r
}

/** المشرف: تعديل الدورات المسندة لرافع محتوى */
export async function setUploaderCoursesAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = z.object({ userId: z.string().uuid(), courseIds: z.array(z.string().uuid()).max(200) }).safeParse({ userId: fd.get('userId') ?? '', courseIds: courseIds(fd) })
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    await setUploaderCourses(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data.userId, parsed.data.courseIds)
    return undefined
  })
  if (r.ok) revalidatePath('/admin/employees')
  return r
}
