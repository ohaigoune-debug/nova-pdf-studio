import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { levels, streams, subjects } from '@/server/db/schema'
import { seedCurriculum } from '@/server/db/seed-curriculum'
import { BAC_TEMPLATES, GENERIC_BAC, resolveBacTemplate, totalPointsOf } from '@/lib/bac-templates'
import type { Actor } from '@/server/lib/actor'
import { buildBacMock } from '@/server/services/bac-generator.service'
import { getExam } from '@/server/services/exams.service'
import { createBankQuestion } from '@/server/services/question-bank.service'
import { makeAdmin, makeTeacher, setupDb } from './helpers'

let h: DatabaseHandle
let teacher: Actor
let arabic: string
let math: string
let l3: string
let lit: string
let sci: string

beforeAll(async () => {
  h = await setupDb()
  await seedCurriculum(h.db)
  const admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin)
  arabic = (await h.db.select({ id: subjects.id }).from(subjects).where(eq(subjects.code, 'ARABIC')))[0]!.id
  math = (await h.db.select({ id: subjects.id }).from(subjects).where(eq(subjects.code, 'MATH')))[0]!.id
  l3 = (await h.db.select({ id: levels.id }).from(levels).where(eq(levels.code, '3AS')))[0]!.id
  lit = (await h.db.select({ id: streams.id }).from(streams).where(eq(streams.code, 'LIT')))[0]!.id
  sci = (await h.db.select({ id: streams.id }).from(streams).where(eq(streams.code, 'SCI')))[0]!.id
  const mk = (title: string, body: string, difficulty: 1 | 2 | 3, keywords: string[] = []) => createBankQuestion(h.db, teacher, { kind: 'EXERCISE', type: 'OPEN', title, body, points: 4, difficulty, subjectId: arabic, levelId: l3, keywords })
  await mk('أسئلة الفهم', 'حدّد الفكرة العامة للنصّ وبيّن موقف الشاعر من الحياة.', 2)
  await mk('أسئلة اللغة', 'أعرب ما تحته خطّ، واستخرج صورة بيانية وبيّن نوعها.', 2, ['الإعراب'])
  await mk('نقد', 'ما خصائص الشعر الحر كما تجلّت في النصّ؟ (التقويم النقدي)', 3)
  await mk('إدماج', 'اكتب نصّاً حجاجياً تدافع فيه عن قيمة العمل (الوضعية الإدماجية).', 3)
  await mk('سهل', 'تمرين سهل بلا كلمات مفتاحية.', 1)
})

afterAll(async () => {
  await h.close()
})

describe('مولّد البكالوريا التجريبية', () => {
  it('القوالب: لكل شعبة هيكلتها، والمجاميع 20، والعام احتياط', () => {
    expect(resolveBacTemplate('ARABIC', 'LIT').durationMinutes).toBe(210)
    expect(resolveBacTemplate('ARABIC', 'SCI').durationMinutes).toBe(120)
    expect(resolveBacTemplate('MATH', 'MATH').durationMinutes).toBe(270)
    expect(resolveBacTemplate('MATH', null).durationMinutes).toBe(210)
    expect(resolveBacTemplate('PHILO', 'LIT').chooseOne).toBe(true)
    expect(resolveBacTemplate('UNKNOWN', null)).toBe(GENERIC_BAC)
    for (const t of BAC_TEMPLATES) expect(totalPointsOf(t), t.label).toBe(20)
  })

  it('يبني ورقة BAC_MOCK بالهيكلة: النصّ عنصر نصّي، الأجزاء من البنك بالعناوين والنقاط، والناقص موسوم', async () => {
    const r = await buildBacMock(h.db, teacher, { subjectId: arabic, streamId: lit })
    expect(r.template.label).toContain('آداب')
    expect(r.filled).toBe(4)
    expect(r.missing).toEqual([])
    const v = await getExam(h.db, teacher, r.examId)
    expect(v).toMatchObject({ kind: 'BAC_MOCK', durationMinutes: 210, streamId: lit, levelId: l3, title: expect.stringContaining('بكالوريا تجريبية') })
    expect(v.heading).toBe('بكالوريا تجريبية')
    expect(v.items.map((i) => i.kind)).toEqual(['TEXT', 'EXERCISE', 'EXERCISE', 'EXERCISE', 'EXERCISE'])
    expect(v.items.slice(1).map((i) => i.title)).toEqual(['البناء الفكري', 'البناء اللغوي', 'التقويم النقدي', 'الوضعية الإدماجية'])
    expect(v.items.slice(1).map((i) => Number(i.points))).toEqual([8, 4, 4, 4])
    expect(Number(v.totalPoints)).toBe(20)
    // الكلمات المفتاحية وجّهت الاختيار
    expect(v.items[2]!.snapshot.body).toContain('أعرب')
    expect(v.items[3]!.snapshot.body).toContain('التقويم النقدي')
    expect(v.items[4]!.snapshot.body).toContain('الوضعية الإدماجية')
    expect(v.items.slice(1).every((i) => i.bankQuestionId)).toBe(true)
    // شعبة علمية: هيكلة أقصر، ولا يُعاد استعمال السؤال نفسه مرتين في الورقة
    const r2 = await buildBacMock(h.db, teacher, { subjectId: arabic, streamId: sci })
    const v2 = await getExam(h.db, teacher, r2.examId)
    expect(v2.durationMinutes).toBe(120)
    expect(v2.items.filter((i) => i.kind === 'EXERCISE').map((i) => i.title)).toEqual(['البناء الفكري', 'البناء اللغوي', 'الوضعية الإدماجية'])
    expect(new Set(v2.items.map((i) => i.bankQuestionId).filter(Boolean)).size).toBe(3)
    // مادة بلا أسئلة في البنك: كل الأجزاء موسومة «أكمل» بنقاطها
    const r3 = await buildBacMock(h.db, teacher, { subjectId: math, streamId: sci })
    expect(r3.filled).toBe(0)
    expect(r3.missing).toHaveLength(4)
    const v3 = await getExam(h.db, teacher, r3.examId)
    expect(v3.items.every((i) => i.title?.endsWith('— أكمل') && i.bankQuestionId === null)).toBe(true)
    expect(Number(v3.totalPoints)).toBe(20)
    expect(v3.items.map((i) => Number(i.points))).toEqual([4, 5, 4, 7])
  })
})
