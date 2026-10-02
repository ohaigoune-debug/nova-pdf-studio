'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { kickWorker } from '@/server/jobs/runner'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { approveDocument, registerBacDocuments, rejectDocument, reprocessDocument, requestProcessing } from '@/server/services/exam-engine.service'

const uuid = z.string().uuid()
const revalidate = () => {
  revalidatePath('/admin/exam-engine')
  revalidatePath('/archive')
  revalidatePath('/bac')
  revalidatePath('/admin/bac-bank')
}

/** يسجّل مواضيع المكتبة الرسمية (الافتراضي: رياضيات 3AS) في سجلّ المعالجة */
export async function registerBacDocumentsAction(input: { subjectCode?: string; levelCode?: string; streamCode?: string | null; limit?: number } = {}): Promise<ActionResult<{ registered: number; candidates: number }>> {
  const parsed = z.object({ subjectCode: z.string().regex(/^[A-Z_]{2,20}$/).optional(), levelCode: z.string().regex(/^[0-9A-Z_]{2,10}$/).optional(), streamCode: z.string().regex(/^[A-Z_]{2,20}$/).nullish(), limit: z.number().int().min(1).max(2000).optional() }).safeParse(input)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => registerBacDocuments(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data))
  if (result.ok) revalidate()
  return result
}

/** يبدأ معالجة المعلّق (أو وثائق بعينها) في الخلفية */
export async function processDocumentsAction(input: { documentIds?: string[]; limit?: number } = {}): Promise<ActionResult<{ jobId: string; count: number; reused: boolean }>> {
  const parsed = z.object({ documentIds: z.array(uuid).max(200).optional(), limit: z.number().int().min(1).max(200).optional() }).safeParse(input)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => requestProcessing(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data))
  if (result.ok) {
    kickWorker(getDb)
    revalidate()
  }
  return result
}

export async function approveDocumentAction(id: string): Promise<ActionResult<{ approved: number }>> {
  const parsed = uuid.safeParse(id)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => approveDocument(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data))
  if (result.ok) revalidate()
  return result
}

export async function rejectDocumentAction(id: string, reason?: string | null): Promise<ActionResult> {
  const parsed = z.object({ id: uuid, reason: z.string().max(300).nullish() }).safeParse({ id, reason })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await rejectDocument(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data.id, parsed.data.reason)
    return undefined
  })
  if (result.ok) revalidate()
  return result
}

export async function reprocessDocumentAction(id: string): Promise<ActionResult<{ jobId: string; reused: boolean }>> {
  const parsed = uuid.safeParse(id)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => reprocessDocument(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data))
  if (result.ok) {
    kickWorker(getDb)
    revalidate()
  }
  return result
}
