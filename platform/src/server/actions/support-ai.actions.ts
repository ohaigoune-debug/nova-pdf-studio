'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { anthropicKeyForTools } from '@/server/ai/provider'
import { requireActor, requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { AppError } from '@/server/lib/errors'
import { loadAiCredentials, testAiKey } from '@/server/services/ai-credentials.service'
import { requestHumanAgent, setTicketAiPaused } from '@/server/services/support.service'
import { readSupportAiSettings, saveSupportAiSettings, SUPPORT_AI_MODES } from '@/server/support-ai/settings'

const str = (fd: FormData, k: string) => {
  const v = fd.get(k)
  return typeof v === 'string' ? v.trim() : ''
}
const num = (fd: FormData, k: string) => {
  const v = str(fd, k).replace(',', '.')
  return v === '' ? null : Number(v)
}

const settingsSchema = z.object({
  mode: z.enum(SUPPORT_AI_MODES),
  model: z.string().max(80),
  pilotPhones: z.string().max(6000),
  dailyLimit: z.number().int('عدد صحيح').min(0).max(5000).nullable(),
  dailyBudgetUsd: z.number().min(0).max(500).nullable(),
  knowledge: z.string().max(12_000, 'النص طويل (12000 حرف على الأكثر)')
})

/** حفظ إعدادات مساعد الدعم (المشرف العام) */
export async function saveSupportAiAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const custom = str(fd, 'customModel')
  const parsed = settingsSchema.safeParse({
    mode: str(fd, 'mode') || 'OFF',
    model: custom || str(fd, 'model'),
    pilotPhones: str(fd, 'pilotPhones'),
    dailyLimit: num(fd, 'dailyLimit'),
    dailyBudgetUsd: num(fd, 'dailyBudgetUsd'),
    knowledge: str(fd, 'knowledge')
  })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    await saveSupportAiSettings(await getDb(), actor, parsed.data)
    return undefined
  })
  if (result.ok) revalidatePath('/admin/settings/support-ai')
  return result
}

/** يتأكد أن مفتاح Anthropic المحفوظ يقبل النموذج المختار (طلب مجاني، لا يُحسب رمزًا) */
export async function testSupportAiAction(): Promise<ActionResult<{ model: string }>> {
  return runAction(async () => {
    await requireRole('SUPER_ADMIN')
    const db = await getDb()
    await loadAiCredentials(db)
    const key = anthropicKeyForTools()
    if (!key) throw new AppError('SUPPORT_AI_NO_KEY')
    const s = await readSupportAiSettings(db)
    await testAiKey('anthropic', key, s.model)
    return { model: s.model }
  })
}

/** التلميذ صاحب التذكرة: «أريد موظفًا» — يتوقف المساعد في هذه التذكرة */
export async function requestHumanAction(ticketId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(ticketId)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await requestHumanAgent(await getDb(), await requireActor(), parsed.data)
    return undefined
  })
  if (result.ok) {
    revalidatePath(`/student/support/${ticketId}`)
    revalidatePath(`/admin/support/${ticketId}`)
  }
  return result
}

/** المشرف: إيقاف المساعد في تذكرة أو إعادته */
export async function setTicketAiPausedAction(ticketId: string, paused: boolean): Promise<ActionResult> {
  const parsed = z.object({ ticketId: z.string().uuid(), paused: z.boolean() }).safeParse({ ticketId, paused })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await setTicketAiPaused(await getDb(), await requireActor(), parsed.data.ticketId, parsed.data.paused)
    return undefined
  })
  if (result.ok) revalidatePath(`/admin/support/${ticketId}`)
  return result
}
