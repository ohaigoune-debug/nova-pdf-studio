import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { skills } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { createAssignment, getAssignmentForStudent, reviewSubmission, submitAnswer } from '@/server/services/assignments.service'
import { generateCodes } from '@/server/services/enrollment-codes.service'
import { redeemEnrollmentCode } from '@/server/services/enrollment.service'
import { createGroup } from '@/server/services/groups.service'
import { listSkills } from '@/server/services/reference.service'
import { createRubric, deleteRubric, getRubric, listRubrics, updateRubric } from '@/server/services/rubrics.service'
import { groupWeakSkills, recordSkillResult, skillHistory, skillMap, skillMapFor } from '@/server/services/skills.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb } from './helpers'

let h: DatabaseHandle
let admin: Actor
let teacherA: Actor
let teacherB: Actor
let groupA: { id: string }
let s1: Actor
let s2: Actor
let fikri: string
let lughawi: string

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

beforeAll(async () => {
  h = await setupDb()
  await h.db.insert(skills).values([
    { code: 'INTELLECTUAL', nameAr: 'البناء الفكري', category: 'ANALYSIS' },
    { code: 'LINGUISTIC', nameAr: 'البناء اللغوي', category: 'ANALYSIS' }
  ])
  const sk = await listSkills(h.db)
  fikri = sk.find((s) => s.code === 'INTELLECTUAL')!.id
  lughawi = sk.find((s) => s.code === 'LINGUISTIC')!.id
  admin = await makeAdmin(h.db)
  teacherA = await makeTeacher(h.db, admin, 'الأستاذ أ')
  teacherB = await makeTeacher(h.db, admin, 'الأستاذ ب')
  groupA = await createGroup(h.db, teacherA, { name: 'فوج أ' })
  s1 = await makeStudent(h.db, 'محمد أحمد')
  s2 = await makeStudent(h.db, 'سارة بن علي')
  const c = await generateCodes(h.db, teacherA, { groupId: groupA.id, count: 2 })
  await redeemEnrollmentCode(h.db, s1, c.codes[0]!.code)
  await redeemEnrollmentCode(h.db, s2, c.codes[1]!.code)
})

afterAll(async () => {
  await h.close()
})

describe('شبكات التقييم', () => {
  let rubricId: string

  it('إنشاء شبكة بمجموع محسوب، وقوالب عامة من المشرف تظهر للأساتذة', async () => {
    const r = await createRubric(h.db, teacherA, { name: 'موضوع البكالوريا', items: [{ label: 'البناء الفكري', maxPoints: 8, skillId: fikri }, { label: 'البناء اللغوي', maxPoints: 8, skillId: lughawi }, { label: 'التقويم النقدي', maxPoints: 4 }] })
    rubricId = r.id
    expect(Number(r.maxScore)).toBe(20)
    await createRubric(h.db, admin, { name: 'قالب عام', items: [{ label: 'أ', maxPoints: 10 }] }, { global: true })
    const listA = await listRubrics(h.db, teacherA)
    expect(listA.some((x) => x.id === rubricId)).toBe(true)
    expect(listA.some((x) => x.isGlobal)).toBe(true)
    const listB = await listRubrics(h.db, teacherB)
    expect(listB.some((x) => x.id === rubricId)).toBe(false)
    expect(listB.some((x) => x.isGlobal)).toBe(true)
    await expectCode(() => getRubric(h.db, teacherB, rubricId), 'RUBRIC_NOT_FOUND')
    const g = listB.find((x) => x.isGlobal)!
    await expectCode(() => updateRubric(h.db, teacherB, g.id, { name: 'x', items: [{ label: 'أ', maxPoints: 1 }] }), 'FORBIDDEN')
    await expectCode(() => createRubric(h.db, teacherA, { name: 'x', items: [] }), 'VALIDATION')
  })

  it('التصحيح بالشبكة بنداً بنداً يحسب العلامة ويحدّث مهارات البنود', async () => {
    const asg = await createAssignment(h.db, teacherA, { title: 'موضوع بكالوريا', maxScore: 20, rubricId, groupIds: [groupA.id], studentIds: [] })
    const sub = await submitAnswer(h.db, s1, asg.id, 'الفكرة العامة… البناء اللغوي… النقد…')
    const rub = await getRubric(h.db, teacherA, rubricId)
    const [i1, i2, i3] = rub.items
    await expectCode(() => reviewSubmission(h.db, teacherA, sub.submissionId, { score: 0, strengths: [], improvements: [], rubricBreakdown: { [i1!.id]: 9, [i2!.id]: 5, [i3!.id]: 2 } }), 'RUBRIC_MISMATCH')
    await expectCode(() => reviewSubmission(h.db, teacherA, sub.submissionId, { score: 0, strengths: [], improvements: [], rubricBreakdown: { [i1!.id]: 6 } }), 'RUBRIC_MISMATCH')
    await reviewSubmission(h.db, teacherA, sub.submissionId, { score: 0, strengths: ['الفكرة'], improvements: [], rubricBreakdown: { [i1!.id]: 6, [i2!.id]: 4, [i3!.id]: 3 } })
    const view = await getAssignmentForStudent(h.db, s1, asg.id)
    expect(view.grade?.score).toBe('13.00')
    const map = await skillMap(h.db, s1.studentId!)
    expect(map.find((m) => m.code === 'INTELLECTUAL')?.score).toBe(75)
    expect(map.find((m) => m.code === 'LINGUISTIC')?.score).toBe(50)
  })

  it('حذف الشبكة ناعم', async () => {
    await deleteRubric(h.db, teacherA, rubricId)
    await expectCode(() => getRubric(h.db, teacherA, rubricId), 'RUBRIC_NOT_FOUND')
  })
})

describe('محرّك المهارات', () => {
  it('متوسط متحرك وثقة تتراكم وتاريخ محفوظ', async () => {
    const r1 = await recordSkillResult(h.db, { studentId: s2.studentId!, skillId: fikri, percent: 40, sourceType: 'MANUAL' })
    expect(r1).toEqual({ score: 40, confidence: 0.2, attempts: 1 })
    const r2 = await recordSkillResult(h.db, { studentId: s2.studentId!, skillId: fikri, percent: 90, sourceType: 'MANUAL' })
    expect(r2.score).toBe(60) // 40*0.6 + 90*0.4
    expect(r2.confidence).toBe(0.4)
    const hist = await skillHistory(h.db, s2.studentId!, fikri)
    expect(hist.map((x) => Number(x.score))).toEqual([40, 60])
  })

  it('الصلاحيات على خريطة المهارات والمهارات الضعيفة المشتركة', async () => {
    await recordSkillResult(h.db, { studentId: s2.studentId!, skillId: lughawi, percent: 30, sourceType: 'MANUAL' })
    expect((await skillMapFor(h.db, s2, s2.studentId!)).length).toBe(2)
    await expectCode(() => skillMapFor(h.db, s1, s2.studentId!), 'FORBIDDEN')
    expect((await skillMapFor(h.db, teacherA, s2.studentId!)).length).toBe(2)
    await expectCode(() => skillMapFor(h.db, teacherB, s2.studentId!), 'NOT_FOUND')
    const weak = await groupWeakSkills(h.db, groupA.id)
    const ling = weak.find((w) => w.name === 'البناء اللغوي')!
    expect(ling.weakCount).toBe(2) // s1: 50, s2: 30
    expect(ling.students).toContain('سارة بن علي')
    expect(weak.find((w) => w.name === 'البناء الفكري')).toBeUndefined() // s1: 75, s2: 60
  })
})
