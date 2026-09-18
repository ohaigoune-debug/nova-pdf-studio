'use client'

import { Clock, Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Alert } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import { submitAttemptAction } from '@/server/actions/quizzes.actions'

export interface PlayerQuestion {
  id: string
  type: string
  prompt: string
  points: number
  imageUrl: string | null
  options: { id: string; label: string }[]
  matching: { lefts: string[]; rights: { index: number; label: string }[] } | null
  blanksCount: number
}

type AnswerState = { optionIds?: string[]; value?: boolean; text?: string; blanks?: string[]; matches?: Record<string, number> }

export function QuizPlayer({ attemptId, questions, expiresAt }: { attemptId: string; questions: PlayerQuestion[]; expiresAt: string | null }) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({})
  const [confirm, setConfirm] = useState(false)
  const [pending, start] = useTransition()
  const [now, setNow] = useState(Date.now())
  const submitted = useRef(false)
  const set = (qid: string, patch: AnswerState) => setAnswers((a) => ({ ...a, [qid]: { ...a[qid], ...patch } }))

  const submit = useCallback(() => {
    if (submitted.current) return
    submitted.current = true
    start(async () => {
      const payload = questions.map((q) => ({ questionId: q.id, ...(answers[q.id] ?? {}) }))
      const r = await submitAttemptAction(attemptId, payload)
      if (!r.ok) {
        submitted.current = false
        toast('error', r.error.message)
        return
      }
      toast('success', r.data.needsReview ? t('quizzes.pendingEssay') : `${t('quizzes.yourScore')}: ${r.data.finalScore}/${r.data.maxScore}`, undefined, 8000)
      setConfirm(false)
      router.refresh()
    })
  }, [answers, attemptId, questions, router])

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(iv)
  }, [])
  const remaining = expiresAt ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000)) : null
  useEffect(() => {
    if (remaining === 0 && !submitted.current) submit()
  }, [remaining, submit])

  const answered = questions.filter((q) => {
    const a = answers[q.id]
    return a && (a.optionIds?.length || a.value !== undefined || a.text?.trim() || a.blanks?.some(Boolean) || (a.matches && Object.keys(a.matches).length))
  }).length

  return (
    <div className="space-y-4">
      <div className="sticky top-16 z-30 flex items-center justify-between rounded-lg border bg-background/90 px-4 py-2 text-sm backdrop-blur">
        <span className="tabular">
          {answered}/{questions.length} سؤال
        </span>
        {remaining !== null ? (
          <span className={cn('flex items-center gap-1 font-bold tabular', remaining < 60 && 'text-destructive')}>
            <Clock className="size-4" /> {t('quizzes.timeLeft')}: {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
          </span>
        ) : null}
        <Button size="sm" onClick={() => setConfirm(true)} loading={pending}>
          <Send className="size-4" /> {t('quizzes.submit')}
        </Button>
      </div>

      {questions.map((q, i) => (
        <Card key={q.id}>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
              <div className="flex-1">
                <p className="text-[16px] font-semibold leading-7">{q.type === 'FILL_BLANK' ? q.prompt.replace(/___/g, '(____)') : q.prompt}</p>
                <p className="text-[11px] text-muted-foreground tabular">{q.points} نقطة</p>
              </div>
            </div>
            {q.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={q.imageUrl} alt="" className="max-h-72 rounded-lg border" />
            ) : null}
            {(q.type === 'MCQ' || q.type === 'IMAGE') && q.options.length ? (
              <div className="space-y-1">
                {q.options.map((o) => {
                  const chosen = answers[q.id]?.optionIds?.includes(o.id) ?? false
                  return (
                    <label key={o.id} className={cn('flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm', chosen && 'border-primary bg-primary/5')}>
                      <input
                        type="checkbox"
                        checked={chosen}
                        onChange={(e) => {
                          const cur = answers[q.id]?.optionIds ?? []
                          set(q.id, { optionIds: e.target.checked ? [...cur, o.id] : cur.filter((x) => x !== o.id) })
                        }}
                        className="size-4"
                      />
                      {o.label}
                    </label>
                  )
                })}
              </div>
            ) : null}
            {q.type === 'TRUE_FALSE' ? (
              <div className="flex gap-2">
                {[true, false].map((v) => (
                  <Button key={String(v)} type="button" variant={answers[q.id]?.value === v ? 'default' : 'outline'} onClick={() => set(q.id, { value: v })}>
                    {v ? t('quizzes.trueLabel') : t('quizzes.falseLabel')}
                  </Button>
                ))}
              </div>
            ) : null}
            {q.type === 'SHORT_ANSWER' || (q.type === 'IMAGE' && q.options.length === 0) ? <Input value={answers[q.id]?.text ?? ''} onChange={(e) => set(q.id, { text: e.target.value })} placeholder={t('quizzes.yourAnswer')} /> : null}
            {q.type === 'LONG_ANSWER' ? <Textarea rows={6} value={answers[q.id]?.text ?? ''} onChange={(e) => set(q.id, { text: e.target.value })} placeholder={t('assignments.answerPlaceholder')} className="leading-7" /> : null}
            {q.type === 'FILL_BLANK' ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {Array.from({ length: q.blanksCount }).map((_, k) => (
                  <Input
                    key={k}
                    value={answers[q.id]?.blanks?.[k] ?? ''}
                    onChange={(e) => {
                      const b = [...(answers[q.id]?.blanks ?? Array(q.blanksCount).fill(''))]
                      b[k] = e.target.value
                      set(q.id, { blanks: b })
                    }}
                    placeholder={`الفراغ ${k + 1}`}
                  />
                ))}
              </div>
            ) : null}
            {q.type === 'MATCHING' && q.matching ? (
              <div className="space-y-2">
                {q.matching.lefts.map((left, k) => (
                  <div key={k} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
                    <span className="rounded-md bg-muted px-3 py-2">{left}</span>
                    <span>⟵</span>
                    <Select value={answers[q.id]?.matches?.[String(k)] ?? ''} onChange={(e) => set(q.id, { matches: { ...(answers[q.id]?.matches ?? {}), [String(k)]: Number(e.target.value) } })}>
                      <option value="">—</option>
                      {q.matching!.rights.map((r) => (
                        <option key={r.index} value={r.index}>
                          {r.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}

      {answered < questions.length ? <Alert tone="warning">بقي {questions.length - answered} سؤال بلا إجابة.</Alert> : null}
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('quizzes.submit')}</DialogTitle>
            <DialogDescription>{t('quizzes.submitConfirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={submit} loading={pending}>
              {t('common.confirm')}
            </Button>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              {t('common.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
