import { Badge } from '@/components/ui/badge'
import Link from '@/components/ui/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/misc'
import { CONTENT_KINDS, CONTENT_KIND_LABELS, REPLY_KIND_LABELS, REPLY_KINDS, formatDa, rateLabel, type AssistantPayConfig, type Statement } from '@/lib/assistant-pay'

/** كشف شهر الأستاذ المساعد: يراه هو والمشرف بالأرقام نفسها */
export function AssistantStatement({
  statement: s,
  config: c,
  payout,
  term
}: {
  statement: Statement
  config: AssistantPayConfig
  payout: { amount: number; paidAt: Date } | null
  term: { label: string; used: number; limit: number }
}) {
  const extraReplies = REPLY_KINDS.reduce((n, k) => n + s.extraReplies[k].count, 0)
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">كشف الشّهر</CardTitle>
        {payout ? (
          <Badge variant="success">
            مدفوع {payout.paidAt.toLocaleDateString('fr-DZ')} · {formatDa(payout.amount)}
          </Badge>
        ) : (
          <Badge variant="muted">غير مدفوع بعد</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-muted p-2">
            <div className="text-xs text-muted-foreground">الرّاتب</div>
            <div className="font-bold">{formatDa(s.base)}</div>
          </div>
          <div className="rounded-lg bg-muted p-2">
            <div className="text-xs text-muted-foreground">الإضافيّ</div>
            <div className="font-bold">{formatDa(s.extra)}</div>
          </div>
          <div className="rounded-lg bg-primary/10 p-2">
            <div className="text-xs text-muted-foreground">المجموع</div>
            <div className="font-bold text-primary">{formatDa(s.total)}</div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>الرّدود المشمولة بالرّاتب</span>
            <span className="font-bold tabular-nums">
              {s.repliesIncluded} من {c.includedReplies}
            </span>
          </div>
          <Progress value={c.includedReplies ? Math.round((100 * s.repliesIncluded) / c.includedReplies) : 100} />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>الإضافيّ من السّقف</span>
            <span className="font-bold tabular-nums">
              {formatDa(s.extra)} من {formatDa(c.extraCap)}
            </span>
          </div>
          <Progress value={c.extraCap ? Math.round((100 * s.extra) / c.extraCap) : 0} tone={s.capped ? 'warning' : 'success'} />
          {s.capped ? <p className="text-xs text-warning">بلغ السّقف: المستحقّ قبل السّقف {formatDa(s.extraBeforeCap)}.</p> : null}
          {s.contentOverLimit > 0 ? <p className="text-xs text-warning">{s.contentOverLimit} اختبار أو مقترح فوق حدّ الفصل، لا يُحسب.</p> : null}
        </div>

        <ul className="divide-y rounded-lg border text-sm">
          {REPLY_KINDS.map((k) => (
            <li key={k} className="flex justify-between gap-2 p-2">
              <span>
                {REPLY_KIND_LABELS[k]} زائد × {s.extraReplies[k].count} <span className="text-xs text-muted-foreground">({formatDa(c.replyRates[k])})</span>
              </span>
              <span className="tabular-nums">{formatDa(s.extraReplies[k].amount)}</span>
            </li>
          ))}
          <li className="flex justify-between gap-2 p-2">
            <span>
              المحتوى المرفوع · {s.contentPages} صفحة
            </span>
            <span className="tabular-nums">{formatDa(s.contentAmount)}</span>
          </li>
          <li className="flex justify-between gap-2 p-2">
            <span>الاختبارات والمقترحات في {term.label}</span>
            <span className="shrink-0 tabular-nums">{term.limit > 0 ? `${Math.min(term.used, term.limit)} من ${term.limit}` : term.used}</span>
          </li>
        </ul>
        <p className="text-xs leading-relaxed text-muted-foreground">
          كلّ الرّدود هذا الشّهر: {s.repliesTotal}، منها {extraReplies} فوق الرّاتب. الرّدّ المفصّل: {c.detailedMinChars} حرفًا فأكثر. المحتوى:{' '}
          {CONTENT_KINDS.map((k) => `${CONTENT_KIND_LABELS[k]} ${rateLabel(k, c)}`).join('، ')}. الاختبار والمقترح: صفحات الموضوع وحدها، والتّصحيح مجّانيّ.
        </p>
      </CardContent>
    </Card>
  )
}

/** روابط آخر ستّة أشهر */
export function MonthLinks({ current, months, href }: { current: string; months: string[]; href: (m: string) => string }) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="الشّهر">
      {months.map((m) => (
        <Link
          key={m}
          href={href(m)}
          className={`rounded-full border px-3 py-1 text-sm ${m === current ? 'border-primary bg-primary text-primary-foreground' : 'bg-card'}`}
          aria-current={m === current ? 'page' : undefined}
        >
          {m}
        </Link>
      ))}
    </nav>
  )
}
