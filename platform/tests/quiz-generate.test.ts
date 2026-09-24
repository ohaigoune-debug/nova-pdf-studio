import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { jobs, notifications } from '@/server/db/schema'
import { processQueuedJobs } from '@/server/jobs/runner'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { uploadFile } from '@/server/services/files.service'
import { createGroup } from '@/server/services/groups.service'
import { requestQuizGeneration } from '@/server/services/quiz-generate.service'
import { getQuizForEdit } from '@/server/services/quizzes.service'
import { fakeDrive, LESSON_IMAGERY, LESSON_OTHER } from './fake-drive'
import { makeAdmin, makeTeacher, setupDb } from './helpers'

let h: DatabaseHandle
let teacher: Actor
let other: Actor
let group: { id: string }
let fileId: string
let cache: string
const drive = fakeDrive({}, [{ id: 'metre_file01', name: 'العروض', mimeType: 'application/vnd.google-apps.document', text: LESSON_OTHER, parent: 'x' }])

beforeAll(async () => {
  h = await setupDb()
  const admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin)
  other = await makeTeacher(h.db, admin, 'أستاذ آخر')
  group = await createGroup(h.db, teacher, { name: 'فوج الاختبار المولَّد' })
  process.env.UPLOADS_DIR = await mkdtemp(path.join(tmpdir(), 'uploads-'))
  cache = await mkdtemp(path.join(tmpdir(), 'cache-'))
  process.env.DRIVE_CACHE_DIR = cache
  process.env.GOOGLE_API_KEY = 'test-key'
  vi.stubGlobal('fetch', drive)
  const f = await uploadFile(h.db, teacher, { originalName: 'الصور البيانية.txt', mimeType: 'text/plain', bytes: Buffer.from(LESSON_IMAGERY) })
  fileId = f.id
})

afterAll(async () => {
  vi.unstubAllGlobals()
  delete process.env.GOOGLE_API_KEY
  delete process.env.DRIVE_CACHE_DIR
  await rm(cache, { recursive: true, force: true })
  await h.close()
})

async function runAndGetQuiz(jobId: string) {
  await processQueuedJobs(h.db)
  const [job] = await h.db.select().from(jobs).where(eq(jobs.id, jobId))
  return job!
}

describe('توليد اختبار من مصادر الأستاذ وحدها', () => {
  it('من ملف مرفوع ورابط Drive معاً، بالأنواع المطلوبة، ومسودة غير منشورة', async () => {
    const r = await requestQuizGeneration(h.db, teacher, {
      topic: null,
      count: 6,
      questionTypes: ['TRUE_FALSE'],
      groupIds: [group.id],
      fileIds: [fileId],
      driveLinks: ['https://drive.google.com/file/d/metre_file01/view'],
      useLinkedFolder: false
    })
    const job = await runAndGetQuiz(r.jobId)
    expect(job.status).toBe('COMPLETED')
    const result = job.result as { quizId: string; sources: string[] }
    expect(result.sources.sort()).toEqual(['الصور البيانية.txt', 'العروض'].sort())
    const q = await getQuizForEdit(h.db, teacher, result.quizId)
    expect(q.publishedAt).toBeNull()
    expect(q.questions.length).toBeGreaterThanOrEqual(3)
    expect(q.questions.every((x) => x.type === 'TRUE_FALSE')).toBe(true)
    // كل سؤال جملة من المصادر نفسها
    for (const x of q.questions) {
      const sentence = x.prompt.replace('صحيح أم خطأ: ', '')
      expect(LESSON_IMAGERY.includes(sentence) || LESSON_OTHER.includes(sentence)).toBe(true)
    }
    expect(q.description).toContain('«العروض»')
  })

  it('بموضوع: ما يخصّه فقط، وإن غاب عن المصادر فلا شيء وإشعار بالسبب', async () => {
    const ok = await requestQuizGeneration(h.db, teacher, { topic: 'الاستعارة', count: 5, questionTypes: [], groupIds: [group.id], fileIds: [fileId], driveLinks: ['https://drive.google.com/file/d/metre_file01/view'], useLinkedFolder: false })
    const job = await runAndGetQuiz(ok.jobId)
    expect((job.result as { sources: string[] }).sources).toEqual(['الصور البيانية.txt'])

    const miss = await requestQuizGeneration(h.db, teacher, { topic: 'المعادلات التفاضلية', count: 5, questionTypes: [], groupIds: [group.id], fileIds: [fileId], driveLinks: [], useLinkedFolder: false })
    const failed = await runAndGetQuiz(miss.jobId)
    expect(failed).toMatchObject({ status: 'FAILED', error: 'SOURCES_NO_MATCH' })
    const n = await h.db.select().from(notifications).where(eq(notifications.userId, teacher.userId))
    expect(n.some((x) => x.title.includes('لم يُولَّد الاختبار: المعادلات التفاضلية'))).toBe(true)
  })

  it('يرفض بلا مصادر، وبملفات أستاذ آخر، وبلا فوج', async () => {
    const base = { topic: null, count: 5, questionTypes: [], driveLinks: [], useLinkedFolder: false }
    await expect(requestQuizGeneration(h.db, teacher, { ...base, groupIds: [group.id], fileIds: [] })).rejects.toMatchObject({ code: 'SOURCES_REQUIRED' })
    await expect(requestQuizGeneration(h.db, other, { ...base, groupIds: [], fileIds: [fileId] })).rejects.toMatchObject({ code: 'FILE_NOT_FOUND' })
    await expect(requestQuizGeneration(h.db, teacher, { ...base, groupIds: [], fileIds: [fileId] })).rejects.toBeInstanceOf(AppError)
    await expect(requestQuizGeneration(h.db, teacher, { ...base, groupIds: [group.id], fileIds: [], useLinkedFolder: true })).rejects.toMatchObject({ code: 'DRIVE_SOURCE_MISSING' })
  })
})
