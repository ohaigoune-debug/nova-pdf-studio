/**
 * تمارين تحت درس الدورة من بنك مدرسة PLAY (22 نوفمبر 2026): الإضافة والترتيب والحذف، ظهورها للمشترك وحده،
 * واللعب باشتراك الدورة لا بتجربة PLAY (لا تُفتح تجربة، ويُرفض اللعب بعد انتهاء الاشتراك).
 */
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { courseEnrollments, playAccessTrials, playExamSets, playLessons } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { readExamSetFile, validateExamSet } from '@/server/play/exams/engine'
import { importQuestions, syncCatalog } from '@/server/play/importer'
import type { PlayContentQuestion } from '@/server/play/question-types'
import { saveCourseLesson } from '@/server/services/course-lessons.service'
import { createCourse, enrollStudent } from '@/server/services/courses.service'
import {
  addLessonPractice,
  isOwnPracticeRunPath,
  lessonPracticeForStudent,
  listLessonPractice,
  moveLessonPractice,
  practiceBackHref,
  practiceCountsFor,
  removeLessonPractice,
  searchPracticeBank,
  startLessonPractice
} from '@/server/services/lesson-practice.service'
import { getExamAttemptView } from '@/server/services/play-exams.service'
import { getSessionView, startPlaySession, submitPlayAnswer } from '@/server/services/play.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb, workspaceIdOfTeacher } from './helpers'

let h: DatabaseHandle
let admin: Actor
let student: Actor
let outsider: Actor
let courseId = ''
let lessonId = ''
let playLessonId = ''
let examSetId = ''

const catalog = {
  version: 1,
  grades: [{ grade: '3AS', subjects: [{ subject: 'AR', units: [{ code: 'U1', name: 'البناء اللغوي', verified: true, lessons: [{ code: 'L1', name: 'الجملة الواقعة خبرا', verified: true }, { code: 'L2', name: 'درس بلا أسئلة', verified: true }] }] }] }]
}

function q(i: number): PlayContentQuestion {
  return {
    key: `3AS-AR-U1-L1-${String(i).padStart(4, '0')}`,
    type: 'MCQ',
    grade: '3AS',
    subject: 'AR',
    unit: 'U1',
    lesson: 'L1',
    difficulty: 'EASY',
    question: `ما محلّ جملة «يطلع» في «الفجر يطلع»؟ (${i})`,
    options: ['في محل رفع خبر', 'لا محل لها', 'في محل نصب حال', 'في محل جر'],
    correct: 0,
    explanation: 'جملة فعلية وقعت خبرًا للمبتدأ «الفجر».'
  }
}

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  const teacher = await makeTeacher(h.db, admin)
  const ws = await workspaceIdOfTeacher(h.db, teacher)
  await syncCatalog(h.db, catalog)
  await importQuestions(h.db, Array.from({ length: 14 }, (_, i) => q(i + 1)))
  const [pl] = await h.db.select({ id: playLessons.id }).from(playLessons).where(eq(playLessons.lessonCode, 'L1')).limit(1)
  playLessonId = pl!.id
  const { doc, checksum } = readExamSetFile('content/play-exams/sets/3AS/AR/ar-3as-t1-sci-d01.json')
  expect(validateExamSet(doc).publishable).toBe(true)
  const [set] = await h.db
    .insert(playExamSets)
    .values({ kind: 'DEVOIR', gradeCode: '3AS', streamCodes: doc.source.streams, subjectCode: 'AR', year: doc.source.year, term: 1, paper: null, scoreTotal: 20, stepCount: doc.steps.length, setId: doc.set_id, title: doc.source.title, status: 'APPROVED', publishable: true, checksum, document: doc })
    .returning()
  examSetId = set!.id
  courseId = (await createCourse(h.db, admin, { title: 'دورة الفصل الأوّل', workspaceId: ws, season: '2026/2027' })).id
  lessonId = (await saveCourseLesson(h.db, admin, courseId, null, { title: 'إعراب الجمل', body: 'الجمل التي لها محل من الإعراب.', pdfFileId: null, video: { provider: 'YOUTUBE', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }, publish: true })).id
  student = await makeStudent(h.db, 'مشترك')
  outsider = await makeStudent(h.db, 'غير مشترك')
  await enrollStudent(h.db, admin, { courseId, studentId: student.studentId!, source: 'MANUAL', silent: true })
})

afterAll(async () => {
  await h.close()
})

describe('بنك مدرسة في محرّر الدرس', () => {
  it('البحث في دروس PLAY (بعدد أسئلتها) وفي الفروض والبكالوريات', async () => {
    const lessons = await searchPracticeBank(h.db, admin, { kind: 'LESSON', q: 'خبرا', gradeCode: '3AS', subjectCode: 'AR' })
    expect(lessons).toEqual([expect.objectContaining({ kind: 'LESSON', refId: playLessonId, title: 'لعبة: الجملة الواقعة خبرا' })])
    expect(lessons[0]!.subtitle).toContain('14 سؤالًا')
    const sets = await searchPracticeBank(h.db, admin, { kind: 'EXAM_SET', subjectCode: 'AR', examKind: 'DEVOIR' })
    expect(sets.map((s) => s.refId)).toEqual([examSetId])
    await expectCode(() => searchPracticeBank(h.db, student, { kind: 'LESSON' }), 'FORBIDDEN')
  })

  it('الإضافة (بلا تكرار) والترتيب والحذف، للمحرّر وحده', async () => {
    await expectCode(() => addLessonPractice(h.db, student, courseId, lessonId, { kind: 'LESSON', refId: playLessonId }), 'FORBIDDEN')
    const a = await addLessonPractice(h.db, admin, courseId, lessonId, { kind: 'LESSON', refId: playLessonId })
    const again = await addLessonPractice(h.db, admin, courseId, lessonId, { kind: 'LESSON', refId: playLessonId })
    expect(again.linkId).toBe(a.linkId)
    const b = await addLessonPractice(h.db, admin, courseId, lessonId, { kind: 'EXAM_SET', refId: examSetId })
    expect((await listLessonPractice(h.db, admin, courseId, lessonId)).map((i) => i.linkId)).toEqual([a.linkId, b.linkId])
    await moveLessonPractice(h.db, admin, courseId, lessonId, b.linkId, 'up')
    expect((await listLessonPractice(h.db, admin, courseId, lessonId)).map((i) => i.kind)).toEqual(['EXAM_SET', 'LESSON'])
    await moveLessonPractice(h.db, admin, courseId, lessonId, b.linkId, 'down')
    expect((await practiceCountsFor(h.db, [lessonId])).get(lessonId)).toBe(2)
    const extra = await addLessonPractice(h.db, admin, courseId, lessonId, { kind: 'EXAM_SET', refId: examSetId })
    expect(extra.linkId).toBe(b.linkId)
    await removeLessonPractice(h.db, admin, courseId, lessonId, b.linkId)
    expect(await listLessonPractice(h.db, admin, courseId, lessonId)).toHaveLength(1)
    await addLessonPractice(h.db, admin, courseId, lessonId, { kind: 'EXAM_SET', refId: examSetId })
  })
})

describe('التلميذ تحت الدرس', () => {
  it('درس PLAY بلا أسئلة صالحة لا يُضاف تحت الدرس', async () => {
    const [empty] = await h.db.select({ id: playLessons.id }).from(playLessons).where(eq(playLessons.lessonCode, 'L2')).limit(1)
    await expectCode(() => addLessonPractice(h.db, admin, courseId, lessonId, { kind: 'LESSON', refId: empty!.id }), 'PLAY_NO_QUESTIONS')
  })

  it('المشترك يرى التمارين، وغير المشترك لا يرى شيئًا ولا يبدأ', async () => {
    const items = await lessonPracticeForStudent(h.db, student, lessonId)
    expect(items?.map((i) => [i.kind, i.best])).toEqual([
      ['LESSON', null],
      ['EXAM_SET', null]
    ])
    expect(await lessonPracticeForStudent(h.db, outsider, lessonId)).toBeNull()
    await expectCode(() => startLessonPractice(h.db, outsider, items![0]!.linkId), 'LESSON_PRACTICE_NOT_ALLOWED')
  })

  it('لعبة الدرس باشتراك الدورة: لا تجربة PLAY، والجولة تعود إلى الدرس', async () => {
    const items = (await lessonPracticeForStudent(h.db, student, lessonId))!
    const { href } = await startLessonPractice(h.db, student, items[0]!.linkId)
    const sessionId = href.split('/').pop()!
    expect(href).toBe(`/student/play/session/${sessionId}`)
    const view = await getSessionView(h.db, student, sessionId)
    expect(view.session.practiceLinkId).toBe(items[0]!.linkId)
    expect(view.questions.length).toBe(12)
    const first = view.questions[0]!
    const key = first.payload.type === 'MCQ' ? first.payload.options[0]!.key : ''
    await submitPlayAnswer(h.db, student, sessionId, first.id, { type: 'MCQ', key }, 900)
    expect(await h.db.select().from(playAccessTrials).where(eq(playAccessTrials.studentId, student.studentId!))).toHaveLength(0)
    expect(await isOwnPracticeRunPath(h.db, student, href)).toBe(true)
    expect(await isOwnPracticeRunPath(h.db, outsider, href)).toBe(false)
    expect(await practiceBackHref(h.db, items[0]!.linkId)).toMatch(/^\/student\/lessons\//)
  })

  it('جولة PLAY العادية لا تُفتح من الحارس (ليست تمرين دورة)', async () => {
    const normal = await startPlaySession(h.db, student, { challengeType: 'LESSON_MASTERY', lessonId: playLessonId })
    expect(await isOwnPracticeRunPath(h.db, student, `/student/play/session/${normal.id}`)).toBe(false)
  })

  it('الفرض باشتراك الدورة: محاولة مربوطة بالتمرين', async () => {
    const items = (await lessonPracticeForStudent(h.db, student, lessonId))!
    const { href } = await startLessonPractice(h.db, student, items[1]!.linkId)
    const attemptId = href.split('/').pop()!
    const view = await getExamAttemptView(h.db, student, attemptId)
    expect(view.practiceLinkId).toBe(items[1]!.linkId)
    expect(await isOwnPracticeRunPath(h.db, student, `/student/play/exam/${attemptId}/result`)).toBe(true)
  })

  it('انتهاء الاشتراك يوقف التمرين حتى في جولة مفتوحة', async () => {
    const items = (await lessonPracticeForStudent(h.db, student, lessonId))!
    const { href } = await startLessonPractice(h.db, student, items[0]!.linkId)
    const sessionId = href.split('/').pop()!
    const view = await getSessionView(h.db, student, sessionId)
    await h.db.update(courseEnrollments).set({ status: 'EXPIRED' }).where(eq(courseEnrollments.studentId, student.studentId!))
    const first = view.questions[0]!
    const key = first.payload.type === 'MCQ' ? first.payload.options[0]!.key : ''
    await expectCode(() => submitPlayAnswer(h.db, student, sessionId, first.id, { type: 'MCQ', key }, 900), 'LESSON_PRACTICE_NOT_ALLOWED')
    expect(await lessonPracticeForStudent(h.db, student, lessonId)).toBeNull()
  })
})
