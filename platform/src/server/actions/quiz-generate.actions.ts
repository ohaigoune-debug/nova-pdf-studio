'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { kickWorker } from '@/server/jobs/runner'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { RATE_LIMITS, checkRateLimit } from '@/server/lib/rate-limit'
import { QUESTION_TYPES, requestQuizGeneration } from '@/server/services/quiz-generate.service'

const schema = z.object({
  title: z.string().trim().max(200).optional(),
  topic: z.string().trim().max(200).optional(),
  count: z.coerce.number().int().min(3).max(20).default(10),
  driveLinks: z.string().optional(),
  useLinkedFolder: z.literal('on').optional()
})

/** طلب توليد اختبار من المصادر المختارة — مهمة خلفية، والنتيجة مسودة وإشعار */
export async function requestQuizGenerationAction(_prev: ActionResult<{ jobId: string }> | null, fd: FormData): Promise<ActionResult<{ jobId: string }>> {
  const parsed = schema.safeParse(Object.fromEntries(fd))
  if (!parsed.success) return failValidation(parsed.error)
  const uuids = (k: string) => fd.getAll(k).map(String).filter((v) => /^[0-9a-f-]{36}$/.test(v))
  const types = fd.getAll('questionTypes').map(String).filter((v): v is (typeof QUESTION_TYPES)[number] => (QUESTION_TYPES as readonly string[]).includes(v))
  const driveLinks = (parsed.data.driveLinks ?? '')
    .split(/\s+/)
    .map((l) => l.trim())
    .filter(Boolean)
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER')
    const db = await getDb()
    await checkRateLimit(db, { scope: 'ai-request', subject: actor.userId, ...RATE_LIMITS.aiRequest })
    return requestQuizGeneration(db, actor, {
      title: parsed.data.title,
      topic: parsed.data.topic,
      count: parsed.data.count,
      questionTypes: types,
      groupIds: uuids('groupIds'),
      fileIds: uuids('fileIds'),
      driveLinks,
      useLinkedFolder: parsed.data.useLinkedFolder === 'on'
    })
  })
  if (result.ok) {
    kickWorker(getDb)
    revalidatePath('/teacher/quizzes')
  }
  return result
}
