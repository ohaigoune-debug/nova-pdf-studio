/**
 * التسجيل بالهاتف دون بريد (قرار المالك 5 و10 نوفمبر 2026): البريد اختياري، هاتف التلميذ وهاتف الولي إلزاميان.
 * الحساب بلا بريد يدخل برقمه (الموقع وواجهة التطبيق)، يُقفل برقمه عند تكرار الخطأ، ويُستعاد برمز SMS،
 * ولا يُرسل له بريد ولا يظهر «null» في قوائم الإدارة.
 */
import { eq, isNull } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb } from '@/server/db/client'
import type { DatabaseHandle } from '@/server/db/connect'
import { levels, profiles, streams, students, users, wilayas } from '@/server/db/schema'
import { verifyPassword } from '@/server/auth/password'
import { resolveActor } from '@/server/auth/session'
import { sha256 } from '@/server/lib/codes'
import { setMailerForTests, type MailMessage } from '@/server/lib/mailer'
import { RATE_LIMITS, rateKey } from '@/server/lib/rate-limit'
import { rateLimits } from '@/server/db/schema'
import { setSmsSenderForTests, type SmsMessage } from '@/server/lib/sms'
import { listAllStudents, listUsers } from '@/server/services/admin.service'
import { login, loginIdentity, registerStudent, requestPasswordReset } from '@/server/services/auth.service'
import { requestPhonePasswordReset, resetPasswordByPhone } from '@/server/services/phone-recovery.service'
import { loginAction, registerAction } from '@/server/actions/auth.actions'
import { POST as apiLogin } from '@/app/api/v1/auth/login/route'
import { POST as iosRegister } from '@/app/api/v1/ios/register/route'
import { makeAdmin, setupDb } from './helpers'

vi.mock('server-only', () => ({}))
vi.mock('@/server/db/client', () => ({ getDb: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }))
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`)
  }
}))
// الجلسة تُكتب في كوكي عبر next/headers؛ هنا يكفي التقاط الرمز
const cookieTokens: string[] = []
vi.mock('@/server/auth/current-user', () => ({
  requestMeta: async () => ({ userAgent: 'vitest', ip: '197.200.50.1' }),
  setSessionCookie: async (token: string) => void cookieTokens.push(token),
  clearSessionCookie: async () => undefined,
  currentSessionToken: async () => null,
  requireActor: async () => {
    throw new Error('not used')
  },
  homeFor: () => '/student'
}))

let h: DatabaseHandle
let wilayaId: string
let levelId: string
let streamId: string
let n = 0
const emails: MailMessage[] = []
const sms: SmsMessage[] = []
const PASSWORD = 'Bac2027-strong'
const nextPhone = () => `0555${String(++n).padStart(6, '0')}`
const guardian = '0770112233'

const form = (fields: Record<string, string>) => {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}
const webFields = (over: Record<string, string> = {}) => ({ fullName: 'ياسين بن علي', email: '', phone: nextPhone(), guardianPhone: guardian, password: PASSWORD, wilayaId, levelId, streamId, ...over })
/** registerAction/loginAction ينتهيان بـ redirect عند النجاح */
const redirected = (p: Promise<unknown>) => p.then(() => null, (e: Error) => (e.message.startsWith('REDIRECT:') ? e.message.slice(9) : Promise.reject(e)))
const ios = (body: unknown) =>
  iosRegister(new NextRequest('https://madrasadz.com/api/v1/ios/register', { method: 'POST', headers: { 'content-type': 'application/json', 'x-madrasadz-client': 'ios' }, body: JSON.stringify(body) }))
const api = (email: string, password: string) =>
  apiLogin(new Request('https://madrasadz.com/api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': '197.200.50.2' }, body: JSON.stringify({ email, password }) }))
const byPhone = async (phone: string) =>
  h.db.select({ id: users.id, email: users.email, hash: users.passwordHash, guardianPhone: students.guardianPhone }).from(profiles).innerJoin(users, eq(users.id, profiles.userId)).leftJoin(students, eq(students.userId, users.id)).where(eq(profiles.phone, phone))
const verifyPhone = (userId: string) => h.db.update(profiles).set({ phoneVerifiedAt: new Date() }).where(eq(profiles.userId, userId))
/** حساب بلا بريد عبر الخدمة مباشرة */
async function phoneOnly(opts: { verified?: boolean; phone?: string } = {}) {
  const phone = opts.phone ?? nextPhone()
  const r = await registerStudent(h.db, { email: null, password: PASSWORD, fullName: 'سلمى قاسمي', phone, guardianPhone: guardian, wilayaId, levelId, streamId })
  if (opts.verified) await verifyPhone(r.userId)
  return { ...r, phone }
}

beforeAll(async () => {
  vi.stubEnv('SMS_PROVIDER', 'webhook')
  vi.stubEnv('SMS_WEBHOOK_URL', 'https://sms.test.invalid')
  h = await setupDb()
  vi.mocked(getDb).mockResolvedValue(h.db)
  setMailerForTests({ name: 'memory', send: async (m) => void emails.push(m) })
  setSmsSenderForTests({ name: 'memory', send: async (m) => void sms.push(m) })
  wilayaId = (await h.db.select({ id: wilayas.id }).from(wilayas).limit(1))[0]!.id
  levelId = (await h.db.select({ id: levels.id }).from(levels).where(eq(levels.code, '3AS')))[0]!.id
  streamId = (await h.db.select({ id: streams.id }).from(streams).limit(1))[0]!.id
})
beforeEach(() => {
  emails.length = 0
})
afterAll(async () => {
  setMailerForTests(null)
  setSmsSenderForTests(null)
  vi.unstubAllEnvs()
  await h.close()
})

describe('التسجيل دون بريد — نموذج الموقع', () => {
  it('ينشئ الحساب بلا بريد (NULL، لا عنوان وهمي) ويوجّه إلى تأكيد الهاتف', async () => {
    const f = webFields({ phone: '0555 90 00 01' })
    expect(await redirected(registerAction(null, form(f)))).toBe('/student?verify=1')
    const [row] = await byPhone('0555900001')
    expect(row).toMatchObject({ email: null, guardianPhone: guardian })
    // الجلسة التي كُتبت في الكوكي تعمل، وحساب الجلسة بلا «null»
    const actor = await resolveActor(h.db, cookieTokens.at(-1)!)
    expect(actor).toMatchObject({ userId: row!.id, role: 'STUDENT', email: '', fullName: 'ياسين بن علي' })
  })

  it('حقل البريد الغائب تمامًا من النموذج مقبول أيضًا', async () => {
    const { email: _omit, ...f } = webFields()
    expect(await redirected(registerAction(null, form(f)))).toBe('/student?verify=1')
    expect((await byPhone(f.phone))[0]).toMatchObject({ email: null })
  })

  it('التسجيل ببريد يعمل كما كان، والبريد المكتوب يُفحص شكله ويبقى فريدًا', async () => {
    const f = webFields({ email: 'Yacine.Web@Example.dz' })
    expect(await redirected(registerAction(null, form(f)))).toBe('/student?verify=1')
    expect((await byPhone(f.phone))[0]).toMatchObject({ email: 'yacine.web@example.dz' })
    const bad = await registerAction(null, form(webFields({ email: 'not-an-email' })))
    expect(bad).toMatchObject({ ok: false, error: { code: 'VALIDATION', fieldErrors: { email: expect.any(String) } } })
    const dup = await registerAction(null, form(webFields({ email: 'yacine.web@example.dz' })))
    expect(dup).toMatchObject({ ok: false, error: { code: 'EMAIL_TAKEN' } })
  })

  it('هاتف التلميذ إلزامي وهاتف الولي إلزامي', async () => {
    const noPhone = await registerAction(null, form(webFields({ phone: '' })))
    expect(noPhone).toMatchObject({ ok: false, error: { code: 'VALIDATION', fieldErrors: { phone: expect.any(String) } } })
    const noGuardian = await registerAction(null, form(webFields({ guardianPhone: '' })))
    expect(noGuardian).toMatchObject({ ok: false, error: { code: 'VALIDATION', fieldErrors: { guardianPhone: expect.any(String) } } })
    const { guardianPhone: _g, ...missing } = webFields()
    expect(await registerAction(null, form(missing))).toMatchObject({ ok: false, error: { code: 'VALIDATION' } })
    // والخدمة نفسها لا تنشئ حسابًا بلا بريد ولا هاتف
    await expect(registerStudent(h.db, { password: PASSWORD, fullName: 'بلا معرّف' })).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('حسابان بلا بريد برقمين مختلفين يتعايشان', async () => {
    const a = await phoneOnly()
    const b = await phoneOnly()
    expect(a.userId).not.toBe(b.userId)
    expect((await h.db.select({ id: users.id }).from(users).where(isNull(users.email))).length).toBeGreaterThanOrEqual(2)
  })

  it('رقم مؤكَّد لحساب بلا بريد لا يُسجَّل به حساب ثانٍ، ببريد أو بدونه', async () => {
    const a = await phoneOnly({ verified: true })
    const again = await registerAction(null, form(webFields({ phone: a.phone })))
    expect(again).toMatchObject({ ok: false, error: { code: 'PHONE_TAKEN' } })
    await expect(registerStudent(h.db, { email: 'other@example.dz', password: PASSWORD, fullName: 'آخر', phone: a.phone })).rejects.toMatchObject({ code: 'PHONE_TAKEN' })
    expect(await byPhone(a.phone)).toHaveLength(1)
  })

  it('رقم مؤكَّد لحساب له بريد: لا يُسجَّل به حساب آخر، بلا بريد أو ببريد (قرار 11 نوفمبر: الرقم الموثَّق لحساب واحد)', async () => {
    const phone = nextPhone()
    const first = await registerStudent(h.db, { email: 'holder@example.dz', password: PASSWORD, fullName: 'صاحب الرقم', phone })
    await verifyPhone(first.userId)
    await expect(registerStudent(h.db, { password: PASSWORD, fullName: 'بلا بريد', phone })).rejects.toMatchObject({ code: 'PHONE_TAKEN' })
    await expect(registerStudent(h.db, { email: 'sibling@example.dz', password: PASSWORD, fullName: 'أخوه', phone })).rejects.toMatchObject({ code: 'PHONE_TAKEN' })
    expect(await byPhone(phone)).toHaveLength(1)
  })

  it('رقم غير مؤكَّد لا يحجز شيئًا: صاحب الرقم الحقيقي يسجّل ولو كتب غيره رقمه قبله', async () => {
    const squatter = await phoneOnly()
    const owner = await phoneOnly({ phone: squatter.phone, verified: true })
    expect(owner.userId).not.toBe(squatter.userId)
    // الدخول بالرقم: كلمة السر تحدّد الحساب، والمؤكَّد يُفحص أولًا
    const r = await login(h.db, { email: squatter.phone, password: PASSWORD })
    expect(r.userId).toBe(owner.userId)
  })
})

describe('التسجيل دون بريد — تطبيق الآيفون', () => {
  const body = (over: Record<string, unknown> = {}) => ({ fullName: 'أمينة بن سالم', phone: nextPhone(), guardianPhone: '+213770112233', password: PASSWORD, wilayaId, levelId, streamId, ...over })

  it('بلا حقل بريد، أو بريد فارغ، أو null: ينشأ الحساب وتعود جلسة', async () => {
    for (const email of [undefined, '', '   ', null]) {
      const b = body(email === undefined ? {} : { email })
      const res = await ios(b)
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data).toMatchObject({ role: 'STUDENT', token: expect.any(String) })
      expect((await byPhone(b.phone as string))[0]).toMatchObject({ email: null })
      expect((await resolveActor(h.db, data.token))?.email).toBe('')
    }
  })

  it('ببريد يعمل كما كان، والبريد الخاطئ يُسمّى حقله', async () => {
    const b = body({ email: 'amina.ios@example.dz' })
    expect((await ios(b)).status).toBe(200)
    expect((await byPhone(b.phone))[0]).toMatchObject({ email: 'amina.ios@example.dz' })
    const bad = await ios(body({ email: 'nope' }))
    expect(bad.status).toBe(422)
    expect((await bad.json()).error).toMatchObject({ code: 'VALIDATION', field: 'email' })
  })

  it('هاتف التلميذ وهاتف الولي إلزاميان، والرقم المؤكَّد المكرّر يُرفض', async () => {
    const { phone: _p, ...noPhone } = body()
    expect((await (await ios(noPhone)).json()).error).toMatchObject({ code: 'VALIDATION', field: 'phone' })
    const { guardianPhone: _g, ...noGuardian } = body()
    expect((await (await ios(noGuardian)).json()).error).toMatchObject({ code: 'VALIDATION', field: 'guardianPhone' })
    const a = await phoneOnly({ verified: true })
    const dup = await ios(body({ phone: a.phone }))
    expect(dup.status).toBe(400)
    expect((await dup.json()).error.code).toBe('PHONE_TAKEN')
  })
})

describe('الدخول برقم الهاتف', () => {
  it('حساب بلا بريد يدخل برقمه بصيغه المختلفة: الخدمة، نموذج الموقع، وواجهة التطبيق', async () => {
    const a = await phoneOnly({ verified: true })
    const intl = `+213 ${a.phone.slice(1, 4)} ${a.phone.slice(4, 6)} ${a.phone.slice(6, 8)} ${a.phone.slice(8)}`
    expect((await login(h.db, { email: a.phone, password: PASSWORD })).userId).toBe(a.userId)
    expect((await login(h.db, { email: intl, password: PASSWORD })).userId).toBe(a.userId)
    expect(await redirected(loginAction(null, form({ email: intl, password: PASSWORD })))).toBe('/student')
    expect((await resolveActor(h.db, cookieTokens.at(-1)!))?.userId).toBe(a.userId)
    const res = await api(a.phone, PASSWORD)
    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data).toMatchObject({ role: 'STUDENT' })
    expect((await resolveActor(h.db, data.token))?.userId).toBe(a.userId)
  })

  it('الدخول بالبريد لم يتغيّر', async () => {
    const phone = nextPhone()
    const r = await registerStudent(h.db, { email: 'login.mail@example.dz', password: PASSWORD, fullName: 'ببريد', phone })
    expect((await login(h.db, { email: 'Login.Mail@example.dz', password: PASSWORD })).userId).toBe(r.userId)
    expect(await redirected(loginAction(null, form({ email: 'login.mail@example.dz', password: PASSWORD })))).toBe('/student')
    expect((await api('login.mail@example.dz', PASSWORD)).status).toBe(200)
    await expect(login(h.db, { email: 'login.mail@example.dz', password: 'wrong-password' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    expect(loginIdentity(' Login.Mail@example.dz ')).toEqual({ scope: 'login-email', subject: sha256('login.mail@example.dz') })
  })

  it('كلمة سر خاطئة تقفل الرقم نفسه مهما اختلفت صيغة كتابته، بحدّ البريد نفسه، ولا تقفل رقمًا آخر', async () => {
    expect(RATE_LIMITS.loginPhone).toEqual(RATE_LIMITS.loginEmail)
    const a = await phoneOnly({ verified: true })
    const other = await phoneOnly({ verified: true })
    const forms = [a.phone, `+213${a.phone.slice(1)}`, `${a.phone.slice(0, 4)} ${a.phone.slice(4, 6)} ${a.phone.slice(6, 8)} ${a.phone.slice(8)}`, `213${a.phone.slice(1)}`]
    for (const f of forms) expect(loginIdentity(f)).toEqual({ scope: 'login-phone', subject: sha256(a.phone) })
    // نصف المحاولات من الموقع ونصفها من واجهة التطبيق: العدّاد واحد
    for (let i = 0; i < RATE_LIMITS.loginPhone.limit; i++) {
      const ident = forms[i % forms.length]!
      if (i % 2 === 0) expect(await loginAction(null, form({ email: ident, password: 'wrong-password' }))).toMatchObject({ ok: false, error: { code: 'INVALID_CREDENTIALS' } })
      else expect((await (await api(ident, 'wrong-password')).json()).error.code).toBe('INVALID_CREDENTIALS')
    }
    // بعد الحد: حتى كلمة السر الصحيحة تُرفض، من المسارين
    expect(await loginAction(null, form({ email: forms[1]!, password: PASSWORD }))).toMatchObject({ ok: false, error: { code: 'RATE_LIMITED' } })
    const locked = await api(forms[2]!, PASSWORD)
    expect(locked.status).toBe(429)
    // رقم آخر من العنوان نفسه يدخل
    expect((await api(other.phone, PASSWORD)).status).toBe(200)
  })

  it('الدخول الناجح يصفّر عدّاد الرقم', async () => {
    const a = await phoneOnly({ verified: true })
    for (let i = 0; i < 3; i++) await api(a.phone, 'wrong-password')
    const key = rateKey('login-phone', sha256(a.phone))
    expect((await h.db.select().from(rateLimits).where(eq(rateLimits.key, key)))[0]?.count).toBe(3)
    expect((await api(a.phone, PASSWORD)).status).toBe(200)
    expect(await h.db.select().from(rateLimits).where(eq(rateLimits.key, key))).toHaveLength(0)
  })

  it('رقم يتقاسمه حسابان: دخول أحدهما لا يصفّر عدّاد الرقم، فلا يخمّن به كلمة سر الآخر بلا قفل', async () => {
    // حسابان غير مؤكَّدين بالرقم نفسه (الرقم غير المؤكَّد لا يحجز شيئًا): الضحية لم تُدخل رمز SMS بعد
    const phone = nextPhone()
    await registerStudent(h.db, { email: `victim-${phone}@example.dz`, password: 'Victim-secret-2027', fullName: 'الضحية', phone, guardianPhone: guardian, wilayaId, levelId, streamId })
    await registerStudent(h.db, { email: `attacker-${phone}@example.dz`, password: 'Attacker-pass-2027', fullName: 'المهاجم', phone, guardianPhone: guardian, wilayaId, levelId, streamId })
    const statuses: number[] = []
    for (let round = 0; round < 3; round++) {
      // تخمينات على كلمة سر الضحية ثم دخول صحيح بحساب المهاجم — من المسارين
      for (let i = 0; i < 3; i++) statuses.push((await api(phone, `guess-${round}-${i}-wrong`)).status)
      if (round % 2 === 0) statuses.push((await api(phone, 'Attacker-pass-2027')).status)
      else await loginAction(null, form({ email: phone, password: 'Attacker-pass-2027' })).then((r) => statuses.push(r?.ok === false && r.error.code === 'RATE_LIMITED' ? 429 : 0), () => statuses.push(200))
    }
    // 12 محاولة على رقم واحد في نافذة واحدة: ما بعد الثامنة يُقفل، ولو تخلّلها دخول ناجح بالحساب الآخر
    expect(statuses.slice(0, RATE_LIMITS.loginPhone.limit)).not.toContain(429)
    expect(statuses.slice(RATE_LIMITS.loginPhone.limit)).toEqual([429, 429, 429, 429])
  })
})

describe('استعادة كلمة السر والبريد لحساب بلا بريد', () => {
  it('يُستعاد برمز SMS إلى هاتفه المؤكَّد، ولا يُرسل أي بريد', async () => {
    const a = await phoneOnly({ verified: true })
    expect(await requestPhonePasswordReset(h.db, a.phone, { ip: '192.0.2.10' })).toEqual({ cooldown: 60 })
    const code = sms.filter((m) => m.to === a.phone).at(-1)?.variables?.code
    expect(code).toMatch(/^\d{6}$/)
    await resetPasswordByPhone(h.db, { phone: a.phone, code: code!, password: 'New-password-2027' }, { ip: '192.0.2.10' })
    const [row] = await byPhone(a.phone)
    expect(await verifyPassword('New-password-2027', row!.hash)).toBe(true)
    expect((await login(h.db, { email: a.phone, password: 'New-password-2027' })).userId).toBe(a.userId)
    // إشعار «تغيّرت كلمة السر» يُرسل بالبريد لمن له بريد فقط: هنا يُتخطّى بصمت
    expect(emails).toHaveLength(0)
  })

  it('مسار البريد يفشل بهدوء: نفس الرد لبريد مجهول، بلا رسالة وبلا كشف لوجود الحساب', async () => {
    await phoneOnly({ verified: true })
    expect(await requestPasswordReset(h.db, 'nobody@example.dz')).toEqual({ sent: false })
    expect(await requestPasswordReset(h.db, '')).toEqual({ sent: false })
    expect(emails).toHaveLength(0)
  })
})

describe('قوائم الإدارة لحساب بلا بريد', () => {
  it('لا تتعطل ولا تعرض null/undefined، والبحث بالاسم يجده', async () => {
    const admin = await makeAdmin(h.db)
    const phone = nextPhone()
    const r = await registerStudent(h.db, { password: PASSWORD, fullName: 'رميساء بلا بريد', phone, guardianPhone: guardian, wilayaId, levelId, streamId })
    const all = await listAllStudents(h.db, admin, { search: 'رميساء' })
    const mine = all.find((s) => s.userId === r.userId)
    expect(mine).toMatchObject({ email: '', fullName: 'رميساء بلا بريد', phone })
    // والبحث بالرقم يجده: الهاتف معرّف هذا الحساب
    const u = (await listUsers(h.db, admin, { search: phone })).rows.find((x) => x.id === r.userId)
    expect(u).toMatchObject({ email: '', phone })
    expect((await listAllStudents(h.db, admin, { search: phone })).map((s) => s.userId)).toEqual([r.userId])
  })
})
