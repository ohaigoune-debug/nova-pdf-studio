'use server'

import { revalidatePath } from 'next/cache'
import { requireActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { runAction, type ActionResult } from '@/server/lib/action-result'
import { markAllRead, markRead } from '@/server/services/notifications.service'

export async function markAllReadAction(): Promise<ActionResult> {
  const result = await runAction(async () => {
    const actor = await requireActor()
    await markAllRead(await getDb(), actor.userId)
    return undefined
  })
  if (result.ok) revalidatePath('/', 'layout')
  return result
}

export async function markReadAction(id: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    const actor = await requireActor()
    await markRead(await getDb(), actor.userId, id)
    return undefined
  })
  if (result.ok) revalidatePath('/', 'layout')
  return result
}
