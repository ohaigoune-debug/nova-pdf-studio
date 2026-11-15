/**
 * نطاق التلميذ في «دروسي» (قرار المالك 15 نوفمبر 2026): التلميذ المسجَّل يرى ويفتح دروس مستواه وشعبته فقط،
 * والمشتركة بين شعب مستواه، والقديمة غير المصنّفة. تغيير الرابط لا يفتح درسًا آخر (الخادم يمنع)،
 * والمحتوى الموجَّه له (دوراته) يبقى. الزائر والمشرف كما كانا. قاعدة PGlite في الذاكرة.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { seedCurriculum } from '@/server/db/seed-curriculum'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { getPublicContentBySlug, listPublicContent } from '@/server/queries/content.queries'
import { listStudentContent, listStudentFiles } from '@/server/queries/student-extras.queries'
import { listStudentLessonsOrganized } from '@/server/services/academy-catalog.service'
import { createContent, getContentForStudent } from '@/server/services/content.service'
import { uploadFile } from '@/server/services/files.service'
import { iosApiHome, iosApiLesson } from '@/server/services/ios-api.service'
import { resolveMediaAccess } from '@/server/services/media.service'
import { contentInScope, saveStudentLevelStream, studentScope, studentScopeOf } from '@/server/services/student-scope.service'
import { resolveCodes } from '@/server/services/taxonomy.service'
import { makeAdmin, makeStudent, setupDb } from './helpers'

let h: DatabaseHandle
let admin: Actor
let adab: Actor // 3 ثانوي آداب وفلسفة
let ulum: Actor // 3 ثانوي علوم تجريبية
let bare: Actor // بلا مستوى في حسابه
let C: Record<'common' | 'lit' | 'sci' | 'as2' | 'old' | 'targetedSci' | 'litPdf', { id: string; slug: string }>

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}
const slugsOf = (sections: Awaited<ReturnType<typeof listStudentLessonsOrganized>>) => sections.flatMap((s) => s.lessons.map((l) => l.slug))

beforeAll(async () => {
  process.env.UPLOADS_DIR = `data/test-uploads-scope-${Date.now()}`
  h = await setupDb()
  await seedCurriculum(h.db)
  admin = await makeAdmin(h.db)
  adab = await makeStudent(h.db, 'تلميذ آداب')
  ulum = await makeStudent(h.db, 'تلميذ علوم')
  bare = await makeStudent(h.db, 'تلميذ بلا مستوى')
  const lit = await resolveCodes(h.db, { level: '3AS', stream: 'LIT', subject: 'ARABIC' })
  const sci = await resolveCodes(h.db, { level: '3AS', stream: 'SCI', subject: 'ARABIC' })
  const as2 = await resolveCodes(h.db, { level: '2AS', stream: 'SCI' })
  await saveStudentLevelStream(h.db, adab, { levelId: lit.levelId!, streamId: lit.streamId })
  await saveStudentLevelStream(h.db, ulum, { levelId: sci.levelId!, streamId: sci.streamId })
  const mk = (title: string, levelId: string | null, streamId: string | null, extra: Record<string, unknown> = {}) =>
    createContent(h.db, admin, { type: 'LESSON', title, body: 'نص', levelId, streamId, visibility: 'PUBLIC', publish: true, ...extra })
  const pdf = await uploadFile(h.db, admin, { originalName: 'lit.pdf', mimeType: 'application/pdf', bytes: Buffer.from('%PDF-1.4\n%%EOF') })
  C = {
    common: await mk('مشترك 3 ثانوي', lit.levelId, null),
    lit: await mk('درس آداب', lit.levelId, lit.streamId),
    sci: await mk('درس علوم', sci.levelId, sci.streamId),
    as2: await mk('درس 2 ثانوي', as2.levelId, as2.streamId),
    old: await mk('درس قديم غير مصنّف', null, null),
    // درس شعبة أخرى لكنه موجَّه لتلميذ الآداب شخصيًا (مثل محتوى دورة): يبقى له
    targetedSci: await mk('درس علوم موجَّه لتلميذ الآداب', sci.levelId, sci.streamId, { visibility: 'SPECIFIC_STUDENTS', studentIds: [adab.studentId!] }),
    litPdf: await createContent(h.db, admin, { type: 'PDF', title: 'ملف آداب', fileId: pdf.id, levelId: lit.levelId, streamId: lit.streamId, visibility: 'PUBLIC', publish: true })
  }
})

afterAll(async () => {
  await h.close()
})

describe('نطاق الحساب', () => {
  it('المستوى والشعبة من الحساب، والسطر «السنة الثالثة ثانوي · آداب وفلسفة»', async () => {
    const s = await studentScope(h.db, adab.studentId!)
    expect(s.complete).toBe(true)
    expect(s.label).toBe('السنة الثالثة ثانوي · آداب وفلسفة')
    const none = await studentScope(h.db, bare.studentId!)
    expect(none.complete).toBe(false)
    expect(none.label).toBeNull()
    // الزائر والمشرف: لا نطاق (مرشّحاتهم كما هي)
    expect(await studentScopeOf(h.db, null)).toBeNull()
    expect(await studentScopeOf(h.db, admin)).toBeNull()
  })

  it('الحفظ بقواعد التسجيل: الشعبة إلزامية للثانوي ومن شعب سنته؛ غير التلميذ لا يحفظ', async () => {
    const lit = await resolveCodes(h.db, { level: '1AS', stream: 'LIT' })
    const as3 = await resolveCodes(h.db, { level: '3AS' })
    await expect(saveStudentLevelStream(h.db, bare, { levelId: as3.levelId!, streamId: null })).rejects.toSatisfy((e) => e instanceof AppError && e.code === 'VALIDATION' && e.details?.field === 'streamId')
    // «آداب وفلسفة» ليست من شعب الأولى ثانوي (جذعان مشتركان)
    await expect(saveStudentLevelStream(h.db, bare, { levelId: lit.levelId!, streamId: lit.streamId })).rejects.toSatisfy((e) => e instanceof AppError && e.code === 'VALIDATION' && e.details?.field === 'streamId')
    await expectCode(() => saveStudentLevelStream(h.db, admin, { levelId: as3.levelId!, streamId: null }), 'FORBIDDEN')
    expect((await studentScope(h.db, bare.studentId!)).levelId).toBeNull()
    // المتوسط بلا شعبة: مكتمل، والشعبة المرسلة تُتجاهل
    const am4 = await resolveCodes(h.db, { level: '4AM', stream: 'SCI' })
    const saved = await saveStudentLevelStream(h.db, bare, { levelId: am4.levelId!, streamId: am4.streamId })
    expect(saved.complete).toBe(true)
    expect(saved.streamId).toBeNull()
    expect(saved.label).toBe('السنة الرابعة متوسط')
  })
})

describe('«دروسي»: القائمة', () => {
  it('تلميذ الآداب: مشترك مستواه + شعبته + غير المصنّف + الموجَّه له؛ لا علوم ولا 2 ثانوي', async () => {
    // كما تستدعيها الصفحة: بلا مستوى ولا شعبة في الرابط — النطاق من الحساب
    const slugs = slugsOf(await listStudentLessonsOrganized(h.db, adab))
    expect(slugs).toEqual(expect.arrayContaining([C.common.slug, C.lit.slug, C.old.slug, C.targetedSci.slug]))
    expect(slugs).not.toContain(C.sci.slug)
    expect(slugs).not.toContain(C.as2.slug)
  })

  it('مرشّح يطلب مستوى أو شعبة أخرى لا يوسّع النطاق', async () => {
    const sci = await resolveCodes(h.db, { level: '3AS', stream: 'SCI' })
    expect(slugsOf(await listStudentLessonsOrganized(h.db, adab, { levelId: sci.levelId, streamId: sci.streamId }))).not.toContain(C.sci.slug)
    const slugs = slugsOf(await listStudentLessonsOrganized(h.db, adab, { levelId: null, streamId: null }))
    expect(slugs).not.toContain(C.sci.slug)
    expect(slugs).not.toContain(C.as2.slug)
    expect(slugs).toContain(C.lit.slug)
  })

  it('تلميذ العلوم: مشترك مستواه + شعبته؛ لا آداب', async () => {
    const slugs = slugsOf(await listStudentLessonsOrganized(h.db, ulum))
    expect(slugs).toEqual(expect.arrayContaining([C.common.slug, C.sci.slug]))
    expect(slugs).not.toContain(C.lit.slug)
    expect(slugs).not.toContain(C.targetedSci.slug) // موجَّه لتلميذ الآداب وحده
  })

  it('مقترحات «اليوم» و«الملفات» بالشرط نفسه', async () => {
    const suggested = (await listStudentContent(h.db, ulum)).map((c) => c.slug)
    expect(suggested).toContain(C.sci.slug)
    expect(suggested).not.toContain(C.lit.slug)
    expect((await listStudentFiles(h.db, ulum)).map((f) => f.slug)).not.toContain(C.litPdf.slug)
    expect((await listStudentFiles(h.db, adab)).map((f) => f.slug)).toContain(C.litPdf.slug)
  })
})

describe('الخادم: فتح الدرس بتغيير الرابط', () => {
  it('تلميذ الآداب لا يفتح درس العلوم ولا 2 ثانوي (LESSON_OUT_OF_SCOPE)، ويفتح دروسه', async () => {
    await expectCode(() => getContentForStudent(h.db, adab, C.sci.slug), 'LESSON_OUT_OF_SCOPE')
    await expectCode(() => getContentForStudent(h.db, adab, C.as2.slug), 'LESSON_OUT_OF_SCOPE')
    expect((await getContentForStudent(h.db, adab, C.lit.slug)).id).toBe(C.lit.id)
    expect((await getContentForStudent(h.db, adab, C.common.slug)).id).toBe(C.common.id)
    expect((await getContentForStudent(h.db, adab, C.old.slug)).id).toBe(C.old.id)
    expect((await getContentForStudent(h.db, adab, C.targetedSci.slug)).id).toBe(C.targetedSci.id)
    await expectCode(() => getContentForStudent(h.db, adab, 'no-such-slug'), 'CONTENT_NOT_FOUND')
  })

  it('تلميذ العلوم لا يفتح درس الآداب؛ التلميذ بلا مستوى (قبل الاختيار) كما كان', async () => {
    await expectCode(() => getContentForStudent(h.db, ulum, C.lit.slug), 'LESSON_OUT_OF_SCOPE')
    const noLevel = await makeStudent(h.db, 'جديد بلا مستوى')
    expect((await getContentForStudent(h.db, noLevel, C.sci.slug)).id).toBe(C.sci.id)
  })

  it('الوسائط (PDF/فيديو) بالشرط نفسه؛ الزائر والمشرف كما كانا', async () => {
    await expectCode(() => resolveMediaAccess(h.db, ulum, C.litPdf.id), 'LESSON_OUT_OF_SCOPE')
    expect((await resolveMediaAccess(h.db, adab, C.litPdf.id)).content.id).toBe(C.litPdf.id)
    expect((await resolveMediaAccess(h.db, null, C.litPdf.id)).content.id).toBe(C.litPdf.id)
    expect((await resolveMediaAccess(h.db, admin, C.litPdf.id)).content.id).toBe(C.litPdf.id)
    expect((await resolveMediaAccess(h.db, adab, C.targetedSci.id)).content.id).toBe(C.targetedSci.id)
  })

  it('صفحة الدرس العامة: التلميذ خارج نطاقه ممنوع، والزائر يرى كل شيء', async () => {
    const sci = (await getPublicContentBySlug(h.db, C.sci.slug))!
    expect(contentInScope(await studentScopeOf(h.db, adab), sci)).toBe(false)
    expect(contentInScope(await studentScopeOf(h.db, ulum), sci)).toBe(true)
    expect(contentInScope(await studentScopeOf(h.db, null), sci)).toBe(true)
    expect(contentInScope(await studentScopeOf(h.db, admin), sci)).toBe(true)
  })
})

describe('تطبيقا آيفون وأندرويد (الواجهة /api/v1/ios)', () => {
  it('الدروس المجانية للتلميذ من نطاقه؛ الزائر يرى الكل', async () => {
    const flat = (home: Awaited<ReturnType<typeof iosApiHome>>) => home.freeLessons.flatMap((e) => (e.kind === 'group' ? e.items.map((i) => i.slug) : [e.slug]))
    const mine = flat(await iosApiHome(h.db, adab))
    expect(mine).toContain(C.lit.slug)
    expect(mine).toContain(C.common.slug)
    expect(mine).not.toContain(C.sci.slug)
    const guest = flat(await iosApiHome(h.db, null))
    expect(guest).toEqual(expect.arrayContaining([C.lit.slug, C.sci.slug, C.as2.slug]))
    await expectCode(() => iosApiLesson(h.db, adab, C.sci.slug), 'LESSON_OUT_OF_SCOPE')
    expect((await iosApiLesson(h.db, null, C.sci.slug)).lesson.slug).toBe(C.sci.slug)
  })

  it('listPublicContent بالشعبة: المشترك يبقى، وشعبة أخرى تسقط', async () => {
    const own = (await studentScope(h.db, ulum.studentId!))!
    const slugs = (await listPublicContent(h.db, { levelId: own.levelId, streamIds: own.streamFamily })).map((c) => c.slug)
    expect(slugs).toEqual(expect.arrayContaining([C.common.slug, C.sci.slug, C.old.slug]))
    expect(slugs).not.toContain(C.lit.slug)
  })
})
