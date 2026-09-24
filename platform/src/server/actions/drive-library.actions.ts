'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { DraftFromSourceOutput } from '@/server/ai/types'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { VISIBILITIES } from '@/server/db/schema/enums'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { RATE_LIMITS, checkRateLimit } from '@/server/lib/rate-limit'
import { draftFromDriveFile, publishExplanation } from '@/server/services/drive-library.service'

type Draft = Omit<DraftFromSourceOutput, 'raw'> & { fileName: string; viewUrl: string }

/** مسودة من ملف في مجلد Drive — تُعرض للأستاذ ليراجعها، لا تُحفظ ولا تُنشر هنا */
export async function draftFromDriveAction(fileId: string, mode: 'assignment' | 'explanation'): Promise<ActionResult<Draft>> {
  const parsed = z.object({ fileId: z.string().min(10).max(200), mode: z.enum(['assignment', 'explanation']) }).safeParse({ fileId, mode })
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => {
    const actor = await requireRole('TEACHER')
    const db = await getDb()
    await checkRateLimit(db, { scope: 'ai-request', subject: actor.userId, ...RATE_LIMITS.aiRequest })
    return draftFromDriveFile(db, actor, parsed.data.fileId, parsed.data.mode)
  })
}

const explanationSchema = z.object({
  title: z.string().trim().min(3, 'أدخل عنواناً'),
  summary: z.string().trim().max(600).optional(),
  body: z.string().trim().min(20, 'الشرح قصير جداً'),
  sourceUrl: z.string().url().optional().or(z.literal('')),
  visibility: z.enum(VISIBILITIES).default('STUDENTS_ONLY'),
  intent: z.enum(['publish', 'draft']).default('draft')
})

/** الأستاذ راجع الشرح وعدّله: يُنشر للتلاميذ، أو يُحفظ مسودة */
export async function publishExplanationAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = explanationSchema.safeParse(Object.fromEntries(fd))
  if (!parsed.success) return failValidation(parsed.error)
  const groupIds = fd.getAll('groupIds').map(String).filter((v) => /^[0-9a-f-]{36}$/.test(v))
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER')
    return publishExplanation(await getDb(), actor, {
      title: parsed.data.title,
      summary: parsed.data.summary ?? '',
      body: parsed.data.body,
      sourceUrl: parsed.data.sourceUrl || null,
      visibility: parsed.data.visibility,
      groupIds,
      publish: parsed.data.intent === 'publish'
    })
  })
  if (!result.ok) return result
  revalidatePath('/teacher/content')
  redirect(`/teacher/content/${result.data.id}/edit`)
}
