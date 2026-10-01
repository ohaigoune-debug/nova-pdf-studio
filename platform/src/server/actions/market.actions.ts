'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { LISTING_KINDS } from '@/server/db/schema/enums'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { archiveListing, createListing, createPayout, markPayoutPaid, reviewListing, submitListing, updateListing } from '@/server/services/marketplace.service'

const uuid = z.string().uuid()
const optUuid = z.string().uuid().nullish()

const revalidate = () => {
  revalidatePath('/teacher/market')
  revalidatePath('/admin/market')
  revalidatePath('/store')
}

export async function createListingAction(input: { kind: string; title: string; description?: string | null; priceDzd: number; subjectId?: string | null; levelId?: string | null; streamId?: string | null; examId?: string | null; fileId?: string | null; questionIds?: string[]; rightsConfirmed?: boolean }): Promise<ActionResult<{ id: string }>> {
  const parsed = z.object({ kind: z.enum(LISTING_KINDS), title: z.string().min(2).max(200), description: z.string().max(2000).nullish(), priceDzd: z.coerce.number().int().min(0).max(100_000), subjectId: optUuid, levelId: optUuid, streamId: optUuid, examId: optUuid, fileId: optUuid, questionIds: z.array(uuid).max(200).optional(), rightsConfirmed: z.boolean().optional() }).safeParse(input)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const row = await createListing(await getDb(), await requireRole('TEACHER'), parsed.data)
    return { id: row.id }
  })
  if (result.ok) revalidate()
  return result
}

export async function updateListingAction(id: string, patch: { title?: string; description?: string | null; priceDzd?: number; rightsConfirmed?: boolean }): Promise<ActionResult> {
  const parsed = z.object({ id: uuid, patch: z.object({ title: z.string().min(2).max(200).optional(), description: z.string().max(2000).nullish(), priceDzd: z.coerce.number().int().min(0).max(100_000).optional(), rightsConfirmed: z.boolean().optional() }) }).safeParse({ id, patch })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await updateListing(await getDb(), await requireRole('TEACHER'), parsed.data.id, parsed.data.patch)
    return undefined
  })
  if (result.ok) revalidate()
  return result
}

export async function submitListingAction(id: string): Promise<ActionResult> {
  const parsed = uuid.safeParse(id)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await submitListing(await getDb(), await requireRole('TEACHER'), parsed.data)
    return undefined
  })
  if (result.ok) revalidate()
  return result
}

export async function archiveListingAction(id: string): Promise<ActionResult> {
  const parsed = uuid.safeParse(id)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await archiveListing(await getDb(), await requireRole('TEACHER'), parsed.data)
    return undefined
  })
  if (result.ok) revalidate()
  return result
}

export async function reviewListingAction(id: string, approve: boolean, note?: string | null): Promise<ActionResult> {
  const parsed = z.object({ id: uuid, approve: z.boolean(), note: z.string().max(500).nullish() }).safeParse({ id, approve, note })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await reviewListing(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data.id, { approve: parsed.data.approve, note: parsed.data.note ?? null })
    return undefined
  })
  if (result.ok) revalidate()
  return result
}

export async function createPayoutAction(input: { workspaceId: string; amountDzd: number; note?: string | null; paid?: boolean }): Promise<ActionResult> {
  const parsed = z.object({ workspaceId: uuid, amountDzd: z.coerce.number().int().min(1).max(10_000_000), note: z.string().max(300).nullish(), paid: z.boolean().optional() }).safeParse(input)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await createPayout(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data)
    return undefined
  })
  if (result.ok) revalidate()
  return result
}

export async function markPayoutPaidAction(id: string): Promise<ActionResult> {
  const parsed = uuid.safeParse(id)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await markPayoutPaid(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data)
    return undefined
  })
  if (result.ok) revalidate()
  return result
}
