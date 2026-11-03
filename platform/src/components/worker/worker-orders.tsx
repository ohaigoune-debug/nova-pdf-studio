'use client'

import { CheckCircle2, Clock, KeyRound, PackageCheck, Phone, PhoneMissed, Send, Undo2, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { formatTime } from '@/lib/utils'
import { sendToEcotrackAction } from '@/server/actions/ecotrack.actions'
import { releaseOrdersAction, sendActivationCodeAction, setOrderStatusAction } from '@/server/actions/store.actions'

export interface WorkerOrder {
  id: string
  number: string
  status: string
  statusLabel: string
  customerName: string
  phone: string
  place: string
  wilayaId: string | null
  commune: string | null
  address: string | null
  itemsText: string
  note: string | null
  streamId: string | null
  streamName: string | null
  totalDzd: number
  subtotalDzd: number
  shippingDzd: number
  paymentLabel: string
  needsShipping: boolean
  hasCourse: boolean
  shipped: boolean
  confirmAttempts: number
  lastCallAt: string | null
  history: { delivered: number; returned: number; cancelled: number }
  reservedByMe: boolean
}

type Result = 'CONFIRMED' | 'NO_ANSWER' | 'CALL_LATER' | 'CANCELLED'
const IN_QUEUE = ['PENDING', 'NO_ANSWER', 'CALL_LATER']
/** أسباب جاهزة للإلغاء — تصل إلى الزبون كما هي */
const CANCEL_REASONS = ['ألغى الزبون الطلب', 'طلب مكرّر', 'الزبون لم يطلب هذا', 'تعذّر الوصول إلى الزبون']
const STATUS_TONE: Record<string, 'warning' | 'secondary' | 'success' | 'muted' | 'destructive'> = { PENDING: 'warning', NO_ANSWER: 'secondary', CALL_LATER: 'secondary', CONFIRMED: 'success', SHIPPED: 'success', DELIVERED: 'success', CANCELLED: 'muted', RETURNED: 'destructive' }

/** «0661 11 22 33» — يُقرأ ويُملى بسهولة */
const spaced = (p: string) => (p.length === 10 ? `${p.slice(0, 4)} ${p.slice(4, 6)} ${p.slice(6, 8)} ${p.slice(8)}` : p)

/** نتيجة المكالمة: تأكيد / لا يردّ / لاحقًا / إلغاء بسبب — كلها عبر محرّك الحالات في الخادم */
function useResult(onDone?: () => void) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const send = (o: { id: string }, next: Result | 'DELIVERED', reason?: string) =>
    start(async () => {
      const r = await setOrderStatusAction(o.id, next, { reason: reason ?? null })
      if (!r.ok) return toast('error', r.error.message)
      const msg: Record<string, string> = { CONFIRMED: 'أُكِّد الطلب', NO_ANSWER: 'سُجِّل: لا يردّ', CALL_LATER: 'سُجِّل: اتصل لاحقًا', CANCELLED: 'أُلغي الطلب', DELIVERED: 'سُجِّل التسليم' }
      toast('success', msg[next] ?? 'تمّ')
      onDone?.()
      router.refresh()
    })
  return { pending, send }
}

/** أزرار النتيجة الأربعة، والإلغاء يفتح أسبابًا جاهزة */
function ResultButtons({ order, big = false, onDone }: { order: WorkerOrder; big?: boolean; onDone?: () => void }) {
  const { pending, send } = useResult(onDone)
  const [cancelling, setCancelling] = useState(false)
  const [other, setOther] = useState('')
  const h = big ? 'h-14 text-base' : 'h-12'
  if (cancelling)
    return (
      <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
        <p className="text-sm font-semibold">سبب الإلغاء (يصل إلى الزبون):</p>
        <div className="grid grid-cols-2 gap-2">
          {CANCEL_REASONS.map((r) => (
            <Button key={r} variant="outline" className="h-auto min-h-11 whitespace-normal py-2 text-sm" loading={pending} onClick={() => send(order, 'CANCELLED', r)}>
              {r}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={other} onChange={(e) => setOther(e.target.value)} placeholder="سبب آخر…" maxLength={200} />
          <Button variant="destructive" loading={pending} disabled={other.trim().length < 3} onClick={() => send(order, 'CANCELLED', other.trim())}>
            إلغاء
          </Button>
        </div>
        <Button variant="ghost" className="w-full" onClick={() => setCancelling(false)}>
          تراجع
        </Button>
      </div>
    )
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button variant="success" className={h} loading={pending} onClick={() => send(order, 'CONFIRMED')}>
        <CheckCircle2 className="size-5" /> مؤكَّد
      </Button>
      <Button variant="outline" className={h} loading={pending} onClick={() => send(order, 'NO_ANSWER')}>
        <PhoneMissed className="size-5" /> لا يردّ
      </Button>
      <Button variant="outline" className={h} loading={pending} onClick={() => send(order, 'CALL_LATER')}>
        <Clock className="size-5" /> اتصل لاحقًا
      </Button>
      <Button variant="outline" className={`${h} text-destructive`} loading={pending} onClick={() => setCancelling(true)}>
        <XCircle className="size-5" /> إلغاء
      </Button>
    </div>
  )
}

/** أزرار ما بعد التأكيد (تبويب «بحث وتفعيل»): التسليم والتفعيل، كود التفعيل، الإرسال إلى الناقل */
function AfterConfirmActions({ order, ecotrack }: { order: WorkerOrder; ecotrack: boolean }) {
  const router = useRouter()
  const { pending, send } = useResult()
  const [busy, start] = useTransition()
  const [sure, setSure] = useState(false)
  const [codeOpen, setCodeOpen] = useState(false)
  const [codePhone, setCodePhone] = useState('')
  const [codes, setCodes] = useState<{ phone: string; list: { courseTitle: string; code: string }[]; sms: boolean } | null>(null)
  const deliverable = order.status === 'CONFIRMED' || order.status === 'SHIPPED'
  const sendEco = () =>
    start(async () => {
      const r = await sendToEcotrackAction(order.id)
      if (!r.ok) return toast('error', r.error.message)
      toast('success', `أُرسل إلى EcoTrack — ${r.data.tracking}`)
      router.refresh()
    })
  const makeCode = () =>
    start(async () => {
      const r = await sendActivationCodeAction(order.id, codePhone.trim() || null)
      if (!r.ok) return toast('error', r.error.message)
      setCodes({ phone: r.data.phone, list: r.data.codes, sms: r.data.smsSent })
    })
  return (
    <div className="space-y-2">
      {deliverable ? (
        sure ? (
          <div className="space-y-2 rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
            <p>{order.hasCourse ? 'استلم الزبون الطرد ودفع؟ تُفعَّل الدورة في حسابه فورًا.' : 'استلم الزبون الطرد ودفع؟'}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="success" className="h-12" loading={pending} onClick={() => send(order, 'DELIVERED')}>
                نعم، سُلِّم
              </Button>
              <Button variant="ghost" className="h-12" onClick={() => setSure(false)}>
                تراجع
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="success" className="h-12 w-full" onClick={() => setSure(true)}>
            <PackageCheck className="size-5" /> {order.hasCourse ? 'سُلِّم وتفعيل الدورة' : 'سُلِّم'}
          </Button>
        )
      ) : null}
      {order.status === 'CONFIRMED' && order.needsShipping && ecotrack && !order.shipped ? (
        <Button variant="outline" className="h-12 w-full" loading={busy} onClick={sendEco}>
          <Send className="size-5" /> إرسال إلى EcoTrack
        </Button>
      ) : null}
      {order.status === 'DELIVERED' && order.hasCourse ? (
        codes ? (
          <div className="space-y-1 rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="font-semibold">{codes.sms ? `أُرسل بالـSMS إلى ${codes.phone}` : `تعذّر SMS — أملِ الكود على الزبون (${codes.phone})`}</p>
            {codes.list.map((c) => (
              <p key={c.code}>
                {c.courseTitle}: <span dir="ltr" className="font-mono text-lg font-bold tracking-wider">{c.code}</span>
              </p>
            ))}
            <p className="text-xs text-muted-foreground">يُدخله التلميذ مع هذا الرقم في madrasadz.com/claim</p>
          </div>
        ) : codeOpen ? (
          <div className="space-y-2 rounded-lg border p-3">
            <Input type="tel" inputMode="tel" dir="ltr" value={codePhone} onChange={(e) => setCodePhone(e.target.value)} placeholder={`هاتف الاستلام (فارغ = ${order.phone})`} />
            <Button className="h-12 w-full" loading={busy} onClick={makeCode}>
              <KeyRound className="size-5" /> ولّد الكود وأرسله
            </Button>
          </div>
        ) : (
          <Button variant="outline" className="h-12 w-full" onClick={() => setCodeOpen(true)}>
            <KeyRound className="size-5" /> كود التفعيل
          </Button>
        )
      ) : null}
    </div>
  )
}

/** بطاقة طلب: الزبون، «اتصل» كبير، ثم النتيجة */
export function WorkerOrderCard({ order, ecotrack = false }: { order: WorkerOrder; ecotrack?: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const inQueue = IN_QUEUE.includes(order.status)
  const release = () =>
    start(async () => {
      const r = await releaseOrdersAction({ orderIds: [order.id] })
      if (!r.ok) return toast('error', r.error.message)
      toast('success', 'أُعيد الطلب إلى الطابور')
      router.refresh()
    })
  return (
    <li className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-bold leading-snug">{order.customerName}</p>
          <p className="text-sm text-muted-foreground">{order.place}</p>
        </div>
        <div className="shrink-0 text-end">
          <Badge variant={STATUS_TONE[order.status] ?? 'secondary'}>{order.statusLabel}</Badge>
          <p dir="ltr" className="mt-1 font-mono text-[11px] text-muted-foreground">{order.number}</p>
        </div>
      </div>
      <div className="space-y-1 text-sm">
        <p className="font-medium">{order.itemsText || '—'}</p>
        {order.streamName ? <p className="text-muted-foreground">الشعبة: {order.streamName}</p> : null}
        <p className="text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{order.totalDzd} دج</span> · {order.paymentLabel}
          {order.confirmAttempts ? ` · محاولات ${order.confirmAttempts}` : ''}
          {order.lastCallAt ? ` · آخر اتصال ${formatTime(order.lastCallAt)}` : ''}
        </p>
        {order.note ? <p className="text-muted-foreground">ملاحظة: {order.note}</p> : null}
        {order.history.returned || order.history.delivered || order.history.cancelled >= 2 ? (
          <div className="flex flex-wrap gap-1">
            {order.history.returned ? <Badge variant="destructive">⚠️ رفض الاستلام سابقًا ×{order.history.returned}</Badge> : null}
            {order.history.delivered ? <Badge variant="success">استلم سابقًا ×{order.history.delivered}</Badge> : null}
            {order.history.cancelled >= 2 ? <Badge variant="warning">طلبات ملغاة ×{order.history.cancelled}</Badge> : null}
          </div>
        ) : null}
      </div>
      <Button asChild className="h-14 w-full text-lg">
        <a href={`tel:${order.phone}`}>
          <Phone className="size-5" /> اتصل <span dir="ltr" className="font-mono tracking-wide">{spaced(order.phone)}</span>
        </a>
      </Button>
      {inQueue ? <ResultButtons order={order} /> : <AfterConfirmActions order={order} ecotrack={ecotrack} />}
      {inQueue && order.reservedByMe ? (
        <button type="button" disabled={pending} onClick={release} className="flex min-h-11 w-full items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <Undo2 className="size-4" /> لن أتصل به الآن — أعده للطابور
        </button>
      ) : null}
    </li>
  )
}
