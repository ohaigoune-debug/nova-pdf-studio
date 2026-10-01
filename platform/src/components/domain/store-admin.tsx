'use client'

import { Archive, CheckCircle2, Eye, EyeOff, PackageCheck, Trash2, Truck, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
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
export function OrderRowActions({ id, status, needsShipping }: { id: string; status: string; needsShipping: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const go = (next: 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED') =>
    start(async () => {
      const reason = next === 'CANCELLED' ? prompt('سبب الإلغاء (يصل إلى العميل):') : null
      if (next === 'CANCELLED' && reason === null) return
      const r = await setOrderStatusAction(id, next, { reason })
      if (!r.ok) return toast('error', r.error.message)
      toast('success', 'حُدّثت حالة الطلب')
      router.refresh()
    })
  return (
    <div className="flex justify-end gap-1">
      {status === 'PENDING' ? (
        <Button size="sm" variant="outline" loading={pending} onClick={() => go('CONFIRMED')} title="تأكيد (بعد التحقّق من الدفع أو الاتصال بالعميل)">
          <CheckCircle2 className="size-4" /> تأكيد
        </Button>
      ) : null}
      {status === 'CONFIRMED' && needsShipping ? (
        <Button size="sm" variant="outline" loading={pending} onClick={() => go('SHIPPED')}>
          <Truck className="size-4" /> شُحن
        </Button>
      ) : null}
      {status === 'CONFIRMED' || status === 'SHIPPED' ? (
        <Button size="sm" variant="outline" loading={pending} onClick={() => go('DELIVERED')}>
          <PackageCheck className="size-4" /> سُلّم
        </Button>
      ) : null}
      {status === 'PENDING' || status === 'CONFIRMED' || status === 'SHIPPED' ? (
        <Button size="sm" variant="ghost" loading={pending} onClick={() => go('CANCELLED')} title="إلغاء">
          <XCircle className="size-4 text-destructive" />
        </Button>
      ) : null}
    </div>
  )
}
