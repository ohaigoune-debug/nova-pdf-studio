'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { runAction, type ActionResult } from '@/server/lib/action-result'
import { blockPhone, liftPhone } from '@/server/services/cod-blocks.service'

/** المشرف: منع رقم من الدفع عند الاستلام يدويًا (أو إعادة منع رقم أُعفي) */
export async function blockPhoneAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const r = await runAction(async () => {
    await blockPhone(await getDb(), await requireRole('SUPER_ADMIN'), String(fd.get('phone') ?? ''), String(fd.get('note') ?? ''))
    return undefined
  })
  if (r.ok) revalidatePath('/admin/store/cod-blocks')
  return r
}

/** المشرف: إعفاء رقم (أرجع لسبب مقبول) */
export async function liftPhoneAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const r = await runAction(async () => {
    await liftPhone(await getDb(), await requireRole('SUPER_ADMIN'), String(fd.get('phone') ?? ''), String(fd.get('note') ?? ''))
    return undefined
  })
  if (r.ok) revalidatePath('/admin/store/cod-blocks')
  return r
}
