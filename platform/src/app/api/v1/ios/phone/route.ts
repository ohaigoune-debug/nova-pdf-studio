import type { NextRequest } from 'next/server'
import { AppError } from '@/server/lib/errors'
import { phoneGateFor } from '@/server/services/phone-gate.service'
import { iosApiGet } from '../_respond'

export const dynamic = 'force-dynamic'

/** حالة تأكيد هاتف التلميذ في التطبيق: هل هو مطلوب، وقنواته (رمز SMS أو مكالمة إلى رقم المنصة) */
export function GET(req: NextRequest) {
  return iosApiGet(req, async (db, actor) => {
    if (!actor) throw new AppError('AUTH_REQUIRED')
    if (actor.role !== 'STUDENT') throw new AppError('FORBIDDEN')
    const gate = await phoneGateFor(db, actor.userId)
    return { required: gate.required, phone: gate.phone, sms: gate.channels.sms, callNumber: gate.channels.callNumber }
  })
}
