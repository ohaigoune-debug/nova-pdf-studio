'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { writeAudit } from '@/server/lib/audit'
import { AppError, isAppError } from '@/server/lib/errors'
import { clearGuiddiniConfig, getGuiddiniConfig, guiddiniTest, saveGuiddiniConfig } from '@/server/lib/guiddini'

/** المشرف: لصق مفاتيح eFawtara App Key / App Secret (السرّ يُختم ولا يعود إلى المتصفح؛ تركه فارغًا يُبقي السابق) */
export async function saveGuiddiniAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = z
    .object({ baseUrl: z.string().trim().max(200), appKey: z.string().trim().min(8, 'المفتاح App Key قصير').max(300), appSecret: z.string().trim().max(500), enabled: z.boolean() })
    .safeParse({ baseUrl: fd.get('baseUrl') ?? '', appKey: fd.get('appKey') ?? '', appSecret: fd.get('appSecret') ?? '', enabled: fd.get('enabled') === 'on' })
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    const db = await getDb()
    const saved = await saveGuiddiniConfig(db, parsed.data)
    await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'payment.settings', entityType: 'settings', entityId: null, newValue: { baseUrl: saved.baseUrl, enabled: parsed.data.enabled, secretChanged: Boolean(parsed.data.appSecret) } })
    return undefined
  })
  if (r.ok) revalidatePath('/admin/settings/payment')
  return r
}

/** اختبار المفاتيح المحفوظة عند eFawtara دون إنشاء أي معاملة. للمشرف وحده: الرسالة تحمل رمز البوابة وسببها. */
export async function testGuiddiniAction(): Promise<ActionResult> {
  let reason: string | null = null
  const r = await runAction(async () => {
    await requireRole('SUPER_ADMIN')
    const c = await getGuiddiniConfig(await getDb())
    if (!c) throw new AppError('PAYMENT_NOT_CONFIGURED')
    try {
      await guiddiniTest(c)
    } catch (err) {
      if (isAppError(err) && err.details) {
        const d = err.details as { httpStatus?: unknown; code?: unknown; detail?: unknown }
        reason = [d.httpStatus, d.code, d.detail].filter((x) => x !== null && x !== undefined && x !== '').join(' · ') || null
      }
      throw err
    }
    return undefined
  })
  if (!r.ok && reason) return { ok: false, error: { ...r.error, message: `${r.error.message} (${reason})` } }
  return r
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
