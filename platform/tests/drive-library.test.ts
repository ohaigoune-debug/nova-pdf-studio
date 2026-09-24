import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import type { Actor } from '@/server/lib/actor'
import { setDriveSource } from '@/server/services/drive-source.service'
import { draftFromDriveFile, listDriveLibrary, publishExplanation } from '@/server/services/drive-library.service'
import { fakeDrive, LESSON_IMAGERY } from './fake-drive'
import { makeAdmin, makeTeacher, setupDb } from './helpers'

const FOLDER = 'FOLDER_library01'
const EXERCISE = `تمرين: استخرج من البيت صورة بيانية وسمّها واشرحها.
«وإذا المنيّة أنشبت أظفارها»
الحل:
الصورة: استعارة مكنية، شبّه المنيّة بحيوان مفترس فحذفه وأبقى لازمه «الأظفار».`
const drive = fakeDrive({ [FOLDER]: 'بلاغة' }, [
  { id: 'exercise_01', name: 'تمرين الاستعارة', mimeType: 'application/vnd.google-apps.document', text: EXERCISE, parent: FOLDER },
  { id: 'lesson_0001', name: 'درس الصور البيانية', mimeType: 'application/vnd.google-apps.document', text: LESSON_IMAGERY, parent: FOLDER }
])
const opts = { apiKey: 'test-key', fetch: drive }

let h: DatabaseHandle
let teacher: Actor
let other: Actor
let cache: string
beforeAll(async () => {
  h = await setupDb()
  const admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin)
  other = await makeTeacher(h.db, admin, 'أستاذ ثانٍ')
  cache = await mkdtemp(path.join(tmpdir(), 'lib-cache-'))
  process.env.DRIVE_CACHE_DIR = cache
  await setDriveSource(h.db, teacher, FOLDER, opts)
})
afterAll(async () => {
  delete process.env.DRIVE_CACHE_DIR
  await rm(cache, { recursive: true, force: true })
  await h.close()
})

describe('مكتبة Drive: الأستاذ يختار الملف والذكاء يصوغ منه', () => {
  it('تعرض ملفات المجلد المربوط فقط، ولا شيء لمن لم يربط', async () => {
    const lib = await listDriveLibrary(h.db, teacher, opts)
    expect(lib?.files.map((f) => f.name).sort()).toEqual(['تمرين الاستعارة', 'درس الصور البيانية'].sort())
    expect(lib?.files.find((f) => f.id === 'exercise_01')?.viewUrl).toBe('https://docs.google.com/document/d/exercise_01/view')
    expect(await listDriveLibrary(h.db, other, opts)).toBeNull()
  })

  it('واجب: نصّ التمرين بلا حلّه، والحل النموذجي منقول من الملف', async () => {
    const d = await draftFromDriveFile(h.db, teacher, 'exercise_01', 'assignment', opts)
    expect(d.statement).toContain('استخرج من البيت')
    expect(d.statement).not.toContain('استعارة مكنية')
    expect(d.modelAnswer).toContain('استعارة مكنية')
    expect(d.solutionInSource).toBe(true)
    // ملف ليس في المجلد المربوط يُرفض
    await expect(draftFromDriveFile(h.db, teacher, 'someone_else_file', 'assignment', opts)).rejects.toMatchObject({ code: 'FILE_NOT_FOUND' })
  })

  it('شرح: مسودة يراجعها الأستاذ، ثم تُنشر مقالاً بمرجع الملف', async () => {
    const d = await draftFromDriveFile(h.db, teacher, 'lesson_0001', 'explanation', opts)
    expect(d.body).toContain('الاستعارة')
    const row = await publishExplanation(h.db, teacher, { title: d.title, summary: d.summary, body: `${d.body}\nملاحظة الأستاذ`, sourceUrl: d.viewUrl, visibility: 'STUDENTS_ONLY', groupIds: [], publish: true })
    expect(row.type).toBe('ARTICLE')
    expect(row.publishedAt).not.toBeNull()
    expect(row.body).toContain('ملاحظة الأستاذ')
    expect(row.body).toContain('https://docs.google.com/document/d/lesson_0001/view')
  })
})
