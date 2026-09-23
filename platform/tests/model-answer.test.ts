import { describe, expect, it } from 'vitest'
import { processQueuedJobs } from '@/server/jobs/runner'
import { approveAiEvaluation, getLatestAiEvaluation, requestAiEvaluation } from '@/server/services/ai.service'
import { createAssignment, getAssignmentForStudent, submitAnswer } from '@/server/services/assignments.service'
import { generateCodes } from '@/server/services/enrollment-codes.service'
import { redeemEnrollmentCode } from '@/server/services/enrollment.service'
import { createGroup } from '@/server/services/groups.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb } from './helpers'

const MODEL = `التشبيه إلحاق أمر بأمر في صفة مشتركة بأداة.
أركان التشبيه أربعة: المشبه والمشبه به والأداة ووجه الشبه.
الاستعارة تشبيه حذف أحد طرفيه.
الكناية لفظ أريد به لازم معناه.`

describe('المقارنة بالحل النموذجي واعتماد العلامة بـ«نعم»', () => {
  it('يقارن بالحل وحده، ويعتمد بنقرة، والحل لا يصل التلميذ', async () => {
    const h = await setupDb()
    try {
      const teacher = await makeTeacher(h.db, await makeAdmin(h.db))
      const group = await createGroup(h.db, teacher, { name: 'فوج الحل النموذجي' })
      const student = await makeStudent(h.db)
      const { codes } = await generateCodes(h.db, teacher, { groupId: group.id, count: 1 })
      await redeemEnrollmentCode(h.db, student, codes[0]!.code)
      const a = await createAssignment(h.db, teacher, { title: 'الصور البيانية', description: 'عرّف الصور البيانية', maxScore: 20, modelAnswer: MODEL, groupIds: [group.id], studentIds: [] })

      // التلميذ لا يرى الحل النموذجي في أي شكل
      const view = await getAssignmentForStudent(h.db, student, a.id)
      expect(JSON.stringify(view)).not.toContain('إلحاق أمر بأمر')
      expect('modelAnswer' in view.assignment).toBe(false)

      const sub = await submitAnswer(h.db, student, a.id, 'التشبيه هو إلحاق أمر بأمر في صفة مشتركة بينهما بأداة، والاستعارة تشبيه حذف أحد طرفيه.')
      await requestAiEvaluation(h.db, teacher, sub.submissionId)
      await processQueuedJobs(h.db)
      const ev = await getLatestAiEvaluation(h.db, teacher, sub.submissionId)
      expect(ev?.status).toBe('COMPLETED')
      expect(ev?.matched.length).toBe(2)
      expect(ev?.missing.length).toBe(2)
      expect(ev?.suggestedScore).toBe(10)

      await approveAiEvaluation(h.db, teacher, ev!.id)
      const after = await getLatestAiEvaluation(h.db, teacher, sub.submissionId)
      expect(after?.decision?.decision).toBe('APPROVED')
      const seen = await getAssignmentForStudent(h.db, student, a.id)
      expect(Number(seen.grade?.score)).toBe(10)
      // قرار واحد فقط
      await expect(approveAiEvaluation(h.db, teacher, ev!.id)).rejects.toMatchObject({ code: 'AI_EVAL_ALREADY_DECIDED' })
    } finally {
      await h.close()
    }
  })
})
