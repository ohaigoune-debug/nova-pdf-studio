import { Gamepad2, NotebookPen, Target } from 'lucide-react'
import { PracticeAgainButton } from '@/components/play/practice-again-button'
import { cn } from '@/lib/utils'
import type { StudentPracticeItem } from '@/server/services/lesson-practice.service'

/** «تدرّب على هذا الدرس»: تمارين بنك مدرسة تحت فيديو الدرس، لمشتركي الدورة (22 نوفمبر 2026) */
export function LessonPracticeCard({ items }: { items: StudentPracticeItem[] }) {
  if (!items.length) return null
  return (
    <section aria-labelledby="lesson-practice-title" className="space-y-3 rounded-[20px] border-2 border-primary/60 bg-card p-4">
      <h2 id="lesson-practice-title" className="flex items-center gap-2 font-heading text-lg font-bold">
        <Target className="size-5 text-primary" /> تدرّب على هذا الدرس
      </h2>
      {items.map((it) => (
        <div key={it.linkId} className="flex items-center gap-3 rounded-2xl border p-3">
          <span className={cn('flex size-11 flex-none items-center justify-center rounded-2xl', it.kind === 'LESSON' ? 'bg-primary/10 text-primary' : 'bg-amber-100 text-amber-700')}>
            {it.kind === 'LESSON' ? <Gamepad2 className="size-5" /> : <NotebookPen className="size-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold leading-snug">{it.title}</p>
            <p className="text-xs text-muted-foreground">{it.best ? it.best.label : it.kind === 'LESSON' ? 'لم تلعبه بعد' : 'لم تبدأه بعد'}</p>
            {it.best ? (
              <div dir="ltr" className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={it.best.pct} aria-valuemin={0} aria-valuemax={100} aria-label="أفضل نتيجة">
                <div className={cn('h-full rounded-full', it.best.pct >= 50 ? 'bg-emerald-600' : 'bg-amber-500')} style={{ width: `${it.best.pct}%` }} />
              </div>
            ) : null}
          </div>
          <PracticeAgainButton linkId={it.linkId} size="sm" className="flex-none">
            {it.kind === 'LESSON' ? 'العب' : 'ابدأ'}
          </PracticeAgainButton>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">نتيجتك تُحفظ، وترى الإجابة الصحيحة وشرحها بعد كل سؤال.</p>
    </section>
  )
}
