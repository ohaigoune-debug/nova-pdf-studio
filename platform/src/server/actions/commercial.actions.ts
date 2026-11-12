'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { fail, runAction, type ActionResult } from '@/server/lib/action-result'
import { COMMERCIAL_BOUNDS, type CommercialKey, type CommercialSettings, setCommercialSettings } from '@/server/services/commercial-settings.service'

/** الإعدادات التجارية (البند ب5): كل حقل عدد صحيح بين حدّيه، والخطأ يظهر على الحقل نفسه */
export async function setCommercialSettingsAction(_prev: ActionResult<CommercialSettings> | null, fd: FormData): Promise<ActionResult<CommercialSettings>> {
  const input: Partial<Record<CommercialKey, number>> = {}
  const errors: Record<string, string> = {}
  for (const k of Object.keys(COMMERCIAL_BOUNDS) as CommercialKey[]) {
    const raw = String(fd.get(k) ?? '').trim()
    if (raw === '') continue
    const v = Number(raw)
    const [min, max] = COMMERCIAL_BOUNDS[k]
    if (!Number.isInteger(v) || v < min || v > max) errors[k] = `عدد صحيح بين ${min} و${max}`
    else input[k] = v
  }
  if (Object.keys(errors).length) return fail('VALIDATION', errors)
  const result = await runAction(async () => setCommercialSettings(await getDb(), await requireRole('SUPER_ADMIN'), input))
  if (result.ok) {
    revalidatePath('/admin/settings')
    revalidatePath('/admin/store')
  }
  return result
}
