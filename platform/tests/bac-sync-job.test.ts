import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { bacExams, jobs, notifications } from '@/server/db/schema'
import { claimNextJob, enqueueJob } from '@/server/jobs/queue'
import { processQueuedJobs } from '@/server/jobs/runner'
import type { Actor } from '@/server/lib/actor'
import { bacSyncStatus, requestBacSync } from '@/server/services/bac-sync.service'
import { fakeSite } from './fake-dzexams'
import { makeAdmin, makeTeacher, setupDb } from './helpers'

let h: DatabaseHandle
let admin: Actor
let teacher: Actor

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin)
  process.env.BAC_SYNC_DELAY_MS = '0'
  vi.stubGlobal('fetch', fakeSite)
})

afterAll(async () => {
  vi.unstubAllGlobals()
  delete process.env.BAC_SYNC_DELAY_MS
  await h.close()
})

const job = async (id: string) => (await h.db.select().from(jobs).where(eq(jobs.id, id)))[0]!

describe('جلب بكالوريات DzExams من لوحة الإدارة (مهمة بطيئة بتقدّم)', () => {
  it('للمدير وحده، والمسار الافتراضي لا يلتقطها', async () => {
    await expect(requestBacSync(h.db, teacher, { mode: 'trial' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const r = await requestBacSync(h.db, admin, { mode: 'trial' })
    expect(r.reused).toBe(false)
    // مهمة مصحّح في المسار الافتراضي تمرّ، والزحف يبقى في الانتظار
    await enqueueJob(h.db, { type: 'CLEANUP', payload: {} })
    const s = await processQueuedJobs(h.db, { limit: 5 })
    expect(s.processed).toBe(1)
    expect((await job(r.jobId)).status).toBe('QUEUED')
    // والمسار البطيء لا يلتقط غيرها
    await enqueueJob(h.db, { type: 'CLEANUP', payload: {} })
    const claimed = await claimNextJob(h.db, new Date(), 'slow')
    expect(claimed?.id).toBe(r.jobId)
    // نعيدها للانتظار ليكملها الاختبار التالي
    await h.db.update(jobs).set({ status: 'QUEUED', attempts: 0 }).where(eq(jobs.id, r.jobId))
    await processQueuedJobs(h.db, { limit: 5 })
  })

  it('التجربة تقرأ مادة واحدة بلا حفظ وتترك سجلاً وإشعاراً', async () => {
    const pending = (await bacSyncStatus(h.db, admin)).job!
    expect(pending.status).toBe('QUEUED')
    const s = await processQueuedJobs(h.db, { limit: 1, lane: 'slow' })
    expect(s).toMatchObject({ processed: 1, completed: 1 })
    const st = await bacSyncStatus(h.db, admin)
    expect(st.job).toMatchObject({ status: 'COMPLETED', mode: 'trial', result: { found: 2, saved: 0, subjects: 1 } })
    expect(st.job!.logs.join('\n')).toContain('الموضوع: https://cdn.dzexams.com/bac/arabe-2024-lp.pdf')
    expect(st.saved).toBe(0)
    const n = await h.db.select().from(notifications).where(eq(notifications.userId, admin.userId))
    expect(n.some((x) => x.title === 'انتهت تجربة جلب DzExams' && (x.body ?? '').includes('بلا حفظ'))).toBe(true)
  })

  it('الجلب الكامل يحفظ الروابط ويكتب التقدّم، ولا يعمل مرّتان معاً', async () => {
    const a = await requestBacSync(h.db, admin, { mode: 'all' })
    const b = await requestBacSync(h.db, admin, { mode: 'all' })
    expect(b).toEqual({ jobId: a.jobId, reused: true })
    await processQueuedJobs(h.db, { limit: 1, lane: 'slow' })
    const st = await bacSyncStatus(h.db, admin)
    expect(st).toMatchObject({ saved: 2, withDirectLink: 2, subjects: 1 })
    expect(st.job).toMatchObject({ status: 'COMPLETED', mode: 'all', result: { subjects: 2, found: 2, saved: 2, withDirectLink: 2, errors: 0 }, progress: { phase: 'done', subjects: 2 } })
    const row = await job(a.jobId)
    expect(row).toMatchObject({ totalItems: 2, processedItems: 2, failedItems: 0 })
    expect(row.logs.some((l) => l.startsWith('تمّ:'))).toBe(true)
    // ثانية: لا زيارة للمحفوظ ولا تكرار
    const c = await requestBacSync(h.db, admin, { mode: 'all' })
    await processQueuedJobs(h.db, { limit: 1, lane: 'slow' })
    expect((await job(c.jobId)).result).toMatchObject({ found: 2, saved: 0 })
    expect(await h.db.select().from(bacExams)).toHaveLength(2)
  })

  it('مهمة قُطعت بإعادة تشغيل الخادم تُعلَّم فاشلة ويُسمح بأخرى', async () => {
    const stuck = await enqueueJob(h.db, { type: 'BAC_SYNC', payload: { mode: 'all' }, maxAttempts: 1 })
    await h.db.update(jobs).set({ status: 'PROCESSING', startedAt: new Date(Date.now() - 4 * 60 * 60_000) }).where(eq(jobs.id, stuck.id))
    const r = await requestBacSync(h.db, admin, { mode: 'trial' })
    expect(r.reused).toBe(false)
    expect((await job(stuck.id))).toMatchObject({ status: 'FAILED', error: expect.stringContaining('interrupted') })
    await processQueuedJobs(h.db, { limit: 1, lane: 'slow' })
  })
})
