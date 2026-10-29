'use client'

import { Archive, Ban, CheckCircle2, Clock, Eye, EyeOff, KeyRound, PackageCheck, PencilLine, PhoneMissed, RotateCcw, Send, Trash2, Truck, Undo2, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { sendToEcotrackAction } from '@/server/actions/ecotrack.actions'
import { adjustOrderAmountAction, banOrderCustomerAction, changeOrderStreamAction, deleteProductAction, sendActivationCodeAction, setOrderStatusAction, setProductStatusAction } from '@/server/actions/store.actions'

export function ProductRowActions({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, ok: string) =>
    start(async () => {
      const r = await fn()
      if (!r.ok) return toast('error', r.error!.message)
      toast('success', ok)
      router.refresh()
    })
  return (
    <div className="flex justify-end gap-1">
      {status === 'PUBLISHED' ? (
        <Button size="sm" variant="ghost" title="إخفاء (مسودة)" loading={pending} onClick={() => run(() => setProductStatusAction(id, 'DRAFT'), 'أُخفي من المتجر')}>
          <EyeOff className="size-4" />
        </Button>
      ) : (
        <Button size="sm" variant="ghost" title="نشر" loading={pending} onClick={() => run(() => setProductStatusAction(id, 'PUBLISHED'), 'نُشر في المتجر')}>
          <Eye className="size-4" />
        </Button>
      )}
      {status !== 'ARCHIVED' ? (
        <Button size="sm" variant="ghost" title="أرشفة" loading={pending} onClick={() => run(() => setProductStatusAction(id, 'ARCHIVED'), 'أُرشف')}>
          <Archive className="size-4" />
        </Button>
      ) : null}
      <Button size="sm" variant="ghost" title="حذف" loading={pending} onClick={() => confirm('حذف المنتج؟ الطلبات السابقة تبقى.') && run(() => deleteProductAction(id), 'حُذف')}>
        <Trash2 className="size-4" />
      </Button>
    </div>
  )
}

/** أزرار حالة الطلب حسب الانتقالات المسموحة */
export function OrderRowActions({ id, status, needsShipping, ecotrack = false, provider = null, confirmer = false }: { id: string; status: string; needsShipping: boolean; ecotrack?: boolean; provider?: string | null; confirmer?: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const go = (next: 'CONFIRMED' | 'NO_ANSWER' | 'CALL_LATER' | 'SHIPPED' | 'DELIVERED' | 'RETURNED' | 'CANCELLED' | 'PENDING') =>
    start(async () => {
      const reason = next === 'CANCELLED' ? prompt('سبب الإلغاء (يصل إلى العميل):') : null
      if (next === 'CANCELLED' && reason === null) return
      const r = await setOrderStatusAction(id, next, { reason })
      if (!r.ok) return toast('error', r.error.message)
      toast('success', 'حُدّثت حالة الطلب')
      router.refresh()
    })
  const send = () =>
    start(async () => {
      const r = await sendToEcotrackAction(id)
      if (!r.ok) return toast('error', r.error.message)
      toast('success', `أُرسل الطرد إلى EcoTrack — رقم التتبّع ${r.data.tracking}`)
      router.refresh()
    })
  const activationCode = () =>
    start(async () => {
      const phone = prompt('هاتف استلام كود التفعيل (اتركه فارغاً لهاتف الطلب، أو اكتب هاتف الولي / رقماً آخر):', '')
      if (phone === null) return
      const r = await sendActivationCodeAction(id, phone || null)
      if (!r.ok) return toast('error', r.error.message)
      const list = r.data.codes.map((c) => `${c.courseTitle}: ${c.code}`).join(' · ')
      // نافذة لا تختفي: قد يحتاج المشرف إلى إملاء الكود هاتفياً
      alert(`${r.data.smsSent ? 'أُرسل كود التفعيل بالـSMS' : 'تعذّر إرسال SMS — أملِ الكود على التلميذ هاتفياً'} إلى ${r.data.phone}\n\n${list}\n\nيُدخله التلميذ مع هذا الرقم في madrasadz.com/claim`)
    })
  const confirming = status === 'PENDING' || status === 'NO_ANSWER' || status === 'CALL_LATER'
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {confirming ? (
        <>
          <Button size="sm" variant="outline" loading={pending} onClick={() => go('CONFIRMED')} title="تأكيد (بعد الاتصال بالعميل أو التحقّق من الدفع)">
            <CheckCircle2 className="size-4" /> تأكيد
          </Button>
          <Button size="sm" variant="ghost" loading={pending} onClick={() => go('NO_ANSWER')} title="لم يردّ على الاتصال">
            <PhoneMissed className="size-4" /> لا يردّ
          </Button>
          <Button size="sm" variant="ghost" loading={pending} onClick={() => go('CALL_LATER')} title="طلب الاتصال لاحقاً">
            <Clock className="size-4" /> لاحقاً
          </Button>
        </>
      ) : null}
      {status === 'CONFIRMED' && needsShipping && ecotrack ? (
        <Button size="sm" loading={pending} onClick={send} title="إنشاء الطرد عند EcoTrack وحفظ رقم التتبّع">
          <Send className="size-4" /> إرسال إلى EcoTrack
        </Button>
      ) : null}
      {!confirmer && status === 'CONFIRMED' && needsShipping ? (
        <Button size="sm" variant="outline" loading={pending} onClick={() => go('SHIPPED')} title="شُحن بطريقة أخرى">
          <Truck className="size-4" /> شُحن
        </Button>
      ) : null}
      {status === 'CONFIRMED' || status === 'SHIPPED' ? (
        <Button size="sm" variant="outline" loading={pending} onClick={() => confirm('تأكيد التسليم واستلام المبلغ؟ تُفعَّل الدورة والملفات المرتبطة بالطلب.') && go('DELIVERED')} title="سُلِّم: استلام المبلغ وتفعيل الدورة المرتبطة">
          <PackageCheck className="size-4" /> سُلّم وتفعيل
        </Button>
      ) : null}
      {!confirmer && status === 'SHIPPED' ? (
        <Button size="sm" variant="ghost" loading={pending} onClick={() => confirm('أعادت شركة التوصيل الطرد؟ يُعاد المخزون.') && go('RETURNED')} title="مرتجع">
          <Undo2 className="size-4" /> مرتجع
        </Button>
      ) : null}
      {confirming || status === 'CONFIRMED' || (!confirmer && status === 'SHIPPED') ? (
        <Button size="sm" variant="ghost" loading={pending} onClick={() => go('CANCELLED')} title={provider === 'ecotrack' && status === 'SHIPPED' ? 'إلغاء (احذف الطرد من EcoTrack أيضاً من صفحة التوصيل)' : 'إلغاء'}>
          <XCircle className="size-4 text-destructive" />
        </Button>
      ) : null}
      {status === 'DELIVERED' || (!confirmer && status === 'SHIPPED') ? (
        <Button size="sm" variant="ghost" loading={pending} onClick={activationCode} title="لم تُفعَّل الدورة؟ أرسل كود تفعيل لهاتف التلميذ أو وليّه">
          <KeyRound className="size-4" /> كود تفعيل
        </Button>
      ) : null}
      {!confirmer && status === 'CANCELLED' ? (
        <Button size="sm" variant="ghost" loading={pending} onClick={() => go('PENDING')} title="إعادة فتح الطلب">
          <RotateCcw className="size-4" /> إعادة فتح
        </Button>
      ) : null}
    </div>
  )
}

const EDITABLE = ['PENDING', 'NO_ANSWER', 'CALL_LATER', 'CONFIRMED']

/**
 * تعديل الطلب أثناء التأكيد (المشرف والموظف): الشعبة، والمبلغ بسبب إلزامي، وحظر صاحب الطلب.
 * الخادم يعيد كل الفحوص (قبل الشحن، أدوار الزبائن، السبب)؛ هذه الواجهة لا تمنح صلاحية.
 */
export function OrderEditPanel({ id, status, trackingId, streamId, subtotalDzd, shippingDzd, streams }: { id: string; status: string; trackingId: string | null; streamId: string | null; subtotalDzd: number; shippingDzd: number; streams: { id: string; name: string }[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [stream, setStream] = useState(streamId ?? '')
  const [subtotal, setSubtotal] = useState(String(subtotalDzd))
  const [shipping, setShipping] = useState(String(shippingDzd))
  const [reason, setReason] = useState('')
  const editable = EDITABLE.includes(status) && !trackingId
  const done = (r: { ok: boolean; error?: { message: string } }, message: string) => {
    if (!r.ok) return toast('error', r.error!.message)
    toast('success', message)
    router.refresh()
  }
  const saveStream = () => start(async () => done(await changeOrderStreamAction(id, stream), 'حُدّثت شعبة الطلب'))
  const saveAmount = () =>
    start(async () => {
      const s = Number(subtotal)
      const sh = Number(shipping)
      if (!Number.isInteger(s) || s < 0 || !Number.isInteger(sh) || sh < 0) return toast('error', 'أدخل مبلغًا صحيحًا بالدينار.')
      if (reason.trim().length < 3) return toast('error', 'اكتب سبب تغيير المبلغ.')
      const r = await adjustOrderAmountAction(id, { subtotalDzd: s, shippingDzd: sh, reason: reason.trim() })
      if (r.ok) setReason('')
      done(r, 'حُدّث مبلغ الطلب')
    })
  const ban = () =>
    start(async () => {
      const why = prompt('سبب الحظر (يُسجَّل، ويُلغي طلبات هذا الزبون التي لم تُشحن):')
      if (why === null) return
      if (!confirm('إيقاف حساب هذا الزبون؟ لن يستطيع الدخول أو الطلب حتى يرفع المشرف الحظر.')) return
      const r = await banOrderCustomerAction(id, why)
      if (!r.ok) return toast('error', r.error.message)
      toast('success', `حُظر الزبون${r.data.cancelledOrders ? ` وأُلغي ${r.data.cancelledOrders} طلب مفتوح` : ''}`)
      router.refresh()
    })
  const total = (Number(subtotal) || 0) + (Number(shipping) || 0)
  return (
    <details className="mt-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold">
        <PencilLine className="size-4" aria-hidden /> تعديل الطلب
      </summary>
      <div className="space-y-4 py-2">
        {editable ? (
          <>
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-40 flex-1 space-y-1">
                <span className="text-xs text-muted-foreground">الشعبة</span>
                <Select value={stream} onChange={(e) => setStream(e.target.value)} aria-label="الشعبة">
                  <option value="" disabled>اختر الشعبة</option>
                  {streams.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </label>
              <Button size="sm" variant="outline" loading={pending} disabled={!stream || stream === streamId} onClick={saveStream}>حفظ الشعبة</Button>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">ثمن الطلب (دج)</span>
                  <Input inputMode="numeric" dir="ltr" value={subtotal} onChange={(e) => setSubtotal(e.target.value.replace(/[^0-9]/g, ''))} aria-label="ثمن الطلب" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">التوصيل (دج)</span>
                  <Input inputMode="numeric" dir="ltr" value={shipping} onChange={(e) => setShipping(e.target.value.replace(/[^0-9]/g, ''))} aria-label="رسوم التوصيل" />
                </label>
              </div>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب التغيير (إلزامي)" maxLength={300} aria-label="سبب تغيير المبلغ" />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">الإجمالي الجديد: <b className="text-foreground">{total} دج</b></span>
                <Button size="sm" variant="outline" loading={pending} onClick={saveAmount}>حفظ المبلغ</Button>
              </div>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">الشعبة والمبلغ لا يُعدَّلان بعد الشحن أو التسليم أو الإلغاء.</p>
        )}
        <Button size="sm" variant="ghost" className="text-destructive" loading={pending} onClick={ban} title="إيقاف حساب الزبون وإلغاء طلباته التي لم تُشحن">
          <Ban className="size-4" /> حظر الزبون
        </Button>
      </div>
    </details>
  )
}
