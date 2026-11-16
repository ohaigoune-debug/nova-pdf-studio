'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { writeAudit } from '@/server/lib/audit'
import { clearZoomSdkCredentials, saveZoomSdkCredentials } from '@/server/lib/zoom'

const credsSchema = z.object({
  sdkKey: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{10,100}$/, 'Client ID غير صحيح: انسخه كما هو من صفحة التطبيق في Zoom Marketplace'),
  sdkSecret: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{16,200}$/, 'Client Secret غير صحيح: انسخه كما هو من صفحة التطبيق في Zoom Marketplace')
})

/** يحفظ اعتمادات Zoom Meeting SDK مختومة؛ لا تعود إلى المتصفح بعدها (يُعرض آخر 4 أحرف فقط) */
export async function saveZoomSdkAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = credsSchema.safeParse(Object.fromEntries(fd))
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    const db = await getDb()
    await saveZoomSdkCredentials(db, parsed.data)
    await writeAudit(db, { actorUserId: actor.userId, action: 'live.zoom_sdk_save', entityType: 'settings', entityId: null, newValue: { sdkKeyHint: parsed.data.sdkKey.slice(-4) } })
    return undefined
  })
  if (r.ok) revalidatePath('/admin/live')
  return r
}

export async function clearZoomSdkAction(): Promise<ActionResult> {
  const r = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    const db = await getDb()
    await clearZoomSdkCredentials(db)
    await writeAudit(db, { actorUserId: actor.userId, action: 'live.zoom_sdk_clear', entityType: 'settings', entityId: null })
    return undefined
  })
  if (r.ok) revalidatePath('/admin/live')
  return r
}
