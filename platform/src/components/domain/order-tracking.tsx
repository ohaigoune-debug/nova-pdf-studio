'use client'

import { CheckCircle2, CircleAlert, Circle, Search, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { cn, formatDateTime } from '@/lib/utils'
import { cancelMyOrderAction, trackOrdersAction, type TrackedOrderView } from '@/server/actions/tracking.actions'

const VARIANT: Record<string, 'secondary' | 'success' | 'warning' | 'muted' | 'destructive'> = { PENDING: 'warning', NO_ANSWER: 'warning', CALL_LATER: 'warning', CONFIRMED: 'secondary', SHIPPED: 'secondary', DELIVERED: 'success', RETURNED: 'destructive', CANCELLED: 'muted' }
const REASONS: [string, string][] = [
  ['changed_mind', 'غيّرت رأيي'],
  ['ordered_by_mistake', 'طلبت بالخطأ'],
  ['found_elsewhere', 'وجدته في مكان آخر'],
  ['price', 'السعر'],
  ['delay', 'التأخير'],
  ['other', 'سبب آخر']
]

function CancelBox({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('changed_mind')
  const [note, setNote] = useState('')
  const [pending, start] = useTransition()
  if (!open)
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <XCircle className="size-4 text-destructive" /> إلغاء الطلب
      </Button>
    )
  const go = () =>
    start(async () => {
      const r = await cancelMyOrderAction(orderId, reason, note || null)
      if (!r.ok) return toast('error', r.error.message)
      toast('success', 'أُلغي الطلب')
      onDone()
    })
  return (
    <div className="space-y-2 rounded-lg border border-destructive/30 p-3">
      <Select value={reason} onChange={(e) => setReason(e.target.value)}>
        {REASONS.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>
      <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="ملاحظة (اختياري)" dir="auto" />
      <div className="flex gap-2">
        <Button size="sm" variant="destructive" onClick={go} loading={pending}>
          تأكيد الإلغاء
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          تراجع
        </Button>
      </div>
    </div>
  )
}

/** بطاقة طلب بخطّه الزمني لحظة بلحظة (نسق NOVA) */
export function TrackedOrderCard({ o, onChanged }: { o: TrackedOrderView; onChanged?: () => void }) {
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base">
          <span dir="ltr" className="font-mono">
            {o.number}
          </span>
          <span className="block text-xs font-normal text-muted-foreground">
            {o.itemsText} · {o.totalDzd} دج · {formatDateTime(new Date(o.createdAt))}
          </span>
        </CardTitle>
        <Badge variant={VARIANT[o.status] ?? 'secondary'}>{o.statusAr}</Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {o.wilayaName || o.commune ? <p className="text-muted-foreground">{[o.wilayaName, o.commune].filter(Boolean).join(' — ')}</p> : null}
        {o.trackingId ? (
          <p className="text-xs text-muted-foreground">
            رقم التتبّع{o.deliveryProvider === 'ecotrack' ? ' (EcoTrack)' : ''}: <span dir="ltr" className="font-mono font-bold text-foreground">{o.trackingId}</span>
          </p>
        ) : null}
        <ol className="space-y-2">
          {o.timeline.map((s, i) => (
            <li key={i} className="flex items-start gap-2">
              {s.tone === 'done' ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : s.tone === 'bad' ? <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
              <span className={cn('flex-1', s.tone === 'bad' && 'text-destructive')}>{s.label}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">{formatDateTime(new Date(s.at))}</span>
            </li>
          ))}
        </ol>
        {o.canCancel ? <CancelBox orderId={o.id} onDone={() => onChanged?.()} /> : null}
      </CardContent>
    </Card>
  )
}

/** قائمة طلبات التلميذ (بحسابه) — مع الإلغاء قبل الشحن */
export function MyOrdersTracking({ orders }: { orders: TrackedOrderView[] }) {
  const router = useRouter()
  if (orders.length === 0) return <p className="text-sm text-muted-foreground">لا طلبات بعد.</p>
  return (
    <div className="space-y-4">
      {orders.map((o) => (
        <TrackedOrderCard key={o.id} o={o} onChanged={() => router.refresh()} />
      ))}
    </div>
  )
}

/** التتبّع العام بالهاتف (بلا حساب) */
export function PhoneTracker({ initialPhone }: { initialPhone?: string }) {
  const [phone, setPhone] = useState(initialPhone ?? '')
  const [res, setRes] = useState<TrackedOrderView[] | null>(null)
  const [pending, start] = useTransition()
  const search = () =>
    start(async () => {
      const r = await trackOrdersAction(phone)
      if (!r.ok) return toast('error', r.error.message)
      setRes(r.data)
    })
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" inputMode="tel" placeholder="05XXXXXXXX" className="h-12 text-center font-mono text-lg" onKeyDown={(e) => e.key === 'Enter' && search()} />
        <Button size="lg" onClick={search} loading={pending} disabled={phone.replace(/\D/g, '').length < 9}>
          <Search className="size-4" /> تتبّع
        </Button>
      </div>
      {res === null ? null : res.length === 0 ? (
        <p className="text-sm text-muted-foreground">لا طلبات بهذا الرقم خلال الأشهر الستة الأخيرة.</p>
      ) : (
        res.map((o) => <TrackedOrderCard key={o.id} o={o} />)
      )}
    </div>
  )
}
