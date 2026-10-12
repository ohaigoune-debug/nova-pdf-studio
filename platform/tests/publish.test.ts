import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import JSZip from 'jszip'
import { PDFDocument } from 'pdf-lib'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setAiProviderForTests } from '@/server/ai/provider'
import type { AIProvider, OrganizeUploadInput } from '@/server/ai/types'
import type { DatabaseHandle } from '@/server/db/connect'
import { content, files, levels, resources, subjects, uploadBatches } from '@/server/db/schema'
import { seedCurriculum } from '@/server/db/seed-curriculum'
import { processQueuedJobs } from '@/server/jobs/runner'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { storage } from '@/server/lib/storage'
import { splitByHeadings, guessDocType } from '@/lib/publish-guess'
import { createContent } from '@/server/services/content.service'
import { generateCodes } from '@/server/services/enrollment-codes.service'
import { redeemEnrollmentCode } from '@/server/services/enrollment.service'
import { uploadFile } from '@/server/services/files.service'
import { createGroup } from '@/server/services/groups.service'
import { listResourceCards, publicResourceFile } from '@/server/services/library.service'
import { createBatch, createBatchFromContent, getBatch, listPublished, publishBatch, saveBatchItems, unpublishResource, type BatchDefaults } from '@/server/services/publish.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb } from './helpers'

let h: DatabaseHandle
let admin: Actor
let teacher: Actor
let other: Actor
let math: string
let am4: string

async function pdf(pages: number): Promise<Buffer> {
  const d = await PDFDocument.create()
  for (let i = 0; i < pages; i++) d.addPage([300, 400])
  return Buffer.from(await d.save())
}
const up = async (actor: Actor, name: string, bytes: Buffer, mime = 'application/pdf') => (await uploadFile(h.db, actor, { originalName: name, mimeType: mime, bytes })).id
const defaults = (patch: Partial<BatchDefaults> = {}): BatchDefaults => ({ type: 'AUTO', subjectId: math, levelId: am4, streamId: null, term: 1, year: 2026, audience: 'PUBLIC', groupIds: [], author: 'الأستاذ حيقون أسامة', ...patch })
const code = async (fn: () => Promise<unknown>) => {
  try {
    await fn()
    return null
  } catch (e) {
    return e instanceof AppError ? e.code : String(e)
  }
}

/** ذكاء اصطناعي مزيّف: يقسّم الملف ذا الصفحات الست إلى فرضين وحلّ الأول */
const splitter = {
  name: 'openai',
  model: 'x',
  async organizeUpload(input: OrganizeUploadInput) {
    const f = input.files[0]!
    return {
      documents: [
        { fileKey: f.key, fromPage: 1, toPage: 2, type: 'HOMEWORK' as const, title: 'الفرض الأول للفصل الأول', subjectCode: 'MATH', levelCode: '4AM', streamCode: null, term: 1, year: null, solutionOf: null },
        { fileKey: f.key, fromPage: 3, toPage: 4, type: 'TEST' as const, title: 'اختبار الفصل الأول', subjectCode: 'MATH', levelCode: '4AM', streamCode: null, term: 1, year: null, solutionOf: null },
        { fileKey: f.key, fromPage: 5, toPage: 6, type: 'SOLUTION' as const, title: 'حلّ الفرض الأول', subjectCode: 'MATH', levelCode: '4AM', streamCode: null, term: 1, year: null, solutionOf: 0 }
      ]
    }
  }
} as unknown as AIProvider

beforeAll(async () => {
  process.env.UPLOADS_DIR = await mkdtemp(path.join(tmpdir(), 'publish-uploads-'))
  h = await setupDb()
  await seedCurriculum(h.db)
  admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin, 'حيقون أسامة')
  other = await makeTeacher(h.db, admin, 'أستاذ آخر')
  math = (await h.db.select({ id: subjects.id }).from(subjects).where(eq(subjects.code, 'MATH')))[0]!.id
  am4 = (await h.db.select({ id: levels.id }).from(levels).where(eq(levels.code, '4AM')))[0]!.id
})

afterAll(async () => {
  setAiProviderForTests(null)
  delete process.env.UPLOADS_DIR
  await h.close()
})

describe('صفحة «نشر» للأستاذ والمشرف', () => {
  it('النوع من الاسم، وتقسيم سلسلة عند عناوين صفحاتها', () => {
    expect(guessDocType('حل الفرض الأول.pdf')).toBe('SOLUTION')
    expect(guessDocType('الفرض الثاني رياضيات.pdf')).toBe('HOMEWORK')
    expect(guessDocType('اختبار الفصل الأول.docx')).toBe('TEST')
    expect(guessDocType('ملخص الدوال.pdf')).toBe('SUMMARY')
    const segs = splitByHeadings([
      { n: 1, text: 'الفرض الأول في الرياضيات\nالتمرين 1' },
      { n: 2, text: 'التمرين 2' },
      { n: 3, text: 'اختبار الفصل الأول\nالتمرين 1' },
      { n: 4, text: 'حل الفرض الأول\nالتمرين 1: …' }
    ])
    expect(segs.map((s) => [s.fromPage, s.toPage, s.type])).toEqual([
      [1, 2, 'HOMEWORK'],
      [3, 3, 'TEST'],
      [4, 4, 'SOLUTION']
    ])
  })

  it('ZIP «كما رفعته»: يُفكّ، كل ملف وثيقة، الحلّ يُرفق بموضوعه، و«من إنشاء» يظهر', async () => {
    const zip = new JSZip()
    zip.file('الفصل الأول/الفرض الأول.pdf', await pdf(1))
    zip.file('الفصل الأول/حل الفرض الأول.pdf', await pdf(1))
    zip.file('الفصل الأول/درس المعادلات.pdf', await pdf(2))
    zip.file('__MACOSX/._x.pdf', 'junk')
    const zipId = await up(teacher, 'رياضيات 4 متوسط.zip', Buffer.from(await zip.generateAsync({ type: 'uint8array' })), 'application/zip')
    const b = await createBatch(h.db, teacher, { fileIds: [zipId], mode: 'manual', defaults: defaults() })
    expect(b.status).toBe('READY')
    const { batch } = await getBatch(h.db, teacher, b.id)
    expect(batch.items.map((i) => [i.type, i.title])).toEqual([
      ['HOMEWORK', 'الفرض الأول'],
      ['SOLUTION', 'حل الفرض الأول'],
      ['LESSON', 'درس المعادلات']
    ])
    expect(batch.items[1]!.solutionFor).toBe(batch.items[0]!.key)
    const r = await publishBatch(h.db, teacher, b.id)
    expect(r).toEqual({ published: 3, sections: { exams: 2, lessons: 1 } })

    const exams = await listResourceCards(h.db, { types: ['HOMEWORK', 'TEST', 'SOLUTION', 'EXERCISE'], levelId: am4 })
    const hw = exams.items.find((i) => i.title === 'الفرض الأول')!
    expect(hw).toMatchObject({ author: 'الأستاذ حيقون أسامة', hasSolution: true, groupOnly: false })
    expect(hw.href).toBe(`/library/r/${hw.id}`)
    const sol = await publicResourceFile(h.db, hw.id, 'solution')
    expect(sol.fileId).toBeTruthy()
    const lessons = await listResourceCards(h.db, { types: ['LESSON', 'SUMMARY'], levelId: am4 })
    expect(lessons.items.map((i) => i.title)).toContain('درس المعادلات')
    expect((await listPublished(h.db, teacher)).length).toBe(3)
    expect((await listPublished(h.db, other)).length).toBe(0)
  })

  it('اقتراح الذكاء الاصطناعي يقسّم السلسلة صفحاتٍ، يُراجَع ويُعدَّل، ثم يُنشر ملفات منفصلة', async () => {
    setAiProviderForTests(splitter)
    const id = await up(teacher, 'سلسلة الفروض.pdf', await pdf(6))
    const b = await createBatch(h.db, teacher, { fileIds: [id], mode: 'ai', defaults: defaults({ type: 'AUTO' }) })
    expect(b.status).toBe('ANALYZING')
    await processQueuedJobs(h.db, { lane: 'slow', limit: 5 })
    const { batch } = await getBatch(h.db, teacher, b.id)
    expect(batch.status).toBe('READY')
    expect(batch.items.map((i) => [i.fromPage, i.toPage, i.type])).toEqual([
      [1, 2, 'HOMEWORK'],
      [3, 4, 'TEST'],
      [5, 6, 'SOLUTION']
    ])
    expect(batch.items[2]!.solutionFor).toBe('d1')
    // الأستاذ يعدّل العنوان ويستبعد الاختبار
    await saveBatchItems(h.db, teacher, b.id, [{ key: 'd1', title: 'الفرض الأول — الرياضيات' }, { key: 'd2', include: false }])
    const r = await publishBatch(h.db, teacher, b.id)
    expect(r.published).toBe(2)
    const [hw] = await h.db.select().from(resources).where(eq(resources.title, 'الفرض الأول — الرياضيات'))
    expect(hw!.hasSolution).toBe(true)
    const [f] = await h.db.select().from(files).where(eq(files.id, hw!.fileId!))
    const doc = await PDFDocument.load(await storage().get(f!.storageKey))
    expect(doc.getPageCount()).toBe(2)
    setAiProviderForTests(null)
  })

  it('«أفواجي فقط»: يراه تلاميذ الفوج وحدهم، والأستاذ لا ينشر لفوج غيره', async () => {
    const g = await createGroup(h.db, teacher, { name: 'فوج 4 متوسط', dayOfWeek: 6, startTime: '10:00' })
    const foreign = await createGroup(h.db, other, { name: 'فوج آخر', dayOfWeek: 1, startTime: '10:00' })
    const member = await makeStudent(h.db, 'تلميذ الفوج')
    const outsider = await makeStudent(h.db, 'تلميذ خارج الفوج')
    await redeemEnrollmentCode(h.db, member, (await generateCodes(h.db, teacher, { groupId: g.id, count: 1 })).codes[0]!.code)
    const id = await up(teacher, 'فرض خاص.pdf', await pdf(1))
    expect(await code(() => createBatch(h.db, teacher, { fileIds: [id], mode: 'manual', defaults: defaults({ audience: 'GROUPS', groupIds: [foreign.id] }) }))).toBe('FORBIDDEN')
    const b = await createBatch(h.db, teacher, { fileIds: [id], mode: 'manual', defaults: defaults({ audience: 'GROUPS', groupIds: [g.id], type: 'HOMEWORK' }) })
    await publishBatch(h.db, teacher, b.id)
    const titles = async (studentId: string | null) => (await listResourceCards(h.db, { types: ['HOMEWORK'], studentId })).items.map((i) => i.title)
    expect(await titles(member.studentId)).toContain('فرض خاص')
    expect(await titles(outsider.studentId)).not.toContain('فرض خاص')
    expect(await titles(null)).not.toContain('فرض خاص')
    const [r] = await h.db.select().from(resources).where(eq(resources.title, 'فرض خاص'))
    expect(await code(() => publicResourceFile(h.db, r!.id, 'file', { studentId: outsider.studentId }))).toBe('NOT_FOUND')
    expect((await publicResourceFile(h.db, r!.id, 'file', { studentId: member.studentId })).fileId).toBeTruthy()
    // ملفات أستاذ آخر لا تُستعمل
    expect(await code(() => createBatch(h.db, other, { fileIds: [id], mode: 'manual', defaults: defaults() }))).toBe('FILE_NOT_FOUND')
    // السحب
    await unpublishResource(h.db, teacher, r!.id)
    expect(await titles(member.studentId)).not.toContain('فرض خاص')
  })

  it('المشرف يفكّ سلسلة منشورة في «الدروس» وينقلها، فتُسحب من الدروس', async () => {
    setAiProviderForTests(splitter)
    const fileId = await up(admin, 'سلسلة الفروض والاختبارات 4 متوسط.pdf', await pdf(6))
    const c = await createContent(h.db, admin, { type: 'PDF', title: 'سلسلة الفروض والاختبارات — السنة الرابعة متوسط — الفصل الأول (نسخة مجانية)', fileId, levelId: am4, visibility: 'PUBLIC', publish: true })
    const b = await createBatchFromContent(h.db, admin, c.id)
    await processQueuedJobs(h.db, { lane: 'slow', limit: 5 })
    const [batch] = await h.db.select().from(uploadBatches).where(eq(uploadBatches.id, b.id))
    expect(batch!.defaults.term).toBe(1)
    expect(batch!.items).toHaveLength(3)
    const r = await publishBatch(h.db, admin, b.id)
    expect(r.sections.exams).toBe(3)
    const [after] = await h.db.select().from(content).where(eq(content.id, c.id))
    expect(after!.publishedAt).toBeNull()
    setAiProviderForTests(null)
  })
})
