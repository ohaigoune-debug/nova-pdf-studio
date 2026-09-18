import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { auditLogs, notifications } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { listStudentGrades } from '@/server/queries/student-extras.queries'
import {
  addThreadMessage,
  createAssignment,
  deleteAssignment,
  getAssignmentForStudent,
  getAssignmentForTeacher,
  getSubmissionForTeacher,
  listAssignmentsForStudent,
  reviewSubmission,
  saveDraft,
  submitAnswer,
  updateAssignment
} from '@/server/services/assignments.service'
import { generateCodes } from '@/server/services/enrollment-codes.service'
import { redeemEnrollmentCode } from '@/server/services/enrollment.service'
import { createGroup } from '@/server/services/groups.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb } from './helpers'

let h: DatabaseHandle
let admin: Actor
let teacherA: Actor
let teacherB: Actor
let groupA: { id: string }
let groupB: { id: string }
let s1: Actor
let s2: Actor
let s3: Actor

async function enroll(student: Actor, g: { id: string }, t: Actor) {
  const r = await generateCodes(h.db, t, { groupId: g.id, count: 1 })
  await redeemEnrollmentCode(h.db, student, r.codes[0]!.code)
}
async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  teacherA = await makeTeacher(h.db, admin, 'الأستاذ أ')
  teacherB = await makeTeacher(h.db, admin, 'الأستاذ ب')
  groupA = await createGroup(h.db, teacherA, { name: 'فوج أ' })
  groupB = await createGroup(h.db, teacherB, { name: 'فوج ب' })
  s1 = await makeStudent(h.db, 'محمد أحمد')
  s2 = await makeStudent(h.db, 'سارة بن علي')
  s3 = await makeStudent(h.db, 'طالب فوج ب')
  await enroll(s1, groupA, teacherA)
  await enroll(s2, groupA, teacherA)
  await enroll(s3, groupB, teacherB)
})

afterAll(async () => {
  await h.close()
})

describe('الواجبات والإجابة كرسالة', () => {
  let assignmentId: string
  let submissionId: string

  it('الأستاذ يسند واجباً لفوجه فيصل الطلاب النشطين فقط مع إشعار', async () => {
    const a = await createAssignment(h.db, teacherA, { title: 'تحليل نص شعري', description: 'حلّل البناء الفكري…', maxScore: 20, dueAt: new Date(Date.now() + 7 * 86400000), groupIds: [groupA.id], studentIds: [] })
    assignmentId = a.id
    const detail = await getAssignmentForTeacher(h.db, teacherA, a.id)
    expect(detail.eligible).toBe(2)
    expect(detail.submissions.every((s) => s.status === null)).toBe(true)

    const n1 = await h.db.select().from(notifications).where(eq(notifications.userId, s1.userId))
    expect(n1.some((n) => n.type === 'NEW_ASSIGNMENT')).toBe(true)
    const n3 = await h.db.select().from(notifications).where(eq(notifications.userId, s3.userId))
    expect(n3.some((n) => n.type === 'NEW_ASSIGNMENT')).toBe(false)

    expect((await listAssignmentsForStudent(h.db, s1)).some((x) => x.id === a.id)).toBe(true)
    expect((await listAssignmentsForStudent(h.db, s3)).some((x) => x.id === a.id)).toBe(false)
    await expectCode(() => getAssignmentForStudent(h.db, s3, a.id), 'NOT_TARGETED')
  })

  it('العزل: الأستاذ الآخر لا يسند لفوج ليس له ولا يرى الواجب', async () => {
    await expectCode(() => createAssignment(h.db, teacherB, { title: 'x', groupIds: [groupA.id], studentIds: [] }), 'NOT_FOUND')
    await expectCode(() => getAssignmentForTeacher(h.db, teacherB, assignmentId), 'ASSIGNMENT_NOT_FOUND')
    await expectCode(() => createAssignment(h.db, teacherA, { title: 'x', groupIds: [], studentIds: [] }), 'VALIDATION')
    await expectCode(() => createAssignment(h.db, s1, { title: 'x', groupIds: [groupA.id], studentIds: [] }), 'FORBIDDEN')
  })

  it('الطالب يحفظ مسودة ثم يرسل الإجابة نصاً، ولا يمكن تعديلها بعد الإرسال', async () => {
    const d = await saveDraft(h.db, s1, assignmentId, 'مسودة أولى')
    expect(d.submissionId).toBeTruthy()
    let view = await getAssignmentForStudent(h.db, s1, assignmentId)
    expect(view.submission?.status).toBe('DRAFT')
    expect(view.messages).toHaveLength(0)

    await expectCode(() => submitAnswer(h.db, s1, assignmentId, '  '), 'EMPTY_ANSWER')
    const r = await submitAnswer(h.db, s1, assignmentId, 'الفكرة العامة للنص هي الحنين إلى الوطن…')
    submissionId = r.submissionId
    expect(r.late).toBe(false)
    view = await getAssignmentForStudent(h.db, s1, assignmentId)
    expect(view.submission?.status).toBe('SUBMITTED')
    expect(view.messages.map((m) => m.kind)).toEqual(['ANSWER'])
    expect(view.messages[0]?.mine).toBe(true)

    await expectCode(() => saveDraft(h.db, s1, assignmentId, 'تعديل'), 'SUBMISSION_LOCKED')
    await expectCode(() => submitAnswer(h.db, s1, assignmentId, 'إجابة أخرى'), 'SUBMISSION_LOCKED')

    const tn = await h.db.select().from(notifications).where(eq(notifications.userId, teacherA.userId))
    expect(tn.some((n) => n.link?.includes(submissionId))).toBe(true)
  })

  it('سلسلة الرسائل: الأستاذ يعلّق، الطالب يردّ، وغيرهما ممنوع', async () => {
    const f = await addThreadMessage(h.db, teacherA, submissionId, 'أحسنت، لكن وضّح الصورة البيانية.')
    expect(f?.kind).toBe('FEEDBACK')
    const rep = await addThreadMessage(h.db, s1, submissionId, 'شكراً أستاذ، سأوضحها.')
    expect(rep?.kind).toBe('REPLY')
    await expectCode(() => addThreadMessage(h.db, s2, submissionId, 'x'), 'FORBIDDEN')
    await expectCode(() => addThreadMessage(h.db, teacherB, submissionId, 'x'), 'SUBMISSION_NOT_FOUND')
    const view = await getSubmissionForTeacher(h.db, teacherA, submissionId)
    expect(view.messages.map((m) => m.kind)).toEqual(['ANSWER', 'FEEDBACK', 'REPLY'])
    expect(view.student.fullName).toBe('محمد أحمد')
  })

  it('اعتماد التصحيح: علامة ضمن المجال، رسالة تصحيح، تظهر للطالب فقط بعد الاعتماد', async () => {
    await expectCode(() => reviewSubmission(h.db, teacherA, submissionId, { score: 25, strengths: [], improvements: [] }), 'INVALID_SCORE')
    await expectCode(() => reviewSubmission(h.db, teacherB, submissionId, { score: 10, strengths: [], improvements: [] }), 'SUBMISSION_NOT_FOUND')
    await expectCode(() => reviewSubmission(h.db, s1, submissionId, { score: 10, strengths: [], improvements: [] }), 'FORBIDDEN')

    const gradesBefore = await listStudentGrades(h.db, s1)
    expect(gradesBefore).toHaveLength(0)

    await reviewSubmission(h.db, teacherA, submissionId, { score: 14, strengths: ['استخراج الفكرة العامة'], improvements: ['إعراب الجملة', 'شرح الصورة البيانية'], notes: 'راجع درس الاستعارة.' })
    const view = await getAssignmentForStudent(h.db, s1, assignmentId)
    expect(view.submission?.status).toBe('REVIEWED')
    expect(view.grade?.score).toBe('14.00')
    expect(view.grade?.improvements).toHaveLength(2)
    const last = view.messages[view.messages.length - 1]!
    expect(last.kind).toBe('FEEDBACK')
    expect(last.body).toContain('14/20')
    expect(last.body).toContain('إعراب الجملة')

    const grades = await listStudentGrades(h.db, s1)
    expect(grades).toHaveLength(1)
    expect(grades[0]?.assignmentTitle).toBe('تحليل نص شعري')
    expect((await listStudentGrades(h.db, s2))).toHaveLength(0)

    // تعديل العلامة يسجَّل في التدقيق بالقيمة القديمة
    await reviewSubmission(h.db, teacherA, submissionId, { score: 15, strengths: [], improvements: [] })
    const logs = await h.db.select().from(auditLogs).where(eq(auditLogs.action, 'grade.set'))
    expect(logs.some((l) => (l.oldValue as { score?: string } | null)?.score === '14.00' && (l.newValue as { score?: number }).score === 15)).toBe(true)
  })

  it('لا تصحيح لمسودة لم تُرسل', async () => {
    const d = await saveDraft(h.db, s2, assignmentId, 'مسودة سارة')
    await expectCode(() => reviewSubmission(h.db, teacherA, d.submissionId, { score: 10, strengths: [], improvements: [] }), 'SUBMISSION_NOT_SUBMITTED')
    await expectCode(() => addThreadMessage(h.db, teacherA, d.submissionId, 'x'), 'SUBMISSION_NOT_SUBMITTED')
    const detail = await getAssignmentForTeacher(h.db, teacherA, assignmentId)
    expect(detail.submissions.find((s) => s.studentId === s2.studentId)?.status).toBe('DRAFT')
    expect(detail.submissions.find((s) => s.studentId === s1.studentId)?.score).toBe('15.00')
  })

  it('تغيير الإسناد وحذف الواجب لا يمسّ الإجابات والعلامات', async () => {
    await updateAssignment(h.db, teacherA, assignmentId, { groupIds: [], studentIds: [s1.studentId!] })
    expect((await listAssignmentsForStudent(h.db, s2)).some((x) => x.id === assignmentId)).toBe(false)
    expect((await listAssignmentsForStudent(h.db, s1)).some((x) => x.id === assignmentId)).toBe(true)
    await expectCode(() => updateAssignment(h.db, teacherA, assignmentId, { groupIds: [], studentIds: [s3.studentId!] }), 'NOT_FOUND')

    await deleteAssignment(h.db, teacherA, assignmentId)
    expect((await listAssignmentsForStudent(h.db, s1)).some((x) => x.id === assignmentId)).toBe(false)
    await expectCode(() => getAssignmentForTeacher(h.db, teacherA, assignmentId), 'ASSIGNMENT_NOT_FOUND')
    expect(await listStudentGrades(h.db, s1)).toHaveLength(1)
  })

  it('الإرسال بعد الأجل يُعلَّم متأخراً لكنه يُقبل', async () => {
    const a = await createAssignment(h.db, teacherA, { title: 'واجب منتهٍ', dueAt: new Date(Date.now() - 86400000), groupIds: [groupA.id], studentIds: [] })
    const r = await submitAnswer(h.db, s2, a.id, 'إجابة متأخرة')
    expect(r.late).toBe(true)
  })
})
