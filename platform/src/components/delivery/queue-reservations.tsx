'use client'

import { Hand, Undo2, Unlock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { formatTime } from '@/lib/utils'
import { claimOrdersAction, releaseOrdersAction, setReservationPolicyAction } from '@/server/actions/store.actions'

/**
 * شريط الموظف أعلى طابوره: حجوزاته من الحد الأقصى، والمتاح في الطابور العام، وأزرار «احجز 10 / 20»
 * و«أعد الكل». الطلبات التي يحجزها تختفي من طوابير زملائه.
 */
export function ReservationBar({ held, max, free, until, holdMinutes }: { held: number; max: number; free: number; until: string | null; holdMinutes: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const room = Math.max(0, max - held)
  const claim = (size: 10 | 20) =>
    start(async () => {
      const r = await claimOrdersAction(size)
      if (!r.ok) return toast('error', r.error.message)
      toast(r.data.claimed ? 'success' : 'info', r.data.claimed ? `حُجز لك ${r.data.claimed} طلبًا` : 'لا طلبات غير محجوزة الآن')
      router.refresh()
    })
  const releaseAll = () =>
    start(async () => {
      if (!window.confirm('إعادة كل حجوزاتك إلى الطابور العام ليأخذها زملاؤك؟')) return
      const r = await releaseOrdersAction({})
      if (!r.ok) return toast('error', r.error.message)
      toast('success', `أُعيد ${r.data.released} طلبًا إلى الطابور`)
      router.refresh()
    })
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm">
        <p className="font-semibold">
          حجوزاتي: <span className="tabular-nums">{held}</span> من <span className="tabular-nums">{max}</span>
          {until ? <span className="font-normal text-muted-foreground"> · أقربها ينتهي {formatTime(until)}</span> : null}
        </p>
        <p className="text-muted-foreground">
          في الطابور العام <span className="tabular-nums font-semibold text-foreground">{free}</span> طلبًا غير محجوز. الحجز يدوم {holdMinutes} دقيقة ثم يعود ما لم تُنهِه إلى الطابور.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => claim(10)} loading={pending} disabled={room === 0 || free === 0}>
          <Hand className="size-4" /> احجز 10
        </Button>
        <Button variant="outline" onClick={() => claim(20)} loading={pending} disabled={room === 0 || free === 0}>
          احجز 20
        </Button>
        {held > 0 ? (
          <Button variant="ghost" onClick={releaseAll} loading={pending}>
            <Undo2 className="size-4" /> أعد الكل
          </Button>
        ) : null}
      </div>
    </div>
  )
}

/** إعادة طلب واحد إلى الطابور (الموظف) أو فكّ حجزه (المشرف) */
export function ReleaseOrderButton({ orderId, admin = false }: { orderId: string; admin?: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const go = () =>
    start(async () => {
      const r = await releaseOrdersAction({ orderIds: [orderId] })
      if (!r.ok) return toast('error', r.error.message)
      toast('success', admin ? 'فُكّ الحجز وعاد الطلب إلى الطابور' : 'أُعيد الطلب إلى الطابور')
      router.refresh()
    })
  return (
    <Button size="sm" variant="ghost" loading={pending} onClick={go} title={admin ? 'فكّ الحجز: يعود الطلب إلى الطابور العام' : 'لن أتصل به: أعده إلى الطابور العام'}>
      {admin ? <Unlock className="size-4" /> : <Undo2 className="size-4" />} {admin ? 'فكّ الحجز' : 'أعده للطابور'}
    </Button>
  )
}

/** المشرف: تفعيل الحجز ومدته وحدّه، وحجوزات كل موظف الآن مع «فكّ الكل» */
export function ReservationAdmin({ policy, byConfirmer, free }: { policy: { enabled: boolean; holdMinutes: number; maxHeld: number }; byConfirmer: { userId: string; name: string; held: number; until: string | null }[]; free: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [f, setF] = useState({ enabled: policy.enabled, holdMinutes: String(policy.holdMinutes), maxHeld: String(policy.maxHeld) })
  const save = () =>
    start(async () => {
      const r = await setReservationPolicyAction({ enabled: f.enabled, holdMinutes: Number(f.holdMinutes), maxHeld: Number(f.maxHeld) })
      if (!r.ok) return toast('error', Object.values(r.error.fieldErrors ?? {})[0] ?? r.error.message)
      toast('success', 'حُفظت إعدادات الحجز')
      router.refresh()
    })
  const release = (forUserId: string | null, name: string) =>
    start(async () => {
      if (!window.confirm(forUserId ? `فكّ كل حجوزات ${name}؟ تعود طلباته إلى الطابور العام.` : 'فكّ كل الحجوزات لكل الموظفين؟')) return
      const r = await releaseOrdersAction(forUserId ? { forUserId } : {})
      if (!r.ok) return toast('error', r.error.message)
      toast('success', `عاد ${r.data.released} طلبًا إلى الطابور`)
      router.refresh()
    })
  const total = byConfirmer.reduce((a, b) => a + b.held, 0)
  return (
    <div className="space-y-5 text-sm">
      <div>
        <p className="mb-2 font-semibold">
          محجوز الآن: <span className="tabular-nums">{total}</span> · غير محجوز: <span className="tabular-nums">{free}</span>
        </p>
        {byConfirmer.length === 0 ? (
          <p className="text-muted-foreground">لا حجوزات سارية.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {byConfirmer.map((c) => (
              <li key={c.userId} className="flex items-center justify-between gap-2 px-3 py-2">
                <span>
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    · <span className="tabular-nums">{c.held}</span> طلبًا{c.until ? ` · أقربها ينتهي ${formatTime(c.until)}` : ''}
                  </span>
                </span>
                <Button size="sm" variant="ghost" loading={pending} onClick={() => release(c.userId, c.name)}>
                  <Unlock className="size-4" /> فكّ الكل
                </Button>
              </li>
            ))}
          </ul>
        )}
        {byConfirmer.length > 1 ? (
          <Button className="mt-2" size="sm" variant="outline" loading={pending} onClick={() => release(null, '')}>
            فكّ كل الحجوزات
          </Button>
        ) : null}
      </div>

      <div className="space-y-3 border-t pt-4">
        <label className="flex items-start gap-3 rounded-lg border p-3">
          <input type="checkbox" className="mt-1 size-4" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} />
          <span>
            <span className="font-semibold">الحجز مفعّل</span>
            <span className="block text-muted-foreground">كل موظف يحجز دفعة من الطلبات فتختفي من طوابير زملائه. إن عطّلته عاد الطابور مشتركًا بين الجميع.</span>
          </span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field label="مدة الحجز (دقائق)">
            <Input type="number" inputMode="numeric" min={10} max={1440} dir="ltr" value={f.holdMinutes} onChange={(e) => setF({ ...f, holdMinutes: e.target.value })} />
          </Field>
          <Field label="الحد الأقصى لكل موظف">
            <Input type="number" inputMode="numeric" min={1} max={200} dir="ltr" value={f.maxHeld} onChange={(e) => setF({ ...f, maxHeld: e.target.value })} />
          </Field>
        </div>
        <Button onClick={save} loading={pending}>
          حفظ
        </Button>
      </div>
    </div>
  )
}
