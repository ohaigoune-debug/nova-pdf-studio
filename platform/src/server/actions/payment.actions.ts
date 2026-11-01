'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { writeAudit } from '@/server/lib/audit'
import { AppError } from '@/server/lib/errors'
import { clearGuiddiniConfig, getGuiddiniConfig, guiddiniTest, saveGuiddiniConfig } from '@/server/lib/guiddini'

/** المشرف: لصق مفاتيح Guiddini (السرّ يُختم ولا يعود إلى المتصفح؛ تركه فارغًا يُبقي السابق) */
export async function saveGuiddiniAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = z
    .object({ baseUrl: z.string().trim().max(200), appKey: z.string().trim().min(8, 'المفتاح x-app-key قصير').max(300), appSecret: z.string().trim().max(500), enabled: z.boolean() })
    .safeParse({ baseUrl: fd.get('baseUrl') ?? '', appKey: fd.get('appKey') ?? '', appSecret: fd.get('appSecret') ?? '', enabled: fd.get('enabled') === 'on' })
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    const db = await getDb()
    await saveGuiddiniConfig(db, parsed.data)
    await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'payment.settings', entityType: 'settings', entityId: null, newValue: { baseUrl: parsed.data.baseUrl, enabled: parsed.data.enabled, secretChanged: Boolean(parsed.data.appSecret) } })
    return undefined
  })
  if (r.ok) revalidatePath('/admin/settings/payment')
  return r
}

/** اختبار المفاتيح المحفوظة عند Guiddini دون إنشاء أي معاملة */
export async function testGuiddiniAction(): Promise<ActionResult> {
  return runAction(async () => {
    await requireRole('SUPER_ADMIN')
    const c = await getGuiddiniConfig(await getDb())
    if (!c) throw new AppError('PAYMENT_NOT_CONFIGURED')
    await guiddiniTest(c)
    return undefined
  })
}

export async function clearGuiddiniAction(): Promise<ActionResult> {
  const r = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    const db = await getDb()
    await clearGuiddiniConfig(db)
    await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'payment.settings', entityType: 'settings', entityId: null, newValue: { cleared: true } })
    return undefined
  })
  if (r.ok) revalidatePath('/admin/settings/payment')
  return r
}
