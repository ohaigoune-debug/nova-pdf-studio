/**
 * بعد رسالة من التلميذ في تذكرته: تُدرج مهمة SUPPORT_AI_REPLY إن كان المساعد مفعّلًا.
 * 15 ثانية انتظار: إن أرسل التلميذ رسالتين متتاليتين يُجاب عن الأخيرة وحدها (المهمة تتحقق أن رسالتها آخر رسالة).
 * لا يرمي أبدًا: تعطّل المساعد لا يمنع فتح التذكرة ولا الردّ عليها.
 */
import type { Db } from '@/server/db/connect'
import type { SupportTicketRow } from '@/server/db/schema'
import { kickJobsSoon } from '@/server/jobs/kick'
import { enqueueJob } from '@/server/jobs/queue'
import { readSupportAiSettings } from './settings'

export const SUPPORT_AI_DEBOUNCE_MS = 15_000

export async function scheduleSupportAi(db: Db, input: { ticket: Pick<SupportTicketRow, 'id' | 'isSensitive' | 'aiPaused' | 'status'>; messageId: string }): Promise<boolean> {
  try {
    if (input.ticket.isSensitive || input.ticket.aiPaused || input.ticket.status === 'CLOSED') return false
    const settings = await readSupportAiSettings(db)
    if (settings.mode === 'OFF') return false
    await enqueueJob(db, { type: 'SUPPORT_AI_REPLY', payload: { ticketId: input.ticket.id, messageId: input.messageId }, maxAttempts: 2, runAfter: new Date(Date.now() + SUPPORT_AI_DEBOUNCE_MS) })
    kickJobsSoon()
    return true
  } catch (err) {
    console.error('[support-ai] schedule failed', err)
    return false
  }
}
