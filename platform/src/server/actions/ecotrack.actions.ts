'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { errorMessage } from '@/i18n'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { getLocale } from '@/i18n/server'
import { failValidation, ok, runAction, type ActionResult } from '@/server/lib/action-result'
import { isAppError } from '@/server/lib/errors'
import { kickJobsSoon } from '@/server/jobs/kick'
import { TelegramError, saveTelegramConfig, sendTelegram, type TelegramConfig } from '@/server/lib/telegram'
import { callPairingUrl, saveCallConfirm, type CallConfirmConfig } from '@/server/services/call-confirm.service'
import { cancelEcotrackParcel, saveEcotrackSettings, sendOrderToEcotrack, syncEcotrackFees, syncNow, type EcotrackStatus, type EcotrackSyncSummary } from '@/server/services/ecotrack.service'

const uuid = z.string().uuid()

/**
 * كـrunAction لكن رسالة الخطأ تحمل سبب الطرف الخارجي (EcoTrack/تيليغرام/SuiviSMS) بدل «خطأ داخلي»:
 * المشرف يحتاج أن يرى «رفضت EcoTrack الرمز (401)» ليصحّح.
 */
async function runExternal<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn()
    kickJobsSoon()
    return ok(data)
  } catch (e) {
    const locale = await getLocale()
    if (isAppError(e)) {
      const detail = typeof e.details?.message === 'string' ? ` — ${e.details.message}` : ''
      return { ok: false, error: { code: e.code, message: `${errorMessage(e.code, locale)}${detail}` } }
    }
    return { ok: false, error: { code: 'VALIDATION', message: e instanceof Error ? e.message.slice(0, 300) : errorMessage('INTERNAL', locale) } }
  }
}

function revalidateStore() {
  revalidatePath('/admin/store')
  revalidatePath('/admin/store/confirm')
  revalidatePath('/admin/delivery')
}

/* ───────────── EcoTrack ───────────── */

export async function saveEcotrackAction(_prev: ActionResult<EcotrackStatus> | null, fd: FormData): Promise<ActionResult<EcotrackStatus>> {
  const parsed = z
    .object({ baseUrl: z.string().trim().min(4, 'أدخل رابط المنصّة').max(200), apiToken: z.string().trim().max(600).optional(), enabled: z.coerce.boolean(), autoSend: z.coerce.boolean() })
    .safeParse({ baseUrl: fd.get('baseUrl') ?? '', apiToken: String(fd.get('apiToken') ?? '').trim() || undefined, enabled: fd.get('enabled') === 'on', autoSend: fd.get('autoSend') === 'on' })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runExternal(async () => saveEcotrackSettings(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data))
  if (result.ok) revalidateStore()
  return result
}

export async function clearEcotrackAction(): Promise<ActionResult> {
  const result = await runAction(async () => {
    await saveEcotrackSettings(await getDb(), await requireRole('SUPER_ADMIN'), { baseUrl: 'x', apiToken: '', enabled: false, autoSend: false })
    return undefined
  })
  if (result.ok) revalidateStore()
  return result
}

export async function syncEcotrackFeesAction(): Promise<ActionResult<{ count: number }>> {
  const result = await runExternal(async () => syncEcotrackFees(await getDb(), await requireRole('SUPER_ADMIN')))
  if (result.ok) {
    revalidateStore()
    revalidatePath('/store/cart')
  }
  return result
}

export async function syncEcotrackNowAction(): Promise<ActionResult<EcotrackSyncSummary>> {
  const result = await runAction(async () => syncNow(await getDb(), await requireRole('SUPER_ADMIN')))
  if (result.ok) revalidateStore()
  return result
}

/** «إرسال إلى EcoTrack» من صف الطلب */
export async function sendToEcotrackAction(orderId: string): Promise<ActionResult<{ tracking: string }>> {
  const parsed = uuid.safeParse(orderId)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runExternal(async () => sendOrderToEcotrack(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data))
  if (result.ok) {
    revalidateStore()
    revalidatePath(`/store/orders/${orderId}`)
  }
  return result
}

export async function cancelEcotrackParcelAction(orderId: string): Promise<ActionResult<{ ok: boolean }>> {
  const parsed = uuid.safeParse(orderId)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runExternal(async () => ({ ok: await cancelEcotrackParcel(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data) }))
  if (result.ok) revalidateStore()
  return result
}

/* ───────────── التأكيد بالمكالمة ───────────── */

export type CallConfirmView = Omit<CallConfirmConfig, 'secret'> & { pairingUrl: string | null }

export async function saveCallConfirmAction(_prev: ActionResult<CallConfirmView> | null, fd: FormData): Promise<ActionResult<CallConfirmView>> {
  const parsed = z
    .object({ enabled: z.boolean(), number: z.string().trim().max(24), windowHours: z.coerce.number().refine((n): n is 24 | 72 | 168 => n === 24 || n === 72 || n === 168, 'النافذة 24 أو 72 أو 168 ساعة'), autoReject: z.boolean(), rotate: z.boolean() })
    .safeParse({ enabled: fd.get('enabled') === 'on', number: fd.get('number') ?? '', windowHours: fd.get('windowHours') ?? 72, autoReject: fd.get('autoReject') === 'on', rotate: fd.get('rotate') === '1' })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const cfg = await saveCallConfirm(await getDb(), await requireRole('SUPER_ADMIN'), { enabled: parsed.data.enabled, number: parsed.data.number, windowHours: parsed.data.windowHours, autoReject: parsed.data.autoReject }, { rotateSecret: parsed.data.rotate })
    const { secret, ...rest } = cfg
    return { ...rest, pairingUrl: callPairingUrl(secret, process.env.APP_URL) }
  })
  if (result.ok) revalidatePath('/admin/store/confirm')
  return result
}

/* ───────────── تيليغرام ───────────── */

export async function saveTelegramAction(_prev: ActionResult<TelegramConfig> | null, fd: FormData): Promise<ActionResult<TelegramConfig>> {
  const parsed = z.object({ enabled: z.boolean(), chatId: z.string().trim().max(40), token: z.string().trim().max(120).optional() }).safeParse({ enabled: fd.get('enabled') === 'on', chatId: fd.get('chatId') ?? '', token: String(fd.get('token') ?? '').trim() || undefined })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runExternal(async () => {
    await requireRole('SUPER_ADMIN')
    return saveTelegramConfig(await getDb(), parsed.data)
  })
  if (result.ok) revalidatePath('/admin/settings')
  return result
}

export async function clearTelegramAction(): Promise<ActionResult> {
  const result = await runAction(async () => {
    await requireRole('SUPER_ADMIN')
    await saveTelegramConfig(await getDb(), { enabled: false, chatId: '', token: '' })
    return undefined
  })
  if (result.ok) revalidatePath('/admin/settings')
  return result
}

export async function testTelegramAction(): Promise<ActionResult<{ sent: boolean }>> {
  return runExternal(async () => {
    await requireRole('SUPER_ADMIN')
    const sent = await sendTelegram(await getDb(), '✅ مدرسة: إشعارات تيليغرام تعمل.', { throwOnError: true })
    if (!sent) throw new TelegramError('فعّل البوت واحفظ الرمز ومعرّف المحادثة أولاً')
    return { sent }
  })
}
