'use client'

import { GraduationCap } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { setPlayProfileAction } from '@/server/actions/play.actions'
import { PLAY_CYCLE_NAMES, PLAY_STREAMS, type PlayGrade } from '@/server/play/constants'

export function PlayProfileForm({ grades, current }: { grades: PlayGrade[]; current: { gradeCode: string | null; streamCode: string | null } }) {
  const router = useRouter()
  const [grade, setGrade] = useState<string | null>(current.gradeCode)
  const [stream, setStream] = useState<string | null>(current.streamCode)
  const [pending, start] = useTransition()
  const g = grades.find((x) => x.code === grade) ?? null
  const cycles = [...new Set(grades.map((x) => x.cycle))]
  const canSave = !!g && (g.streams.length === 0 || (!!stream && g.streams.includes(stream)))
  const save = () =>
    start(async () => {
      if (!g) return
      const r = await setPlayProfileAction({ gradeCode: g.code, streamCode: g.streams.length ? stream : null })
      if (!r.ok) {
        toast('error', r.error.message)
        return
      }
      toast('success', 'تم حفظ ملفك الدراسي.')
      router.push('/student/play')
      router.refresh()
    })
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {cycles.map((c) => (
        <section key={c} className="space-y-2">
          <h2 className="text-sm font-bold text-muted-foreground">{PLAY_CYCLE_NAMES[c]}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {grades
              .filter((x) => x.cycle === c)
              .map((x) => (
                <button
                  key={x.code}
                  type="button"
                  onClick={() => {
                    setGrade(x.code)
                    setStream(null)
                  }}
                  className={cn('rounded-2xl border-2 p-3 text-start text-sm font-bold transition-all', grade === x.code ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:border-primary/50')}
                >
                  <GraduationCap className="mb-1 size-5" />
                  {x.nameAr}
                </button>
              ))}
          </div>
        </section>
      ))}
      {g && g.streams.length ? (
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-muted-foreground">الشعبة</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {g.streams.map((s) => (
              <button key={s} type="button" onClick={() => setStream(s)} className={cn('rounded-2xl border-2 p-3 text-sm font-bold transition-all', stream === s ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:border-primary/50')}>
                {PLAY_STREAMS.find((x) => x.code === s)?.nameAr ?? s}
              </button>
            ))}
          </div>
        </section>
      ) : null}
      <Button size="lg" className="w-full" disabled={!canSave} loading={pending} onClick={save}>
        ابدأ اللعب
      </Button>
    </div>
  )
}
