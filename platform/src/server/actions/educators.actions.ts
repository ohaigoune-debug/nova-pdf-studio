'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { kickWorker } from '@/server/jobs/runner'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { approveEducator, rejectEducator, requestChannelSync, requestEducatorResolve, resetEducator } from '@/server/services/educators.service'

const uuid = z.string().uuid()

function done<T>(r: ActionResult<T>): ActionResult<T> {
  if (r.ok) {
    kickWorker(getDb)
    revalidatePath('/admin/educators')
  }
  return r
}

/** البحث عن قنوات كل الأساتذة الذين لم يُحلّوا بعد (مهمة خلفية؛ تكلّف حصة يوتيوب) */
export async function resolveEducatorsAction(): Promise<ActionResult<{ jobId: string; reused: boolean; toResolve: number }>> {
  return done(await runAction(async () => requestEducatorResolve(await getDb(), await requireRole('SUPER_ADMIN'))))
}

export async function approveEducatorAction(educatorId: string, channelId: string): Promise<ActionResult<{ jobId: string }>> {
  const parsed = z.object({ educatorId: uuid, channelId: z.string().regex(/^UC[A-Za-z0-9_-]{20,}$/) }).safeParse({ educatorId, channelId })
  if (!parsed.success) return failValidation(parsed.error)
  return done(await runAction(async () => approveEducator(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data.educatorId, parsed.data.channelId)))
}

export async function rejectEducatorAction(educatorId: string): Promise<ActionResult> {
  const parsed = uuid.safeParse(educatorId)
  if (!parsed.success) return failValidation(parsed.error)
  return done(
    await runAction(async () => {
      await rejectEducator(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data)
      return undefined
    })
  )
}

export async function resetEducatorAction(educatorId: string): Promise<ActionResult> {
  const parsed = uuid.safeParse(educatorId)
  if (!parsed.success) return failValidation(parsed.error)
  return done(
    await runAction(async () => {
      await resetEducator(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data)
      return undefined
    })
  )
}

export async function syncEducatorAction(educatorId: string): Promise<ActionResult<{ jobId: string }>> {
  const parsed = uuid.safeParse(educatorId)
  if (!parsed.success) return failValidation(parsed.error)
  return done(await runAction(async () => requestChannelSync(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data)))
}
