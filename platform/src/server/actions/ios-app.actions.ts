'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { runAction, type ActionResult } from '@/server/lib/action-result'
import { errorMessage } from '@/i18n'
import { parseAppStoreLink } from '@/lib/ios-app'
import { setIosAppLink } from '@/server/services/ios-app.service'

/** المشرف: رابط تطبيق الآيفون في App Store (فارغ = إخفاء الزر) */
export async function saveIosAppLinkAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const raw = String(fd.get('url') ?? '').trim()
  if (raw && !parseAppStoreLink(raw)) {
    return { ok: false, error: { code: 'VALIDATION', message: errorMessage('VALIDATION'), fieldErrors: { url: 'الصق رابط التطبيق من App Store كما هو (يبدأ بـ https://apps.apple.com ويحتوي على id ورقم)' } } }
  }
  const r = await runAction(async () => {
    await setIosAppLink(await getDb(), await requireRole('SUPER_ADMIN'), raw)
    return undefined
  })
  if (r.ok) {
    revalidatePath('/admin/settings/apps')
    revalidatePath('/', 'layout')
  }
  return r
}
