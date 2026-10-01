import { ArrowRight, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PracticePlayer } from '@/components/domain/practice-player'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, PageHeader, Progress } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { hasMath, renderBody } from '@/server/lib/exam-render'
import { getPractice } from '@/server/services/practice.service'

export const dynamic = 'force-dynamic'

export default async function PracticeSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('STUDENT')
  const { id } = await params
  let v
  try {
    v = await getPractice(await getDb(), actor, id)
  } catch (e) {
    if (e instanceof AppError) notFound()
    throw e
  }
  const math = hasMath(v.questions.flatMap((q) => [q.body, q.result?.solution]))
  const title = `${v.session.subjectName ?? 'تدريب'}${v.session.nodeTitle ? ` — ${v.session.nodeTitle}` : ''}`
  return (
    <div className="space-y-6">
      {math ? <link rel="stylesheet" href="/katex/katex.min.css" /> : null}
      <PageHeader
        title={title}
        description={`${v.session.questionCount} سؤال`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/student/practice">
              <ArrowRight className="size-4" /> التدريب
            </Link>
          </Button>
        }
      />
      {v.summary ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>النتيجة: {v.summary.scorePct}%</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="tabular">
                {v.summary.correct} صحيح من {v.summary.total}
                {v.summary.answered < v.summary.total ? ` (${v.summary.total - v.summary.answered} بلا إجابة)` : ''}
              </p>
              <Progress value={v.summary.scorePct} tone={v.summary.scorePct >= 60 ? 'success' : 'warning'} />
              {v.summary.weak.length ? <Alert tone="warning" title="يحتاج تدريباً">{v.summary.weak.join('، ')}</Alert> : <Alert tone="success">لا نقاط ضعف واضحة في هذه الجلسة.</Alert>}
              <ul className="space-y-2">
                {v.summary.byNode.map((n) => (
                  <li key={n.title}>
                    <div className="mb-1 flex items-center justify-between">
                      <span>{n.title}</span>
                      <span className="tabular text-xs text-muted-foreground">
                        {n.correct} / {n.total}
                      </span>
                    </div>
                    <Progress value={(n.correct / n.total) * 100} tone={n.correct / n.total >= 0.6 ? 'success' : 'warning'} />
                  </li>
                ))}
              </ul>
              <Button asChild>
                <Link href={`/student/practice?subject=${v.session.subjectId}${v.session.curriculumNodeId ? `&node=${v.session.curriculumNodeId}` : ''}`}>
                  <RotateCcw className="size-4" /> جلسة جديدة
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>مراجعة الأسئلة</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm">
                {v.questions.map((q, i) => (
                  <li key={q.id} className={`rounded-lg border p-3 ${q.result ? (q.result.isCorrect ? 'border-success/40' : 'border-destructive/40') : 'border-dashed'}`}>
                    <div className="flex items-start gap-2">
                      <span className="tabular text-muted-foreground">{i + 1}.</span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div dir="auto" dangerouslySetInnerHTML={{ __html: renderBody(q.body) }} />
                        {q.result ? (
                          <p className="text-xs">
                            {q.result.isCorrect ? <span className="text-success">صحيح</span> : <span className="text-destructive">خطأ</span>}
                            {!q.result.isCorrect && q.result.correctText ? <span> · الصحيح: {q.result.correctText}</span> : null}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">بلا إجابة</p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </>
      ) : (
        <PracticePlayer sessionId={v.session.id} questions={v.questions.map((q) => ({ ...q, bodyHtml: renderBody(q.type === 'FILL_BLANK' ? q.body.replace(/___/g, '(____)') : q.body), solutionHtml: q.result?.solution ? renderBody(q.result.solution) : null }))} />
      )}
    </div>
  )
}
