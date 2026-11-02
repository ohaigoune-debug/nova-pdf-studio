'use client'

import { CreditCard } from 'lucide-react'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { placeDigitalCourseOrderAction } from '@/server/actions/course-purchase.actions'

/**
 * شراء النسخة الرقمية: تأكيد صريح «دون كتاب» ثم صفحة SATIM. لا عنوان ولا هاتف ولا رمز:
 * الخادم يحدّد السعر، والدورة تُفتح عند العودة فور تأكّد الدفع.
 */
export function DigitalCheckout({ courseId, priceDzd, credit }: { courseId: string; priceDzd: number; credit?: { balanceDzd: number; applyDzd: number } }) {
  const [ack, setAck] = useState(false)
  const [useCredit, setUseCredit] = useState(Boolean(credit?.applyDzd))
  const [pending, start] = useTransition()
  const applied = useCredit && credit ? credit.applyDzd : 0
  const due = priceDzd - applied
  const pay = () =>
    start(async () => {
      const r = await placeDigitalCourseOrderAction({ courseId, acceptNoBook: ack, useCredit: applied > 0 })
      if (!r.ok) return toast('error', r.error.message)
      if (r.data.paidWithCredit) toast('success', 'دُفعت الدورة برصيدك وفُتحت الآن')
      window.location.assign(r.data.payUrl)
    })
  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 rounded-lg border border-warning/50 bg-warning/5 p-3 text-sm">
        <input type="checkbox" className="mt-0.5 size-4 shrink-0" checked={ack} onChange={(e) => setAck(e.target.checked)} />
        <span>
          فهمت أن هذه <strong>نسخة رقمية دون كتاب ورقي</strong>: لن يصلني أي كتاب، وتُفتح الدورة على حسابي فور الدفع، ولا يُستردّ ثمنها بعد فتحها.
        </span>
      </label>
      {credit && credit.applyDzd > 0 ? (
        <label className="flex items-start gap-3 rounded-lg border border-success/50 bg-success/5 p-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 shrink-0" checked={useCredit} onChange={(e) => setUseCredit(e.target.checked)} />
          <span>
            استعمل رصيدي: يُخصم <strong className="tabular-nums">{credit.applyDzd} دج</strong> (رصيدك {credit.balanceDzd} دج).
          </span>
        </label>
      ) : null}
      <Button className="w-full" size="lg" disabled={!ack} loading={pending} onClick={pay}>
        <CreditCard className="size-4" /> {due === 0 ? 'افتح الدورة برصيدي' : `ادفع ${due} دج بالبطاقة`}
      </Button>
      <p className="text-center text-xs text-muted-foreground">CIB أو الذهبية — صفحة الدفع الرسمية (SATIM). لا تُحفظ بيانات بطاقتك عندنا.</p>
    </div>
  )
}
