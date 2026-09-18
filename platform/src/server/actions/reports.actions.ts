'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { kickWorker } from '@/server/jobs/runner'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { REPORT_KINDS, requestReport } from '@/server/services/reports.service'

const schema = z.object({ kind: z.enum(REPORT_KINDS), groupId: z.string().uuid().optional().or(z.literal('')).transform((v) => (v ? v : null)) })

export async function requestReportAction(_prev: ActionResult<{ jobId: string }> | null, fd: FormData): Promise<ActionResult<{ jobId: string }>> {
  const parsed = schema.safeParse(Object.fromEntries(fd))
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER')
    return requestReport(await getDb(), actor, parsed.data)
  })
  if (result.ok) {
    kickWorker(getDb)
    revalidatePath('/teacher/reports')
  }
  return result
}
