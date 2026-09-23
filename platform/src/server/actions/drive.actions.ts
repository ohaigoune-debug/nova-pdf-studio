'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { RATE_LIMITS, checkRateLimit } from '@/server/lib/rate-limit'
import { clearDriveSource, setDriveSource, type DriveSource } from '@/server/services/drive-source.service'

const linkSchema = z.object({ url: z.string().trim().min(10, 'الصق رابط مجلد Google Drive') })

/** ربط مجلد Drive مصدراً وحيداً للتمارين المولَّدة */
export async function linkDriveAction(_prev: ActionResult<DriveSource> | null, formData: FormData): Promise<ActionResult<DriveSource>> {
  const parsed = linkSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER')
    const db = await getDb()
    // كل ربط يقرأ المجلد من Google: يُحدّ كطلبات الذكاء الاصطناعي
    await checkRateLimit(db, { scope: 'drive-link', subject: actor.userId, ...RATE_LIMITS.aiRequest })
    return setDriveSource(db, actor, parsed.data.url)
  })
  if (result.ok) revalidatePath('/teacher/settings')
  return result
}

export async function unlinkDriveAction(): Promise<ActionResult> {
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER')
    await clearDriveSource(await getDb(), actor)
    return undefined
  })
  if (result.ok) revalidatePath('/teacher/settings')
  return result
}
