import { ArrowRight, FileText } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { DIFF_AR, KIND_AR } from '@/lib/bank-labels'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { ARABIC_LETTERS, hasMath, renderBody } from '@/server/lib/exam-render'
import { ORIGIN_AR } from '@/server/services/exam-engine.service'
import { publicQuestion } from '@/server/services/library.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'سؤال من البنك' }

/** عرض عام لسؤال/تمرين من البنك: النصّ والاختيارات والفرعيات والحلّ — بلا كشف الصحيح في الاختيارات */
export default async function PublicQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let r
  try {
    r = await publicQuestion(await getDb(), id)
  } catch (e) {
    if (e instanceof AppError) notFound()
    throw e
  }
  const q = r.q
  const math = hasMath([q.body, q.solution, ...r.children.map((c) => c.body)])
  return (
    <div className="container max-w-3xl py-10">
      {math ? <link rel="stylesheet" href="/katex/katex.min.css" /> : null}
      <PageHeader
        title={q.title ?? KIND_AR[q.kind] ?? 'سؤال'}
        description={[r.subjectName, r.levelName, r.streamName, r.nodeTitle].filter(Boolean).join(' · ')}
        actions={
          <span className="flex flex-wrap gap-2">
            {r.originalResourceId ? (
              <Button asChild size="sm">
                <Link href={`/archive/${r.originalResourceId}`}>
                  <FileText className="size-4" /> عرض الامتحان الأصلي
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link href="/library">
                <ArrowRight className="size-4" /> المكتبة
              </Link>
            </Button>
          </span>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <Badge variant="secondary">{KIND_AR[q.kind]}</Badge>
            <Badge variant={DIFF_AR[q.difficulty]?.variant ?? 'default'}>{DIFF_AR[q.difficulty]?.label}</Badge>
            <Badge variant="muted">{Number(q.points)} ن</Badge>
            <Badge variant={q.origin === 'AI_GENERATED' ? 'gold' : q.origin === 'SOURCED' ? 'success' : 'outline'}>{ORIGIN_AR[q.origin] ?? q.origin}</Badge>
            {q.sourceExerciseNo ? <Badge variant="outline">التمرين {q.sourceExerciseNo}{q.sourceTopicNo ? ` — الموضوع ${q.sourceTopicNo}` : ''}</Badge> : null}
            {q.sourceLabel ? <span className="text-xs font-normal text-muted-foreground">المصدر: {q.sourceLabel}{q.sourceYear ? ` ${q.sourceYear}` : ''}</span> : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-[16px] leading-8">
          <div dir="auto" dangerouslySetInnerHTML={{ __html: renderBody(q.body) }} />
          {q.options.length ? (
            <ol className="space-y-1 text-sm">
              {q.options.map((o, i) => (
                <li key={i}>
                  {ARABIC_LETTERS[i] ?? i + 1}) {o.label}
                </li>
              ))}
            </ol>
          ) : null}
          {r.children.length ? (
            <ol className="space-y-2 border-t pt-3 text-sm">
              {r.children.map((c, i) => (
                <li key={c.id} className="flex items-start gap-2">
                  <span className="tabular text-muted-foreground">{i + 1}.</span>
                  <span className="min-w-0 flex-1">
                    <span dir="auto" dangerouslySetInnerHTML={{ __html: renderBody(c.body) }} />
                    {c.options.length ? <span className="block text-xs text-muted-foreground">{c.options.map((o, k) => `${ARABIC_LETTERS[k] ?? k + 1}) ${o.label}`).join(' · ')}</span> : null}
                  </span>
                  <span className="tabular text-xs text-muted-foreground">{Number(c.points)} ن</span>
                </li>
              ))}
            </ol>
          ) : null}
          {q.solution ? (
            <details className="rounded-lg border bg-muted/40 p-3 text-sm">
              <summary className="cursor-pointer font-semibold">الحلّ النموذجي</summary>
              <div className="mt-2 leading-7" dir="auto" dangerouslySetInnerHTML={{ __html: renderBody(q.solution) }} />
            </details>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
