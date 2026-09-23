import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppError } from '@/server/lib/errors'
import { listDriveFolder, parseDriveFolderId } from '@/server/lib/google-drive'
import { getDriveSource, loadSourceDocs, queryTerms, selectPassages, setDriveSource, clearDriveSource } from '@/server/services/drive-source.service'
import { fakeDrive, LESSON_IMAGERY, LESSON_OTHER } from './fake-drive'
import { makeAdmin, makeStudent, makeTeacher, setupDb } from './helpers'

const FOLDER = 'FOLDER_abcdefghij'
const drive = fakeDrive({ [FOLDER]: 'دروس البلاغة', [`${FOLDER}/sub`]: 'ملحقات' }, [
  { id: 'doc1', name: 'الصور البيانية', mimeType: 'application/vnd.google-apps.document', text: LESSON_IMAGERY, parent: FOLDER },
  { id: 'doc2', name: 'العروض.txt', mimeType: 'text/plain', text: LESSON_OTHER, parent: `${FOLDER}/sub` },
  { id: 'img', name: 'صورة.png', mimeType: 'image/png', parent: FOLDER }
])
const opts = { apiKey: 'test-key', fetch: drive }

let cache: string
beforeAll(async () => {
  cache = await mkdtemp(path.join(tmpdir(), 'drive-cache-'))
  process.env.DRIVE_CACHE_DIR = cache
})
afterAll(async () => {
  delete process.env.DRIVE_CACHE_DIR
  await rm(cache, { recursive: true, force: true })
})

describe('قراءة مجلد Google Drive', () => {
  it('يفهم روابط المجلد بصيغها', () => {
    expect(parseDriveFolderId(`https://drive.google.com/drive/folders/${FOLDER}?usp=sharing`)).toBe(FOLDER)
    expect(parseDriveFolderId(`https://drive.google.com/drive/u/0/folders/${FOLDER}`)).toBe(FOLDER)
    expect(parseDriveFolderId(`https://drive.google.com/open?id=${FOLDER}`)).toBe(FOLDER)
    expect(parseDriveFolderId('ليس رابطاً')).toBeNull()
  })

  it('يسرد الملفات المقروءة مع المجلدات الفرعية ويتجاهل الصور', async () => {
    const r = await listDriveFolder(FOLDER, opts)
    expect(r.name).toBe('دروس البلاغة')
    expect(r.files.map((f) => f.name).sort()).toEqual(['الصور البيانية', 'ملحقات / العروض.txt'].sort())
  })

  it('المفتاح الخاطئ والمجلد غير المشارَك يعطيان سبباً واضحاً', async () => {
    await expect(listDriveFolder(FOLDER, { apiKey: 'bad', fetch: drive })).rejects.toMatchObject({ code: 'DRIVE_API_DISABLED' })
    const closed = fakeDrive({ [FOLDER]: 'x' }, [], { shared: false })
    await expect(listDriveFolder(FOLDER, { apiKey: 'test-key', fetch: closed })).rejects.toMatchObject({ code: 'DRIVE_NOT_SHARED' })
  })
})

describe('اختيار المقاطع: من المجلد لا غير', () => {
  it('يأخذ ما يخصّ المهارة ويرفض ما لا أثر له في المجلد', async () => {
    const docs = await loadSourceDocs(FOLDER, opts)
    expect(docs).toHaveLength(2)
    const picked = selectPassages(docs, queryTerms('الصور البيانية'))
    expect(picked?.map((d) => d.title)).toEqual(['الصور البيانية'])
    expect(picked?.[0]?.text).toContain('الاستعارة')
    expect(selectPassages(docs, queryTerms('المعادلات التفاضلية'))).toBeNull()
  })

  it('النصوص تُخبَّأ: ملف لم يتغيّر لا يُنزَّل ثانية', async () => {
    let calls = 0
    const counting = (async (i: RequestInfo | URL, init?: RequestInit) => {
      if (String(i).includes('/export')) calls++
      return drive(i, init)
    }) as typeof fetch
    await loadSourceDocs(FOLDER, { apiKey: 'test-key', fetch: counting })
    expect(calls).toBe(0)
  })
})

describe('ربط المجلد من إعدادات الأستاذ', () => {
  it('يُتحقَّق منه قبل الحفظ، ويُفكّ، والتلميذ لا يربط شيئاً', async () => {
    const h = await setupDb()
    try {
      const teacher = await makeTeacher(h.db, await makeAdmin(h.db))
      await expect(setDriveSource(h.db, teacher, 'رابط خاطئ', opts)).rejects.toMatchObject({ code: 'INVALID_DRIVE_URL' })
      const empty = fakeDrive({ EMPTY_folder01: 'فارغ' }, [])
      await expect(setDriveSource(h.db, teacher, 'EMPTY_folder01', { apiKey: 'test-key', fetch: empty })).rejects.toMatchObject({ code: 'DRIVE_EMPTY' })

      const s = await setDriveSource(h.db, teacher, `https://drive.google.com/drive/folders/${FOLDER}`, opts)
      expect(s).toMatchObject({ folderId: FOLDER, folderName: 'دروس البلاغة', files: 2 })
      expect(await getDriveSource(h.db, teacher.workspaceId!)).toMatchObject({ folderId: FOLDER })
      await clearDriveSource(h.db, teacher)
      expect(await getDriveSource(h.db, teacher.workspaceId!)).toBeNull()

      const student = await makeStudent(h.db)
      await expect(setDriveSource(h.db, student, FOLDER, opts)).rejects.toBeInstanceOf(AppError)
    } finally {
      await h.close()
    }
  })
})
