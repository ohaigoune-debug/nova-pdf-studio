/**
 * حدود المحاولات والعناوين المشتركة: شبكات الهاتف النقال تجمع آلاف التلاميذ خلف عنوان واحد (CGNAT)،
 * فالعنوان سقف واسع والقفل على الهوية (رقم الهاتف في التسجيل). كان الحدّ 10 تسجيلات في الساعة
 * لكل عنوان، فيُرفض التلميذ الحادي عشر بعد أي منشور.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { clientIp } from '@/server/lib/client-ip'
import { sha256 } from '@/server/lib/codes'
import { AppError } from '@/server/lib/errors'
import { RATE_LIMITS, checkRateLimit, checkRegisterLimits } from '@/server/lib/rate-limit'
import { setupDb } from './helpers'

let h: DatabaseHandle
// وقت ثابت في منتصف نافذة: لا يتأثر الاختبار بحدّ الساعة
const NOW = new Date('2026-11-10T20:30:00Z')
const phoneKey = (i: number) => sha256(`0661${String(i).padStart(6, '0')}`)
const limited = (e: unknown) => e instanceof AppError && e.code === 'RATE_LIMITED'

beforeAll(async () => {
  h = await setupDb()
})
afterAll(async () => {
  await h.close()
})

describe('rate limits behind a shared mobile address', () => {
  it('lets 200 different students register from one address within the hour', async () => {
    for (let i = 0; i < 200; i++) await checkRegisterLimits(h.db, { ip: '197.200.10.1', phoneKey: phoneKey(i) }, NOW)
  })

  it('still caps a single address', async () => {
    const ip = '197.200.10.2'
    for (let i = 0; i < RATE_LIMITS.registerIp.limit; i++) await checkRegisterLimits(h.db, { ip, phoneKey: phoneKey(10_000 + i) }, NOW)
    await expect(checkRegisterLimits(h.db, { ip, phoneKey: phoneKey(99_999) }, NOW)).rejects.toSatisfy(limited)
  })

  it('locks repeated registration attempts on one phone number, whatever address they come from', async () => {
    const key = phoneKey(500_000)
    for (let i = 0; i < RATE_LIMITS.registerPhone.limit; i++) await checkRegisterLimits(h.db, { ip: `197.200.20.${i}`, phoneKey: key }, NOW)
    await expect(checkRegisterLimits(h.db, { ip: '197.200.20.250', phoneKey: key }, NOW)).rejects.toSatisfy(limited)
    // رقم آخر من العنوان نفسه لا يتأثر
    await checkRegisterLimits(h.db, { ip: '197.200.20.250', phoneKey: phoneKey(500_001) }, NOW)
  })

  it('the per-phone window reopens the next hour', async () => {
    const key = phoneKey(600_000)
    for (let i = 0; i < RATE_LIMITS.registerPhone.limit; i++) await checkRegisterLimits(h.db, { ip: '197.200.30.1', phoneKey: key }, NOW)
    await expect(checkRegisterLimits(h.db, { ip: '197.200.30.1', phoneKey: key }, NOW)).rejects.toSatisfy(limited)
    await checkRegisterLimits(h.db, { ip: '197.200.30.1', phoneKey: key }, new Date(NOW.getTime() + 61 * 60 * 1000))
  })

  it('lets 200 logins through one address in 15 minutes while the per-account lock stays tight', async () => {
    for (let i = 0; i < 200; i++) await checkRateLimit(h.db, { scope: 'login-ip', subject: '197.200.40.1', ...RATE_LIMITS.loginIp }, NOW)
    expect(RATE_LIMITS.loginEmail.limit).toBeLessThanOrEqual(8)
    expect(RATE_LIMITS.passwordReset.limit).toBeLessThanOrEqual(5)
  })

  it('address ceilings are wide and identity locks are narrow', () => {
    expect(RATE_LIMITS.registerIp.limit).toBeGreaterThanOrEqual(200)
    expect(RATE_LIMITS.loginIp.limit).toBeGreaterThanOrEqual(200)
    expect(RATE_LIMITS.passwordResetIp.limit).toBeGreaterThan(RATE_LIMITS.passwordReset.limit)
    expect(RATE_LIMITS.registerPhone.limit).toBeLessThanOrEqual(5)
  })
})

describe('client address behind the proxy', () => {
  const h = (init: Record<string, string>) => new Headers(init)

  it('prefers X-Real-IP, which Caddy writes itself, over a forwarded chain the visitor can forge', () => {
    expect(clientIp(h({ 'x-real-ip': '197.200.1.9', 'x-forwarded-for': '1.2.3.4, 197.200.1.9, 172.64.0.1' }))).toBe('197.200.1.9')
  })

  it('falls back to the first forwarded address when the proxy sets no X-Real-IP', () => {
    expect(clientIp(h({ 'x-forwarded-for': '197.200.1.9, 10.0.0.2' }))).toBe('197.200.1.9')
  })

  it('accepts IPv6 and ignores a malformed X-Real-IP', () => {
    expect(clientIp(h({ 'x-real-ip': '2a02:8440::1' }))).toBe('2a02:8440::1')
    expect(clientIp(h({ 'x-real-ip': 'not-an-ip', 'x-forwarded-for': '197.200.1.9' }))).toBe('197.200.1.9')
  })

  it('returns null when no proxy header is present', () => {
    expect(clientIp(h({}))).toBeNull()
  })
})
