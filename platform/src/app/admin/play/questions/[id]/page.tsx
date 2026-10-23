import { ArrowRight, Flag } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DIFFICULTY_AR, REASON_AR, REPORT_STATUS_AR, SOURCE_AR, STATUS_VARIANT, statusAr, typeAr } from '@/components/play-admin/labels'
import { QuestionActions } from '@/components/play-admin/question-actions'
import { QuestionForm, type QuestionFormInitial } from '@/components/play-admin/question-form'
import { ReportActions } from '@/components/play-admin/report-actions'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { gradeByCode, streamName, subjectName, type PlayDifficulty, type PlayQuestionType, type PlayReviewStatus } from '@/server/play/constants'
import type { PlayAnswerKey, PlayPublicPayload } from '@/server/play/question-types'
import { getQuestionAdmin, listLessonsAdmin } from '@/server/services/play-admin.service'

export const dynamic = 'force-dynamic'

type Q = Awaited<ReturnType<typeof getQuestionAdmin>>

/** يعيد بناء مدخلات نموذج التحرير من payload/answerKey المخزَّنين */
function toInitial(q: Q): QuestionFormInitial {
  const p = q.payload as PlayPublicPayload
  const k = q.answerKey as PlayAnswerKey
  const base: QuestionFormInitial = {
    key: q.key,
    type: q.type as PlayQuestionType,
    grade: q.gradeCode,
    streams: q.streamCodes,
    subject: q.subjectCode,
    unit: q.unitCode,
    lesson: q.lessonCode,
    objective: q.objective ?? undefined,
    difficulty: q.difficulty as PlayDifficulty,
    question: q.questionText,
    explanation: q.explanation,
    tags: q.tags,
    reviewStatus: q.reviewStatus as PlayReviewStatus,
    note: q.note ?? undefined
  }
  if (p.type === 'MCQ' && k.type === 'MCQ') return { ...base, options: p.options.map((o) => o.text), correct: Math.max(0, p.options.findIndex((o) => o.key === k.correct)) }
  if (p.type === 'FILL_BLANK' && k.type === 'FILL_BLANK') return { ...base, blanks: k.answers.map((a) => (a.length === 1 ? a[0]! : a)), bank: p.bank }
  if (p.type === 'MATCHING' && k.type === 'MATCHING') return { ...base, pairs: p.lefts.map((l) => ({ left: l.text, right: p.rights.find((r) => r.key === k.pairs[l.key])?.text ?? '' })) }
  if (p.type === 'ORDERING' && k.type === 'ORDERING') return { ...base, order: k.order.map((key) => p.items.find((i) => i.key === key)?.text ?? '') }
  return base
}

function AnswerPreview({ q }: { q: Q }) {
  const p = q.payload as PlayPublicPayload
  const k = q.answerKey as PlayAnswerKey
  if (p.type === 'MCQ' && k.type === 'MCQ')
    return (
      <ol className="space-y-1 text-sm">
        {p.options.map((o) => (
          <li key={o.key} className={o.key === k.correct ? 'rounded-md bg-success/10 px-2 py-1 font-bold text-success' : 'px-2 py-1'}>
            <span className="me-2 font-mono text-xs text-muted-foreground">{o.key}.</span>
            {o.text}
            {o.key === k.correct ? ' ✓' : ''}
          </li>
        ))}
      </ol>
    )
  if (p.type === 'FILL_BLANK' && k.type === 'FILL_BLANK')
    return (
      <div className="space-y-2 text-sm">
        <p>
          <span className="font-semibold">الإجابات: </span>
          {k.answers.map((a, i) => (
            <Badge key={i} variant="success" className="me-1">
              {i + 1}: {a.join(' | ')}
            </Badge>
          ))}
        </p>
        <p>
          <span className="font-semibold">بنك الكلمات: </span>
          {p.bank.map((w) => (
            <Badge key={w} variant="muted" className="me-1">
              {w}
            </Badge>
          ))}
        </p>
      </div>
    )
  if (p.type === 'MATCHING' && k.type === 'MATCHING')
    return (
      <ul className="space-y-1 text-sm">
        {p.lefts.map((l) => (
          <li key={l.key}>
            {l.text} <span className="text-muted-foreground">↔</span> {p.rights.find((r) => r.key === k.pairs[l.key])?.text}
          </li>
        ))}
      </ul>
    )
  if (p.type === 'ORDERING' && k.type === 'ORDERING')
    return (
      <ol className="list-decimal space-y-1 ps-6 text-sm">
        {k.order.map((key) => (
          <li key={key}>{p.items.find((i) => i.key === key)?.text}</li>
        ))}
      </ol>
    )
  return null
}

export default async function PlayQuestionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('SUPER_ADMIN')
  const { id } = await params
  const db = await getDb()
  let q: Q
  try {
    q = await getQuestionAdmin(db, actor, id)
  } catch (e) {
    if (isAppError(e) && e.code === 'PLAY_QUESTION_NOT_FOUND') notFound()
    throw e
  }
  const lessons = await listLessonsAdmin(db, actor)
  const served = q.timesCorrect + q.timesWrong
  const rate = served ? Math.round((100 * q.timesCorrect) / served) : null

  return (
    <>
      <PageHeader
        title={q.key}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={(STATUS_VARIANT as Record<string, 'muted'>)[q.reviewStatus] ?? 'muted'}>{statusAr(q.reviewStatus)}</Badge>
            {q.isSuspended ? <Badge variant="destructive">معلَّق</Badge> : null}
            {q.deletedAt ? <Badge variant="destructive">مؤرشف</Badge> : null}
            <span>
              {gradeByCode(q.gradeCode)?.nameAr ?? q.gradeCode}
              {q.streamCodes.length ? ` (${q.streamCodes.map(streamName).join('، ')})` : ''} · {subjectName(q.subjectCode)} · {q.unitName} · {q.lessonName}
            </span>
          </span>
        }
        actions={
          <Link href="/admin/play/questions" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <ArrowRight className="size-4" /> إلى البنك
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              السؤال <Badge variant="secondary">{typeAr(q.type)}</Badge>
              <Badge variant={q.difficulty === 'HARD' ? 'destructive' : q.difficulty === 'MEDIUM' ? 'warning' : 'success'}>{(DIFFICULTY_AR as Record<string, string>)[q.difficulty] ?? q.difficulty}</Badge>
              <Badge variant="muted">{SOURCE_AR[q.source] ?? q.source}</Badge>
              <Badge variant="muted">{q.language}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-lg leading-relaxed">{q.questionText}</p>
            <AnswerPreview q={q} />
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <p className="mb-1 text-xs font-bold text-muted-foreground">التفسير</p>
              <p className="leading-relaxed">{q.explanation}</p>
            </div>
            {q.objective ? (
              <p className="text-sm">
                <span className="font-semibold">الهدف: </span>
                {q.objective}
              </p>
            ) : null}
            {q.tags.length ? (
              <p className="flex flex-wrap gap-1">
                {q.tags.map((t) => (
                  <Badge key={t} variant="outline">
                    {t}
                  </Badge>
                ))}
              </p>
            ) : null}
            {q.qualityFlags.length ? (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
                <p className="mb-1 text-xs font-bold">تنبيهات الجودة</p>
                <ul className="list-disc ps-5">
                  {q.qualityFlags.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>الإجراءات</CardTitle>
            </CardHeader>
            <CardContent>
              <QuestionActions id={q.id} status={q.reviewStatus} suspended={q.isSuspended} note={q.note} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>الإحصاء والمراجعة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                عُرض <strong className="tabular">{q.timesServed}</strong> مرة · صحيحة <strong className="tabular text-success">{q.timesCorrect}</strong> · خاطئة <strong className="tabular text-destructive">{q.timesWrong}</strong>
                {rate !== null ? <> · نسبة النجاح {rate}%</> : null}
              </p>
              <p>
                بلاغات: <strong className="tabular">{q.reportsCount}</strong>
              </p>
              <p className="text-muted-foreground">آخر مراجعة: {q.reviewedAt ? formatDateTime(q.reviewedAt) : '—'}</p>
              <p className="text-muted-foreground">أُنشئ: {formatDateTime(q.createdAt)} · عُدّل: {formatDateTime(q.updatedAt)}</p>
              {q.note ? (
                <p className="rounded-md bg-muted/50 p-2">
                  <span className="font-semibold">ملاحظة: </span>
                  {q.note}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag className="size-4 text-destructive" /> البلاغات على هذا السؤال <Badge variant="muted">{q.reports.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {q.reports.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">لا بلاغات.</p>
          ) : (
            <ul className="divide-y text-sm">
              {q.reports.map((r) => (
                <li key={r.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {(REASON_AR as Record<string, string>)[r.reason] ?? r.reason} <Badge variant={r.status === 'OPEN' ? 'warning' : 'muted'}>{(REPORT_STATUS_AR as Record<string, string>)[r.status] ?? r.status}</Badge>
                    </p>
                    {r.message ? <p className="text-muted-foreground">{r.message}</p> : null}
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(r.createdAt)}
                      {r.resolution ? ` · القرار: ${r.resolution}` : ''}
                    </p>
                  </div>
                  {r.status === 'OPEN' ? <ReportActions id={r.id} /> : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>تعديل السؤال</CardTitle>
        </CardHeader>
        <CardContent>
          <QuestionForm lessons={lessons} initial={toInitial(q)} existingId={q.id} />
        </CardContent>
      </Card>
    </>
  )
}
