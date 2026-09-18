'use client'

import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Alert } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { saveQuizAction, type QuizPayload } from '@/server/actions/quizzes.actions'
import { QUESTION_TYPES } from '@/server/db/schema/enums'
import type { QuestionState } from '@/lib/quiz-state'

type Opt = { id: string; name: string }

export interface QuizBuilderDefaults {
  title?: string
  description?: string | null
  topic?: string | null
  skillId?: string | null
  timeLimitMinutes?: number | null
  maxAttempts?: number
  dueAt?: Date | null
  isPublic?: boolean
  published?: boolean
  groupIds?: string[]
  studentIds?: string[]
  questions?: QuestionState[]
}

const typeLabel = (type: string) => (t(`quizzes.type${type}` as never) as string) || type

let seq = 0
export function newQuestion(type = 'MCQ'): QuestionState {
  return { key: `q${++seq}${Date.now()}`, type, prompt: '', points: 1, skillId: '', imageFileId: '', options: [{ label: '', isCorrect: true }, { label: '', isCorrect: false }], tfValue: true, accepted: '', blanks: '', pairs: '' }
}

function toPayloadQuestion(q: QuestionState): NonNullable<QuizPayload['questions']>[number] {
  const lines = (s: string) => s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
  let answerKey: Record<string, unknown> | null = null
  let options: { label: string; isCorrect: boolean }[] = []
  switch (q.type) {
    case 'MCQ':
    case 'IMAGE':
      options = q.options.filter((o) => o.label.trim())
      break
    case 'TRUE_FALSE':
      answerKey = { value: q.tfValue }
      break
    case 'SHORT_ANSWER':
      answerKey = { accepted: lines(q.accepted) }
      break
    case 'FILL_BLANK':
      answerKey = { blanks: lines(q.blanks).map((l) => l.split('|').map((x) => x.trim()).filter(Boolean)) }
      break
    case 'MATCHING':
      answerKey = {
        pairs: lines(q.pairs)
          .map((l) => l.split('='))
          .filter((p) => p.length >= 2)
          .map((p) => ({ left: p[0]!.trim(), right: p.slice(1).join('=').trim() }))
      }
      break
  }
  return { id: q.id, type: q.type as (typeof QUESTION_TYPES)[number], prompt: q.prompt, points: q.points, skillId: q.skillId || null, imageFileId: q.imageFileId || null, answerKey, options }
}

function toLocal(d: Date | null | undefined) {
  if (!d) return ''
  const x = new Date(d)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`
}

export function QuizBuilder({ quizId, defaults = {}, groups, students, skills, files, hasAttempts = false }: { quizId?: string; defaults?: QuizBuilderDefaults; groups: Opt[]; students: Opt[]; skills: Opt[]; files: Opt[]; hasAttempts?: boolean }) {
  const router = useRouter()
  const [meta, setMeta] = useState({
    title: defaults.title ?? '',
    description: defaults.description ?? '',
    topic: defaults.topic ?? '',
    skillId: defaults.skillId ?? '',
    timeLimitMinutes: defaults.timeLimitMinutes ?? ('' as number | ''),
    maxAttempts: defaults.maxAttempts ?? 1,
    dueAt: toLocal(defaults.dueAt),
    isPublic: defaults.isPublic ?? false,
    publish: defaults.published ?? true
  })
  const [groupIds, setGroupIds] = useState<string[]>(defaults.groupIds ?? [])
  const [studentIds, setStudentIds] = useState<string[]>(defaults.studentIds ?? [])
  const [questions, setQuestions] = useState<QuestionState[]>(defaults.questions?.length ? defaults.questions : [newQuestion()])
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const total = questions.reduce((s, q) => s + (Number.isFinite(q.points) ? q.points : 0), 0)

  const update = (i: number, patch: Partial<QuestionState>) => setQuestions((l) => l.map((q, j) => (j === i ? { ...q, ...patch } : q)))
  const move = (i: number, dir: -1 | 1) =>
    setQuestions((l) => {
      const j = i + dir
      if (j < 0 || j >= l.length) return l
      const copy = [...l]
      ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
      return copy
    })

  const submit = () => {
    setError(null)
    start(async () => {
      const payload: QuizPayload = {
        title: meta.title,
        description: meta.description || null,
        topic: meta.topic || null,
        skillId: meta.skillId || null,
        timeLimitMinutes: meta.timeLimitMinutes === '' ? null : Number(meta.timeLimitMinutes),
        maxAttempts: meta.maxAttempts,
        dueAt: meta.dueAt || null,
        isPublic: meta.isPublic,
        publish: meta.publish,
        groupIds,
        studentIds,
        questions: hasAttempts ? undefined : questions.map(toPayloadQuestion)
      }
      const r = await saveQuizAction(quizId ?? null, payload)
      if (!r.ok) setError(r.error.message + (r.error.fieldErrors ? ' — ' + Object.values(r.error.fieldErrors).join('، ') : ''))
      else {
        toast('success', quizId ? t('quizzes.saved') : t('quizzes.created'))
        router.push(`/teacher/quizzes/${r.data.id}`)
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-6">
          <Field label={t('quizzes.titleField')} htmlFor="title">
            <Input id="title" value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} required />
          </Field>
          <Field label={t('quizzes.description')} htmlFor="description">
            <Textarea id="description" rows={2} value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('quizzes.topic')} htmlFor="topic">
              <Input id="topic" value={meta.topic} onChange={(e) => setMeta({ ...meta, topic: e.target.value })} />
            </Field>
            <Field label={t('quizzes.skill')} htmlFor="skillId">
              <Select id="skillId" value={meta.skillId} onChange={(e) => setMeta({ ...meta, skillId: e.target.value })}>
                <option value="">—</option>
                {skills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('quizzes.timeLimit')} htmlFor="timeLimit">
              <Input id="timeLimit" type="number" min={1} max={300} value={meta.timeLimitMinutes} onChange={(e) => setMeta({ ...meta, timeLimitMinutes: e.target.value === '' ? '' : Number(e.target.value) })} dir="ltr" />
            </Field>
            <Field label={t('quizzes.maxAttempts')} htmlFor="maxAttempts">
              <Input id="maxAttempts" type="number" min={1} max={10} value={meta.maxAttempts} onChange={(e) => setMeta({ ...meta, maxAttempts: Number(e.target.value) })} dir="ltr" />
            </Field>
            <Field label={t('quizzes.dueAt')} htmlFor="dueAt">
              <Input id="dueAt" type="datetime-local" value={meta.dueAt} onChange={(e) => setMeta({ ...meta, dueAt: e.target.value })} dir="ltr" />
            </Field>
            <div className="flex flex-col justify-end gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={meta.isPublic} onChange={(e) => setMeta({ ...meta, isPublic: e.target.checked })} className="size-4" /> {t('quizzes.isPublic')}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={meta.publish} onChange={(e) => setMeta({ ...meta, publish: e.target.checked })} className="size-4" /> {t('quizzes.publish')}
              </label>
            </div>
          </div>
          {!meta.isPublic ? (
            <fieldset className="rounded-lg border p-4">
              <legend className="px-1 text-sm font-bold">{t('assignments.targets')}</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  {groups.map((g) => (
                    <label key={g.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={groupIds.includes(g.id)} onChange={(e) => setGroupIds((l) => (e.target.checked ? [...l, g.id] : l.filter((x) => x !== g.id)))} className="size-4" />
                      {g.name}
                    </label>
                  ))}
                </div>
                <select multiple value={studentIds} onChange={(e) => setStudentIds([...e.target.selectedOptions].map((o) => o.value))} className="h-32 w-full rounded-md border bg-background p-2 text-sm">
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </fieldset>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold">
          {t('quizzes.questions')} ({questions.length}) · {t('quizzes.points')}: <span className="tabular">{total}</span>
        </h2>
        {!hasAttempts ? (
          <Button type="button" variant="outline" onClick={() => setQuestions((l) => [...l, newQuestion()])}>
            <Plus className="size-4" /> {t('quizzes.addQuestion')}
          </Button>
        ) : null}
      </div>
      {hasAttempts ? <Alert tone="warning">{t('errors.QUIZ_HAS_ATTEMPTS')}</Alert> : null}

      {questions.map((q, i) => (
        <Card key={q.key} className={hasAttempts ? 'opacity-70' : undefined}>
          <CardContent className="space-y-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
              <Select value={q.type} onChange={(e) => update(i, { type: e.target.value })} className="w-auto" disabled={hasAttempts}>
                {QUESTION_TYPES.map((tp) => (
                  <option key={tp} value={tp}>
                    {typeLabel(tp)}
                  </option>
                ))}
              </Select>
              <Input type="number" min={0.5} step="0.5" value={q.points} onChange={(e) => update(i, { points: Number(e.target.value) })} className="w-20" dir="ltr" title={t('quizzes.points')} disabled={hasAttempts} />
              <Select value={q.skillId} onChange={(e) => update(i, { skillId: e.target.value })} className="w-auto" disabled={hasAttempts}>
                <option value="">{t('assignments.skill')}: —</option>
                {skills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <div className="ms-auto flex gap-1">
                <Button type="button" size="icon" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0 || hasAttempts} aria-label="أعلى">
                  <ChevronUp className="size-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" onClick={() => move(i, 1)} disabled={i === questions.length - 1 || hasAttempts} aria-label="أسفل">
                  <ChevronDown className="size-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" onClick={() => setQuestions((l) => l.filter((_, j) => j !== i))} disabled={hasAttempts} aria-label={t('quizzes.removeQuestion')}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
            <Textarea value={q.prompt} onChange={(e) => update(i, { prompt: e.target.value })} placeholder={q.type === 'FILL_BLANK' ? 'مثال: الاستعارة ___ حُذف فيها المشبه به.' : t('quizzes.prompt')} rows={2} disabled={hasAttempts} />
            {q.type === 'IMAGE' ? (
              <Select value={q.imageFileId} onChange={(e) => update(i, { imageFileId: e.target.value })} disabled={hasAttempts}>
                <option value="">{t('quizzes.imageFile')}: —</option>
                {files.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            ) : null}
            {q.type === 'MCQ' || q.type === 'IMAGE' ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">{t('quizzes.options')} — علّم الصحيح</p>
                {q.options.map((o, k) => (
                  <div key={k} className="flex items-center gap-2">
                    <input type="checkbox" checked={o.isCorrect} onChange={(e) => update(i, { options: q.options.map((x, m) => (m === k ? { ...x, isCorrect: e.target.checked } : x)) })} className="size-4" title={t('quizzes.correct')} disabled={hasAttempts} />
                    <Input value={o.label} onChange={(e) => update(i, { options: q.options.map((x, m) => (m === k ? { ...x, label: e.target.value } : x)) })} placeholder={`اختيار ${k + 1}`} disabled={hasAttempts} />
                    <Button type="button" size="icon" variant="ghost" onClick={() => update(i, { options: q.options.filter((_, m) => m !== k) })} disabled={hasAttempts} aria-label={t('common.delete')}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" size="sm" variant="ghost" onClick={() => update(i, { options: [...q.options, { label: '', isCorrect: false }] })} disabled={hasAttempts}>
                  <Plus className="size-4" /> {t('quizzes.addOption')}
                </Button>
              </div>
            ) : null}
            {q.type === 'TRUE_FALSE' ? (
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={q.tfValue} onChange={() => update(i, { tfValue: true })} disabled={hasAttempts} /> {t('quizzes.trueLabel')}
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={!q.tfValue} onChange={() => update(i, { tfValue: false })} disabled={hasAttempts} /> {t('quizzes.falseLabel')}
                </label>
              </div>
            ) : null}
            {q.type === 'SHORT_ANSWER' ? <Textarea value={q.accepted} onChange={(e) => update(i, { accepted: e.target.value })} placeholder={t('quizzes.acceptedAnswers')} rows={2} disabled={hasAttempts} /> : null}
            {q.type === 'FILL_BLANK' ? <Textarea value={q.blanks} onChange={(e) => update(i, { blanks: e.target.value })} placeholder={t('quizzes.blanksHint')} rows={3} disabled={hasAttempts} /> : null}
            {q.type === 'MATCHING' ? <Textarea value={q.pairs} onChange={(e) => update(i, { pairs: e.target.value })} placeholder={t('quizzes.pairsHint')} rows={3} dir="rtl" disabled={hasAttempts} /> : null}
            {q.type === 'LONG_ANSWER' ? <p className="text-xs text-muted-foreground">{t('quizzes.longAnswerHint')}</p> : null}
          </CardContent>
        </Card>
      ))}

      {error ? <Alert tone="destructive">{error}</Alert> : null}
      <div className="flex gap-2">
        <Button type="button" size="lg" onClick={submit} loading={pending}>
          {t('common.save')}
        </Button>
      </div>
    </div>
  )
}
