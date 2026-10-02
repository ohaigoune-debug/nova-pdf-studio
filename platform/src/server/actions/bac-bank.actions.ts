'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { kickWorker } from '@/server/jobs/runner'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { registerAllBacDocuments, requestSolutionDetails, reviewSolutionDetail, searchBacExercises, verifyDocument, type BacSearchHit } from '@/server/services/bac-bank.service'
import { requestProcessing } from '@/server/services/exam-engine.service'

const uuid = z.string().uuid()
const revalidate = () => {
  revalidatePath('/admin/bac-bank')
  revalidatePath('/admin/exam-engine')
  revalidatePath('/bac')
}

/** الدفعة: تسجيل كل مواضيع البكالوريا الرسمية غير المسجَّلة (كل المواد والشعب) */
export async function registerAllBacAction(input: { limit?: number; subjectCode?: string | null } = {}): Promise<ActionResult<{ registered: number; candidates: number; bySubject: Record<string, number> }>> {
  const parsed = z.object({ limit: z.number().int().min(1).max(5000).optional(), subjectCode: z.string().regex(/^[A-Z_]{2,20}$/).nullish() }).safeParse(input)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => registerAllBacDocuments(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data))
  if (result.ok) revalidate()
  return result
}

/** الدفعة: معالجة N وثيقة معلّقة (تنزيل، قراءة، تقسيم، تصنيف) في الخلفية */
export async function processBatchAction(limit = 20): Promise<ActionResult<{ jobId: string; count: number; reused: boolean }>> {
  const parsed = z.number().int().min(1).max(200).safeParse(limit)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => requestProcessing(await getDb(), await requireRole('SUPER_ADMIN'), { limit: parsed.data }))
  if (result.ok) {
    kickWorker(getDb)
    revalidate()
  }
  return result
}

/** توثيق وثيقة بعد الفحص */
export async function verifyDocumentAction(id: string, checklist: Record<string, boolean | string>): Promise<ActionResult<{ missing: string[] }>> {
  const parsed = z.object({ id: uuid, checklist: z.record(z.union([z.boolean(), z.string().max(500)])) }).safeParse({ id, checklist })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const r = await verifyDocument(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data.id, parsed.data.checklist as Record<string, boolean>)
    return { missing: r.missing }
  })
  if (result.ok) revalidate()
  return result
}

/** الدفعة: توليد حلول مفصّلة للتمارين المنشورة بلا حلّ مفصّل */
export async function requestSolutionDetailsAction(input: { limit?: number; documentId?: string | null } = {}): Promise<ActionResult<{ jobId: string; count: number; reused: boolean }>> {
  const parsed = z.object({ limit: z.number().int().min(1).max(300).optional(), documentId: uuid.nullish() }).safeParse(input)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => requestSolutionDetails(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data))
  if (result.ok) {
    kickWorker(getDb)
    revalidate()
  }
  return result
}

export async function reviewSolutionDetailAction(questionId: string, decision: 'approve' | 'reject'): Promise<ActionResult> {
  const parsed = z.object({ questionId: uuid, decision: z.enum(['approve', 'reject']) }).safeParse({ questionId, decision })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await reviewSolutionDetail(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data.questionId, parsed.data.decision)
    return undefined
  })
  if (result.ok) revalidate()
  return result
}

/** البحث الذكي العام (بلا تسجيل دخول): «الدالة الأسية» ← تمارين البكالوريا */
export async function searchBacAction(query: string, f: { subjectId?: string | null; streamId?: string | null; year?: number | null } = {}): Promise<ActionResult<BacSearchHit[]>> {
  const parsed = z.object({ query: z.string().min(2).max(100), subjectId: uuid.nullish(), streamId: uuid.nullish(), year: z.number().int().min(1960).max(2100).nullish() }).safeParse({ query, ...f })
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => searchBacExercises(await getDb(), parsed.data.query, { subjectId: parsed.data.subjectId, streamId: parsed.data.streamId, year: parsed.data.year }))
}
