'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getLocale } from '@/i18n/server'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { fail, failValidation, ok, type ActionResult } from '@/server/lib/action-result'
import { isAppError, toAppError } from '@/server/lib/errors'
import { CC_MODES, CC_RULES, type CcRule } from '@/lib/call-center'
import {
  planCallCenter,
  resolveHumanTask,
  resolveInbound,
  retryTaskNow,
  rotateAgentToken,
  saveCallCenterSettings,
  simulateFromDashboard,
  type PlanSummary,
  type PublicCallCenterConfig
} from '@/server/services/call-center.service'

const uuid = z.string().uuid()

/** رسائل الحقول التي يرفضها الحفظ (بدل «بيانات غير صالحة» العامّة) */
const FIELD_AR: Record<string, string> = {
  inboundSim: 'شريحة الوارد لا تكون من شرائح الصادر',
  testPhones: 'وضع التجربة يحتاج رقمًا واحدًا على الأقل، والأرقام بصيغة 05/06/07',
  quietStart: 'بداية ساعات الاتصال قبل نهايتها',
  mode: 'المحاكاة في وضع التجربة فقط',
  agent: 'صندوق حقيقي متصل الآن: لا محاكاة فوقه'
}

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await fn())
  } catch (e) {
    if (isAppError(e) && e.code === 'VALIDATION' && typeof e.details?.field === 'string' && FIELD_AR[e.details.field]) {
      const field = e.details.field
      return { ok: false, error: { code: 'VALIDATION', message: FIELD_AR[field]!, fieldErrors: { [field]: FIELD_AR[field]! } } }
    }
    const locale = await getLocale()
    return fail(isAppError(e) ? e.code : toAppError(e).code, undefined, locale)
  }
}

const revalidate = () => {
  revalidatePath('/admin/callcenter')
  revalidatePath('/admin/callcenter/settings')
}

const hhmm = (v: FormDataEntryValue | null, fallback: number) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(v ?? '').trim())
  return m ? Number(m[1]) * 60 + Number(m[2]) : fallback
}

export async function saveCallCenterSettingsAction(_prev: ActionResult<PublicCallCenterConfig> | null, fd: FormData): Promise<ActionResult<PublicCallCenterConfig>> {
  const list = (v: FormDataEntryValue | null) => String(v ?? '').split(/[\s,،;]+/).map((x) => x.trim()).filter(Boolean)
  const parsed = z
    .object({
      mode: z.enum(CC_MODES),
      testPhones: z.array(z.string().max(20)).max(20),
      outboundSims: z.array(z.coerce.number().int().min(1).max(32)).min(1, 'شريحة صادرة واحدة على الأقل').max(16),
      inboundSim: z.coerce.number().int().min(1).max(32),
      dailyCapPerSim: z.coerce.number().int().min(1, 'السقف 1 على الأقل').max(1000),
      quietStart: z.number().int().min(0).max(1440),
      quietEnd: z.number().int().min(0).max(1440),
      maxCallAttempts: z.coerce.number().int().min(1).max(6),
      homeStuckHours: z.coerce.number().int().min(6).max(240),
      smsChannel: z.enum(['provider', 'gateway']),
      confirmAmountDzd: z.coerce.number().int().min(0).max(1_000_000),
      deskArrivedText: z.string().trim().min(10, 'نص قصير جدًا').max(300),
      homeArrivedText: z.string().trim().min(10, 'نص قصير جدًا').max(300)
    })
    .safeParse({
      mode: fd.get('mode'),
      testPhones: list(fd.get('testPhones')),
      outboundSims: list(fd.get('outboundSims')),
      inboundSim: fd.get('inboundSim'),
      dailyCapPerSim: fd.get('dailyCapPerSim'),
      quietStart: hhmm(fd.get('quietStart'), 540),
      quietEnd: hhmm(fd.get('quietEnd'), 1200),
      maxCallAttempts: fd.get('maxCallAttempts'),
      homeStuckHours: fd.get('homeStuckHours'),
      smsChannel: fd.get('smsChannel'),
      confirmAmountDzd: fd.get('confirmAmountDzd'),
      deskArrivedText: fd.get('deskArrivedText') ?? '',
      homeArrivedText: fd.get('homeArrivedText') ?? ''
    })
  if (!parsed.success) return failValidation(parsed.error)
  const rules = Object.fromEntries(CC_RULES.map((r) => [r, fd.get(`rule_${r}`) === 'on'])) as Record<CcRule, boolean>
  const result = await run(async () => saveCallCenterSettings(await getDb(), await requireRole('SUPER_ADMIN'), { ...parsed.data, rules }))
  if (result.ok) revalidate()
  return result
}

/** رمز الصندوق الجديد يُعرض مرة واحدة */
export async function rotateAgentTokenAction(): Promise<ActionResult<{ token: string; hint: string }>> {
  const result = await run(async () => rotateAgentToken(await getDb(), await requireRole('SUPER_ADMIN')))
  if (result.ok) revalidate()
  return result
}

export async function runTickNowAction(): Promise<ActionResult<PlanSummary>> {
  const result = await run(async () => {
    await requireRole('SUPER_ADMIN')
    return planCallCenter(await getDb())
  })
  if (result.ok) revalidate()
  return result
}

export async function simulateRoundAction(): Promise<ActionResult<{ created: number; claimed: number; answered: number; noAnswer: number }>> {
  const result = await run(async () => {
    const r = await simulateFromDashboard(await getDb(), await requireRole('SUPER_ADMIN'))
    return { created: r.plan.created, ...r.agent }
  })
  if (result.ok) revalidate()
  return result
}

export async function resolveTaskAction(taskId: string, note: string): Promise<ActionResult<undefined>> {
  const parsed = z.object({ id: uuid, note: z.string().max(500) }).safeParse({ id: taskId, note })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await run(async () => {
    await resolveHumanTask(await getDb(), await requireRole('SUPER_ADMIN', 'CONFIRMER'), parsed.data.id, parsed.data.note)
    return undefined
  })
  if (result.ok) revalidate()
  return result
}

export async function retryTaskAction(taskId: string): Promise<ActionResult<undefined>> {
  const parsed = uuid.safeParse(taskId)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await run(async () => {
    await retryTaskNow(await getDb(), await requireRole('SUPER_ADMIN', 'CONFIRMER'), parsed.data)
    return undefined
  })
  if (result.ok) revalidate()
  return result
}

export async function resolveInboundAction(id: string, note: string): Promise<ActionResult<undefined>> {
  const parsed = z.object({ id: uuid, note: z.string().max(500) }).safeParse({ id, note })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await run(async () => {
    await resolveInbound(await getDb(), await requireRole('SUPER_ADMIN', 'CONFIRMER'), parsed.data.id, parsed.data.note)
    return undefined
  })
  if (result.ok) revalidate()
  return result
}
