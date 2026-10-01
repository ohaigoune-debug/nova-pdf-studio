'use client'

import { ArrowLeft, CheckCircle2, Flag, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'
import { Alert, Progress } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { DIFF_AR } from '@/lib/bank-labels'
import { cn } from '@/lib/utils'
import { answerPracticeAction, finishPracticeAction } from '@/server/actions/practice.actions'
import type { PracticeAnswerResult, PracticeQuestionView } from '@/server/services/practice.service'

type Draft = { optionIds?: string[]; value?: boolean; text?: string; blanks?: string[]; matches?: Record<string, number> }

/** نصّ السؤال مُصيَّر في الخادم (معادلات وغامق) ليبقى العميل خفيفاً */
export type PlayerQuestion = PracticeQuestionView & { bodyHtml: string; solutionHtml: string | null }

/**
 * سؤال واحد في كل مرة: إجابة ← تصحيح فوري مع الإجابة الصحيحة والحلّ ← التالي؛ وفي الآخر «إنهاء».
 */
export function PracticePlayer({ sessionId, questions }: { sessionId: string; questions: PlayerQuestion[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [results, setResults] = useState<Record<string, PracticeAnswerResult>>(() => Object.fromEntries(questions.filter((q) => q.result).map((q) => [q.id, q.result!])))
  const firstOpen = questions.findIndex((q) => !results[q.id])
  const [idx, setIdx] = useState(firstOpen === -1 ? Math.max(0, questions.length - 1) : firstOpen)
  const [draft, setDraft] = useState<Draft>({})
  const q = questions[idx]
  if (!q) return null
  const res = results[q.id]
  const answered = Object.keys(results).length
  const correct = Object.values(results).filter((r) => r.isCorrect).length
  const ready = q.type === 'MCQ' ? (draft.optionIds?.length ?? 0) > 0 : q.type === 'TRUE_FALSE' ? typeof draft.value === 'boolean' : q.type === 'SHORT_ANSWER' ? Boolean(draft.text?.trim()) : q.type === 'FILL_BLANK' ? (draft.blanks ?? []).filter(Boolean).length === q.blanksCount : q.type === 'MATCHING' ? Object.keys(draft.matches ?? {}).length === (q.matching?.lefts.length ?? 0) : false

  const submit = () =>
    start(async () => {
      const r = await answerPracticeAction(sessionId, q.id, draft)
      if (!r.ok) return toast('error', r.error.message)
      setResults((s) => ({ ...s, [q.id]: r.data }))
    })
  const next = () => {
    setDraft({})
    const n = questions.findIndex((x, i) => i > idx && !results[x.id])
    setIdx(n === -1 ? Math.min(idx + 1, questions.length - 1) : n)
  }
  const finish = () =>
    start(async () => {
      const r = await finishPracticeAction(sessionId)
      if (!r.ok) return toast('error', r.error.message)
      router.refresh()
    })
  const last = answered >= questions.length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="tabular">
          السؤال {idx + 1} / {questions.length}
        </span>
        <span className="tabular text-muted-foreground">
          صحيح {correct} من {answered}
        </span>
      </div>
      <Progress value={(answered / questions.length) * 100} tone="success" />

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant={DIFF_AR[q.difficulty]?.variant ?? 'default'}>{DIFF_AR[q.difficulty]?.label}</Badge>
            <Badge variant="muted">{q.points} ن</Badge>
            {q.nodeTitle ? <span className="text-muted-foreground">{q.nodeTitle}</span> : null}
          </div>
          <div className="prose-sm text-[16px] leading-8" dir="auto" dangerouslySetInnerHTML={{ __html: q.bodyHtml }} />

          {q.type === 'MCQ' ? (
            <div className="space-y-1">
              {q.options.map((o) => {
                const chosen = res ? (res.answer?.optionIds as string[] | undefined)?.includes(o.id) : draft.optionIds?.includes(o.id)
                const isRight = res?.correctOptionIds.includes(o.id)
                return (
                  <label key={o.id} className={cn('flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm', !res && chosen && 'border-primary bg-primary/5', res && isRight && 'border-success bg-success/10', res && chosen && !isRight && 'border-destructive bg-destructive/10')}>
                    <input type="checkbox" className="size-4" disabled={Boolean(res)} checked={Boolean(chosen)} onChange={(e) => setDraft((d) => ({ optionIds: e.target.checked ? [...(d.optionIds ?? []), o.id] : (d.optionIds ?? []).filter((x) => x !== o.id) }))} />
                    <span className="flex-1">{o.label}</span>
                    {res && isRight ? <CheckCircle2 className="size-4 text-success" /> : null}
                    {res && chosen && !isRight ? <XCircle className="size-4 text-destructive" /> : null}
                  </label>
                )
              })}
            </div>
          ) : null}
          {q.type === 'TRUE_FALSE' ? (
            <div className="flex gap-2">
              {[true, false].map((v) => (
                <Button key={String(v)} type="button" disabled={Boolean(res)} variant={(res ? res.answer?.value === v : draft.value === v) ? 'default' : 'outline'} onClick={() => setDraft({ value: v })}>
                  {v ? 'صحيح' : 'خطأ'}
                </Button>
              ))}
            </div>
          ) : null}
          {q.type === 'SHORT_ANSWER' ? <Input value={res ? String(res.answer?.text ?? '') : (draft.text ?? '')} disabled={Boolean(res)} onChange={(e) => setDraft({ text: e.target.value })} placeholder="إجابتك" dir="auto" onKeyDown={(e) => { if (e.key === 'Enter' && ready && !res) submit() }} /> : null}
          {q.type === 'FILL_BLANK' ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from({ length: q.blanksCount }).map((_, k) => (
                <Input key={k} disabled={Boolean(res)} value={res ? String((res.answer?.blanks as string[] | undefined)?.[k] ?? '') : (draft.blanks?.[k] ?? '')} onChange={(e) => setDraft((d) => { const b = [...(d.blanks ?? Array(q.blanksCount).fill(''))]; b[k] = e.target.value; return { blanks: b } })} placeholder={`الفراغ ${k + 1}`} dir="auto" />
              ))}
            </div>
          ) : null}
          {q.type === 'MATCHING' && q.matching ? (
            <div className="space-y-2">
              {q.matching.lefts.map((left, k) => (
                <div key={k} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
                  <span className="rounded-md bg-muted px-3 py-2">{left}</span>
                  <span>⟵</span>
                  <Select disabled={Boolean(res)} value={res ? String((res.answer?.matches as Record<string, number> | undefined)?.[String(k)] ?? '') : String(draft.matches?.[String(k)] ?? '')} onChange={(e) => setDraft((d) => ({ matches: { ...(d.matches ?? {}), [String(k)]: Number(e.target.value) } }))}>
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

          {res ? (
            <Alert tone={res.isCorrect ? 'success' : 'destructive'} title={res.isCorrect ? `صحيح — ${res.score} / ${res.points}` : `خطأ — ${res.score} / ${res.points}`}>
              {!res.isCorrect && res.correctText ? (
                <p>
                  الإجابة الصحيحة: <strong dir="auto">{res.correctText}</strong>
                </p>
              ) : null}
              {q.solutionHtml ? <div className="mt-1 text-sm leading-7" dir="auto" dangerouslySetInnerHTML={{ __html: q.solutionHtml }} /> : null}
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            {!res ? (
              <Button onClick={submit} loading={pending} disabled={!ready}>
                تحقّق
              </Button>
            ) : last ? (
              <Button onClick={finish} loading={pending}>
                <Flag className="size-4" /> إنهاء وعرض النتيجة
              </Button>
            ) : (
              <Button onClick={next}>
                التالي <ArrowLeft className="size-4" />
              </Button>
            )}
            {!last && !res ? (
              <Button variant="ghost" size="sm" onClick={finish} loading={pending}>
                إنهاء الآن
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
