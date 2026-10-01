'use client'

import { CheckCircle2, Wallet, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { createPayoutAction, markPayoutPaidAction, reviewListingAction } from '@/server/actions/market.actions'

export function ReviewActions({ id }: { id: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const go = (approve: boolean) =>
    start(async () => {
      const note = approve ? null : prompt('سبب الرفض (يصل إلى الأستاذ):')
      if (!approve && note === null) return
      const r = await reviewListingAction(id, approve, note)
      if (!r.ok) return toast('error', r.error.message)
      toast('success', approve ? 'نُشر في المتجر' : 'رُفض')
      router.refresh()
    })
  return (
    <div className="flex justify-end gap-1">
      <Button size="sm" variant="outline" loading={pending} onClick={() => go(true)}>
        <CheckCircle2 className="size-4" /> قبول ونشر
      </Button>
      <Button size="sm" variant="ghost" loading={pending} onClick={() => go(false)} title="رفض">
        <XCircle className="size-4 text-destructive" />
      </Button>
    </div>
  )
}

export function PayoutForm({ workspaceId, balanceDzd }: { workspaceId: string; balanceDzd: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [amount, setAmount] = useState(String(Math.max(0, balanceDzd)))
  return (
    <div className="flex items-center gap-1">
      <Input type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} dir="ltr" className="w-28" aria-label="المبلغ" />
      <Button size="sm" variant="outline" loading={pending} disabled={!(Number(amount) > 0)} onClick={() => start(async () => { const r = await createPayoutAction({ workspaceId, amountDzd: Number(amount), paid: true, note: 'تحويل مبيعات السوق' }); if (!r.ok) return toast('error', r.error.message); toast('success', 'سُجّلت الدفعة'); router.refresh() })}>
        <Wallet className="size-4" /> سُدّد
      </Button>
    </div>
  )
}

export function MarkPaidButton({ id }: { id: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button size="sm" variant="ghost" loading={pending} onClick={() => start(async () => { const r = await markPayoutPaidAction(id); if (!r.ok) return toast('error', r.error.message); router.refresh() })}>
      تمّ التحويل
    </Button>
  )
}
