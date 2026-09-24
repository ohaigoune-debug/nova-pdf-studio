import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { and, eq, isNull } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { content, jobs } from '@/server/db/schema'
import { processQueuedJobs } from '@/server/jobs/runner'
import type { Actor } from '@/server/lib/actor'
import { requestFileImport } from '@/server/services/file-import.service'
import { uploadFile } from '@/server/services/files.service'
import { fakeDrive, LESSON_IMAGERY, LESSON_OTHER } from './fake-drive'
import { makeAdmin, makeTeacher, setupDb } from './helpers'

let h: DatabaseHandle
let teacher: Actor
let cache: string
const FOLDER = 'FOLDER_import0001'
const drive = fakeDrive({ [FOLDER]: 'دروسي' }, [{ id: 'metre_doc01', name: 'العروض', mimeType: 'application/vnd.google-apps.document', text: LESSON_OTHER, parent: FOLDER }])

beforeAll(async () => {
  h = await setupDb()
  teacher = await makeTeacher(h.db, await makeAdmin(h.db))
  process.env.UPLOADS_DIR = await mkdtemp(path.join(tmpdir(), 'uploads-'))
  cache = await mkdtemp(path.join(tmpdir(), 'cache-'))
  process.env.DRIVE_CACHE_DIR = cache
  process.env.GOOGLE_API_KEY = 'test-key'
  vi.stubGlobal('fetch', drive)
})
afterAll(async () => {
  vi.unstubAllGlobals()
  delete process.env.GOOGLE_API_KEY
  delete process.env.DRIVE_CACHE_DIR
  await rm(cache, { recursive: true, force: true })
  await h.close()
})

describe('استيراد ملفات كثيرة دروساً', () => {
  it('ملف نصي يصير مقالاً، ومجلد Drive روابط، ثم لا تكرار عند الإعادة', async () => {
    const f = await uploadFile(h.db, teacher, { originalName: 'درس الصور البيانية.txt', mimeType: 'text/plain', bytes: Buffer.from(LESSON_IMAGERY) })
    const input = { fileIds: [f.id], driveLinks: [`https://drive.google.com/drive/folders/${FOLDER}`], organize: true, publish: false, visibility: 'STUDENTS_ONLY' as const, groupIds: [] }
    const r = await requestFileImport(h.db, teacher, input)
    await processQueuedJobs(h.db)
    const [job] = await h.db.select().from(jobs).where(eq(jobs.id, r.jobId))
    expect(job?.status).toBe('COMPLETED')
    const rows = await h.db.select().from(content).where(and(eq(content.workspaceId, teacher.workspaceId!), isNull(content.deletedAt)))
    const article = rows.find((x) => x.type === 'ARTICLE')
    const link = rows.find((x) => x.type === 'LINK')
    expect(article?.title).toBe('درس الصور البيانية')
    expect(article?.body).toContain('الاستعارة')
    expect(article?.summary).toBeTruthy()
    expect(link?.externalUrl).toBe('https://docs.google.com/document/d/metre_doc01/view')
    expect(rows.every((x) => x.publishedAt === null)).toBe(true)

    const again = await requestFileImport(h.db, teacher, input)
    await processQueuedJobs(h.db)
    const [job2] = await h.db.select().from(jobs).where(eq(jobs.id, again.jobId))
    expect(job2?.result).toMatchObject({ imported: 0 })
  })

  it('يرفض بلا ملفات ولا روابط، وبرابط ليس من Drive', async () => {
    const base = { organize: false, publish: false, visibility: 'STUDENTS_ONLY' as const, groupIds: [] }
    await expect(requestFileImport(h.db, teacher, { ...base, fileIds: [], driveLinks: [] })).rejects.toMatchObject({ code: 'SOURCES_REQUIRED' })
    await expect(requestFileImport(h.db, teacher, { ...base, fileIds: [], driveLinks: ['https://example.com/x'] })).rejects.toMatchObject({ code: 'INVALID_DRIVE_URL' })
  })
})
