'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { runAction } from '@/server/lib/action-result'
import { setCodReceived } from '@/server/services/cod-money.service'

/** «استلمتُ» / «تراجع» على طرد مسلَّم */
export async function codReceivedAction(fd: FormData): Promise<void> {
  const id = String(fd.get('orderId') ?? '')
  const on = fd.get('on') === '1'
  const r = await runAction(async () => {
    await setCodReceived(await getDb(), await requireRole('SUPER_ADMIN'), id, on)
    return undefined
  })
  if (r.ok) revalidatePath('/admin/revenue')
}
