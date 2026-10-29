/**
 * بوّابة تأكيد الهاتف (قرار المالك 2026-10-24: «نستقبل فقط الأرقام الحقيقية»).
 * الحساب الجديد لا يدخل لوحته قبل تأكيد هاتفه — برمز SMS أو بمكالمة فائتة مجانية إلى رقم المشرف (NOVA Call).
 * لا تُطبَّق إلا:
 *   - على الحسابات المنشأة بعد تاريخ إطلاق البوابة؛ يمكن تقديم التاريخ للقدامى، ولا يمكن تأخيره لإعفاء حساب جديد،
 *   - وحين توجد قناة تأكيد فعلية (مزوّد SMS مضبوط أو التأكيد بالمكالمة مفعّل) — وإلا لا تحجب أحداً.
 */
import { eq } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { profiles, users } from '@/server/db/schema'
import { smsStatus } from '@/server/lib/sms'
import { getCallConfirm } from './call-confirm.service'
import { ttlMemo } from '@/server/lib/ttl-cache'

const DEFAULT_SINCE = '2026-10-24T14:00:00Z'

export function phoneGateSince(): Date {
  const d = new Date(process.env.PHONE_VERIFY_REQUIRED_SINCE || DEFAULT_SINCE)
  const launch = new Date(DEFAULT_SINCE)
  return Number.isNaN(d.getTime()) || d > launch ? launch : d
}

export interface PhoneChannels {
  sms: boolean
  /** رقم المكالمة الفائتة المجانية، أو null */
  callNumber: string | null
}

/** تُقرأ في كل صفحة للتلميذ (بوابة الهاتف): إعدادات لا تتغيّر إلّا من الإدارة، فذاكرة 30 ثانية */
export function phoneChannels(db: Db): Promise<PhoneChannels> {
  return ttlMemo('phone:channels', 30_000, () => readPhoneChannels(db))
}

async function readPhoneChannels(db: Db): Promise<PhoneChannels> {
  const [sms, call] = await Promise.all([smsStatus(db), getCallConfirm(db)])
  const smsReady = (sms.provider === 'suivisms' && sms.keySource !== 'none' && !sms.unusable) || (sms.provider === 'webhook' && Boolean(process.env.SMS_WEBHOOK_URL))
  return { sms: smsReady, callNumber: call.enabled && call.number ? call.number : null }
}

export interface PhoneGate {
  required: boolean
  phone: string | null
  channels: PhoneChannels
}

export async function phoneGateFor(db: Db, userId: string): Promise<PhoneGate> {
  const [row] = await db.select({ createdAt: users.createdAt, phone: profiles.phone, verifiedAt: profiles.phoneVerifiedAt }).from(users).leftJoin(profiles, eq(profiles.userId, users.id)).where(eq(users.id, userId)).limit(1)
  const channels = await phoneChannels(db)
  if (!row || row.verifiedAt) return { required: false, phone: row?.phone ?? null, channels }
  const isNew = row.createdAt.getTime() >= phoneGateSince().getTime()
  const required = isNew && (channels.sms || Boolean(channels.callNumber))
  return { required, phone: row.phone ?? null, channels }
}
