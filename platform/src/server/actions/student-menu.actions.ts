'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { runAction, type ActionResult } from '@/server/lib/action-result'
import { setPlayBacIosOnly } from '@/server/services/ios-only.service'
import { setHiddenStudentEntries } from '@/server/services/student-menu.service'

/** المشرف: الأقسام المخفية من حساب التلميذ (المؤشَّر = مخفي) */
export async function saveStudentMenuAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const hidden = fd.getAll('hidden').filter((x): x is string => typeof x === 'string')
  const r = await runAction(async () => {
    await setHiddenStudentEntries(await getDb(), await requireRole('SUPER_ADMIN'), hidden)
    return undefined
  })
  if (r.ok) {
    revalidatePath('/admin/settings/student-menu')
    revalidatePath('/student', 'layout')
  }
  return r
}

/** المشرف: PLAY وبنك البكالوريات في تطبيق آيفون وحده (المؤشَّر) أو في الموقع أيضًا */
export async function savePlayBacIosOnlyAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const on = fd.get('iosOnly') === 'on'
  const r = await runAction(async () => {
    await setPlayBacIosOnly(await getDb(), await requireRole('SUPER_ADMIN'), on)
    return undefined
  })
  if (r.ok) {
    revalidatePath('/admin/settings/student-menu')
    revalidatePath('/', 'layout')
  }
  return r
}
