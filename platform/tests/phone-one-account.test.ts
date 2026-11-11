/**
 * قرار المالك 11 نوفمبر 2026: «الرقم الموثَّق لحساب واحد، والرقم يُفتح به حساب واحد فقط».
 * اختبار لكل ثغرة أكّدها المراجع في PR #72 (1–4)، ثم التزامن، والبيانات القديمة، وتطابق مسار الآيفون مع الموقع.
 */
import { and, eq, isNotNull } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { getDb } from '@/server/db/client'
import type { DatabaseHandle } from '@/server/db/connect'
import { profiles, sessions, users } from '@/server/db/schema'
import { verifyPassword } from '@/server/auth/password'
import { SESSION_COOKIE, resolveActor, revokeAllSessions } from '@/server/auth/session'
import type { Actor } from '@/server/lib/actor'
import { setSmsSenderForTests, type SmsMessage } from '@/server/lib/sms'
import { requestOtpAction, verifyOtpAction } from '@/server/actions/otp.actions'
import { login, registerStudent } from '@/server/services/auth.service'
import { handleIncomingCall, saveCallConfirm } from '@/server/services/call-confirm.service'
import { requestOtp, verifyOtp } from '@/server/services/otp.service'
import { phoneGateFor } from '@/server/services/phone-gate.service'
import { requestPhonePasswordReset, resetPasswordByPhone } from '@/server/services/phone-recovery.service'
import { addPosMember, createPointOfSale } from '@/server/services/points-of-sale.service'
import { POST as iosRegister } from '@/app/api/v1/ios/register/route'
import { POST as iosPhoneRequest } from '@/app/api/v1/ios/phone/request/route'
import { POST as iosPhoneVerify } from '@/app/api/v1/ios/phone/verify/route'
import { makeAdmin, refIds, setupDb } from './helpers'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }))
vi.mock('@/server/db/client', () => ({ getDb: vi.fn() }))
let currentActor: Actor | null = null
vi.mock('@/server/auth/current-user', () => ({
  requestMeta: async () => ({ userAgent: 'vitest', ip: '197.200.60.1' }),
  requireActor: async () => {
    if (!currentActor) throw new Error('no actor')
    return currentActor
  },
  requireRole: async () => {
    throw new Error('not used')
  }
}))

let h: DatabaseHandle
let admin: Actor
let refs: Awaited<ReturnType<typeof refIds>>
let n = 0
const sms: SmsMessage[] = []
const PASSWORD = 'Bac2027-strong'
const nextPhone = () => `0556${String(++n).padStart(6, '0')}`
const guardian = '0770112233'
const MIN = 60_000

interface Account {
  userId: string
  token: string
  phone: string
  password: string
}
/** حساب تلميذ عبر الخدمة (بلا بريد افتراضيًا)، بجلسته كما بعد التسجيل */
async function reg(phone: string, opts: { email?: string; password?: string } = {}): Promise<Account> {
  const password = opts.password ?? PASSWORD
  const r = await registerStudent(h.db, { email: opts.email ?? null, password, fullName: 'تلميذ', phone, guardianPhone: guardian })
  return { userId: r.userId, token: r.session.token, phone, password }
}
const profileOf = async (userId: string) => (await h.db.select({ phone: profiles.phone, at: profiles.phoneVerifiedAt }).from(profiles).where(eq(profiles.userId, userId)))[0]!
const verifiedOn = async (phone: string) => (await h.db.select({ userId: profiles.userId }).from(profiles).where(and(eq(profiles.phone, phone), isNotNull(profiles.phoneVerifiedAt)))).map((r) => r.userId)
/** كتابة مباشرة في القاعدة: حالة «قديمة» سابقة للقاعدة، أو مسار آخر سبق */
const forceVerified = (userId: string, phone?: string) => h.db.update(profiles).set({ ...(phone ? { phone } : {}), phoneVerifiedAt: new Date() }).where(eq(profiles.userId, userId))
const logout = (userId: string) => revokeAllSessions(h.db, userId)
/** رمز REGISTER صالح للحساب؛ `agoMin` يؤخّر وقت الطلب لتجاوز مهلة إعادة الإرسال (60 ثانية لكل رقم) */
const codeFor = async (a: Account, phone = a.phone, agoMin = 0) => (await requestOtp(h.db, { phone, purpose: 'REGISTER', userId: a.userId }, new Date(Date.now() - agoMin * MIN))).devCode!

type Path = 'web' | 'ios'
const iosReq = (url: string, a: Account, body: unknown) =>
  new NextRequest(`https://madrasadz.com${url}`, { method: 'POST', headers: { cookie: `${SESSION_COOKIE}=${a.token}`, 'content-type': 'application/json', 'x-madrasadz-client': 'ios' }, body: JSON.stringify(body) })
/** طلب رمز التأكيد من المسار: يرجع رمز الخطأ أو null */
async function requestVia(path: Path, a: Account, phone: string): Promise<string | null> {
  if (path === 'web') {
    currentActor = await resolveActor(h.db, a.token)
    const r = await requestOtpAction({ phone, purpose: 'REGISTER' })
    return r.ok ? null : r.error.code
  }
  const res = await iosPhoneRequest(iosReq('/api/v1/ios/phone/request', a, { phone }))
  return res.status === 200 ? null : (await res.json()).error.code
}
/** إدخال الرمز من المسار: يرجع رمز الخطأ أو null */
async function verifyVia(path: Path, a: Account, phone: string, code: string): Promise<string | null> {
  if (path === 'web') {
    currentActor = await resolveActor(h.db, a.token)
    const r = await verifyOtpAction({ phone, purpose: 'REGISTER', code })
    return r.ok ? null : r.error.code
  }
  const res = await iosPhoneVerify(iosReq('/api/v1/ios/phone/verify', a, { phone, code }))
  return res.status === 200 ? null : (await res.json()).error.code
}
/** التلميذ يؤكّد رقمه برمز SMS من المسار */
async function smsVerify(path: Path, a: Account, agoMin = 0) {
  expect(await verifyVia(path, a, a.phone, await codeFor(a, a.phone, agoMin))).toBeNull()
}
const loginId = async (phone: string, password: string) => (await login(h.db, { email: phone, password })).userId
/** الاستعادة بالهاتف حتى الدخول بكلمة السر الجديدة */
async function recover(a: Account, ip: string) {
  sms.length = 0
  await requestPhonePasswordReset(h.db, a.phone, { ip })
  const code = sms.filter((m) => m.to === a.phone).at(-1)?.variables?.code
  expect(code).toMatch(/^\d{6}$/)
  await resetPasswordByPhone(h.db, { phone: a.phone, code: code!, password: 'Recovered-2027-x' }, { ip })
  expect(await loginId(a.phone, 'Recovered-2027-x')).toBe(a.userId)
}

beforeAll(async () => {
  vi.stubEnv('SMS_PROVIDER', 'webhook')
  vi.stubEnv('SMS_WEBHOOK_URL', 'https://sms.test.invalid')
  h = await setupDb()
  vi.mocked(getDb).mockResolvedValue(h.db)
  setSmsSenderForTests({ name: 'memory', send: async (m) => void sms.push(m) })
  admin = await makeAdmin(h.db)
  refs = await refIds(h.db)
  await saveCallConfirm(h.db, admin, { enabled: true, number: '0555998877', windowHours: 72, autoReject: true })
})
afterAll(async () => {
  setSmsSenderForTests(null)
  vi.unstubAllEnvs()
  await h.close()
})

describe.each(['web', 'ios'] as Path[])('الثغرة 1 — تأكيد رقم مؤكَّد لحساب آخر برمز SMS (%s)', (path) => {
  it('المرفوض عند التسجيل برقم مؤكَّد لا يؤكّده بعد التسجيل برقم آخر: PHONE_TAKEN قبل أي رسالة، والاستعادة تبقى تعمل', async () => {
    const y = nextPhone()
    const owner = await reg(y)
    await smsVerify(path, owner)
    // التسجيل بالرقم المؤكَّد مرفوض، ببريد أو بدونه، من الخدمة ومن مسار الآيفون
    await expect(reg(y)).rejects.toMatchObject({ code: 'PHONE_TAKEN' })
    await expect(reg(y, { email: `sib-${y}@example.dz` })).rejects.toMatchObject({ code: 'PHONE_TAKEN' })
    const viaIos = await iosRegister(new NextRequest('https://madrasadz.com/api/v1/ios/register', { method: 'POST', headers: { 'content-type': 'application/json', 'x-madrasadz-client': 'ios' }, body: JSON.stringify({ fullName: 'آخر', phone: y, guardianPhone: guardian, password: PASSWORD, wilayaId: refs.wilayaId, levelId: refs.levelId, streamId: refs.streamId }) }))
    expect((await viaIos.json()).error?.code).toBe('PHONE_TAKEN')
    // يسجّل برقم آخر ثم يحاول تأكيد Y من داخل حسابه
    const other = await reg(nextPhone())
    sms.length = 0
    expect(await requestVia(path, other, y)).toBe('PHONE_TAKEN')
    expect(sms).toHaveLength(0)
    expect(await verifiedOn(y)).toEqual([owner.userId])
    expect(await profileOf(other.userId)).toMatchObject({ phone: other.phone, at: null })
    await recover(owner, path === 'web' ? '192.0.2.21' : '192.0.2.22')
  })

  it('سباق: رمز صدر لحساب قبل أن يؤكّد حساب آخر الرقم ⇒ إدخاله يُرفض ولا يتغيّر ملفه', async () => {
    const y = nextPhone()
    const first = await reg(y)
    const late = await reg(nextPhone())
    const code = await codeFor(late, y)
    await forceVerified(first.userId)
    expect(await verifyVia(path, late, y, code)).toBe('PHONE_TAKEN')
    expect(await verifiedOn(y)).toEqual([first.userId])
    expect(await profileOf(late.userId)).toMatchObject({ phone: late.phone, at: null })
  })
})

describe('الثغرة 2 — المكالمة الفائتة لا تؤكّد أكثر من حساب ولا تمنح الرقم لمن كتبه', () => {
  it.each(['web', 'ios'] as Path[])('من كتب رقم غيره قبله وصاحب الرقم ينتظران معًا: المكالمة لا تؤكّد أحدًا، وصاحب الرقم يؤكّد برمز SMS ويدخل ويستعيد (%s)', async (path) => {
    const phone = nextPhone()
    const squatter = await reg(phone, { password: 'Squatter-pass-1' })
    const owner = await reg(phone)
    const call = await handleIncomingCall(h.db, phone)
    expect(call.result).not.toBe('phone_verified')
    expect(await verifiedOn(phone)).toEqual([])
    // البوّابة ما زالت مطلوبة للاثنين: يبقى رمز SMS المرتبط بالحساب
    expect((await phoneGateFor(h.db, owner.userId)).required).toBe(true)
    await smsVerify(path, owner)
    expect(await verifiedOn(phone)).toEqual([owner.userId])
    // مكالمة لاحقة لا تؤكّد الآخر
    await handleIncomingCall(h.db, phone)
    expect(await verifiedOn(phone)).toEqual([owner.userId])
    // الرقم يفتح حساب صاحبه وحده
    expect(await loginId(phone, PASSWORD)).toBe(owner.userId)
    await expect(login(h.db, { email: phone, password: squatter.password })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    // والآخر لا يؤكّد الرقم بعدها
    expect(await requestVia(path, squatter, phone)).toBe('PHONE_TAKEN')
    await recover(owner, path === 'web' ? '192.0.2.31' : '192.0.2.32')
  })

  it('من كتب الرقم ثم غادر (لا جلسة قائمة) لا تؤكّده مكالمة صاحب الرقم؛ وصاحبه يسجّل بعدها ويؤكّد ويدخل ويستعيد', async () => {
    const phone = nextPhone()
    const squatter = await reg(phone, { password: 'Squatter-pass-2' })
    await logout(squatter.userId)
    // صاحب الرقم يتصل (لتأكيد طلب مثلًا) قبل أن يسجّل
    expect((await handleIncomingCall(h.db, phone)).result).not.toBe('phone_verified')
    expect(await verifiedOn(phone)).toEqual([])
    const owner = await reg(phone)
    // هو وحده ينتظر عند البوّابة ⇒ مكالمته تؤكّده هو
    expect((await handleIncomingCall(h.db, phone)).result).toBe('phone_verified')
    expect(await verifiedOn(phone)).toEqual([owner.userId])
    expect(await loginId(phone, PASSWORD)).toBe(owner.userId)
    await expect(login(h.db, { email: phone, password: squatter.password })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    await recover(owner, '192.0.2.33')
  })

  it('جلسة منتهية أو قديمة لا تُعدّ انتظارًا؛ ورقم مؤكَّد لحساب لا تؤكّد المكالمة به حسابًا آخر', async () => {
    const phone = nextPhone()
    const stale = await reg(phone)
    await h.db.update(sessions).set({ lastSeenAt: new Date(Date.now() - 72 * 60 * MIN) }).where(eq(sessions.userId, stale.userId))
    expect((await handleIncomingCall(h.db, phone)).result).not.toBe('phone_verified')
    expect(await verifiedOn(phone)).toEqual([])
    const holder = await reg(nextPhone())
    await forceVerified(holder.userId)
    // حالة قديمة: حساب آخر يحمل الرقم المؤكَّد نفسه غير مؤكَّد
    const carrier = await reg(nextPhone())
    await h.db.update(profiles).set({ phone: holder.phone }).where(eq(profiles.userId, carrier.userId))
    await handleIncomingCall(h.db, holder.phone)
    expect(await verifiedOn(holder.phone)).toEqual([holder.userId])
  })

  it('حساب شريك (نقطة بيع) بالرقم نفسه لا يُؤكَّد بالمكالمة ولا يمنع تأكيد التلميذ', async () => {
    const phone = nextPhone()
    const pos = await createPointOfSale(h.db, admin, { name: 'مكتبة الاختبار', phone })
    const member = await addPosMember(h.db, admin, pos.id, { fullName: 'صاحب المكتبة', phone })
    const student = await reg(phone)
    expect((await handleIncomingCall(h.db, phone)).result).toBe('phone_verified')
    expect(await verifiedOn(phone)).toEqual([student.userId])
    // قرار 2 نوفمبر باقٍ: الشريك يدخل برقمه وكلمة سرّه، والتلميذ بكلمة سرّه
    expect(await loginId(phone, member.password)).toBe(member.userId)
    const r = await login(h.db, { email: phone, password: PASSWORD })
    expect(r).toMatchObject({ userId: student.userId, sharedIdentity: true })
  })
})

describe('الثغرة 3 — حسابات كثيرة بالرقم نفسه لا تزيح صاحب حساب أقدم', () => {
  it('ستة حسابات لاحقة بالرقم (دخلت كلها حديثًا) لا تمنع التلميذ العائد قبل إدخال رمز SMS من الدخول بكلمة سرّه', async () => {
    const phone = nextPhone()
    const victim = await reg(phone, { password: 'Victim-secret-2027' })
    await logout(victim.userId)
    const squatters: Account[] = []
    for (let i = 0; i < 6; i++) squatters.push(await reg(phone, { password: `Squat-pass-${i}-x` }))
    for (const s of squatters) await h.db.update(users).set({ lastLoginAt: new Date(Date.now() + MIN) }).where(eq(users.id, s.userId))
    expect(await loginId(phone, 'Victim-secret-2027')).toBe(victim.userId)
    // بعد أن يؤكّد رقمه: لا تفتح كلمة سر أي حساب آخر هذا الرقم
    const back = { ...victim, token: (await login(h.db, { email: phone, password: 'Victim-secret-2027' })).session.token }
    await smsVerify('web', back)
    for (const s of squatters) await expect(login(h.db, { email: phone, password: s.password })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    expect(await loginId(phone, 'Victim-secret-2027')).toBe(victim.userId)
    await recover(back, '192.0.2.41')
  })

  it('من سبقته خمسة حسابات بالرقم يسجّل ويؤكّد في جلسة تسجيله، فيصير الرقم له وحده', async () => {
    const phone = nextPhone()
    for (let i = 0; i < 5; i++) await reg(phone, { password: `Early-squat-${i}-x` })
    const owner = await reg(phone, { password: 'Owner-secret-2027' })
    await smsVerify('ios', owner)
    expect(await loginId(phone, 'Owner-secret-2027')).toBe(owner.userId)
    await expect(login(h.db, { email: phone, password: 'Early-squat-0-x' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
  })
})

describe('الثغرة 4 — أيّ حساب يفتحه الرقم لا يتبع آخر من دخل', () => {
  it('حسابان غير مؤكَّدين بالرقم وكلمة السر نفسيهما: الأقدم دائمًا، ثم من يؤكّد الرقم وحده', async () => {
    const phone = nextPhone()
    const older = await reg(phone)
    const newer = await reg(phone)
    await h.db.update(users).set({ lastLoginAt: new Date(Date.now() + 5 * MIN) }).where(eq(users.id, newer.userId))
    expect(await loginId(phone, PASSWORD)).toBe(older.userId)
    await h.db.update(users).set({ lastLoginAt: new Date(Date.now() + 10 * MIN) }).where(eq(users.id, newer.userId))
    expect(await loginId(phone, PASSWORD)).toBe(older.userId)
    // الأحدث يؤكّد الرقم من جلسته ⇒ الرقم يفتح حسابه هو وحده
    await smsVerify('web', newer)
    expect(await loginId(phone, PASSWORD)).toBe(newer.userId)
    expect((await login(h.db, { email: phone, password: PASSWORD })).sharedIdentity).toBe(false)
  })

  it('رقم مؤكَّد لحساب: كلمة سر حساب آخر يحمل الرقم لا تفتحه ولو دخل ذلك الحساب آخرًا', async () => {
    const phone = nextPhone()
    const other = await reg(phone, { email: `other-${phone}@example.dz`, password: 'Other-pass-2027' })
    const holder = await reg(phone)
    await smsVerify('web', holder)
    await h.db.update(users).set({ lastLoginAt: new Date(Date.now() + 5 * MIN) }).where(eq(users.id, other.userId))
    await expect(login(h.db, { email: phone, password: 'Other-pass-2027' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    // الحساب الآخر لم يُحذف ولم يُمسّ: يدخل ببريده، ورقمه المكتوب باقٍ غير مؤكَّد
    expect(await loginId(`other-${phone}@example.dz`, 'Other-pass-2027')).toBe(other.userId)
    expect(await profileOf(other.userId)).toMatchObject({ phone, at: null })
  })
})

describe('التزامن — تأكيدان للرقم نفسه في اللحظة نفسها', () => {
  it('حسابان يؤكّدان الرقم معًا: واحد ينجح والآخر PHONE_TAKEN', async () => {
    const { claimVerifiedPhone } = await import('@/server/services/phone-ownership.service')
    const phone = nextPhone()
    const a = await reg(phone)
    const b = await reg(phone)
    const at = new Date()
    const out = await Promise.allSettled([claimVerifiedPhone(h.db, { userId: a.userId, phone, at }), claimVerifiedPhone(h.db, { userId: b.userId, phone, at })])
    expect(out.filter((o) => o.status === 'fulfilled')).toHaveLength(1)
    expect(out.find((o) => o.status === 'rejected')).toMatchObject({ reason: { code: 'PHONE_TAKEN' } })
    expect(await verifiedOn(phone)).toHaveLength(1)
  })

  it('رمز SMS لحساب ومكالمة فائتة في اللحظة نفسها: حساب واحد مؤكَّد على الأكثر، وهو صاحب الرمز', async () => {
    const phone = nextPhone()
    const a = await reg(phone)
    const b = await reg(phone)
    const code = await codeFor(a)
    await Promise.allSettled([verifyOtp(h.db, { phone, purpose: 'REGISTER', code, userId: a.userId }), handleIncomingCall(h.db, phone), handleIncomingCall(h.db, phone)])
    expect(await verifiedOn(phone)).toEqual([a.userId])
    expect((await profileOf(b.userId)).at).toBeNull()
  })

  it('الحساب نفسه يعيد تأكيد رقمه أو يغيّره إلى رقم حرّ: مسموح', async () => {
    const a = await reg(nextPhone())
    await smsVerify('web', a)
    await smsVerify('web', a, -2)
    const free = nextPhone()
    expect(await verifyVia('web', a, free, await codeFor(a, free))).toBeNull()
    expect(await profileOf(a.userId)).toMatchObject({ phone: free })
    expect(await verifiedOn(a.phone)).toEqual([])
  })
})

describe('البيانات القديمة — رقم مؤكَّد لحسابين قبل القاعدة (لا تُمسّ)', () => {
  it('كل حساب يدخل بكلمة سرّه كما كان، ولا حساب ثالث، ولا استعادة بالهاتف (كما كانت)، ولا يُلغى تأكيد أحد', async () => {
    const phone = nextPhone()
    const one = await reg(phone, { email: `one-${phone}@example.dz`, password: 'Legacy-one-2027' })
    const two = await reg(phone, { email: `two-${phone}@example.dz`, password: 'Legacy-two-2027' })
    await forceVerified(one.userId)
    await forceVerified(two.userId)
    expect(await login(h.db, { email: phone, password: 'Legacy-one-2027' })).toMatchObject({ userId: one.userId, sharedIdentity: true })
    expect(await login(h.db, { email: phone, password: 'Legacy-two-2027' })).toMatchObject({ userId: two.userId, sharedIdentity: true })
    await expect(login(h.db, { email: phone, password: 'neither-password' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    await expect(reg(phone)).rejects.toMatchObject({ code: 'PHONE_TAKEN' })
    sms.length = 0
    await requestPhonePasswordReset(h.db, phone, { ip: '192.0.2.51' })
    expect(sms.filter((m) => m.to === phone)).toHaveLength(0)
    await handleIncomingCall(h.db, phone)
    expect((await verifiedOn(phone)).sort()).toEqual([one.userId, two.userId].sort())
    // والدخول بالبريد لا يتأثر
    expect(await loginId(`one-${phone}@example.dz`, 'Legacy-one-2027')).toBe(one.userId)
    const [row] = await h.db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, two.userId))
    expect(await verifyPassword('Legacy-two-2027', row!.hash)).toBe(true)
  })

  it('بكلمة السر نفسها: الأحدث دخولًا، كما كان قبل القاعدة', async () => {
    const phone = nextPhone()
    const one = await reg(phone, { email: `s1-${phone}@example.dz` })
    const two = await reg(phone, { email: `s2-${phone}@example.dz` })
    await forceVerified(one.userId)
    await forceVerified(two.userId)
    await h.db.update(users).set({ lastLoginAt: new Date(Date.now() + 5 * MIN) }).where(eq(users.id, one.userId))
    expect(await loginId(phone, PASSWORD)).toBe(one.userId)
  })
})
