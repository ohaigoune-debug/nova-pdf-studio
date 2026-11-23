import { redirect } from 'next/navigation'
import { AssistantStatement, MonthLinks } from '@/components/domain/assistant-statement'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from '@/components/ui/link'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { CONTENT_KIND_LABELS, REPLY_KIND_LABELS, contentAmount, formatDa, monthOf, monthRange, recentMonths } from '@/lib/assistant-pay'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isClassroomAssistant } from '@/server/lib/actor'
import { signFileUrl } from '@/server/lib/storage'
import { toggleCorrectionAction } from '@/server/actions/assistant-pay.actions'
import { assistantMonth } from '@/server/services/assistant-pay.service'
import { ContentForm } from './content-form'

export const dynamic = 'force-dynamic'

/** «أرباحي» — كشف الأستاذ المساعد الشّهريّ، ورفع المحتوى، ووسم ردود التّصحيح */
const SHOWN_REPLIES = 30

export default async function AssistantEarningsPage({ searchParams }: { searchParams: Promise<{ m?: string; all?: string }> }) {
  const actor = await requirePageActor('ASSISTANT')
  if (!isClassroomAssistant(actor)) redirect('/assistant')
  const { m, all } = await searchParams
  const now = new Date()
  const months = recentMonths(now)
  const month = m && monthRange(m) && months.includes(m) ? m : monthOf(now)
  const data = await assistantMonth(await getDb(), actor, { month })
  const isCurrent = month === monthOf(now)
  return (
    <>
      <PageHeader title="أرباحي" description="راتبك الثّابت يشمل ردود الشّهر الأولى ومراجعة التّعليقات؛ وفوقه الرّدود الزّائدة والمحتوى الّذي ترفعه، إلى السّقف." />
      <div className="mx-auto max-w-3xl space-y-4">
        <MonthLinks current={month} months={months} href={(x) => `/assistant/earnings?m=${x}`} />
        <AssistantStatement statement={data.statement} config={data.config} payout={data.payout} term={data.term} />

        {isCurrent ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">رفع محتوى</CardTitle>
            </CardHeader>
            <CardContent>
              <ContentForm config={data.config} />
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">المحتوى المرفوع ({data.content.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {data.content.length === 0 ? (
              <EmptyState title="لا محتوى هذا الشّهر" />
            ) : (
              <ul className="divide-y text-sm">
                {data.content.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <a href={signFileUrl(c.fileId)} target="_blank" rel="noreferrer" className="font-bold underline-offset-2 hover:underline">
                        {c.title}
                      </a>
                      <div className="text-xs text-muted-foreground">
                        {CONTENT_KIND_LABELS[c.kind]} · {c.pages} صفحة · {c.createdAt.toLocaleDateString('fr-DZ')}
                        {c.overLimit ? ' · فوق حدّ الفصل' : ''}
                      </div>
                    </div>
                    <span className="tabular-nums">{c.overLimit ? 'لا يُحسب' : formatDa(contentAmount(c.kind, c.pages, data.config))}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">ردودي ({data.replies.length}) · الأحدث أوّلًا</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-2 text-xs text-muted-foreground">إذا كان الرّدّ تصحيحًا لتعبير تلميذ فاضغط «تصحيح تعبير» ليُحسب بثمنه.</p>
            {data.replies.length === 0 ? (
              <EmptyState title="لا ردود هذا الشّهر" />
            ) : (
              <ul className="divide-y text-sm">
                {[...data.replies].reverse().slice(0, all ? undefined : SHOWN_REPLIES).map((r) => (
                  <li key={r.id} className="space-y-1 py-2">
                    <p className="line-clamp-2 leading-relaxed">{r.excerpt}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant={r.included ? 'muted' : 'success'}>{r.included ? 'مشمول بالرّاتب' : REPLY_KIND_LABELS[r.kind]}</Badge>
                      <span className="text-muted-foreground">
                        {r.chars} حرفًا · {r.createdAt.toLocaleDateString('fr-DZ')}
                      </span>
                      {isCurrent ? (
                        <form action={toggleCorrectionAction}>
                          <input type="hidden" name="commentId" value={r.id} />
                          <input type="hidden" name="on" value={r.correction ? '0' : '1'} />
                          <Button type="submit" size="sm" variant={r.correction ? 'gold' : 'outline'}>
                            {r.correction ? '✓ تصحيح تعبير' : 'تصحيح تعبير'}
                          </Button>
                        </form>
                      ) : r.correction ? (
                        <Badge variant="gold">تصحيح تعبير</Badge>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {!all && data.replies.length > SHOWN_REPLIES ? (
              <Link href={`/assistant/earnings?m=${month}&all=1`} className="mt-2 inline-block text-sm font-bold text-primary">
                عرض كلّ الرّدود ({data.replies.length})
              </Link>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
