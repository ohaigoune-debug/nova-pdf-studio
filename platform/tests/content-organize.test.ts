import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setAiProviderForTests } from '@/server/ai/provider'
import type { AIProvider, OrganizeLessonsInput } from '@/server/ai/types'
import type { DatabaseHandle } from '@/server/db/connect'
import { content, jobs, notifications } from '@/server/db/schema'
import { processQueuedJobs } from '@/server/jobs/runner'
import type { Actor } from '@/server/lib/actor'
import { PermanentJobError } from '@/server/lib/errors'
import { applyOrganizeProposals, contentOrganizeStatus, requestContentOrganize } from '@/server/services/content-organize.service'
import { createContent } from '@/server/services/content.service'
import { makeAdmin, makeTeacher, setupDb } from './helpers'

let h: DatabaseHandle
let teacher: Actor
let other: Actor
const ids: string[] = []
const seen: OrganizeLessonsInput[] = []

/** مزوّد يشبه الحقيقي: ينظّف العناوين ويقترح محوراً — ويُسجّل ما أُرسل إليه */
const organizer = {
  name: 'openai',
  model: 'x',
  async organizeLessons(input: OrganizeLessonsInput) {
    seen.push(input)
    return {
      lessons: input.items.map((i, n) => ({
        youtubeId: i.youtubeId,
        title: i.title.replace(/^الحلقة \d+ \| /, '').replace(/ - قناة .*$/, ''),
        summary: `يتعلّم التلميذ ${n + 1}`,
        topic: 'البلاغة',
        order: n + 1
      }))
    }
  }
} as unknown as AIProvider

beforeAll(async () => {
  h = await setupDb()
  const admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin)
  other = await makeTeacher(h.db, admin, 'أستاذ آخر')
  const titles = ['الحلقة 12 | الاستعارة المكنية - قناة الأستاذ', 'الحلقة 13 | الكناية - قناة الأستاذ', 'التشبيه البليغ']
  for (const [i, title] of titles.entries()) {
    const c = await createContent(h.db, teacher, { type: 'VIDEO', title, externalUrl: `https://www.youtube.com/watch?v=abcdefghij${i}`, videoProvider: 'YOUTUBE', visibility: 'PUBLIC', publish: true, topic: i === 2 ? 'البلاغة' : null })
    ids.push(c.id)
  }
  await createContent(h.db, teacher, { type: 'LESSON', title: 'درس مكتوب', body: 'نص', visibility: 'PUBLIC', publish: true })
})

afterAll(async () => {
  setAiProviderForTests(null)
  await h.close()
})

describe('تنظيم فيديوهات الأستاذ بالذكاء الاصطناعي', () => {
  it('بلا مزوّد حقيقي يُرفض، وبلا فيديوهات يُرفض', async () => {
    setAiProviderForTests(null)
    await expect(requestContentOrganize(h.db, teacher)).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' })
    setAiProviderForTests(organizer)
    await expect(requestContentOrganize(h.db, other)).rejects.toMatchObject({ code: 'NO_VIDEO_LESSONS' })
  })

  it('يقترح لكل فيديو عنواناً وملخّصاً ومحوراً دون أن يغيّر شيئاً', async () => {
    setAiProviderForTests(organizer)
    const r = await requestContentOrganize(h.db, teacher)
    expect(r).toMatchObject({ reused: false, lessons: 3 })
    expect((await requestContentOrganize(h.db, teacher)).reused).toBe(true)
    await processQueuedJobs(h.db)
    const st = await contentOrganizeStatus(h.db, teacher)
    expect(st.job).toMatchObject({ id: r.jobId, status: 'COMPLETED', totalItems: 3, processedItems: 3 })
    const props = st.job!.result!.proposals
    expect(props).toHaveLength(3)
    // المفتاح معرّف الدرس لا معرّف يوتيوب، والدروس المكتوبة خارج الطلب
    expect(seen[0]!.items.map((i) => i.youtubeId)).toEqual(ids)
    expect(props.find((p) => p.contentId === ids[0])).toMatchObject({ proposed: { title: 'الاستعارة المكنية', topic: 'البلاغة' }, changed: true })
    // لم يتغيّر أي درس بعد
    const [c0] = await h.db.select().from(content).where(eq(content.id, ids[0]!))
    expect(c0!.title).toBe('الحلقة 12 | الاستعارة المكنية - قناة الأستاذ')
    const n = await h.db.select().from(notifications).where(eq(notifications.userId, teacher.userId))
    expect(n.some((x) => x.title === 'اقتراحات تنظيم الفيديوهات جاهزة')).toBe(true)
  })

  it('يطبّق المختار فقط، لصاحب الدروس فقط', async () => {
    const st = await contentOrganizeStatus(h.db, teacher)
    const jobId = st.job!.id
    await expect(applyOrganizeProposals(h.db, other, jobId, ids)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    const r = await applyOrganizeProposals(h.db, teacher, jobId, [ids[0]!, ids[1]!])
    expect(r.applied).toBe(2)
    const rows = await h.db.select({ id: content.id, title: content.title, topic: content.topic, summary: content.summary }).from(content)
    expect(rows.find((x) => x.id === ids[0])).toMatchObject({ title: 'الاستعارة المكنية', topic: 'البلاغة', summary: 'يتعلّم التلميذ 1' })
    expect(rows.find((x) => x.id === ids[1])).toMatchObject({ title: 'الكناية' })
    expect(rows.find((x) => x.id === ids[2])).toMatchObject({ title: 'التشبيه البليغ', summary: null })
    const [j] = await h.db.select().from(jobs).where(eq(jobs.id, jobId))
    expect((j!.result as { appliedIds: string[] }).appliedIds.sort()).toEqual([ids[0], ids[1]].sort())
  })

  it('فشل المزوّد نهائياً: المهمة تفشل ويصل الإشعار بالسبب', async () => {
    setAiProviderForTests({ name: 'openai', model: 'x', organizeLessons: async () => { throw new PermanentJobError('AI HTTP 429 insufficient_quota') } } as unknown as AIProvider)
    const r = await requestContentOrganize(h.db, teacher)
    await processQueuedJobs(h.db)
    const [j] = await h.db.select().from(jobs).where(eq(jobs.id, r.jobId))
    expect(j!.status).toBe('FAILED')
    const n = await h.db.select().from(notifications).where(eq(notifications.userId, teacher.userId))
    expect(n.some((x) => x.title === 'لم يُنظَّم الفيديوهات' && (x.body ?? '').includes('رصيد'))).toBe(true)
  })
})
