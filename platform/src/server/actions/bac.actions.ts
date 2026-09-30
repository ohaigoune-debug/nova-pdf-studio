'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { kickWorker } from '@/server/jobs/runner'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { requestBacSync } from '@/server/services/bac-sync.service'

const schema = z.object({ mode: z.enum(['all', 'refresh', 'trial']), subjects: z.array(z.string().max(40)).max(20).optional() })

/** يبدأ جلب بكالوريات DzExams في الخلفية (المدير فقط) */
export async function startBacSyncAction(input: { mode: 'all' | 'refresh' | 'trial'; subjects?: string[] }): Promise<ActionResult<{ jobId: string; reused: boolean }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    return requestBacSync(await getDb(), actor, parsed.data)
  })
  if (result.ok) {
    kickWorker(getDb)
    revalidatePath('/admin/curriculum')
  }
  return result
}
