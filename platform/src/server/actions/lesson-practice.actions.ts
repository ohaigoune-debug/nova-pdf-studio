'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { LESSON_PRACTICE_KINDS } from '@/server/db/schema'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import {
  addLessonPractice,
  listLessonPractice,
  moveLessonPractice,
  removeLessonPractice,
  searchPracticeBank,
  startLessonPractice,
  type LessonPracticeAdminItem,
  type PracticeBankItem
} from '@/server/services/lesson-practice.service'

const uuid = z.string().uuid()
const EDITORS = ['SUPER_ADMIN', 'CONTENT_UPLOADER', 'TEACHER'] as const

const searchSchema = z.object({
  kind: z.enum(LESSON_PRACTICE_KINDS),
  q: z.string().trim().max(80).optional(),
  gradeCode: z.string().trim().max(8).optional(),
  subjectCode: z.string().trim().max(16).optional(),
  examKind: z.enum(['BAC', 'DEVOIR', 'TEST']).optional()
})

/** نافذة «أضف من بنك مدرسة»: بحث في دروس PLAY أو البكالوريات والفروض */
export async function searchPracticeBankAction(payload: z.input<typeof searchSchema>): Promise<ActionResult<PracticeBankItem[]>> {
  const parsed = searchSchema.safeParse(payload)
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => searchPracticeBank(await getDb(), await requireRole(...EDITORS), parsed.data))
}

const refSchema = z.object({ courseId: uuid, lessonId: uuid })

export async function listLessonPracticeAction(payload: z.input<typeof refSchema>): Promise<ActionResult<LessonPracticeAdminItem[]>> {
  const parsed = refSchema.safeParse(payload)
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => listLessonPractice(await getDb(), await requireRole(...EDITORS), parsed.data.courseId, parsed.data.lessonId))
}

function revalidateLesson(courseId: string) {
  revalidatePath(`/admin/courses/${courseId}`, 'layout')
  revalidatePath('/student', 'layout')
}

const addSchema = refSchema.extend({ kind: z.enum(LESSON_PRACTICE_KINDS), refId: uuid })

export async function addLessonPracticeAction(payload: z.input<typeof addSchema>): Promise<ActionResult<{ linkId: string }>> {
  const parsed = addSchema.safeParse(payload)
  if (!parsed.success) return failValidation(parsed.error)
  const d = parsed.data
  const r = await runAction(async () => addLessonPractice(await getDb(), await requireRole(...EDITORS), d.courseId, d.lessonId, { kind: d.kind, refId: d.refId }))
  if (r.ok) revalidateLesson(d.courseId)
  return r
}

const linkSchema = refSchema.extend({ linkId: uuid })

export async function removeLessonPracticeAction(payload: z.input<typeof linkSchema>): Promise<ActionResult> {
  const parsed = linkSchema.safeParse(payload)
  if (!parsed.success) return failValidation(parsed.error)
  const d = parsed.data
  const r = await runAction(async () => {
    await removeLessonPractice(await getDb(), await requireRole(...EDITORS), d.courseId, d.lessonId, d.linkId)
    return undefined
  })
  if (r.ok) revalidateLesson(d.courseId)
  return r
}

const moveSchema = linkSchema.extend({ direction: z.enum(['up', 'down']) })

export async function moveLessonPracticeAction(payload: z.input<typeof moveSchema>): Promise<ActionResult> {
  const parsed = moveSchema.safeParse(payload)
  if (!parsed.success) return failValidation(parsed.error)
  const d = parsed.data
  const r = await runAction(async () => {
    await moveLessonPractice(await getDb(), await requireRole(...EDITORS), d.courseId, d.lessonId, d.linkId, d.direction)
    return undefined
  })
  if (r.ok) revalidateLesson(d.courseId)
  return r
}

/** التلميذ: «العب» / «ابدأ» تحت الدرس */
export async function startLessonPracticeAction(payload: { linkId: string }): Promise<ActionResult<{ href: string }>> {
  const parsed = z.object({ linkId: uuid }).safeParse(payload)
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => startLessonPractice(await getDb(), await requireRole('STUDENT'), parsed.data.linkId))
}
