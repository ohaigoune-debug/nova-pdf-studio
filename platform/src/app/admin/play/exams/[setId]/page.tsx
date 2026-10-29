import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { Documents, StepExcerptView } from '@/components/play/exams/exam-runner'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { playExamSets } from '@/server/db/schema'
import { answerText, validateExamSet } from '@/server/play/exams/engine'
import { stepExcerpt } from '@/server/play/exams/excerpt'
import { skillLabel } from '@/server/play/exams/skills'
import type { OriginalQuestion, TrainingStep } from '@/server/play/exams/types'

export const dynamic = 'force-dynamic'

const TYPE: Record<string, string> = { mcq: 'اختيار من متعدد', multi: 'اختيار متعدد', fill_blank: 'ملء فراغ', matching: 'مطابقة', ordering: 'ترتيب', numeric: 'عددي', short_text: 'إجابة قصيرة', portrait: 'صورة شخصية', essay_builder: 'إنتاج كتابي (مؤجّل)' }

function StepCard({ st, q }: { st: TrainingStep; q: OriginalQuestion }) {
  const p = st.payload
  const a = st.answer
  return (
    <div className="rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono" dir="ltr">
          {st.id}
        </span>
        <Badge variant="outline">{TYPE[st.type] ?? st.type}</Badge>
        <span>{st.points} ن</span>
        <span>{skillLabel(st.skill_id)}</span>
        <Badge variant={st.review_status === 'approved' ? 'default' : 'secondary'}>{st.review_status}</Badge>
      </div>
      <p className="mt-2 font-semibold">{st.prompt}</p>
      {st.type !== 'essay_builder' ? <StepExcerptView excerpt={stepExcerpt(st, q)} /> : null}
      {'options' in p ? (
        <ol className="mt-2 space-y-1">
          {p.options.map((o, i) => {
            const ok = a.type === 'multi' ? a.correct.includes(i) : 'correct' in a && a.correct === i
            return (
              <li key={i} className={ok ? 'rounded bg-emerald-50 px-2 py-1 font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'px-2 py-1'}>
                {ok ? '✓ ' : '· '}
                {o}
              </li>
            )
          })}
        </ol>
      ) : p.type === 'fill_blank' ? (
        <div className="mt-2 space-y-1">
          <p>{p.text}</p>
          <p className="text-xs text-muted-foreground">البنك: {p.bank.join(' | ')}</p>
        </div>
      ) : null}
      {st.type !== 'mcq' && st.type !== 'multi' && st.type !== 'portrait' ? <p className="mt-2 text-emerald-700 dark:text-emerald-300">الصحيح: {answerText(st) || JSON.stringify((a as { spec?: unknown }).spec ?? a)}</p> : null}
      <p className="mt-2 text-xs text-muted-foreground">الشرح: {st.explanation}</p>
    </div>
  )
}

/** مراجعة موضوع: النص الأصلي، سلّم التنقيط، وكل خطوة بإجابتها الصحيحة (للمالك/المراجع فقط) */
export default async function AdminPlayExamReviewPage({ params }: { params: Promise<{ setId: string }> }) {
  await requirePageActor('SUPER_ADMIN')
  const { setId } = await params
  const [row] = await (await getDb()).select().from(playExamSets).where(eq(playExamSets.setId, setId)).limit(1)
  if (!row) notFound()
  const doc = row.document
  const v = validateExamSet(doc)
  return (
    <>
      <PageHeader title={doc.source.title} description={`${doc.set_id} · ${doc.status} · ${doc.source.trust} · الأصل: ${doc.source.original_file_ref ?? doc.source.original_url ?? '—'} · التصحيح: ${doc.source.correction_file_ref ?? doc.source.correction_url ?? '—'}`} />
      <div className="space-y-4">
        {doc.source.notes ? (
          <Card>
            <CardContent className="p-4 text-sm leading-relaxed">ملاحظات التحويل: {doc.source.notes}</CardContent>
          </Card>
        ) : null}
        {v.errors.length ? (
          <Card>
            <CardContent className="p-4 text-sm text-destructive">{v.errors.map((e) => `${e.code} ${e.where}: ${e.message}`).join(' · ')}</CardContent>
          </Card>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">الوثائق</CardTitle>
          </CardHeader>
          <CardContent>
            <Documents docs={doc.original_questions.flatMap((q) => q.documents).filter((d, i, all) => all.findIndex((x) => x.id === d.id) === i)} />
          </CardContent>
        </Card>
        {doc.original_questions.map((q) => (
          <Card key={q.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {q.part} — السؤال {q.number} ({q.rubric_total} ن)
              </CardTitle>
              <p className="text-sm text-muted-foreground">{q.verbatim_text}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {q.rubric_elements.map((e) => (
                <div key={e.id} className="space-y-2">
                  <p className="text-sm font-bold">
                    {e.label} — {e.max_points} ن{e.streams?.length ? ` (شعبة ${e.streams.join('، ')})` : ''}
                  </p>
                  {doc.steps
                    .filter((s) => s.rubric_element_id === e.id)
                    .map((s) => (
                      <StepCard key={s.id} st={s} q={q} />
                    ))}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
