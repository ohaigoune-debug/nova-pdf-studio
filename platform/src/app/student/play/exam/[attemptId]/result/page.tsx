import { Check, RotateCcw, X } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { getExamAttemptView, getExamResult } from '@/server/services/play-exams.service'

export const dynamic = 'force-dynamic'

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''))

/** النتيجة: المحصّل من التصحيح الآلي بأوزان سلّم التنقيط الأصلي، والإنتاج الكتابي منفصل (لا ادعاء تصحيح رسمي آلي) */
export default async function PlayExamResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params
  const actor = await requirePageActor('STUDENT')
  const db = await getDb()
  let result
  try {
    const view = await getExamAttemptView(db, actor, attemptId)
    if (view.status !== 'COMPLETED') redirect(`/student/play/exam/${attemptId}`)
    result = await getExamResult(db, actor, attemptId)
  } catch (e) {
    if (e instanceof AppError) notFound()
    throw e
  }
  const { view } = result
  const back = view.set.kind === 'BAC' ? `/student/play/bac?subject=${view.set.subjectCode}` : `/student/play/exams?subject=${view.set.subjectCode}`
  const wrong = result.steps.filter((s) => s.feedback && !s.feedback.correct)
  const skipped = result.steps.filter((s) => !s.feedback)
  return (
    <div className="play-deck mx-auto max-w-xl space-y-5 pb-16">
      <section className="rounded-[1.75rem] border border-[#C9D7EE] bg-white p-5 text-center shadow-[0_18px_30px_-24px_rgba(20,87,197,0.7)]" data-testid="exam-result">
        <p className="text-xs font-bold text-[#5B6B88]">{view.mode === 'PRACTICE' ? 'تدريب' : 'محاكاة امتحان'}</p>
        <h1 className="mt-1 text-[1.1rem] font-extrabold leading-snug text-[#172B50]">{view.set.title}</h1>
        <p className="mt-4 text-[2.6rem] font-black leading-none text-[#1457C5]" data-testid="exam-result-score">
          <bdi dir="ltr">
            {fmt(result.earned)} / {fmt(result.interactiveMax)}
          </bdi>
        </p>
        <p className="mt-2 text-sm font-bold text-[#3B4C6B]">نقاط التصحيح الآلي بأوزان سلّم التنقيط الأصلي</p>
        {result.deferredPoints > 0 ? (
          <p className="mx-auto mt-3 max-w-sm rounded-xl bg-[#FFF8E6] px-3 py-2 text-xs font-bold leading-relaxed text-[#8A5A00]">
            الإنتاج الكتابي ({fmt(result.deferredPoints)} ن من {fmt(view.set.scoreTotal)}) يُصحَّح بشبكة التقويم عند الأستاذ، فلا تُعدّ هذه النتيجة علامة رسمية على {fmt(view.set.scoreTotal)}.
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-[#D3E0F5] bg-white p-4" aria-labelledby="by-part">
        <h2 id="by-part" className="text-[1rem] font-extrabold text-[#1B4DB1]">حسب أجزاء الموضوع</h2>
        <ul className="mt-3 space-y-2">
          {result.byPart.map((p) => (
            <li key={p.part} className="flex items-center gap-3 rounded-xl bg-[#F5F8FF] px-3 py-2">
              <span className="flex-1 text-sm font-bold text-[#172B50]">{p.part}</span>
              {p.max > 0 ? (
                <span className="text-sm font-extrabold text-[#1457C5]">
                  <bdi dir="ltr">
                    {fmt(p.earned)} / {fmt(p.max)}
                  </bdi>
                </span>
              ) : null}
              {p.deferred > 0 ? <span className="text-xs font-bold text-[#8A5A00]">+ {fmt(p.deferred)} ن مؤجّلة</span> : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-[#D3E0F5] bg-white p-4" aria-labelledby="mistakes">
        <h2 id="mistakes" className="text-[1rem] font-extrabold text-[#1B4DB1]">
          مراجعة الأخطاء ({wrong.length}){skipped.length ? ` · دون إجابة (${skipped.length})` : ''}
        </h2>
        {wrong.length === 0 ? <p className="mt-2 text-sm font-bold text-[#15803D]">لا أخطاء في الخطوات التي أجبت عنها.</p> : null}
        <ul className="mt-3 space-y-3">
          {wrong.map((s) => (
            <li key={s.id} className="rounded-xl border border-[#E3EBF8] p-3" data-correct={s.feedback?.correct ? '1' : '0'}>
              <p className="text-[0.7rem] font-bold text-[#5B6B88]">
                السؤال {s.questionNumber} · {s.rubricLabel} · <bdi dir="ltr">{fmt(s.feedback?.earned ?? 0)}/{fmt(s.points)}</bdi> ن
              </p>
              <p className="mt-1 flex items-start gap-2 text-sm font-bold text-[#172B50]">
                {s.feedback?.correct ? <Check className="mt-0.5 size-4 shrink-0 text-[#15803D]" aria-hidden /> : <X className="mt-0.5 size-4 shrink-0 text-[#B91C1C]" aria-hidden />}
                {s.prompt}
              </p>
              {s.feedback && !s.feedback.correct ? (
                <div className="mt-2 space-y-1 text-[0.82rem] leading-relaxed">
                  <p className="text-[#7C2D12]">إجابتك: {s.feedback.yourAnswer}</p>
                  <p className="font-bold text-[#14532D]">الصحيح: {s.feedback.correctText}</p>
                  <p className="text-[#3B4C6B]">{s.feedback.explanation}</p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        {skipped.length ? (
          <details className="mt-4 rounded-xl bg-[#F5F8FF] p-3">
            <summary className="cursor-pointer text-sm font-bold text-[#3B4C6B]">خطوات دون إجابة ({skipped.length}) — اعرض الإجابات الصحيحة</summary>
            <ul className="mt-2 space-y-2">
              {skipped.map((s) => (
                <li key={s.id} className="text-[0.82rem] leading-relaxed text-[#172B50]">
                  <span className="font-bold">{s.prompt}</span>
                  {s.correctText ? <span className="block text-[#14532D]">الصحيح: {s.correctText}</span> : null}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <div className="flex flex-wrap justify-center gap-2">
        <Link href={back} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-gradient-to-b from-[#3B83F0] to-[#1457C5] px-5 text-sm font-extrabold text-white">
          <RotateCcw className="size-4" aria-hidden /> مواضيع أخرى
        </Link>
        <Link href="/student/play/results" className="inline-flex min-h-11 items-center rounded-full border-[1.5px] border-[#6E9DEB] bg-white px-5 text-sm font-extrabold text-[#1457C5]">
          نتائجي وتقدمي
        </Link>
      </div>
    </div>
  )
}
