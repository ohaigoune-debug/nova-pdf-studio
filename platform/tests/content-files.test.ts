import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { signFileUrl, verifyFileSignature } from '@/server/lib/storage'
import { listPublicContent } from '@/server/queries/content.queries'
import { listStudentContent } from '@/server/queries/student-extras.queries'
import { createContent, deleteContent, getContentForEdit, getContentForStudent, updateContent } from '@/server/services/content.service'
import { generateCodes } from '@/server/services/enrollment-codes.service'
import { redeemEnrollmentCode } from '@/server/services/enrollment.service'
import { deleteFile, readFileForDownload, uploadFile } from '@/server/services/files.service'
import { createGroup } from '@/server/services/groups.service'
import { searchWorkspace } from '@/server/services/search.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb } from './helpers'

let h: DatabaseHandle
let admin: Actor
let teacherA: Actor
let teacherB: Actor
let groupA: { id: string }
let s1: Actor
let s3: Actor

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

beforeAll(async () => {
  process.env.UPLOADS_DIR = path.join(os.tmpdir(), `madrasa-test-uploads-${Date.now()}`)
  h = await setupDb()
  admin = await makeAdmin(h.db)
  teacherA = await makeTeacher(h.db, admin, 'الأستاذ أ')
  teacherB = await makeTeacher(h.db, admin, 'الأستاذ ب')
  groupA = await createGroup(h.db, teacherA, { name: 'فوج قالمة' })
  const groupB = await createGroup(h.db, teacherB, { name: 'فوج ب' })
  s1 = await makeStudent(h.db, 'محمد أحمد')
  s3 = await makeStudent(h.db, 'طالب آخر')
  const ca = await generateCodes(h.db, teacherA, { groupId: groupA.id, count: 1 })
  await redeemEnrollmentCode(h.db, s1, ca.codes[0]!.code)
  const cb = await generateCodes(h.db, teacherB, { groupId: groupB.id, count: 1 })
  await redeemEnrollmentCode(h.db, s3, cb.codes[0]!.code)
})

afterAll(async () => {
  await h.close()
})

describe('الملفات', () => {
  it('رفع ملف مسموح، رفض الكبير والنوع غير المسموح، والطالب لا يرفع', async () => {
    const pdf = Buffer.from('%PDF-1.4 test')
    const f = await uploadFile(h.db, teacherA, { originalName: 'ملخص.pdf', mimeType: 'application/pdf', bytes: pdf })
    expect(f.storageKey).toContain(teacherA.workspaceId!)
    const back = await readFileForDownload(h.db, f.id)
    expect(back.bytes.equals(pdf)).toBe(true)
    await expectCode(() => uploadFile(h.db, teacherA, { originalName: 'x.exe', mimeType: 'application/x-msdownload', bytes: pdf }), 'FILE_TYPE_NOT_ALLOWED')
    await expectCode(() => uploadFile(h.db, teacherA, { originalName: 'big.pdf', mimeType: 'application/pdf', bytes: Buffer.alloc(16 * 1024 * 1024) }), 'FILE_TOO_LARGE')
    await expectCode(() => uploadFile(h.db, s1, { originalName: 'a.pdf', mimeType: 'application/pdf', bytes: pdf }), 'FORBIDDEN')
    await expectCode(() => deleteFile(h.db, teacherB, f.id), 'FILE_NOT_FOUND')
    await deleteFile(h.db, teacherA, f.id)
    await expectCode(() => readFileForDownload(h.db, f.id), 'FILE_NOT_FOUND')
  })

  it('الروابط الموقّعة: صالحة ضمن المدة، مرفوضة عند التلاعب أو الانتهاء', () => {
    const id = '11111111-1111-1111-1111-111111111111'
    const url = new URL(signFileUrl(id, 60), 'http://x')
    const exp = url.searchParams.get('exp')
    const sig = url.searchParams.get('sig')
    expect(verifyFileSignature(id, exp, sig)).toBe(true)
    expect(verifyFileSignature(id, exp, sig + 'x')).toBe(false)
    expect(verifyFileSignature('22222222-2222-2222-2222-222222222222', exp, sig)).toBe(false)
    expect(verifyFileSignature(id, exp, sig, Date.now() + 120_000)).toBe(false)
    expect(verifyFileSignature(id, null, null)).toBe(false)
  })
})

describe('المحتوى والرؤية', () => {
  it('محتوى موجّه لفوج يظهر لطلابه فقط، والعام يظهر للجميع', async () => {
    const c = await createContent(h.db, teacherA, { type: 'LESSON', title: 'درس الحال', body: '## الحال\n- تعريف', visibility: 'GROUP_ONLY', groupIds: [groupA.id], publish: true })
    expect((await getContentForStudent(h.db, s1, c.slug)).title).toBe('درس الحال')
    await expectCode(() => getContentForStudent(h.db, s3, c.slug), 'CONTENT_NOT_FOUND')
    expect((await listStudentContent(h.db, s1)).some((x) => x.id === c.id)).toBe(true)
    expect((await listStudentContent(h.db, s3)).some((x) => x.id === c.id)).toBe(false)
    expect((await listPublicContent(h.db)).some((x) => x.id === c.id)).toBe(false)

    const pub = await createContent(h.db, teacherA, { type: 'ARTICLE', title: 'مقال عام', visibility: 'PUBLIC', publish: true })
    expect((await listPublicContent(h.db)).some((x) => x.id === pub.id)).toBe(true)
    expect((await getContentForStudent(h.db, s3, pub.slug)).id).toBe(pub.id)

    const draft = await createContent(h.db, teacherA, { type: 'ARTICLE', title: 'مسودة', visibility: 'PUBLIC', publish: false })
    expect((await listPublicContent(h.db)).some((x) => x.id === draft.id)).toBe(false)
    await updateContent(h.db, teacherA, draft.id, { publish: true })
    expect((await listPublicContent(h.db)).some((x) => x.id === draft.id)).toBe(true)
  })

  it('العزل والحذف', async () => {
    const c = await createContent(h.db, teacherA, { type: 'LESSON', title: 'خاص', visibility: 'STUDENTS_ONLY', publish: true })
    await expectCode(() => getContentForEdit(h.db, teacherB, c.id), 'CONTENT_NOT_FOUND')
    await expectCode(() => updateContent(h.db, teacherB, c.id, { title: 'x' }), 'CONTENT_NOT_FOUND')
    await expectCode(() => createContent(h.db, s1, { type: 'LESSON', title: 'x', visibility: 'PUBLIC' }), 'FORBIDDEN')
    await expectCode(() => createContent(h.db, teacherA, { type: 'LESSON', title: 'x', visibility: 'GROUP_ONLY', groupIds: [] }), 'VALIDATION')
    const edit = await getContentForEdit(h.db, teacherA, c.id)
    expect(edit.groupIds).toEqual([])
    await deleteContent(h.db, teacherA, c.id)
    await expectCode(() => getContentForStudent(h.db, s1, c.slug), 'CONTENT_NOT_FOUND')
  })

  it('البحث الشامل مقيّد بمساحة الأستاذ', async () => {
    const a = await searchWorkspace(h.db, teacherA, 'محمد')
    expect(a.students.some((s) => s.fullName === 'محمد أحمد')).toBe(true)
    const b = await searchWorkspace(h.db, teacherB, 'محمد')
    expect(b.students).toHaveLength(0)
    expect((await searchWorkspace(h.db, teacherA, 'قالمة')).groups).toHaveLength(1)
    expect((await searchWorkspace(h.db, teacherA, 'الحال')).content.length).toBeGreaterThanOrEqual(1)
    await expectCode(() => searchWorkspace(h.db, s1, 'x'), 'FORBIDDEN')
  })
})
