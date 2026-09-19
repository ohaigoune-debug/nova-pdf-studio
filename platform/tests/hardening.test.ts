import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createSession, resolveActor } from '@/server/auth/session'
import type { DatabaseHandle } from '@/server/db/connect'
import { jobs, passwordResets, qrNonces, rateLimits, sessions } from '@/server/db/schema'
import { enqueueJob } from '@/server/jobs/queue'
import { processQueuedJobs } from '@/server/jobs/runner'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { setMailerForTests, type MailMessage } from '@/server/lib/mailer'
import { checkRateLimit, resetRateLimit } from '@/server/lib/rate-limit'
import { login, requestPasswordReset, resetPassword, verifyPasswordResetToken } from '@/server/services/auth.service'
import { ensureMaintenanceJobs, runCleanupJob } from '@/server/services/maintenance.service'
import { makeAdmin, makeStudent, setupDb } from './helpers'

let h: DatabaseHandle
let admin: Actor
let student: Actor
let studentEmail: string
const sent: MailMessage[] = []

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  student = await makeStudent(h.db, 'طالب التحصين')
  studentEmail = student.email
  setMailerForTests({
    name: 'memory',
    async send(m) {
      sent.push(m)
    }
  })
})

afterAll(async () => {
  setMailerForTests(null)
  await h.close()
})

describe('التحصين: الحدّ من المحاولات، إعادة تعيين كلمة السر، الصيانة', () => {
  it('الحدّ من المحاولات: نافذة ثابتة، يرمي RATE_LIMITED بعد الحد، ويُعاد بعد النجاح أو النافذة التالية', async () => {
    const rule = { scope: 'test', subject: '1.2.3.4', limit: 3, windowSeconds: 60 }
    // نسبيّ إلى الآن: تاريخ ثابت يصير أقدم من مهلة التنظيف فتحذفه مهمة الصيانة لاحقاً في هذا الملف
    const t0 = new Date()
    expect((await checkRateLimit(h.db, rule, t0)).remaining).toBe(2)
    expect((await checkRateLimit(h.db, rule, t0)).remaining).toBe(1)
    expect((await checkRateLimit(h.db, rule, t0)).remaining).toBe(0)
    await expectCode(() => checkRateLimit(h.db, rule, t0), 'RATE_LIMITED')
    // نافذة جديدة
    expect((await checkRateLimit(h.db, rule, new Date(t0.getTime() + 61_000))).remaining).toBe(2)
    // إعادة صريحة
    await resetRateLimit(h.db, rule.scope, rule.subject)
    expect((await checkRateLimit(h.db, rule, t0)).remaining).toBe(2)
    // المفاتيح مستقلة
    expect((await checkRateLimit(h.db, { ...rule, subject: '5.6.7.8' }, t0)).remaining).toBe(2)
  })

  it('إعادة تعيين كلمة السر: لا يكشف وجود البريد، الرابط مجزّأ وصالح 30 دقيقة ولمرة واحدة، وينهي الجلسات', async () => {
    expect(await requestPasswordReset(h.db, 'nobody@test.dz')).toEqual({ sent: false })
    expect(sent).toHaveLength(0)
    const s1 = await createSession(h.db, { userId: student.userId })
    expect(await resolveActor(h.db, s1.token)).toBeTruthy()

    const r = await requestPasswordReset(h.db, studentEmail.toUpperCase(), { ip: '9.9.9.9' })
    expect(r.sent).toBe(true)
    expect(sent).toHaveLength(1)
    const link = sent[0]!.text.match(/https?:\/\/\S+\/reset-password\?token=(\S+)/)
    expect(link).toBeTruthy()
    const token = link![1]!
    const rows = await h.db.select().from(passwordResets).where(eq(passwordResets.userId, student.userId))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.tokenHash).not.toBe(token)
    expect(rows[0]?.requestedIp).toBe('9.9.9.9')

    await expectCode(() => verifyPasswordResetToken(h.db, 'x'.repeat(40)), 'RESET_TOKEN_INVALID')
    await expectCode(() => verifyPasswordResetToken(h.db, token, new Date(Date.now() + 31 * 60_000)), 'RESET_TOKEN_EXPIRED')
    await expectCode(() => resetPassword(h.db, token, 'short'), 'WEAK_PASSWORD')
    await resetPassword(h.db, token, 'NewPass@2026')
    await expectCode(() => resetPassword(h.db, token, 'NewPass@2026'), 'RESET_TOKEN_INVALID')

    await expectCode(() => login(h.db, { email: studentEmail, password: 'Student@12345' }), 'INVALID_CREDENTIALS')
    const ok = await login(h.db, { email: studentEmail, password: 'NewPass@2026' })
    expect(ok.userId).toBe(student.userId)
    // الجلسة القديمة أُنهيت
    expect(await resolveActor(h.db, s1.token)).toBeNull()
  })

  it('فشل المزوّد البريدي لا يكشف شيئاً ولا يرمي', async () => {
    setMailerForTests({
      name: 'broken',
      async send() {
        throw new Error('smtp down')
      }
    })
    expect(await requestPasswordReset(h.db, studentEmail)).toEqual({ sent: false })
    setMailerForTests({
      name: 'memory',
      async send(m) {
        sent.push(m)
      }
    })
  })

  it('مهمة الصيانة تنظّف المنتهي فقط وتُجدوَل مرة كل 24 ساعة', async () => {
    const now = new Date()
    const old = new Date(now.getTime() - 40 * 86_400_000)
    await h.db.insert(sessions).values({ userId: admin.userId, tokenHash: 'old-hash', expiresAt: old })
    await h.db.insert(qrNonces).values({ nonce: 'old-nonce', studentId: student.studentId!, expiresAt: old })
    await h.db.insert(qrNonces).values({ nonce: 'fresh-nonce', studentId: student.studentId!, expiresAt: new Date(now.getTime() + 60_000) })
    await h.db.insert(passwordResets).values({ userId: student.userId, tokenHash: 'old-reset', expiresAt: old })
    await h.db.insert(rateLimits).values({ key: 'old:key', windowStart: old, count: 1 })
    await h.db.insert(jobs).values({ type: 'AI_TEACHER_INSIGHTS', payload: {}, status: 'COMPLETED', createdAt: old })
    await h.db.insert(jobs).values({ type: 'REPORT_EXPORT', payload: {}, status: 'COMPLETED', createdAt: old })

    expect(await ensureMaintenanceJobs(h.db)).toBe(true)
    expect(await ensureMaintenanceJobs(h.db)).toBe(false)
    const s = await processQueuedJobs(h.db)
    expect(s.completed).toBe(1)
    const [job] = await h.db.select().from(jobs).where(eq(jobs.type, 'CLEANUP'))
    expect(job?.result).toMatchObject({ sessions: 1, nonces: 1, resets: 1, rateLimits: 1, jobs: 1 })
    expect(await h.db.select().from(qrNonces)).toHaveLength(1)
    // التقارير لا تُحذف تلقائياً (ملفات الأستاذ)
    expect((await h.db.select().from(jobs).where(eq(jobs.type, 'REPORT_EXPORT')))).toHaveLength(1)
    // الجلسة الحالية باقية
    expect((await h.db.select().from(sessions).where(eq(sessions.userId, student.userId))).length).toBeGreaterThan(0)
    // لا جدولة ثانية خلال 24 ساعة
    expect(await ensureMaintenanceJobs(h.db)).toBe(false)
    expect(await ensureMaintenanceJobs(h.db, new Date(now.getTime() + 25 * 3600_000))).toBe(true)
    expect(await runCleanupJob(h.db)).toMatchObject({ nonces: 0 })
    await enqueueJob(h.db, { type: 'CLEANUP', payload: {} }) // لا يفشل عند التكرار
    expect((await processQueuedJobs(h.db)).failed).toBe(0)
  })
})
