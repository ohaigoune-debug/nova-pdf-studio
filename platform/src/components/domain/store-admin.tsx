'use client'

import { Archive, CheckCircle2, Clock, Eye, EyeOff, PackageCheck, PhoneMissed, RotateCcw, Send, Trash2, Truck, Undo2, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { sendToEcotrackAction } from '@/server/actions/ecotrack.actions'
import { deleteProductAction, setOrderStatusAction, setProductStatusAction } from '@/server/actions/store.actions'

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
export function OrderRowActions({ id, status, needsShipping, ecotrack = false, provider = null }: { id: string; status: string; needsShipping: boolean; ecotrack?: boolean; provider?: string | null }) {
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
      {status === 'CONFIRMED' && needsShipping ? (
        <Button size="sm" variant="outline" loading={pending} onClick={() => go('SHIPPED')} title="شُحن بطريقة أخرى">
          <Truck className="size-4" /> شُحن
        </Button>
      ) : null}
      {status === 'CONFIRMED' || status === 'SHIPPED' ? (
        <Button size="sm" variant="outline" loading={pending} onClick={() => go('DELIVERED')} title="سُلِّم: يفعّل الدورة المرتبطة بالكتاب">
          <PackageCheck className="size-4" /> سُلّم
        </Button>
      ) : null}
      {status === 'SHIPPED' ? (
        <Button size="sm" variant="ghost" loading={pending} onClick={() => confirm('أعادت شركة التوصيل الطرد؟ يُعاد المخزون.') && go('RETURNED')} title="مرتجع">
          <Undo2 className="size-4" /> مرتجع
        </Button>
      ) : null}
      {confirming || status === 'CONFIRMED' || status === 'SHIPPED' ? (
        <Button size="sm" variant="ghost" loading={pending} onClick={() => go('CANCELLED')} title={provider === 'ecotrack' && status === 'SHIPPED' ? 'إلغاء (احذف الطرد من EcoTrack أيضاً من صفحة التوصيل)' : 'إلغاء'}>
          <XCircle className="size-4 text-destructive" />
        </Button>
      ) : null}
      {status === 'CANCELLED' ? (
        <Button size="sm" variant="ghost" loading={pending} onClick={() => go('PENDING')} title="إعادة فتح الطلب">
          <RotateCcw className="size-4" /> إعادة فتح
        </Button>
      ) : null}
    </div>
  )
}
