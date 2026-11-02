'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { STAFF_ROLES, createStaffAccount } from '@/server/services/confirmer.service'

/** موظف جديد: موظف تأكيد أو «مدير العمليات» (الدور من قائمة مغلقة، لا من نص حرّ) */
export async function createConfirmerAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = z.object({ email: z.string().trim().email().max(254), password: z.string().min(8).max(200), fullName: z.string().trim().min(3).max(120), phone: z.string().trim().min(9).max(20), role: z.enum(STAFF_ROLES).default('CONFIRMER') }).safeParse(Object.fromEntries(formData))
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await createStaffAccount(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data)
    return undefined
  })
  if (result.ok) revalidatePath('/admin/employees')
  return result
}
