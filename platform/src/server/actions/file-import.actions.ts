'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { VISIBILITIES } from '@/server/db/schema/enums'
import { kickWorker } from '@/server/jobs/runner'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { RATE_LIMITS, checkRateLimit } from '@/server/lib/rate-limit'
import { requestFileImport } from '@/server/services/file-import.service'

const optionalUuid = z
  .string()
  .optional()
  .transform((v) => (v && /^[0-9a-f-]{36}$/.test(v) ? v : null))

const schema = z.object({
  driveLinks: z.string().optional(),
  organize: z.literal('on').optional(),
  publish: z.literal('on').optional(),
  levelId: optionalUuid,
  streamId: optionalUuid,
  visibility: z.enum(VISIBILITIES).default('STUDENTS_ONLY')
})

export async function requestFileImportAction(_prev: ActionResult<{ jobId: string }> | null, fd: FormData): Promise<ActionResult<{ jobId: string }>> {
  const parsed = schema.safeParse(Object.fromEntries(fd))
  if (!parsed.success) return failValidation(parsed.error)
  const uuids = (k: string) => fd.getAll(k).map(String).filter((v) => /^[0-9a-f-]{36}$/.test(v))
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER')
    const db = await getDb()
    await checkRateLimit(db, { scope: 'ai-request', subject: actor.userId, ...RATE_LIMITS.aiRequest })
    return requestFileImport(db, actor, {
      fileIds: uuids('fileIds'),
      driveLinks: (parsed.data.driveLinks ?? '').split(/\s+/).filter(Boolean),
      organize: parsed.data.organize === 'on',
      publish: parsed.data.publish === 'on',
      levelId: parsed.data.levelId,
      streamId: parsed.data.streamId,
      visibility: parsed.data.visibility,
      groupIds: uuids('groupIds')
    })
  })
  if (result.ok) {
    kickWorker(getDb)
    revalidatePath('/teacher/content')
  }
  return result
}
