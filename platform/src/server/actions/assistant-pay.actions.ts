'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { runAction, type ActionResult } from '@/server/lib/action-result'
import { cancelPayout, markMonthPaid, removeAssistantContent, setAssistantPayConfig, setReplyCorrection, submitAssistantContent } from '@/server/services/assistant-pay.service'

const str = (fd: FormData, k: string) => {
  const v = fd.get(k)
  return typeof v === 'string' ? v : ''
}

function refresh() {
  revalidatePath('/admin/assistants-pay')
  revalidatePath('/assistant/earnings')
}

/** المشرف: أرقام أجر الأستاذ المساعد */
export async function saveAssistantPayAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const input = {
    baseSalary: str(fd, 'baseSalary'),
    includedReplies: str(fd, 'includedReplies'),
    detailedMinChars: str(fd, 'detailedMinChars'),
    extraCap: str(fd, 'extraCap'),
    termLimit: str(fd, 'termLimit'),
    replyRates: {
      SHORT: str(fd, 'rate.SHORT'),
      DETAILED: str(fd, 'rate.DETAILED'),
      CORRECTION: str(fd, 'rate.CORRECTION')
    },
    contentRates: {
      SUMMARY: str(fd, 'rate.SUMMARY'),
      EXERCISES: str(fd, 'rate.EXERCISES'),
      EXAM: str(fd, 'rate.EXAM'),
      PROPOSAL: str(fd, 'rate.PROPOSAL')
    },
    contentUnits: {
      SUMMARY: str(fd, 'unit.SUMMARY'),
      EXERCISES: str(fd, 'unit.EXERCISES'),
      EXAM: str(fd, 'unit.EXAM'),
      PROPOSAL: str(fd, 'unit.PROPOSAL')
    }
  }
  const r = await runAction(async () => {
    await setAssistantPayConfig(await getDb(), await requireRole('SUPER_ADMIN'), input)
    return undefined
  })
  if (r.ok) refresh()
  return r
}

/** المساعد: رفع ملخّص أو تمارين أو اختبار أو موضوع مقترح */
export async function submitAssistantContentAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const file = fd.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION',
        message: 'اختر الملف (PDF أو Word).',
        fieldErrors: { file: 'اختر الملف (PDF أو Word).' }
      }
    }
  }
  const r = await runAction(async () => {
    const actor = await requireRole('ASSISTANT')
    await submitAssistantContent(await getDb(), actor, {
      kind: str(fd, 'kind'),
      courseId: str(fd, 'courseId'),
      title: str(fd, 'title'),
      pages: str(fd, 'pages'),
      note: str(fd, 'note') || null,
      file: {
        name: file.name,
        type: file.type,
        bytes: Buffer.from(await file.arrayBuffer())
      }
    })
    return undefined
  })
  if (r.ok) refresh()
  return r
}

/** المساعد (أو المشرف): وسم ردّ «تصحيح تعبير» أو إلغاؤه */
export async function toggleCorrectionAction(fd: FormData): Promise<void> {
  const r = await runAction(async () => {
    await setReplyCorrection(await getDb(), await requireRole('ASSISTANT', 'SUPER_ADMIN'), str(fd, 'commentId'), str(fd, 'on') === '1')
    return undefined
  })
  if (r.ok) refresh()
}

/** المشرف: حذف محتوى من الحساب */
export async function removeAssistantContentAction(fd: FormData): Promise<void> {
  const r = await runAction(async () => {
    await removeAssistantContent(await getDb(), await requireRole('SUPER_ADMIN'), str(fd, 'id'))
    return undefined
  })
  if (r.ok) refresh()
}

/** المشرف: «مدفوع» أو إلغاؤه */
export async function payoutAction(fd: FormData): Promise<void> {
  const r = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    const db = await getDb()
    if (str(fd, 'op') === 'cancel') await cancelPayout(db, actor, str(fd, 'assistantUserId'), str(fd, 'month'))
    else await markMonthPaid(db, actor, str(fd, 'assistantUserId'), str(fd, 'month'))
    return undefined
  })
  if (r.ok) refresh()
}
