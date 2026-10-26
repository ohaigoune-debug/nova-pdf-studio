'use server'

import { after } from 'next/server'
import { z } from 'zod'
import { clearSessionCookie, requestMeta } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { requestPhonePasswordReset, resetPasswordByPhone } from '@/server/services/phone-recovery.service'

const phone = z.string().trim().min(9).max(20)

/** رد عام لا يكشف ما إذا كان الرقم مرتبطًا بحساب. */
export async function requestPhonePasswordResetAction(input: { phone: string }): Promise<ActionResult<{ cooldown: number }>> {
  const parsed = z.object({ phone }).safeParse(input)
  if (!parsed.success) return failValidation(parsed.error)
  // الإرسال بعد الرد: لا يكشف التوقيت أن الرقم مرتبط بحساب
  return runAction(async () => requestPhonePasswordReset(await getDb(), parsed.data.phone, await requestMeta(), { defer: (task) => after(task) }))
}

const resetSchema = z.object({
  phone,
  code: z.string().trim().min(4).max(8),
  password: z.string().min(8, 'كلمة السر 8 أحرف على الأقل'),
  confirm: z.string()
}).refine((data) => data.password === data.confirm, { path: ['confirm'], message: 'كلمتا السر غير متطابقتين' })

export async function resetPasswordByPhoneAction(input: { phone: string; code: string; password: string; confirm: string }): Promise<ActionResult<{ done: true }>> {
  const parsed = resetSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => {
    await resetPasswordByPhone(await getDb(), parsed.data, await requestMeta())
    await clearSessionCookie()
    return { done: true as const }
  })
}
