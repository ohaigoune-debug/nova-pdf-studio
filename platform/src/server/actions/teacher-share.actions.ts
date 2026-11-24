'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { runAction, type ActionResult } from '@/server/lib/action-result'
import { setTeacherSharePaid, setTeacherShareConfig } from '@/server/services/teacher-share.service'

const str = (fd: FormData, k: string) => {
  const v = fd.get(k)
  return typeof v === 'string' ? v : ''
}

/** المالك: نسب نصيب الأستاذ والأساتذة الشركاء */
export async function saveTeacherShareAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const input = { cardPct: str(fd, 'cardPct'), otherPct: str(fd, 'otherPct'), vatPct: str(fd, 'vatPct'), vatMode: str(fd, 'vatMode'), partners: fd.getAll('partners').filter((x): x is string => typeof x === 'string') }
  const r = await runAction(async () => {
    await setTeacherShareConfig(await getDb(), await requireRole('SUPER_ADMIN'), input)
    return undefined
  })
  if (r.ok) {
    revalidatePath('/admin/revenue')
    revalidatePath('/teacher/earnings')
  }
  return r
}

/** المالك: «مدفوع» لنصيب أستاذ في شهر، أو إلغاؤه */
export async function teacherSharePaidAction(fd: FormData): Promise<void> {
  const r = await runAction(async () => {
    await setTeacherSharePaid(await getDb(), await requireRole('SUPER_ADMIN'), str(fd, 'workspaceId'), str(fd, 'month'), str(fd, 'op') !== 'cancel')
    return undefined
  })
  if (r.ok) {
    revalidatePath('/admin/revenue')
    revalidatePath('/teacher/earnings')
  }
}
