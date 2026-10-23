'use client'

import { KeyRound, Truck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useState, useTransition } from 'react'
import { FormError, SubmitButton } from '@/components/forms/form-bits'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { saveDeliverySecretAction, setOrderShippingAction } from '@/server/actions/delivery.actions'

const PROVIDERS: { value: string; label: string }[] = [
  { value: 'yalidine', label: 'Yalidine' },
  { value: 'generic', label: 'شركة توصيل (عام)' }
]

/** نموذج صغير في صفّ الطلب: شركة التوصيل + رقم التتبّع (المؤكَّد يصبح «في الطريق») */
export function ShippingForm({ orderId, provider, trackingId }: { orderId: string; provider: string | null; trackingId: string | null }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(false)
  const [p, setP] = useState(provider ?? 'yalidine')
  const [t, setT] = useState(trackingId ?? '')
  if (!open) {
    return (
      <button type="button" className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground" onClick={() => setOpen(true)}>
        <Truck className="size-3" /> {trackingId ? <span dir="ltr">{`${provider ?? ''} ${trackingId}`}</span> : 'رقم التتبّع…'}
      </button>
    )
  }
  return (
    <form
      className="mt-1 flex flex-wrap items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const r = await setOrderShippingAction(orderId, p, t)
          if (!r.ok) return toast('error', r.error.message)
          toast('success', 'سُجّل رقم التتبّع')
          setOpen(false)
          router.refresh()
        })
      }}
    >
      <Select aria-label="شركة التوصيل" className="h-8 w-auto text-xs" value={p} onChange={(e) => setP(e.target.value)}>
        {PROVIDERS.map((x) => (
          <option key={x.value} value={x.value}>
            {x.label}
          </option>
        ))}
      </Select>
      <Input aria-label="رقم التتبّع" className="h-8 w-36 font-mono text-xs" dir="ltr" value={t} onChange={(e) => setT(e.target.value)} placeholder="tracking" required minLength={3} />
      <Button type="submit" size="sm" loading={pending}>
        حفظ
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
        إلغاء
      </Button>
    </form>
  )
}

export function WebhookSecretForm({ source, hint }: { source: 'admin' | 'env' | 'none'; hint: string | null }) {
  const [state, action] = useActionState(saveDeliverySecretAction, null)
  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {source === 'admin' ? `سرّ محفوظ من لوحة الإدارة (ينتهي بـ …${hint ?? ''}).` : source === 'env' ? 'السرّ من البيئة (DELIVERY_WEBHOOK_SECRET).' : 'لا سرّ مضبوط: الـwebhook مرفوض دائماً حتى تضبط سرّاً هنا أو في البيئة.'}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input name="secret" type="password" dir="ltr" placeholder="سرّ جديد (16 حرفاً فأكثر) — فارغ لحذف المحفوظ" minLength={0} maxLength={200} className="max-w-md font-mono" autoComplete="off" />
        <SubmitButton variant="outline">
          <KeyRound className="size-4" /> حفظ السرّ
        </SubmitButton>
      </div>
      {state?.ok ? <p className="text-xs text-success">حُفظ.</p> : null}
      <FormError state={state} />
    </form>
  )
}
