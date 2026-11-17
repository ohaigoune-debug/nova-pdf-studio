/**
 * التسجيل دون كلمة سر (قرار المالك 18 نوفمبر 2026): رمز دخول من 6 أرقام صالح 7 أيام، لافتة تذكير ثم تحذير من اليوم 5،
 * وبعد الانتهاء لا يُقبل الرمز ويُطلب إنشاء كلمة سر — دون المساس بالدورات. التذكير بالإشعار مرة لكل مرحلة، دون SMS.
 */
import { and, eq, isNull } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { notifications, sessions, users } from '@/server/db/schema'
import { AppError } from '@/server/lib/errors'
import { login, registerStudent } from '@/server/services/auth.service'
import { generateTempCode, sendTempPasswordReminders, setFirstPassword, tempLoginState, tempPasswordStats, tempStageOf, TEMP_CODE_DAYS } from '@/server/services/temp-login.service'
import { setupDb } from './helpers'

let h: DatabaseHandle
const DAY = 86_400_000
let n = 0
const phone = () => `0662${String(300000 + ++n).slice(-6)}`

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

async function passwordless(tel = phone()) {
  const r = await registerStudent(h.db, { password: '', passwordless: true, fullName: `تلميذ إعلان ${n}`, phone: tel, guardianPhone: '0770000000' })
  return { ...r, phone: tel }
}

beforeAll(async () => {
  h = await setupDb()
})
afterAll(async () => {
  await h.close()
})

describe('رمز الدخول المؤقت', () => {
  it('لا رموز سهلة: 6 أرقام، لا تكرار ولا تسلسل', () => {
    for (let i = 0; i < 300; i++) {
      const c = generateTempCode()
      expect(c).toMatch(/^\d{6}$/)
      expect(c).not.toMatch(/^(\d)\1{5}$/)
      expect(['012345', '123456', '234567', '345678', '456789', '987654', '876543']).not.toContain(c)
    }
  })

  it('التسجيل دون كلمة سر يعيد رمزًا صالحًا 7 أيام، والدخول بالهاتف والرمز ينجح', async () => {
    const r = await passwordless()
    expect(r.tempCode).toMatch(/^\d{6}$/)
    const st = await tempLoginState(h.db, r.userId)
    expect(st).toMatchObject({ code: r.tempCode, stage: 'REMIND', daysLeft: TEMP_CODE_DAYS })
    expect(st!.until.getTime() - Date.now()).toBeGreaterThan(6.9 * DAY)
    const l = await login(h.db, { email: r.phone, password: r.tempCode! })
    expect(l.userId).toBe(r.userId)
    await expectCode(() => login(h.db, { email: r.phone, password: '000001' }), 'INVALID_CREDENTIALS')
  })

  it('التسجيل العادي لا يتغيّر: كلمة سر قوية إلزامية، ولا رمز مؤقت', async () => {
    await expectCode(() => registerStudent(h.db, { password: 'short', fullName: 'تلميذ', phone: phone() }), 'WEAK_PASSWORD')
    const r = await registerStudent(h.db, { password: 'Student@12345', fullName: 'تلميذ عادي', phone: phone() })
    expect(r.tempCode).toBeNull()
    expect(await tempLoginState(h.db, r.userId)).toBeNull()
  })

  it('دون كلمة سر يُشترط الهاتف', async () => {
    await expectCode(() => registerStudent(h.db, { password: '', passwordless: true, fullName: 'بلا هاتف', email: 'x@test.dz' }), 'VALIDATION')
  })

  it('المراحل: تذكير، ثم تحذير من اليوم 5، ثم انتهاء', () => {
    const until = new Date(Date.now() + 7 * DAY)
    expect(tempStageOf(until, new Date())).toEqual({ stage: 'REMIND', daysLeft: 7 })
    expect(tempStageOf(until, new Date(Date.now() + 4.5 * DAY)).stage).toBe('REMIND')
    expect(tempStageOf(until, new Date(Date.now() + 5.1 * DAY))).toEqual({ stage: 'WARN', daysLeft: 2 })
    expect(tempStageOf(until, new Date(Date.now() + 6.5 * DAY))).toEqual({ stage: 'WARN', daysLeft: 1 })
    expect(tempStageOf(until, new Date(Date.now() + 7 * DAY + 1000))).toEqual({ stage: 'EXPIRED', daysLeft: 0 })
  })

  it('بعد 7 أيام لا يُقبل الرمز (TEMP_CODE_EXPIRED)، والحساب ودوراته باقيان', async () => {
    const r = await passwordless()
    await h.db.update(users).set({ tempPasswordUntil: new Date(Date.now() - 1000) }).where(eq(users.id, r.userId))
    await expectCode(() => login(h.db, { email: r.phone, password: r.tempCode! }), 'TEMP_CODE_EXPIRED')
    expect((await tempLoginState(h.db, r.userId))!.stage).toBe('EXPIRED')
    const [u] = await h.db.select({ status: users.status, deletedAt: users.deletedAt }).from(users).where(eq(users.id, r.userId))
    expect(u).toEqual({ status: 'ACTIVE', deletedAt: null })
  })

  it('أول كلمة سر: لا تُطلب الكلمة القديمة، الرمز المؤقت يبطل، الجلسة الحالية تبقى والأخرى تُغلق', async () => {
    const r = await passwordless()
    const other = await login(h.db, { email: r.phone, password: r.tempCode! })
    await expectCode(() => setFirstPassword(h.db, { userId: r.userId, password: 'short', keepToken: r.session.token }), 'WEAK_PASSWORD')
    await setFirstPassword(h.db, { userId: r.userId, password: 'Jadida@2027', keepToken: r.session.token })
    expect(await tempLoginState(h.db, r.userId)).toBeNull()
    await expectCode(() => login(h.db, { email: r.phone, password: r.tempCode! }), 'INVALID_CREDENTIALS')
    expect((await login(h.db, { email: r.phone, password: 'Jadida@2027' })).userId).toBe(r.userId)
    const open = await h.db.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.userId, r.userId), isNull(sessions.revokedAt)))
    // الحالية + الدخول الأخير بالكلمة الجديدة؛ جلسة الرمز القديم أُغلقت
    expect(open).toHaveLength(2)
    const [old] = await h.db.select({ revokedAt: sessions.revokedAt }).from(sessions).where(eq(sessions.tokenHash, (await import('@/server/lib/codes')).sha256(other.session.token)))
    expect(old!.revokedAt).toBeInstanceOf(Date)
    // من له كلمة سر عادية يغيّرها من «حسابي» بكلمته الحالية، لا من هنا
    await expectCode(() => setFirstPassword(h.db, { userId: r.userId, password: 'Okhra@2027' }), 'FORBIDDEN')
  })

  it('التذكير: إشعار في اليوم 5 مرة واحدة، وإشعار عند الانتهاء مرة واحدة — والإحصائية', async () => {
    const before = await tempPasswordStats(h.db)
    const a = await passwordless()
    const b = await passwordless()
    const now = new Date()
    await h.db.update(users).set({ tempPasswordUntil: new Date(now.getTime() + 1.5 * DAY) }).where(eq(users.id, a.userId))
    await h.db.update(users).set({ tempPasswordUntil: new Date(now.getTime() - 60_000) }).where(eq(users.id, b.userId))
    const stats = await tempPasswordStats(h.db, now)
    expect(stats.total - before.total).toBe(2)
    expect(stats.warn - before.warn).toBe(1)
    expect(stats.expired - before.expired).toBe(1)
    await sendTempPasswordReminders(h.db, now)
    await sendTempPasswordReminders(h.db, now)
    const titles = async (userId: string) => (await h.db.select({ t: notifications.title }).from(notifications).where(eq(notifications.userId, userId))).map((x) => x.t)
    expect(await titles(a.userId)).toEqual(['أنشئ كلمة سرك: رمز دخولك ينتهي بعد يومين'])
    expect(await titles(b.userId)).toEqual(['انتهى رمز الدخول المؤقت — أنشئ كلمة سرك'])
    // ينتهي رمز (a) لاحقًا: إشعار الانتهاء مرة واحدة
    await sendTempPasswordReminders(h.db, new Date(now.getTime() + 2 * DAY))
    await sendTempPasswordReminders(h.db, new Date(now.getTime() + 3 * DAY))
    expect(await titles(a.userId)).toHaveLength(2)
    // الحساب الذي أنشأ كلمة سره لا يُذكَّر
    const c = await passwordless()
    await setFirstPassword(h.db, { userId: c.userId, password: 'Kalima@2027' })
    await h.db.update(users).set({ tempReminders: 0 }).where(eq(users.id, c.userId))
    await sendTempPasswordReminders(h.db, new Date(now.getTime() + 8 * DAY))
    expect(await titles(c.userId)).toEqual([])
  })
})
