'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireActor, requireRole, requestMeta } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { writeAudit } from '@/server/lib/audit'
import { AppError } from '@/server/lib/errors'
import { RATE_LIMITS, checkRateLimit } from '@/server/lib/rate-limit'
import { clearSmsKey, saveSmsKey, testSmsSend } from '@/server/lib/sms'
import { isPhoneVerified, OTP_RESEND_COOLDOWN_S, requestOtp, verifyOtp } from '@/server/services/otp.service'
import { setStorePolicy } from '@/server/services/store.service'

const phoneSchema = z.string().trim().min(9).max(20)
/** الأغراض المتاحة من المتصفح: التسجيل والطلب فقط (المطالبة والاسترجاع لهما مساراتهما) */
const clientPurpose = z.enum(['REGISTER', 'ORDER'])

/** طلب رمز تحقق لرقم الهاتف (مسجّل الدخول فقط). يعيد مهلة إعادة الإرسال بالثواني. */
export async function requestOtpAction(input: { phone: string; purpose: 'REGISTER' | 'ORDER' }): Promise<ActionResult<{ cooldown: number }>> {
  const parsed = z.object({ phone: phoneSchema, purpose: clientPurpose }).safeParse(input)
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => {
    const actor = await requireActor()
    const db = await getDb()
    const meta = await requestMeta()
    await checkRateLimit(db, { scope: 'otp-user', subject: actor.userId, limit: 10, windowSeconds: 60 * 60 })
    await requestOtp(db, { phone: parsed.data.phone, purpose: parsed.data.purpose, userId: actor.userId, ip: meta.ip ?? null })
    return { cooldown: OTP_RESEND_COOLDOWN_S }
  })
}

/** التحقق من الرمز. للتسجيل يُعلَّم الهاتف مؤكَّداً في ملف المستخدم. */
export async function verifyOtpAction(input: { phone: string; purpose: 'REGISTER' | 'ORDER'; code: string }): Promise<ActionResult<{ verified: true }>> {
  const parsed = z.object({ phone: phoneSchema, purpose: clientPurpose, code: z.string().trim().min(4).max(8) }).safeParse(input)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireActor()
    const db = await getDb()
    await checkRateLimit(db, { scope: 'otp-verify', subject: actor.userId, limit: 30, windowSeconds: 10 * 60 })
    await verifyOtp(db, { phone: parsed.data.phone, purpose: parsed.data.purpose, code: parsed.data.code, userId: actor.userId })
    return { verified: true as const }
  })
  if (result.ok && parsed.data.purpose === 'REGISTER') {
    revalidatePath('/student')
    revalidatePath('/student/profile')
  }
  return result
}

export async function phoneVerificationStatusAction(): Promise<ActionResult<{ verified: boolean; phone: string | null }>> {
  return runAction(async () => isPhoneVerified(await getDb(), (await requireActor()).userId))
}

/* ------------------------------ إعدادات المشرف ------------------------------ */

export async function setStorePolicyAction(input: { requireOtp: boolean }): Promise<ActionResult<{ requireOtp: boolean }>> {
  const parsed = z.object({ requireOtp: z.boolean() }).safeParse(input)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => setStorePolicy(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data))
  if (result.ok) {
    revalidatePath('/admin/settings')
    revalidatePath('/store/cart')
  }
  return result
}

export async function saveSmsKeyAction(_prev: ActionResult<{ hint: string }> | null, fd: FormData): Promise<ActionResult<{ hint: string }>> {
  const parsed = z.object({ apiKey: z.string().trim().min(8, 'أدخل المفتاح كاملاً').max(400), sender: z.string().trim().max(11).optional() }).safeParse({ apiKey: fd.get('apiKey') ?? '', sender: fd.get('sender') ?? undefined })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    const db = await getDb()
    const r = await saveSmsKey(db, parsed.data.apiKey, parsed.data.sender || null)
    await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'settings.sms_key', entityType: 'settings', entityId: null, newValue: { hint: r.hint, sender: parsed.data.sender || null } })
    return r
  })
  if (result.ok) revalidatePath('/admin/settings')
  return result
}

export async function clearSmsKeyAction(): Promise<ActionResult> {
  const result = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    const db = await getDb()
    await clearSmsKey(db)
    await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'settings.sms_key.clear', entityType: 'settings', entityId: null })
    return undefined
  })
  if (result.ok) revalidatePath('/admin/settings')
  return result
}

/** رسالة اختبار إلى رقم يدخله المشرف للتحقّق من المزوّد والمفتاح */
export async function testSmsAction(input: { phone: string }): Promise<ActionResult<{ provider: string }>> {
  const parsed = z.object({ phone: phoneSchema }).safeParse(input)
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    const db = await getDb()
    await checkRateLimit(db, { scope: 'sms-test', subject: actor.userId, ...RATE_LIMITS.passwordReset })
    const phone = parsed.data.phone.replace(/[\s\-().]/g, '')
    if (!/^0[5-7]\d{8}$/.test(phone)) throw new AppError('VALIDATION', { field: 'phone' })
    let r: { provider: string }
    try {
      r = await testSmsSend(db, phone)
    } catch (e) {
      if (process.env.NODE_ENV !== 'test') console.error('[sms] test send failed:', e instanceof Error ? e.message : e)
      throw new AppError('SMS_SEND_FAILED')
    }
    await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'settings.sms_test', entityType: 'settings', entityId: null, newValue: { provider: r.provider, phoneTail: phone.slice(-4) } })
    return r
  })
}
