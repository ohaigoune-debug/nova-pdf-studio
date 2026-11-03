'use client'

/**
 * «حجوزاتي» كلعبة (قرار المالك 4 نوفمبر 2026): زبون واحد في الشاشة.
 *   قبل المكالمة: «اتصل» كبير، ثم أدوات: تعديل · تفعيل · حظر · حذف.
 *   بعد «اتصل»: ثلاث خانات كبيرة — تأكيد · لا يجيب · إلغاء.
 *   بعد النتيجة تطير البطاقة ويصعد الزبون الموالي، حتى تنتهي الحجوزات ⇒ شاشة النتيجة وجولة جديدة.
 * عند الفتح بلا حجوزات تُحجز 10 تلقائيًا، فلا يرى الموظف شاشة فارغة.
 * كل قرار يمرّ من الخادم (الصلاحيات، الحجز، محرّك الحالات)؛ الواجهة تتقدّم فورًا وتُرجع البطاقة إن رُفض.
 */

import { Ban, BadgeCheck, CheckCircle2, MapPin, PencilLine, Phone, PhoneMissed, RefreshCw, RotateCcw, StickyNote, Trash2, Trophy, Undo2, X, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { cn, formatTime } from '@/lib/utils'
import type { ActionResult } from '@/server/lib/action-result'
import { activateOrderNowAction, adjustOrderAmountAction, banOrderCustomerAction, changeOrderStreamAction, claimOrdersAction, editOrderCustomerAction, releaseOrdersAction, setOrderStatusAction } from '@/server/actions/store.actions'
import type { WorkerOrder } from './worker-orders'

type Outcome = 'CONFIRMED' | 'NO_ANSWER' | 'CANCELLED' | 'DELETED' | 'BANNED' | 'ACTIVATED' | 'RELEASED'
type Sheet = 'edit' | 'activate' | 'ban' | 'delete' | 'cancel'
interface Claim {
  held: number
  max: number
  free: number
  until: string | null
}
interface Round {
  handled: Record<string, Outcome>
  called: string | null
  at: number
}

const IN_QUEUE = ['PENDING', 'NO_ANSWER', 'CALL_LATER']
const CLAIM_SIZE = 10
/** أخطاء تعني أن الطلب لم يعد لهذا الموظف: لا تُرجَع بطاقته */
const GONE = ['ORDER_RESERVED', 'ORDER_LOCKED', 'ORDER_NOT_FOUND', 'NOT_FOUND']
const CANCEL_REASONS = ['ألغى الزبون الطلب', 'الزبون لم يطلب هذا', 'غيّر رأيه / لا يريد الدفع', 'تعذّر الوصول إلى الزبون']
const DELETE_REASONS = ['طلب وهمي', 'طلب مكرّر', 'طلب تجريبي', 'رقم خاطئ']
const BAN_REASONS = ['رقم وهمي', 'طلبات وهمية متكرّرة', 'رفض الاستلام سابقًا', 'سلوك مسيء']
const OUT: Record<Outcome, { cls: string; label: string; tone: string }> = {
  CONFIRMED: { cls: 'cq-out-confirm', label: 'مؤكَّد ✓', tone: 'border-success text-success' },
  ACTIVATED: { cls: 'cq-out-confirm', label: 'مُفعَّل ✓', tone: 'border-success text-success' },
  NO_ANSWER: { cls: 'cq-out-later', label: 'لا يجيب', tone: 'border-warning text-warning' },
  RELEASED: { cls: 'cq-out-later', label: 'للطابور', tone: 'border-muted-foreground text-muted-foreground' },
  CANCELLED: { cls: 'cq-out-drop', label: 'ملغى', tone: 'border-destructive text-destructive' },
  DELETED: { cls: 'cq-out-drop', label: 'محذوف', tone: 'border-destructive text-destructive' },
  BANNED: { cls: 'cq-out-drop', label: 'محظور', tone: 'border-destructive text-destructive' }
}

/** «0661 11 22 33» — يُقرأ ويُملى بسهولة */
const spaced = (p: string) => (p.length === 10 ? `${p.slice(0, 4)} ${p.slice(4, 6)} ${p.slice(6, 8)} ${p.slice(8)}` : p)
const cleanPhone = (p: string) => p.replace(/[\s\-().]/g, '').replace(/^\+?213/, '0')

/* ───── الجولة محفوظة في الهاتف: الرجوع من المكالمة أو إعادة فتح التطبيق لا يضيّعها ───── */

const ROUND_TTL = 3 * 60 * 60_000
const emptyRound = (): Round => ({ handled: {}, called: null, at: Date.now() })
function loadRound(key: string): Round {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? 'null') as Round | null
    return v && Date.now() - v.at < ROUND_TTL && v.handled ? v : emptyRound()
  } catch {
    return emptyRound()
  }
}
function saveRound(key: string, r: Round) {
  try {
    localStorage.setItem(key, JSON.stringify(r))
  } catch {
    /* التخزين غير متاح: تبقى الجولة في الذاكرة */
  }
}

export function WorkerDeck({ orders, claim, userId, streams, wilayas }: { orders: WorkerOrder[]; claim: Claim | null; userId: string; streams: { id: string; name: string }[]; wilayas: { id: string; name: string }[] }) {
  const router = useRouter()
  const key = `worker:round:${userId}`
  const [round, setRound] = useState<Round>(emptyRound)
  const [ready, setReady] = useState(false)
  const [leaving, setLeaving] = useState<{ order: WorkerOrder; outcome: Outcome; n: number } | null>(null)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [, start] = useTransition()
  const autoClaimed = useRef(false)

  useEffect(() => {
    setRound(loadRound(key))
    setReady(true)
  }, [key])
  const update = useCallback(
    (fn: (r: Round) => Round) =>
      setRound((r) => {
        const next = { ...fn(r), at: Date.now() }
        saveRound(key, next)
        return next
      }),
    [key]
  )

  const deck = useMemo(() => orders.filter((o) => IN_QUEUE.includes(o.status) && !round.handled[o.id]), [orders, round.handled])
  const current = deck[0] ?? null
  const handledN = Object.keys(round.handled).length
  const total = handledN + deck.length
  const called = Boolean(current && round.called === current.id)

  const claimBatch = useCallback(
    (fresh: boolean) => {
      setClaiming(true)
      start(async () => {
        const r = await claimOrdersAction(CLAIM_SIZE)
        if (!r.ok || !r.data.claimed) {
          setClaiming(false)
          return r.ok ? toast('info', 'لا طلبات جديدة تنتظر التأكيد الآن') : toast('error', r.error.message)
        }
        if (fresh) update(() => emptyRound())
        // «نجهّز لك الزبائن…» يبقى حتى تصل الطلبات المحجوزة (لا وميض لشاشة فارغة)
        router.refresh()
      })
    },
    [router, update]
  )

  // وصلت قائمة جديدة من الخادم ⇒ انتهى الحجز الجاري؛ ومهلة أمان إن تأخّرت
  useEffect(() => setClaiming(false), [orders])
  useEffect(() => {
    if (!claiming) return
    const t = window.setTimeout(() => setClaiming(false), 10_000)
    return () => window.clearTimeout(t)
  }, [claiming])

  // الفتح بلا حجوزات: تُحجز 10 فورًا (هذا ما كان يجعل الشاشة تبدو فارغة «لا تجلب البيانات»)
  useEffect(() => {
    if (!ready || autoClaimed.current || !claim || claim.held > 0 || claim.free === 0) return
    autoClaimed.current = true
    claimBatch(true)
  }, [ready, claim, claimBatch])

  // تحديث هادئ كل دقيقة ما دام الموظف لا يعمل على بطاقة
  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !sheet && !round.called && !leaving) router.refresh()
    }, 60_000)
    return () => window.clearInterval(t)
  }, [router, sheet, round.called, leaving])

  /** القرار: البطاقة تطير فورًا، والخادم يحكم؛ إن رفض تعود البطاقة إلى الواجهة */
  const decide = (o: WorkerOrder, outcome: Outcome, run: () => Promise<ActionResult<unknown>>, after?: (r: ActionResult<unknown>) => void) => {
    setSheet(null)
    setLeaving({ order: o, outcome, n: Date.now() })
    update((r) => ({ ...r, handled: { ...r.handled, [o.id]: outcome }, called: r.called === o.id ? null : r.called }))
    window.setTimeout(() => setLeaving((l) => (l && l.order.id === o.id ? null : l)), 360)
    start(async () => {
      const r = await run()
      if (!r.ok) {
        // لم يعد الطلب لهذا الموظف (حجزه زميل، شُحن…) ⇒ يبقى خارج البطاقات دون أن يُحسب نتيجة؛ وإلا تعود بطاقته
        update((s) => {
          const handled = { ...s.handled }
          if (GONE.includes(r.error.code)) handled[o.id] = 'RELEASED'
          else delete handled[o.id]
          return { ...s, handled }
        })
        toast('error', r.error.message)
        return
      }
      after?.(r)
      router.refresh()
    })
  }

  /** «اتصل» رابط tel: حقيقي (التطبيق يطلب الرقم مباشرة، والمتصفح يفتح لوحة الأرقام)؛ نتذكّر أنّ المكالمة بدأت */
  const markCalled = (o: WorkerOrder) => update((r) => ({ ...r, called: o.id }))

  const stats = useMemo(() => {
    const v = Object.values(round.handled)
    const n = (...k: Outcome[]) => v.filter((x) => k.includes(x)).length
    return { confirmed: n('CONFIRMED'), activated: n('ACTIVATED'), noAnswer: n('NO_ANSWER'), dropped: n('CANCELLED', 'DELETED', 'BANNED'), released: n('RELEASED') }
  }, [round.handled])
  const retry = orders.filter((o) => IN_QUEUE.includes(o.status) && round.handled[o.id] === 'NO_ANSWER')

  if (!ready || (claiming && !current)) return <Loading />

  return (
    <div className="space-y-3">
      <Progress done={handledN} total={total} finished={!current} until={claim?.until ?? null} />
      {current ? (
        <div className="relative">
          {deck.length > 2 ? <div aria-hidden className="absolute inset-x-6 -bottom-3 h-12 rounded-2xl border bg-card/60" /> : null}
          {deck.length > 1 ? <div aria-hidden className="absolute inset-x-3 -bottom-1.5 h-12 rounded-2xl border bg-card/80" /> : null}
          <CustomerCard key={current.id} order={current} called={called}>
            {called ? (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <ResultBox tone="success" icon={<CheckCircle2 className="size-7" />} label="تأكيد" onClick={() => decide(current, 'CONFIRMED', () => setOrderStatusAction(current.id, 'CONFIRMED'))} />
                  <ResultBox tone="warning" icon={<PhoneMissed className="size-7" />} label="لا يجيب" onClick={() => decide(current, 'NO_ANSWER', () => setOrderStatusAction(current.id, 'NO_ANSWER'))} />
                  <ResultBox tone="destructive" icon={<XCircle className="size-7" />} label="إلغاء" onClick={() => setSheet('cancel')} />
                </div>
                <a href={`tel:${current.phone}`} onClick={() => markCalled(current)} className="flex min-h-11 w-full items-center justify-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
                  <RotateCcw className="size-4" /> أعد الاتصال
                </a>
              </div>
            ) : (
              <Button asChild className="h-16 w-full text-xl shadow-md">
                <a href={`tel:${current.phone}`} onClick={() => markCalled(current)}>
                  <Phone className="size-6" /> اتصل
                </a>
              </Button>
            )}
            <div className="grid grid-cols-4 gap-2">
              <Tool icon={<PencilLine className="size-5" />} label="تعديل" onClick={() => setSheet('edit')} />
              <Tool icon={<BadgeCheck className="size-5" />} label="تفعيل" onClick={() => setSheet('activate')} disabled={!current.hasCourse} hint={current.hasCourse ? undefined : 'بلا دورة'} />
              <Tool icon={<Ban className="size-5" />} label="حظر" onClick={() => setSheet('ban')} danger />
              <Tool icon={<Trash2 className="size-5" />} label="حذف" onClick={() => setSheet('delete')} danger />
            </div>
          </CustomerCard>
          {leaving ? <LeavingCard key={leaving.n} order={leaving.order} outcome={leaving.outcome} /> : null}
        </div>
      ) : (
        <div className="relative">
          <EndScreen
            stats={stats}
            retry={retry.length}
            claim={claim}
            claiming={claiming}
            onRetry={() => update((r) => ({ ...r, handled: Object.fromEntries(Object.entries(r.handled).filter(([, v]) => v !== 'NO_ANSWER')) }))}
            onClaim={() => claimBatch(true)}
            onRefresh={() => start(() => router.refresh())}
          />
          {leaving ? <LeavingCard key={leaving.n} order={leaving.order} outcome={leaving.outcome} /> : null}
        </div>
      )}
      {current && deck[1] ? (
        <p className="pt-2 text-center text-xs text-muted-foreground">
          التالي: <span className="font-semibold text-foreground">{deck[1].customerName}</span>
        </p>
      ) : null}
      {current && current.reservedByMe ? (
        <button
          type="button"
          onClick={() => decide(current, 'RELEASED', () => releaseOrdersAction({ orderIds: [current.id] }))}
          className="flex min-h-11 w-full items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Undo2 className="size-3.5" /> لن أتصل به الآن — أعده للطابور
        </button>
      ) : null}

      {current && sheet === 'cancel' ? (
        <ReasonSheet title={`إلغاء طلب ${current.customerName}`} note="السبب يصل إلى الزبون كما هو." reasons={CANCEL_REASONS} confirmLabel="إلغاء الطلب" onClose={() => setSheet(null)} onPick={(reason) => decide(current, 'CANCELLED', () => setOrderStatusAction(current.id, 'CANCELLED', { reason }))} />
      ) : null}
      {current && sheet === 'delete' ? (
        <ReasonSheet
          title={`حذف طلب ${current.customerName}`}
          note="يخرج الطلب من الطابور ويُسجَّل ملغى بهذا السبب، ويبقى في السجلّ لمعرفة سمعة الرقم."
          reasons={DELETE_REASONS}
          confirmLabel="حذف الطلب"
          onClose={() => setSheet(null)}
          onPick={(reason) => decide(current, 'DELETED', () => setOrderStatusAction(current.id, 'CANCELLED', { reason: `حذف: ${reason}` }))}
        />
      ) : null}
      {current && sheet === 'ban' ? (
        <ReasonSheet
          title={`حظر ${current.customerName}`}
          note="يُوقَف حساب الزبون فلا يدخل ولا يطلب، وتُلغى كل طلباته التي لم تُشحن. رفع الحظر للمشرف وحده."
          reasons={BAN_REASONS}
          confirmLabel="حظر الزبون"
          onClose={() => setSheet(null)}
          onPick={(reason) =>
            decide(current, 'BANNED', () => banOrderCustomerAction(current.id, reason), (r) => {
              const n = r.ok ? (r.data as { cancelledOrders: number }).cancelledOrders : 0
              toast('success', n > 1 ? `حُظر الزبون وأُلغي ${n} طلبات مفتوحة` : 'حُظر الزبون')
            })
          }
        />
      ) : null}
      {current && sheet === 'activate' ? (
        <BottomSheet title={`تفعيل دورة ${current.customerName}`} onClose={() => setSheet(null)}>
          <p className="text-sm leading-relaxed text-muted-foreground">يُسجَّل الطلب مؤكَّدًا ومُسلَّمًا، وتُفتح الدورة في حساب التلميذ فورًا. استعمله فقط إن استلم الزبون كتابه أو دفع.</p>
          <p className="rounded-lg bg-muted/60 p-3 text-sm font-medium">{current.itemsText}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="success" className="h-14 text-base" onClick={() => decide(current, 'ACTIVATED', () => activateOrderNowAction(current.id), () => toast('success', 'فُعِّلت الدورة'))}>
              <BadgeCheck className="size-5" /> نعم، فعّل
            </Button>
            <Button variant="ghost" className="h-14" onClick={() => setSheet(null)}>
              تراجع
            </Button>
          </div>
        </BottomSheet>
      ) : null}
      {current && sheet === 'edit' ? <EditSheet order={current} streams={streams} wilayas={wilayas} onClose={() => setSheet(null)} /> : null}
    </div>
  )
}

/* ───────────── القطع ───────────── */

function Loading() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 text-muted-foreground" role="status">
      <RefreshCw className="size-8 animate-spin text-primary" />
      <p className="text-sm font-semibold">نجهّز لك الزبائن…</p>
    </div>
  )
}

function Progress({ done, total, finished, until }: { done: number; total: number; finished: boolean; until: string | null }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <p className="font-bold">
          {finished ? 'أنجزت' : 'الزبون'}{' '}
          <span key={done} className="cq-bump inline-block text-lg tabular-nums text-primary">
            {finished ? done : Math.min(done + 1, Math.max(total, 1))}
          </span>{' '}
          من <span className="tabular-nums">{total}</span>
        </p>
        {until ? <p className="text-xs text-muted-foreground">الحجز حتى {formatTime(until)}</p> : null}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total}>
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function statusChip(o: WorkerOrder) {
  if (o.status === 'NO_ANSWER') return <Badge variant="warning">لم يُجب{o.confirmAttempts ? ` ×${o.confirmAttempts}` : ''}</Badge>
  if (o.status === 'CALL_LATER') return <Badge variant="secondary">اتصل لاحقًا</Badge>
  return <Badge variant="secondary">جديد</Badge>
}

/** بطاقة الزبون: كل ما يحتاجه الموظف قبل المكالمة وأثناءها، والأزرار تحتها */
function CustomerCard({ order: o, called, children }: { order: WorkerOrder; called: boolean; children: ReactNode }) {
  const risky = o.history.returned > 0 || o.history.cancelled >= 2
  return (
    <article className={cn('cq-in relative z-10 space-y-4 rounded-2xl border bg-card p-4 shadow-lg', risky && 'border-destructive/50', called && 'ring-2 ring-primary/40')}>
      <CardBody o={o} />
      {children}
    </article>
  )
}

function CardBody({ o }: { o: WorkerOrder }) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        {statusChip(o)}
        <span dir="ltr" className="font-mono text-[11px] text-muted-foreground">
          {o.number}
        </span>
      </div>
      <div className="space-y-1">
        <h2 className="text-2xl font-bold leading-tight">{o.customerName}</h2>
        <p dir="ltr" className="text-end font-mono text-xl font-semibold tracking-wider text-primary">
          {spaced(o.phone)}
        </p>
        <p className="flex items-start gap-1 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 size-4 shrink-0" />
          <span>
            {o.place}
            {o.address ? ` — ${o.address}` : ''}
          </span>
        </p>
      </div>
      <div className="space-y-1.5 rounded-xl bg-muted/50 p-3 text-sm">
        <p className="font-semibold">{o.itemsText || '—'}</p>
        {o.streamName ? <p className="text-muted-foreground">الشعبة: {o.streamName}</p> : null}
        <p className="flex items-baseline justify-between gap-2">
          <span className="text-muted-foreground">{o.paymentLabel}</span>
          <span className="text-xl font-bold tabular-nums">{o.totalDzd} دج</span>
        </p>
      </div>
      {o.note ? (
        <p className="flex items-start gap-1.5 rounded-lg border border-warning/40 bg-warning/10 p-2 text-sm">
          <StickyNote className="mt-0.5 size-4 shrink-0 text-warning" /> {o.note}
        </p>
      ) : null}
      {o.history.returned || o.history.delivered || o.history.cancelled >= 2 || o.lastCallAt ? (
        <div className="flex flex-wrap gap-1">
          {o.history.returned ? <Badge variant="destructive">⚠️ رفض الاستلام سابقًا ×{o.history.returned}</Badge> : null}
          {o.history.delivered ? <Badge variant="success">استلم سابقًا ×{o.history.delivered}</Badge> : null}
          {o.history.cancelled >= 2 ? <Badge variant="warning">طلبات ملغاة ×{o.history.cancelled}</Badge> : null}
          {o.lastCallAt ? <Badge variant="muted">آخر اتصال {formatTime(o.lastCallAt)}</Badge> : null}
        </div>
      ) : null}
    </>
  )
}

/** البطاقة المغادرة: نسخة فوق الجديدة تطير مع ختم النتيجة */
function LeavingCard({ order, outcome }: { order: WorkerOrder; outcome: Outcome }) {
  const o = OUT[outcome]
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-x-0 top-0 z-20 max-h-full space-y-4 overflow-hidden rounded-2xl border bg-card p-4 shadow-xl', o.cls)}>
      <CardBody o={order} />
      <span className={cn('cq-stamp absolute left-1/2 top-1/2 rounded-xl border-4 bg-card/90 px-5 py-2 text-3xl font-black', o.tone)}>{o.label}</span>
    </div>
  )
}

const BOX_TONE = {
  success: 'bg-success text-success-foreground',
  warning: 'bg-warning text-warning-foreground',
  destructive: 'bg-destructive text-destructive-foreground'
} as const

function ResultBox({ tone, icon, label, onClick }: { tone: keyof typeof BOX_TONE; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn('flex h-24 flex-col items-center justify-center gap-1.5 rounded-xl text-base font-bold shadow-sm transition-transform active:scale-95', BOX_TONE[tone])}>
      {icon}
      {label}
    </button>
  )
}

function Tool({ icon, label, onClick, disabled = false, danger = false, hint }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean; hint?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn('flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border bg-card text-xs font-semibold transition-transform active:scale-95 disabled:opacity-40', danger ? 'text-destructive' : 'text-foreground')}
    >
      {icon}
      <span>{label}</span>
      {hint ? <span className="text-[10px] font-normal text-muted-foreground">{hint}</span> : null}
    </button>
  )
}

function EndScreen({ stats, retry, claim, claiming, onRetry, onClaim, onRefresh }: { stats: { confirmed: number; activated: number; noAnswer: number; dropped: number; released: number }; retry: number; claim: Claim | null; claiming: boolean; onRetry: () => void; onClaim: () => void; onRefresh: () => void }) {
  const any = stats.confirmed + stats.activated + stats.noAnswer + stats.dropped + stats.released > 0
  const room = claim ? Math.max(0, claim.max - claim.held) : 0
  return (
    <section className="cq-in space-y-5 rounded-2xl border bg-card p-6 text-center shadow-lg">
      <Trophy className="mx-auto size-14 text-warning" />
      <div className="space-y-1">
        <h2 className="text-xl font-bold">{any ? 'أنهيت حجوزاتك!' : 'لا زبائن ينتظرون الآن'}</h2>
        <p className="text-sm text-muted-foreground">{any ? 'هذه نتيجة الجولة.' : 'ستظهر الطلبات الجديدة هنا تلقائيًا.'}</p>
      </div>
      {any ? (
        <div className="grid grid-cols-3 gap-2">
          <Stat n={stats.confirmed + stats.activated} label="مؤكَّد" cls="text-success" />
          <Stat n={stats.noAnswer} label="لا يجيب" cls="text-warning" />
          <Stat n={stats.dropped} label="ملغى" cls="text-destructive" />
        </div>
      ) : null}
      <div className="space-y-2">
        {retry ? (
          <Button variant="outline" className="h-14 w-full text-base" onClick={onRetry}>
            <RotateCcw className="size-5" /> جولة ثانية: من لم يُجب ({retry})
          </Button>
        ) : null}
        {claim ? (
          <Button className="h-14 w-full text-base" loading={claiming} disabled={!claim.free || !room} onClick={onClaim}>
            {claim.free ? (room ? `احجز دفعة جديدة (${Math.min(CLAIM_SIZE, room, claim.free)})` : 'وصلت إلى حدّ الحجوزات') : 'لا طلبات جديدة الآن'}
          </Button>
        ) : null}
        <Button variant="ghost" className="h-12 w-full" onClick={onRefresh}>
          <RefreshCw className="size-4" /> تحديث
        </Button>
      </div>
    </section>
  )
}

function Stat({ n, label, cls }: { n: number; label: string; cls: string }) {
  return (
    <div className="rounded-xl bg-muted/50 p-3">
      <p className={cn('text-3xl font-black tabular-nums', cls)}>{n}</p>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
    </div>
  )
}

function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/40" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mx-auto max-h-[88dvh] w-full max-w-xl animate-rise-in space-y-3 overflow-y-auto rounded-t-2xl bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl">
        <div className="flex items-center justify-between gap-2">
          <p className="text-base font-bold">{title}</p>
          <button type="button" onClick={onClose} className="flex size-11 items-center justify-center rounded-full hover:bg-muted" aria-label="إغلاق">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** أسباب جاهزة بلمسة، أو سبب آخر يُكتب */
function ReasonSheet({ title, note, reasons, confirmLabel, onPick, onClose }: { title: string; note: string; reasons: string[]; confirmLabel: string; onPick: (reason: string) => void; onClose: () => void }) {
  const [other, setOther] = useState('')
  return (
    <BottomSheet title={title} onClose={onClose}>
      <p className="text-sm text-muted-foreground">{note}</p>
      <div className="grid grid-cols-2 gap-2">
        {reasons.map((r) => (
          <Button key={r} variant="outline" className="h-auto min-h-14 whitespace-normal py-2 text-sm" onClick={() => onPick(r)}>
            {r}
          </Button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={other} onChange={(e) => setOther(e.target.value)} placeholder="سبب آخر…" maxLength={200} className="h-12" />
        <Button variant="destructive" className="h-12 shrink-0" disabled={other.trim().length < 3} onClick={() => onPick(other.trim())}>
          {confirmLabel}
        </Button>
      </div>
    </BottomSheet>
  )
}

/** «تعديل»: بيانات الزبون، الشعبة، والمبلغ (بسبب) — كل جزء بإجرائه في الخادم */
function EditSheet({ order: o, streams, wilayas, onClose }: { order: WorkerOrder; streams: { id: string; name: string }[]; wilayas: { id: string; name: string }[]; onClose: () => void }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [f, setF] = useState({ name: o.customerName, phone: o.phone, wilayaId: o.wilayaId ?? '', commune: o.commune ?? '', address: o.address ?? '', streamId: o.streamId ?? '', subtotal: String(o.subtotalDzd), shipping: String(o.shippingDzd), reason: '' })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  const amountChanged = Number(f.subtotal) !== o.subtotalDzd || Number(f.shipping) !== o.shippingDzd
  const save = () =>
    start(async () => {
      const phone = cleanPhone(f.phone)
      if (!/^0[5-7]\d{8}$/.test(phone)) return toast('error', 'رقم الهاتف غير صحيح: 10 أرقام تبدأ بـ 05 أو 06 أو 07.')
      if (f.name.trim().length < 2) return toast('error', 'اكتب اسم الزبون.')
      const customer: Record<string, string | null> = {}
      if (f.name.trim() !== o.customerName) customer.customerName = f.name.trim()
      if (phone !== o.phone) customer.phone = phone
      if (f.wilayaId !== (o.wilayaId ?? '')) customer.wilayaId = f.wilayaId || null
      if (f.commune.trim() !== (o.commune ?? '')) customer.commune = f.commune.trim() || null
      if (f.address.trim() !== (o.address ?? '')) customer.address = f.address.trim() || null
      const steps: (() => Promise<ActionResult<unknown>>)[] = []
      if (Object.keys(customer).length) steps.push(() => editOrderCustomerAction(o.id, customer))
      if (f.streamId && f.streamId !== (o.streamId ?? '')) steps.push(() => changeOrderStreamAction(o.id, f.streamId))
      if (amountChanged) {
        const s = Number(f.subtotal)
        const sh = Number(f.shipping)
        if (!Number.isInteger(s) || s < 0 || !Number.isInteger(sh) || sh < 0) return toast('error', 'أدخل مبلغًا صحيحًا بالدينار.')
        if (f.reason.trim().length < 3) return toast('error', 'اكتب سبب تغيير المبلغ.')
        steps.push(() => adjustOrderAmountAction(o.id, { subtotalDzd: s, shippingDzd: sh, reason: f.reason.trim() }))
      }
      if (!steps.length) return onClose()
      for (const step of steps) {
        const r = await step()
        if (!r.ok) return toast('error', r.error.message)
      }
      toast('success', 'حُفظت التعديلات')
      onClose()
      router.refresh()
    })
  return (
    <BottomSheet title={`تعديل طلب ${o.customerName}`} onClose={onClose}>
      <div className="space-y-3">
        <Labeled label="الاسم">
          <Input value={f.name} onChange={set('name')} maxLength={120} className="h-12" />
        </Labeled>
        <Labeled label="الهاتف">
          <Input value={f.phone} onChange={set('phone')} type="tel" inputMode="tel" dir="ltr" maxLength={20} className="h-12 font-mono text-lg" />
        </Labeled>
        <div className="grid grid-cols-2 gap-2">
          <Labeled label="الولاية">
            <Select value={f.wilayaId} onChange={set('wilayaId')} className="h-12">
              <option value="">—</option>
              {wilayas.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </Labeled>
          <Labeled label="البلدية">
            <Input value={f.commune} onChange={set('commune')} maxLength={120} className="h-12" />
          </Labeled>
        </div>
        <Labeled label="العنوان">
          <Input value={f.address} onChange={set('address')} maxLength={300} className="h-12" />
        </Labeled>
        {streams.length ? (
          <Labeled label="الشعبة">
            <Select value={f.streamId} onChange={set('streamId')} className="h-12">
              <option value="" disabled>
                اختر الشعبة
              </option>
              {streams.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Labeled>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Labeled label="ثمن الطلب (دج)">
            <Input value={f.subtotal} onChange={(e) => setF((x) => ({ ...x, subtotal: e.target.value.replace(/[^0-9]/g, '') }))} inputMode="numeric" dir="ltr" className="h-12" />
          </Labeled>
          <Labeled label="التوصيل (دج)">
            <Input value={f.shipping} onChange={(e) => setF((x) => ({ ...x, shipping: e.target.value.replace(/[^0-9]/g, '') }))} inputMode="numeric" dir="ltr" className="h-12" />
          </Labeled>
        </div>
        {amountChanged ? <Input value={f.reason} onChange={set('reason')} placeholder="سبب تغيير المبلغ (إلزامي)" maxLength={300} className="h-12" /> : null}
        <p className="text-xs text-muted-foreground">تغيير الولاية لا يغيّر رسوم التوصيل تلقائيًا — عدّلها هنا إن لزم.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button className="h-14 text-base" loading={pending} onClick={save}>
            حفظ
          </Button>
          <Button variant="ghost" className="h-14" onClick={onClose}>
            تراجع
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
