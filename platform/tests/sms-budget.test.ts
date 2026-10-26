import { and, eq, like } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { notifications, otpCodes } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { setSmsSenderForTests, type SmsMessage } from '@/server/lib/sms'
import { smsDailyCap } from '@/server/lib/sms-budget'
import { requestOtp } from '@/server/services/otp.service'
import { makeAdmin, setupDb } from './helpers'

let h: DatabaseHandle
let admin: Actor
const sent: SmsMessage[] = []
const prevCap = process.env.SMS_DAILY_CAP

beforeAll(async () => {
  process.env.SMS_DAILY_CAP = '5'
  h = await setupDb()
  admin = await makeAdmin(h.db)
  setSmsSenderForTests({ name: 'memory', send: async (m) => void sent.push(m) })
})

afterAll(async () => {
  if (prevCap === undefined) delete process.env.SMS_DAILY_CAP
  else process.env.SMS_DAILY_CAP = prevCap
  setSmsSenderForTests(null)
  await h.close()
})

const adminAlerts = (marker: string) =>
  h.db.select({ title: notifications.title }).from(notifications).where(and(eq(notifications.userId, admin.userId), like(notifications.title, `%${marker}%`)))

describe('السقف اليومي لرسائل رمز التحقق', () => {
  it('قراءة السقف: الافتراضي 1000، والقيم غير الصالحة تعود إليه، و0 يعطّله', () => {
    const keep = process.env.SMS_DAILY_CAP
    delete process.env.SMS_DAILY_CAP
    expect(smsDailyCap()).toBe(1000)
    process.env.SMS_DAILY_CAP = 'abc'
    expect(smsDailyCap()).toBe(1000)
    process.env.SMS_DAILY_CAP = '-3'
    expect(smsDailyCap()).toBe(1000)
    process.env.SMS_DAILY_CAP = '0'
    expect(smsDailyCap()).toBe(0)
    process.env.SMS_DAILY_CAP = keep
  })

  it('أرقام مختلفة: تتوقف الرسائل عند السقف، والمشرف يُنبَّه مرة عند 80% ومرة عند البلوغ', async () => {
    const now = new Date('2026-11-02T10:00:00Z')
    for (let i = 1; i <= 5; i++) await requestOtp(h.db, { phone: `077100000${i}`, purpose: 'ORDER' }, now)
    expect(sent).toHaveLength(5)
    await expect(requestOtp(h.db, { phone: '0771000006', purpose: 'ORDER' }, now)).rejects.toMatchObject({ code: 'RATE_LIMITED' })
    await expect(requestOtp(h.db, { phone: '0771000007', purpose: 'ORDER' }, now)).rejects.toMatchObject({ code: 'RATE_LIMITED' })
    expect(sent).toHaveLength(5)
    // الطلب المرفوض لا يترك رمزاً صالحاً
    expect(await h.db.select().from(otpCodes).where(eq(otpCodes.phone, '0771000006'))).toHaveLength(0)
    expect(await adminAlerts('80%')).toHaveLength(1)
    expect(await adminAlerts('بلغ سقف اليوم')).toHaveLength(1)
  })

  it('يوم جديد: تعود الميزانية', async () => {
    const tomorrow = new Date('2026-11-03T10:00:00Z')
    await expect(requestOtp(h.db, { phone: '0771000008', purpose: 'ORDER' }, tomorrow)).resolves.toMatchObject({ phone: '0771000008' })
  })

  it('رفض المهلة لنفس الهاتف لا يستهلك من الميزانية', async () => {
    const day = new Date('2026-11-04T10:00:00Z')
    await requestOtp(h.db, { phone: '0771000009', purpose: 'ORDER' }, day)
    for (let i = 0; i < 6; i++) await expect(requestOtp(h.db, { phone: '0771000009', purpose: 'ORDER' }, new Date(day.getTime() + 1000))).rejects.toMatchObject({ code: 'RATE_LIMITED' })
    // 4 أرقام جديدة تكمل السقف (5) بعد الرسالة الأولى: الرفض السابق لم يُحسب
    for (let i = 0; i < 4; i++) await requestOtp(h.db, { phone: `07720000${10 + i}`, purpose: 'ORDER' }, day)
    await expect(requestOtp(h.db, { phone: '0772000020', purpose: 'ORDER' }, day)).rejects.toMatchObject({ code: 'RATE_LIMITED' })
  })
})
