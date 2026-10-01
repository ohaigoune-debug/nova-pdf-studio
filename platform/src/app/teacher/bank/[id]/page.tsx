import { Pencil, Plus } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DIFF_AR, EXAM_KIND_AR, KIND_AR, TYPE_AR } from '@/lib/bank-labels'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { getBankQuestion } from '@/server/services/question-bank.service'

export default async function BankQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('TEACHER')
  const { id } = await params
  let q
  try {
    q = await getBankQuestion(await getDb(), actor, id)
  } catch (e) {
    if (e instanceof AppError) notFound()
    throw e
  }
  const own = q.workspaceId === actor.workspaceId
  const key = q.answerKey as Record<string, unknown> | null
  return (
    <>
      <PageHeader
        title={q.title ?? KIND_AR[q.kind] ?? 'سؤال'}
        actions={
          own ? (
            <>
              {q.kind !== 'QUESTION' ? (
                <Button asChild variant="outline">
                  <Link href={`/teacher/bank/${q.id}/sub`}>
                    <Plus className="size-4" /> سؤال فرعي
                  </Link>
                </Button>
              ) : null}
              <Button asChild>
                <Link href={`/teacher/bank/${q.id}/edit`}>
                  <Pencil className="size-4" /> تعديل
                </Link>
              </Button>
            </>
          ) : null
        }
      />
      <div className="max-w-4xl space-y-4">
        <div className="flex flex-wrap gap-1.5 text-xs">
          <Badge variant="secondary">{KIND_AR[q.kind]}</Badge>
          <Badge variant="outline">{TYPE_AR[q.type]}</Badge>
          <Badge variant={DIFF_AR[q.difficulty]?.variant ?? 'default'}>{DIFF_AR[q.difficulty]?.label}</Badge>
          <Badge variant="muted">{Number(q.points)} ن</Badge>
          {q.estimatedMinutes ? <Badge variant="muted">{q.estimatedMinutes} د</Badge> : null}
          {[q.subjectName, q.levelName, q.streamName, q.nodeTitle, q.schoolTerm ? `الفصل ${q.schoolTerm}` : null].filter(Boolean).map((x) => (
            <Badge key={x} variant="muted">
              {x}
            </Badge>
          ))}
        </div>
        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="whitespace-pre-line leading-relaxed" dir="auto">
              {q.body}
            </p>
            {q.options.length ? (
              <ol className="list-[arabic-indic] space-y-1 ps-6">
                {q.options.map((o, i) => (
                  <li key={i} className={o.isCorrect && own ? 'font-semibold text-success' : ''}>
                    {o.label}
                  </li>
                ))}
              </ol>
            ) : null}
            {own && key ? (
              <p className="text-sm text-muted-foreground" dir="auto">
                المفتاح: {Array.isArray(key.accepted) ? (key.accepted as string[]).join(' | ') : Array.isArray(key.blanks) ? (key.blanks as string[][]).map((b) => b[0]).join(' | ') : typeof key.value === 'boolean' ? (key.value ? 'صحيح' : 'خطأ') : Array.isArray(key.pairs) ? (key.pairs as { left: string; right: string }[]).map((p) => `${p.left} = ${p.right}`).join('، ') : ''}
              </p>
            ) : null}
          </CardContent>
        </Card>
        {q.subs.length ? (
          <Card>
            <CardHeader>
              <CardTitle>الأسئلة الفرعية</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-[arabic-indic] space-y-3 ps-6">
                {q.subs.map((s) => (
                  <li key={s.id}>
                    <Link href={`/teacher/bank/${s.id}`} className="hover:underline">
                      <span className="whitespace-pre-line" dir="auto">
                        {s.body}
                      </span>
                    </Link>{' '}
                    <span className="text-xs text-muted-foreground">({Number(s.points)} ن)</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        ) : null}
        {own && (q.solution || q.bareme.length) ? (
          <Card>
            <CardHeader>
              <CardTitle>الحلّ النموذجي وسلّم التنقيط</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {q.solution ? (
                <p className="whitespace-pre-line text-sm" dir="auto">
                  {q.solution}
                </p>
              ) : null}
              {q.bareme.length ? (
                <ul className="text-sm">
                  {q.bareme.map((b, i) => (
                    <li key={i} className="flex justify-between border-b py-1 last:border-0">
                      <span>{b.label}</span>
                      <span className="tabular">{b.points} ن</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
        <p className="text-xs text-muted-foreground">
          المصدر: {q.sourceLabel ?? q.sourceName ?? 'الأستاذ'}
          {q.sourceYear ? ` · ${q.sourceYear}` : ''}
          {q.examKind ? ` · ${EXAM_KIND_AR[q.examKind]}` : ''}
          {q.keywords.length ? ` · ${q.keywords.join('، ')}` : ''}
        </p>
      </div>
    </>
  )
}
