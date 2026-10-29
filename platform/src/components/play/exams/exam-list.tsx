'use client'

import { Eye, FileText, Play, Timer } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { startExamAttemptAction } from '@/server/actions/play-exams.actions'
import { streamName } from '@/server/play/constants'
import type { ExamListItem } from '@/server/services/play-exams.service'

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''))

function StartPair({ id, disabled }: { id: string; disabled: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const go = (mode: 'PRACTICE' | 'EXAM') =>
    start(async () => {
      const r = await startExamAttemptAction({ setId: id, mode })
      if (!r.ok) {
        toast('error', r.error.message)
        return
      }
      router.push(`/student/play/exam/${r.data.attemptId}`)
    })
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <button type="button" disabled={disabled || pending} onClick={() => go('PRACTICE')} data-testid="exam-start-practice" className="flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-gradient-to-b from-[#3B83F0] to-[#1457C5] px-3 text-sm font-extrabold text-white disabled:opacity-50">
        <Play className="size-4" fill="currentColor" strokeWidth={0} aria-hidden /> تدريب
      </button>
      <button type="button" disabled={disabled || pending} onClick={() => go('EXAM')} data-testid="exam-start-exam" className="flex min-h-11 items-center justify-center gap-1.5 rounded-full border-[1.5px] border-[#6E9DEB] bg-white px-3 text-sm font-extrabold text-[#1457C5] disabled:opacity-50">
        <Timer className="size-4" aria-hidden /> محاكاة امتحان
      </button>
    </div>
  )
}

export function ExamCard({ item, canPlay }: { item: ExamListItem; canPlay: boolean }) {
  return (
    <article data-testid="exam-card" className="rounded-2xl border border-[#D3E0F5] bg-white p-4 shadow-[0_10px_24px_-20px_rgba(20,87,197,0.6)]">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#1457C5]">
          <FileText className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[1rem] font-extrabold leading-snug text-[#172B50]">{item.title}</h3>
          <p className="mt-1 text-xs font-medium text-[#5B6B88]">
            {item.streamCodes.length ? item.streamCodes.map(streamName).join('، ') : 'كل الشعب'} · {item.stepCount} سؤالًا تفاعليًا
          </p>
          <p className="mt-1 text-xs font-bold text-[#3B4C6B]">
            التصحيح الآلي: {fmt(item.interactivePoints)} ن{item.deferredPoints > 0 ? ` · الإنتاج الكتابي: ${fmt(item.deferredPoints)} ن (بشبكة التقويم)` : ''} — المجموع {fmt(item.scoreTotal)}
          </p>
          {item.best ? (
            <p className="mt-1 text-xs font-bold text-[#15803D]">
              أفضل نتيجة: {fmt(item.best.score)} / {fmt(item.best.max)} ({item.attempts} {item.attempts === 1 ? 'محاولة' : 'محاولات'})
            </p>
          ) : null}
          {item.preview ? (
            <p data-testid="exam-preview-badge" className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#FFF4D6] px-2.5 py-1 text-[0.72rem] font-bold text-[#8A5A00]">
              <Eye className="size-3.5" aria-hidden /> معاينة تطوير — لم يراجعها الأستاذ بعد
            </p>
          ) : null}
        </div>
      </div>
      <StartPair id={item.id} disabled={!canPlay} />
    </article>
  )
}

/** الفروض والاختبارات: الفصل ← النوع ← المجموعات */
export function TestsByTerm({ items, canPlay }: { items: ExamListItem[]; canPlay: boolean }) {
  const terms = [1, 2, 3]
  return (
    <div className="space-y-6">
      {terms.map((t) => {
        const list = items.filter((i) => i.term === t)
        return (
          <section key={t} aria-labelledby={`term-${t}`}>
            <h2 id={`term-${t}`} className="mb-3 flex items-center gap-2 text-[1.1rem] font-extrabold text-[#1B4DB1]">
              الفصل {['الأول', 'الثاني', 'الثالث'][t - 1]}
              <span className="rounded-full bg-[#EEF4FF] px-2 py-0.5 text-xs font-bold text-[#1457C5]">{list.length}</span>
            </h2>
            {list.length ? (
              <div className="space-y-3">
                {(['TEST', 'DEVOIR'] as const).map((k) => {
                  const ofKind = list.filter((i) => i.kind === k)
                  if (!ofKind.length) return null
                  return (
                    <div key={k} className="space-y-3">
                      <p className="text-sm font-bold text-[#5B6B88]">{k === 'TEST' ? 'الاختبارات' : 'الفروض'}</p>
                      {ofKind.map((i) => (
                        <ExamCard key={i.id} item={i} canPlay={canPlay} />
                      ))}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className={cn('rounded-2xl border border-dashed border-[#C9D7EE] bg-white/70 px-4 py-4 text-sm font-medium text-[#5B6B88]')}>لا توجد مواضيع محوّلة لهذا الفصل بعد.</p>
            )}
          </section>
        )
      })}
    </div>
  )
}
