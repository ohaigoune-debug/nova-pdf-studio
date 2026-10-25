'use server'

import { revalidatePath } from 'next/cache'
import { requireActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { guardianContactSchema, updateGuardianContact } from '@/server/services/student-contact.service'

export async function updateGuardianContactAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = guardianContactSchema.safeParse({ guardianPhone: form.get('guardianPhone') })
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => {
    const actor = await requireActor()
    await updateGuardianContact(await getDb(), actor, parsed.data)
    revalidatePath('/student/profile')
    return undefined
  })
}
