'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { addLessonComment, moderateLessonComment, setLessonQuiz } from '@/server/services/lesson-extras.service'

/** التلميذ: تعليق تحت الحصة (ينتظر موافقة الأستاذ) */
export async function addLessonCommentAction(slug: string, body: string): Promise<ActionResult<{ id: string }>> {
  const parsed = z.object({ slug: z.string().min(1).max(300), body: z.string().trim().min(2, 'اكتب تعليقاً').max(1000, '1000 حرف كحدّ أقصى') }).safeParse({ slug, body })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => addLessonComment(await getDb(), await requireRole('STUDENT'), parsed.data.slug, parsed.data.body))
  if (result.ok) revalidatePath(`/student/lessons/${slug}`)
  return result
}

/** الأستاذ: موافقة (مع ردّ اختياري) أو رفض */
export async function moderateLessonCommentAction(id: string, decision: 'APPROVED' | 'REJECTED', reply?: string | null): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid(), decision: z.enum(['APPROVED', 'REJECTED']), reply: z.string().max(1000).nullish() }).safeParse({ id, decision, reply })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await moderateLessonComment(await getDb(), await requireRole('TEACHER', 'SUPER_ADMIN'), parsed.data.id, parsed.data.decision, parsed.data.reply ?? null)
    return undefined
  })
  if (result.ok) revalidatePath('/teacher/comments')
  return result
}

/** الأستاذ: ربط اختبار QCM بالحصة (أو فكّه) */
export async function setLessonQuizAction(contentId: string, quizId: string | null): Promise<ActionResult> {
  const parsed = z.object({ contentId: z.string().uuid(), quizId: z.string().uuid().nullable() }).safeParse({ contentId, quizId: quizId || null })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await setLessonQuiz(await getDb(), await requireRole('TEACHER', 'SUPER_ADMIN'), parsed.data.contentId, parsed.data.quizId)
    return undefined
  })
  if (result.ok) revalidatePath(`/teacher/content/${contentId}/edit`)
  return result
}
