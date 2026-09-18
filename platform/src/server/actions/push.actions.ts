'use server'

import { z } from 'zod'
import { requireActor, requestMeta } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { removePushSubscription, savePushSubscription } from '@/server/services/push.service'

const subSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(80).max(200), auth: z.string().min(16).max(64) })
})

export async function subscribePushAction(input: unknown): Promise<ActionResult<{ id: string | null }>> {
  const parsed = subSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => {
    const actor = await requireActor()
    const meta = await requestMeta()
    const r = await savePushSubscription(await getDb(), actor, { ...parsed.data, userAgent: meta.userAgent })
    return { id: r.id }
  })
}

export async function unsubscribePushAction(endpoint: string): Promise<ActionResult<{ removed: boolean }>> {
  const parsed = z.string().url().max(2000).safeParse(endpoint)
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => {
    const actor = await requireActor()
    return { removed: await removePushSubscription(await getDb(), actor, parsed.data) }
  })
}
