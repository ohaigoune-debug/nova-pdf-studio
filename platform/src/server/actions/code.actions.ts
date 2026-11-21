'use server'

import { revalidatePath } from 'next/cache'
import { codeDigits, codeKind } from '@/lib/code-input'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { runAction, type ActionResult } from '@/server/lib/action-result'
import { clearPendingCode, savePendingCode } from '@/server/lib/pending-code'
import { RATE_LIMITS, checkRateLimit } from '@/server/lib/rate-limit'
import { redeemTypedCode, type RedeemResult } from '@/server/services/code-redeem.service'

const lengthError = (): ActionResult<never> => ({
  ok: false,
  error: { code: 'CODE_LENGTH', message: 'الكود 11 رقمًا (كود الدورة) أو 6 أرقام (كود الطلب). عُدّ الأرقام وأعد كتابته.', fieldErrors: { code: 'عدد الأرقام غير صحيح' } }
})

/** زائر بلا حساب: نحفظ كوده (دون فحصه) ونرسله للتسجيل أو الدخول */
export async function rememberCodeAction(_prev: ActionResult<{ code: string }> | null, fd: FormData): Promise<ActionResult<{ code: string }>> {
  const digits = codeDigits(String(fd.get('code') ?? ''))
  if (!codeKind(digits)) return lengthError()
  await savePendingCode(digits)
  return { ok: true, data: { code: digits } }
}

/** التلميذ: خانة واحدة لكل أنواع الأكواد؛ الهاتف اختياري ولا يُطلب إلا عند الحاجة */
export async function redeemCodeAction(_prev: ActionResult<RedeemResult> | null, fd: FormData): Promise<ActionResult<RedeemResult>> {
  const code = String(fd.get('code') ?? '')
  if (!codeKind(codeDigits(code))) return lengthError()
  const phone = String(fd.get('phone') ?? '').trim() || null
  const result = await runAction(async () => {
    const actor = await requireRole('STUDENT')
    const db = await getDb()
    await checkRateLimit(db, { scope: 'course-claim', subject: actor.userId, ...RATE_LIMITS.activateCode })
    return redeemTypedCode(db, actor, { code, phone })
  })
  if (result.ok) {
    await clearPendingCode()
    revalidatePath('/student')
    revalidatePath('/student/courses')
  }
  return result
}
