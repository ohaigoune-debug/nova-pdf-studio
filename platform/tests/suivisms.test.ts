/**
 * SuiviSMS الحقيقي (نُقل من NOVA): لا نصّ حرّ في الإرسال الحيّ، قالب معتمد أو تحدّي OTP تولّده البوابة.
 * ورمز التحقق عبر البوابة في otp.service: يُحفظ معرّف التحدّي، والتحقق لديها، و4 أرقام مقبولة.
 */
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { otpCodes } from '@/server/db/schema'
import { AppError } from '@/server/lib/errors'
import { SUIVISMS, SmsError, setSmsSenderForTests, suivismsSender, toInternational } from '@/server/lib/sms'
import { normalizeDigits, requestOtp, verifyOtp } from '@/server/services/otp.service'
import { setupDb } from './helpers'

interface Call {
  url: string
  method: string
  headers: Record<string, string>
  body: Record<string, unknown>
}

function gateway(responder: (c: Call) => { status?: number; body: unknown }) {
  const calls: Call[] = []
  const fetchImpl: typeof fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const c: Call = { url: String(input), method: init?.method ?? 'GET', headers: Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v])), body: init?.body ? JSON.parse(String(init.body)) : {} }
    calls.push(c)
    const r = responder(c)
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
  return { calls, fetchImpl }
}

describe('عميل SuiviSMS', () => {
  it('الأرقام دولية +213', () => {
    expect(toInternational('0555123456')).toBe('+213555123456')
    expect(toInternational('213555123456')).toBe('+213555123456')
    expect(toInternational('+213 555 12 34 56')).toBe('+213555123456')
  })
  it('مفتاح حيّ بلا قالب: الرسالة الحرّة مرفوضة محلياً، وتحدّي OTP يذهب إلى /v1/otp/challenges بترويسة Idempotency-Key', async () => {
    const g = gateway((c) => (c.url.endsWith('/verify') ? { body: { status: c.body.code === '4821' ? 'verified' : 'failed' } } : { status: 202, body: { id: 'otp_1', status: 'queued' } }))
    const s = suivismsSender('sv_live_abcdef123456', { fetchImpl: g.fetchImpl })
    expect(s.sandbox).toBe(false)
    await expect(s.send({ to: '0555123456', text: 'مرحبا' })).rejects.toBeInstanceOf(SmsError)
    expect(g.calls.length).toBe(0)
    const ch = await s.sendOtp!('0555123456', 'otp:test-1234')
    expect(ch.id).toBe('otp_1')
    expect(g.calls[0]!.url).toBe(`${SUIVISMS.baseUrl}/v1/otp/challenges`)
    expect(g.calls[0]!.headers.authorization).toBe('Bearer sv_live_abcdef123456')
    expect(g.calls[0]!.headers['idempotency-key']).toBe('otp:test-1234')
    expect(g.calls[0]!.body).toEqual({ to: '+213555123456' })
    expect(await s.verifyOtp!('otp_1', '4821')).toEqual({ ok: true, status: 'verified' })
    expect(g.calls[1]!.url).toBe(`${SUIVISMS.baseUrl}/v1/otp/challenges/otp_1/verify`)
    expect((await s.verifyOtp!('otp_1', '0000')).ok).toBe(false)
    await expect(s.sendOtp!('0555123456', 'short')).rejects.toThrow(/Idempotency/)
  })
  it('مع قالب معتمد: POST /v1/messages بـ template_id وvariables ولا حقل مرسِل', async () => {
    const g = gateway(() => ({ status: 202, body: { id: 'msg_1', status: 'queued' } }))
    const s = suivismsSender('sv_live_abcdef123456', { templateId: 'tpl_otp', fetchImpl: g.fetchImpl })
    await s.send({ to: '0555123456', text: 'x', variables: { name: 'مدرسة', code: '123456' } })
    expect(g.calls[0]!.url).toBe(`${SUIVISMS.baseUrl}/v1/messages`)
    expect(g.calls[0]!.body).toEqual({ to: '+213555123456', template_id: 'tpl_otp', variables: { name: 'مدرسة', code: '123456' } })
    expect(g.calls[0]!.body.sender).toBeUndefined()
  })
  it('مفتاح اختبار: مسارات sandbox والقالب التجريبي وحقل fields', async () => {
    const g = gateway(() => ({ status: 202, body: { id: 'msg_t', status: 'sent' } }))
    const s = suivismsSender('sv_test_abcdef123456', { fetchImpl: g.fetchImpl })
    expect(s.sandbox).toBe(true)
    await s.send({ to: '0555000001', text: 'x', variables: { name: 'مدرسة', code: '1' } })
    expect(g.calls[0]!.url).toBe(`${SUIVISMS.baseUrl}/v1/sandbox/messages`)
    expect(g.calls[0]!.body).toEqual({ to: '+213555000001', template_id: 'tpl_test_transactional', fields: { name: 'مدرسة', code: '1' } })
  })
  it('أخطاء البوابة تحمل الرمز والرسالة (insufficient_balance 402)', async () => {
    const g = gateway(() => ({ status: 402, body: { error: { code: 'insufficient_balance', message: 'Solde insuffisant' } } }))
    const s = suivismsSender('sv_live_abcdef123456', { templateId: 'tpl', fetchImpl: g.fetchImpl })
    await expect(s.send({ to: '0555123456', text: 'x', variables: {} })).rejects.toMatchObject({ status: 402, code: 'insufficient_balance' })
  })
  it('تطبيع الأرقام: عربية وفارسية وصفّ AZERTY', () => {
    expect(normalizeDigits('٤٨٢١')).toBe('4821')
    expect(normalizeDigits('۴۸۲۱')).toBe('4821')
    expect(normalizeDigits("'_\"&")).toBe('4831')
    expect(normalizeDigits(' 48 21 ')).toBe('4821')
  })
})

describe('رمز التحقق عبر البوابة في otp.service', () => {
  let h: DatabaseHandle
  const verify: string[] = []
  let otpSends = 0
  beforeAll(async () => {
    h = await setupDb()
    setSmsSenderForTests({
      name: 'suivisms',
      send: async () => {
        throw new SmsError('template required', 500, 'template_required')
      },
      sendOtp: async () => ({ id: `otp_${++otpSends}` }),
      verifyOtp: async (id, code) => {
        verify.push(`${id}:${code}`)
        return code === '4821' ? { ok: true, status: 'verified' } : { ok: false, status: 'wrong' }
      }
    })
  })
  afterAll(async () => {
    setSmsSenderForTests(null)
    await h.close()
  })
  it('الطلب ينشئ تحدّياً لدى البوابة ويحفظ معرّفه؛ الكود الخاطئ يُعدّ محاولة، والصحيح (4 أرقام) يُستهلك', async () => {
    const r = await requestOtp(h.db, { phone: '0555123456', purpose: 'ORDER' })
    expect(otpSends).toBe(1)
    const [row] = await h.db.select().from(otpCodes).where(eq(otpCodes.phone, r.phone))
    expect(row!.providerRef).toBe('otp_1')
    expect(row!.codeHash).toBe('gateway')
    await expect(verifyOtp(h.db, { phone: '0555123456', purpose: 'ORDER', code: '٠٠٠٠' })).rejects.toSatisfy((e) => e instanceof AppError && e.code === 'OTP_INVALID')
    expect(verify).toEqual(['otp_1:0000'])
    expect(await verifyOtp(h.db, { phone: '0555123456', purpose: 'ORDER', code: '4821' })).toEqual({ ok: true })
    const [after] = await h.db.select().from(otpCodes).where(eq(otpCodes.id, row!.id))
    expect(after!.consumedAt).toBeTruthy()
    expect(after!.attempts).toBe(1)
  })
})
