'use client'

import { ArrowDown, ArrowUp, BookOpenText, Check, ChevronLeft, ChevronRight, Eye, Flag, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createContext, useContext, useMemo, useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { finishExamAttemptAction, submitExamStepAction } from '@/server/actions/play-exams.actions'
import { PLAY_MATH_SUBJECTS } from '@/server/play/constants'
import type { StepExcerpt } from '@/server/play/exams/excerpt'
import type { PublicStep, SourceDocument, StepAnswer } from '@/server/play/exams/types'
import type { AttemptView, StepFeedback } from '@/server/services/play-exams.service'
import { DECK_BUTTON } from '../deck-ui'
import { RichText } from '../rich-text'

const LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح']
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''))

/** يُفعَّل في مواضيع المواد العلمية: نص فيه $…$ يُعرض معادلةً (KaTeX) */
export const MathContext = createContext(false)

function T({ text }: { text: string }) {
  const math = useContext(MathContext)
  return math && text.includes('$') ? <RichText text={text} /> : <>{text}</>
}

/** للصفحات الخادمية (النتيجة، مراجعة الإدارة): نطاق المعادلات + نص يحترمه */
export function MathScope({ on, children }: { on: boolean; children: React.ReactNode }) {
  return <MathContext.Provider value={on}>{children}</MathContext.Provider>
}
export { T as ExamText }

/* ───────────────────────────── الوثائق ───────────────────────────── */

function DocumentView({ doc }: { doc: SourceDocument }) {
  const verse = doc.table && doc.table.every((r) => r.length === 3 && /^\d+\s*-?$/.test(r[0]!.trim()))
  return (
    <figure className="space-y-2">
      <figcaption className="text-xs font-bold text-[#5B6B88]">{doc.caption}</figcaption>
      {doc.text ? (
        <p className="whitespace-pre-line text-[0.98rem] leading-loose text-[#172B50]">
          <T text={doc.text} />
        </p>
      ) : null}
      {doc.table && verse ? (
        <ol className="space-y-2" data-testid="exam-poem">
          {doc.table.map((r, i) => (
            <li key={i} className="grid grid-cols-[1.75rem_1fr] items-start gap-2 rounded-xl bg-[#F5F8FF] px-2 py-2 sm:grid-cols-[1.75rem_1fr_1fr]">
              <span className="pt-0.5 text-center text-xs font-extrabold text-[#1457C5]">{r[0]!.replace('-', '')}</span>
              <span className="text-[1.02rem] font-bold leading-loose text-[#172B50]">{r[1]}</span>
              <span className="col-start-2 text-[1.02rem] font-bold leading-loose text-[#172B50] sm:col-start-3">{r[2]}</span>
            </li>
          ))}
        </ol>
      ) : doc.table ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <tbody>
              {doc.table.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j} className="border border-[#D3E0F5] px-2 py-1.5 text-[#172B50]">
                      <T text={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {doc.media ? (
        // صورة حقيقية محلية بإسنادها (لا خلفية CSS ولا بديل رمادي)
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={doc.media.local_path} alt={doc.media.alt} className="max-h-80 w-full rounded-xl object-contain" />
          <p className="mt-1 text-[0.7rem] text-[#5B6B88]">
            {doc.media.attribution} — {doc.media.license}
          </p>
        </div>
      ) : null}
    </figure>
  )
}

/** الأبيات أو الجمل التي يحيل إليها السؤال — تحت السؤال مباشرة (يُحسب في الخادم من نصّ الموضوع) */
export function StepExcerptView({ excerpt }: { excerpt: StepExcerpt | null }) {
  if (!excerpt) return null
  return (
    <div className="mt-3 rounded-2xl border border-[#D3E0F5] bg-[#F5F8FF] p-3" data-testid="exam-excerpt">
      <p className="mb-1.5 text-[0.72rem] font-bold text-[#5B6B88]">{excerpt.kind === 'verses' ? (excerpt.rows.length > 1 ? 'الأبيات المقصودة' : 'البيت المقصود') : 'من النصّ'}</p>
      {excerpt.kind === 'verses' ? (
        <ol className="space-y-1.5">
          {excerpt.rows.map((r) => (
            <li key={r.n} className="grid grid-cols-[1.5rem_1fr] items-start gap-2 sm:grid-cols-[1.5rem_1fr_1fr]">
              <span className="pt-0.5 text-center text-xs font-extrabold text-[#1457C5]">{r.n}</span>
              <span className="text-[0.98rem] font-bold leading-loose text-[#172B50]">{r.a}</span>
              {r.b ? <span className="col-start-2 text-[0.98rem] font-bold leading-loose text-[#172B50] sm:col-start-3">{r.b}</span> : null}
            </li>
          ))}
        </ol>
      ) : (
        <div className="space-y-2">
          {excerpt.parts.map((t, i) => (
            <p key={i} className="text-[0.95rem] leading-loose text-[#172B50]">
              {t}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

export function Documents({ docs }: { docs: SourceDocument[] }) {
  if (!docs.length) return <p className="text-sm text-[#5B6B88]">لا وثيقة مرفقة بهذا السؤال.</p>
  return (
    <div className="space-y-5">
      {docs.map((d) => (
        <DocumentView key={d.id} doc={d} />
      ))}
    </div>
  )
}

/* ───────────────────────────── التفاعلات ───────────────────────────── */

type Draft =
  | { type: 'mcq' | 'portrait'; choice: number | null }
  | { type: 'multi'; choices: number[] }
  | { type: 'fill_blank'; blanks: (string | null)[] }
  | { type: 'ordering'; order: number[] }
  | { type: 'matching'; pairs: number[] }
  | { type: 'numeric'; value: string }
  | { type: 'short_text'; text: string }

function emptyDraft(step: PublicStep): Draft {
  const p = step.payload
  switch (p.type) {
    case 'mcq':
    case 'portrait':
      return { type: p.type, choice: null }
    case 'multi':
      return { type: 'multi', choices: [] }
    case 'fill_blank':
      return { type: 'fill_blank', blanks: Array((p.text.match(/____/g) ?? []).length).fill(null) }
    case 'ordering':
      return { type: 'ordering', order: p.items.map((_, i) => i) }
    case 'matching':
      return { type: 'matching', pairs: p.lefts.map(() => -1) }
    case 'numeric':
      return { type: 'numeric', value: '' }
    default:
      return { type: 'short_text', text: '' }
  }
}

function toAnswer(d: Draft): StepAnswer | null {
  switch (d.type) {
    case 'mcq':
    case 'portrait':
      return d.choice === null ? null : { type: d.type, choice: d.choice }
    case 'multi':
      return d.choices.length ? { type: 'multi', choices: [...d.choices].sort((a, b) => a - b) } : null
    case 'fill_blank':
      return d.blanks.every((b) => b) ? { type: 'fill_blank', blanks: d.blanks as string[] } : null
    case 'ordering':
      return { type: 'ordering', order: d.order }
    case 'matching':
      return d.pairs.every((x) => x >= 0) ? { type: 'matching', pairs: d.pairs } : null
    case 'numeric': {
      const v = Number(d.value.replace(',', '.'))
      return d.value.trim() && Number.isFinite(v) ? { type: 'numeric', value: v } : null
    }
    case 'short_text':
      return d.text.trim() ? { type: 'short_text', text: d.text.trim() } : null
  }
}

type RowState = 'idle' | 'picked' | 'locked' | 'correct' | 'wrong' | 'dim'

/** حالة الخيار بعد التصحيح (كما في بطاقات PLAY): الصحيح أخضر، المختار الخاطئ أحمر، والباقي باهت */
function rowState(text: string, picked: boolean, locked: boolean, correctSet: Set<string> | null): RowState {
  if (correctSet) return correctSet.has(text) ? 'correct' : picked ? 'wrong' : 'dim'
  return picked ? 'picked' : locked ? 'locked' : 'idle'
}

function OptionRow({ label, text, state, onClick, disabled, role, checked }: { label: string; text: string; state: RowState; onClick: () => void; disabled: boolean; role: 'radio' | 'checkbox'; checked: boolean }) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={checked}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex min-h-12 w-full items-center gap-3 rounded-[1.4rem] border-[1.5px] px-3 py-2 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1457C5]/40 disabled:cursor-default',
        state === 'picked' && 'border-[#6E9DEB] bg-[#D5E4FC]',
        (state === 'idle' || state === 'locked') && 'border-[#C9D7EE] bg-white hover:border-[#8FAAFF] hover:bg-[#F3F7FF]',
        state === 'locked' && 'opacity-70',
        state === 'correct' && 'border-[#8FD4A0] bg-[#E6F7EA]',
        state === 'wrong' && 'border-[#EBA9A9] bg-[#FDEDED]',
        state === 'dim' && 'border-[#DCE4F2] bg-white opacity-50'
      )}
      data-state={state}
    >
      <span className={cn('flex size-7 shrink-0 items-center justify-center border-[1.5px] text-sm font-bold', role === 'checkbox' ? 'rounded-md' : 'rounded-full', state === 'correct' ? 'border-[#8FD4A0] bg-white text-[#15803D]' : state === 'wrong' ? 'border-[#EBA9A9] bg-white text-[#B91C1C]' : checked ? 'border-[#6E9DEB] bg-white text-[#1457C5]' : 'border-[#BFCDE6] text-[#3B4C6B]')}>
        {state === 'correct' ? <Check className="size-4" aria-hidden /> : state === 'wrong' ? <X className="size-4" aria-hidden /> : role === 'checkbox' && checked ? <Check className="size-4" aria-hidden /> : label}
      </span>
      <span className="flex-1 text-[1rem] font-bold leading-relaxed text-[#172B50]">
        <T text={text} />
      </span>
    </button>
  )
}

function Interaction({ step, draft, setDraft, locked, feedback }: { step: PublicStep; draft: Draft; setDraft: (d: Draft) => void; locked: boolean; feedback: StepFeedback | null }) {
  const p = step.payload
  // في التدريب: بعد التصحيح تُلوَّن الاختيارات (نص الإجابة الصحيحة من الخادم بعد الإرسال فقط)
  const correctSet = feedback ? new Set(p.type === 'multi' ? feedback.correctText.split(' ، ') : [feedback.correctText]) : null
  if ((p.type === 'mcq' || p.type === 'portrait') && (draft.type === 'mcq' || draft.type === 'portrait')) {
    return (
      <div className="space-y-3">
        {p.type === 'portrait' ? (
          <div className="mx-auto w-48 overflow-hidden rounded-2xl border border-[#D3E0F5] bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img data-testid="portrait-img" src={p.media.local_path} alt={p.media.alt} width={p.media.width ?? 384} height={p.media.height ?? 480} className="aspect-[4/5] w-full object-cover object-top" />
            <p className="px-2 py-1 text-[0.65rem] leading-snug text-[#5B6B88]">
              {p.media.attribution} — {p.media.license}
            </p>
          </div>
        ) : null}
        <div className="space-y-2.5" role="radiogroup" aria-label="الاختيارات">
          {p.options.map((o, i) => (
            <OptionRow key={i} label={LETTERS[i]!} text={o} role="radio" checked={draft.choice === i} state={rowState(o, draft.choice === i, locked, correctSet)} disabled={locked} onClick={() => setDraft({ ...draft, choice: i })} />
          ))}
        </div>
      </div>
    )
  }
  if (p.type === 'multi' && draft.type === 'multi') {
    return (
      <div className="space-y-2.5" role="group" aria-label="اختر كل الإجابات الصحيحة">
        <p className="text-xs font-bold text-[#5B6B88]">اختر كل ما ينطبق</p>
        {p.options.map((o, i) => {
          const on = draft.choices.includes(i)
          return <OptionRow key={i} label={LETTERS[i]!} text={o} role="checkbox" checked={on} state={rowState(o, on, locked, correctSet)} disabled={locked} onClick={() => setDraft({ type: 'multi', choices: on ? draft.choices.filter((c) => c !== i) : [...draft.choices, i] })} />
        })}
      </div>
    )
  }
  if (p.type === 'fill_blank' && draft.type === 'fill_blank') {
    const parts = p.text.split('____')
    const used = new Set(draft.blanks.filter(Boolean))
    const place = (w: string) => {
      const at = draft.blanks.findIndex((b) => !b)
      if (at < 0) return
      const next = [...draft.blanks]
      next[at] = w
      setDraft({ type: 'fill_blank', blanks: next })
    }
    return (
      <div className="space-y-4">
        <p className="text-[1.05rem] font-bold leading-[2.4] text-[#172B50]">
          {parts.map((part, i) => (
            <span key={i}>
              <T text={part} />
              {i < parts.length - 1 ? (
                <button
                  type="button"
                  disabled={locked || !draft.blanks[i]}
                  onClick={() => {
                    const next = [...draft.blanks]
                    next[i] = null
                    setDraft({ type: 'fill_blank', blanks: next })
                  }}
                  aria-label={draft.blanks[i] ? `إزالة «${draft.blanks[i]}»` : `فراغ ${i + 1}`}
                  className={cn('mx-1 inline-flex min-h-9 min-w-[4.5rem] items-center justify-center rounded-lg border-b-2 px-2 align-middle', draft.blanks[i] ? 'border-[#1457C5] bg-[#D5E4FC] text-[#1B3F8F]' : 'border-[#8FAAFF] bg-[#F3F7FF] text-transparent')}
                >
                  {draft.blanks[i] ? <T text={draft.blanks[i]!} /> : '…'}
                </button>
              ) : null}
            </span>
          ))}
        </p>
        <div className="flex flex-wrap gap-2" aria-label="بنك الكلمات">
          {p.bank.map((w, i) => (
            <button key={i} type="button" disabled={locked || used.has(w)} onClick={() => place(w)} className="min-h-10 rounded-full border-[1.5px] border-[#C9D7EE] bg-white px-4 text-[0.98rem] font-bold text-[#172B50] hover:border-[#8FAAFF] disabled:opacity-35">
              <T text={w} />
            </button>
          ))}
        </div>
      </div>
    )
  }
  if (p.type === 'matching' && draft.type === 'matching') {
    return (
      <div className="space-y-3">
        {p.lefts.map((l, i) => (
          <label key={i} className="block rounded-2xl border border-[#D3E0F5] bg-white p-3">
            <span className="block text-[0.98rem] font-extrabold text-[#172B50]">
              <T text={l} />
            </span>
            <select
              disabled={locked}
              value={draft.pairs[i]}
              onChange={(e) => {
                const next = [...draft.pairs]
                next[i] = Number(e.target.value)
                setDraft({ type: 'matching', pairs: next })
              }}
              className="mt-2 min-h-11 w-full rounded-xl border-[1.5px] border-[#C9D7EE] bg-[#F8FAFF] px-3 text-[0.95rem] font-bold text-[#172B50]"
            >
              <option value={-1}>اختر ما يناسبه…</option>
              {p.rights.map((r, j) => (
                <option key={j} value={j}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    )
  }
  if (p.type === 'ordering' && draft.type === 'ordering') {
    const move = (pos: number, dir: -1 | 1) => {
      const next = [...draft.order]
      const t = pos + dir
      if (t < 0 || t >= next.length) return
      ;[next[pos], next[t]] = [next[t]!, next[pos]!]
      setDraft({ type: 'ordering', order: next })
    }
    return (
      <ol className="space-y-2">
        {draft.order.map((itemIdx, pos) => (
          <li key={itemIdx} className="flex items-center gap-2 rounded-2xl border border-[#D3E0F5] bg-white p-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#EEF4FF] text-sm font-extrabold text-[#1457C5]">{pos + 1}</span>
            <span className="flex-1 text-[0.98rem] font-bold text-[#172B50]">
              <T text={p.items[itemIdx]!} />
            </span>
            <button type="button" disabled={locked || pos === 0} onClick={() => move(pos, -1)} aria-label="إلى الأعلى" className="flex size-10 items-center justify-center rounded-full border border-[#C9D7EE] disabled:opacity-30">
              <ArrowUp className="size-4" aria-hidden />
            </button>
            <button type="button" disabled={locked || pos === draft.order.length - 1} onClick={() => move(pos, 1)} aria-label="إلى الأسفل" className="flex size-10 items-center justify-center rounded-full border border-[#C9D7EE] disabled:opacity-30">
              <ArrowDown className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ol>
    )
  }
  if (p.type === 'numeric' && draft.type === 'numeric') {
    return (
      <label className="flex items-center gap-2">
        <input inputMode="decimal" dir="ltr" disabled={locked} value={draft.value} onChange={(e) => setDraft({ type: 'numeric', value: e.target.value })} className="min-h-12 flex-1 rounded-xl border-[1.5px] border-[#C9D7EE] bg-white px-3 text-lg font-bold text-[#172B50]" aria-label="الجواب العددي" />
        {p.unit ? <span className="text-sm font-bold text-[#3B4C6B]">{p.unit}</span> : null}
      </label>
    )
  }
  if (p.type === 'short_text' && draft.type === 'short_text') {
    return <input disabled={locked} value={draft.text} onChange={(e) => setDraft({ type: 'short_text', text: e.target.value })} className="min-h-12 w-full rounded-xl border-[1.5px] border-[#C9D7EE] bg-white px-3 text-[1rem] font-bold text-[#172B50]" aria-label="جوابك" />
  }
  return <p className="text-sm text-[#5B6B88]">هذا النوع غير مدعوم في الواجهة بعد.</p>
}

function FeedbackBox({ fb, lang }: { fb: StepFeedback; lang: AttemptView['set']['lang'] }) {
  const dir = lang === 'ar' ? undefined : 'ltr'
  return (
    <div data-testid="exam-feedback" data-correct={fb.correct ? '1' : '0'} className={cn('rounded-2xl border-[1.5px] p-4', fb.correct ? 'border-[#8FD4A0] bg-[#E6F7EA]' : fb.s > 0 ? 'border-[#F2CF8A] bg-[#FFF8E6]' : 'border-[#EBA9A9] bg-[#FDEDED]')}>
      <p className="flex items-center gap-2 text-[1.05rem] font-extrabold text-[#172B50]">
        {fb.correct ? <Check className="size-5 text-[#15803D]" aria-hidden /> : <X className="size-5 text-[#B91C1C]" aria-hidden />}
        {fb.correct ? 'إجابة صحيحة' : fb.s > 0 ? 'إجابة صحيحة جزئيًا' : 'إجابة غير صحيحة'}
        <span className="ms-auto rounded-full bg-white px-2.5 py-0.5 text-sm font-extrabold text-[#1457C5]">
          <bdi dir="ltr">
            {fmt(fb.earned)} / {fmt(fb.w)}
          </bdi>{' '}
          ن
        </span>
      </p>
      {!fb.correct ? (
        <p className="mt-2 text-sm font-bold text-[#172B50]">
          الإجابة الصحيحة:{' '}
          <bdi dir={dir} lang={lang} className="font-extrabold">
            <T text={fb.correctText} />
          </bdi>
        </p>
      ) : null}
      <p dir={dir} lang={lang} className="mt-2 text-sm font-medium leading-relaxed text-[#3B4C6B]">
        <T text={fb.explanation} />
      </p>
    </div>
  )
}

/* ───────────────────────────── المشغّل ───────────────────────────── */

export function ExamRunner({ view }: { view: AttemptView }) {
  /** الفرنسية والإنجليزية: المحتوى من اليسار إلى اليمين، والواجهة عربية */
  const dir = view.set.lang === 'ar' ? undefined : 'ltr'
  const router = useRouter()
  const [steps, setSteps] = useState(view.steps)
  const totalSteps = view.totalSteps
  const [answered, setAnswered] = useState(view.answered)
  const [score, setScore] = useState(view.score)
  const firstOpen = Math.max(0, steps.findIndex((s) => !view.answered[s.id]))
  const [index, setIndex] = useState(Object.keys(view.answered).length ? firstOpen : -1)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [docsOpen, setDocsOpen] = useState(false)
  const [pending, start] = useTransition()
  const practice = view.mode === 'PRACTICE'
  const step = index >= 0 ? steps[index] : undefined
  const draft = step ? (drafts[step.id] ?? emptyDraft(step)) : null
  const done = steps.filter((s) => answered[s.id]).length
  const docs = useMemo(() => {
    const seen = new Map<string, SourceDocument>()
    for (const s of steps) for (const d of s.source_question.documents) if (!seen.has(d.id)) seen.set(d.id, d)
    return [...seen.values()]
  }, [steps])
  const kindLabel = view.set.kind === 'BAC' ? 'بكالوريا' : view.set.kind === 'TEST' ? 'اختبار' : 'فرض'

  const submit = () => {
    if (!step || !draft) return
    const a = toAnswer(draft)
    if (!a) {
      toast('error', 'أكمل إجابتك أولًا')
      return
    }
    start(async () => {
      const r = await submitExamStepAction({ attemptId: view.attemptId, stepId: step.id, answer: a })
      if (!r.ok) {
        toast('error', r.error.message)
        if (r.error.code === 'PLAY_TRIAL_EXPIRED' || r.error.code === 'PLAY_TRIAL_REQUIRED') router.push(view.set.kind === 'BAC' ? '/student/play/bac' : '/student/play/exams')
        else if (r.error.code === 'PLAY_EXAM_CLOSED') router.refresh()
        return
      }
      setAnswered((m) => ({ ...m, [step.id]: { earned: r.data.feedback?.earned ?? 0, w: step.points, feedback: r.data.feedback } }))
      if (r.data.score !== null) setScore(r.data.score)
      // الخادم يكشف الخطوة التالية بعد الإجابة فقط
      const nx = r.data.next
      if (nx) setSteps((list) => (list.some((x) => x.id === nx.id) ? list : [...list, nx]))
      if (!practice) setIndex((i) => (nx ? i + 1 : i))
    })
  }
  const finish = () =>
    start(async () => {
      const r = await finishExamAttemptAction(view.attemptId)
      if (!r.ok) {
        toast('error', r.error.message)
        return
      }
      router.push(`/student/play/exam/${view.attemptId}/result`)
    })

  return (
    <MathContext.Provider value={PLAY_MATH_SUBJECTS.includes(view.set.subjectCode)}>
      <div className="play-deck mx-auto max-w-xl space-y-4 pb-28">
      <header className="rounded-2xl border border-[#D3E0F5] bg-white p-4">
        <p className="text-xs font-bold text-[#5B6B88]">
          {kindLabel} · {practice ? 'تدريب بتصحيح فوري' : 'محاكاة امتحان — التصحيح في النهاية'}
        </p>
        <h1 className="mt-1 text-[1.1rem] font-extrabold leading-snug text-[#172B50]">{view.set.title}</h1>
        {view.preview ? (
          <p data-testid="exam-preview-badge" className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#FFF4D6] px-2.5 py-1 text-[0.72rem] font-bold text-[#8A5A00]">
            <Eye className="size-3.5" aria-hidden /> معاينة تطوير — لم يراجعها الأستاذ بعد
          </p>
        ) : null}
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#E3EBF8]" role="progressbar" aria-valuemin={0} aria-valuemax={totalSteps} aria-valuenow={done} aria-label="التقدم">
            <div className="h-full rounded-full bg-gradient-to-l from-[#3B83F0] to-[#1457C5] transition-[width]" style={{ width: `${(done / Math.max(1, totalSteps)) * 100}%` }} />
          </div>
          <span className="text-xs font-extrabold text-[#1457C5]">
            <bdi dir="ltr">
              {done}/{totalSteps}
            </bdi>
          </span>
          {practice ? (
            <span data-testid="exam-score" className="rounded-full bg-[#EEF4FF] px-2.5 py-0.5 text-xs font-extrabold text-[#1457C5]">
              <bdi dir="ltr">
                {fmt(score)} / {fmt(view.maxScore)}
              </bdi>
            </span>
          ) : null}
        </div>
      </header>

      {index < 0 ? (
        <section className="space-y-4 rounded-2xl border border-[#D3E0F5] bg-white p-4" aria-labelledby="read-first">
          <h2 id="read-first" className="flex items-center gap-2 text-[1.05rem] font-extrabold text-[#1B4DB1]">
            <BookOpenText className="size-5" aria-hidden /> اقرأ النصّ أولًا
          </h2>
          <div dir={dir} lang={view.set.lang}>
            <Documents docs={docs} />
          </div>
          <p className="rounded-xl bg-[#F5F8FF] p-3 text-sm font-medium leading-relaxed text-[#3B4C6B]">
            ستجيب عن أسئلة الموضوع خطوة خطوة. كل خطوة مأخوذة من عنصر في سلّم التنقيط الأصلي وتحمل علامته. {view.deferred.length ? `الإنتاج الكتابي (${fmt(view.deferred.reduce((a, d) => a + d.points, 0))} ن) يُصحَّح بشبكة التقويم ولا يدخل في التصحيح الآلي.` : ''}
          </p>
          <button type="button" className={DECK_BUTTON} onClick={() => setIndex(0)} data-testid="exam-begin">
            ابدأ الإجابة <ChevronLeft className="size-6" strokeWidth={3} aria-hidden />
          </button>
        </section>
      ) : step && draft ? (
        <section className="space-y-4" aria-live="polite">
          <div className="rounded-2xl border border-[#D3E0F5] bg-white p-4">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#EEF4FF] px-2.5 py-0.5 text-xs font-extrabold text-[#1457C5]">
                السؤال الأصلي {step.source_question.number}
              </span>
              <span className="truncate text-xs font-bold text-[#5B6B88]">{step.source_question.part}</span>
              <button type="button" onClick={() => setDocsOpen(true)} className="ms-auto inline-flex min-h-9 items-center gap-1 rounded-full border border-[#C9D7EE] px-3 text-xs font-bold text-[#1457C5]" data-testid="exam-open-docs">
                <BookOpenText className="size-4" aria-hidden /> النصّ
              </button>
            </div>
            <p dir={dir} lang={view.set.lang} className="mt-2 whitespace-pre-line text-[0.85rem] leading-relaxed text-[#3B4C6B]">
              <T text={step.source_question.verbatim_text} />
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-[#C9D7EE] bg-white p-4 shadow-[0_18px_30px_-24px_rgba(20,87,197,0.7)]" data-testid="exam-step" data-step-type={step.type}>
            <p className="text-[0.72rem] font-bold text-[#5B6B88]">
              {step.is_verbatim_original ? 'نصّ السؤال الأصلي' : 'خطوة تدريبية مشتقّة'} · {step.rubric_label} ·{' '}
              <bdi dir="ltr">{fmt(step.points)}</bdi> ن
            </p>
            <div dir={dir} lang={view.set.lang}>
              <h2 className="mt-2 text-[1.15rem] font-extrabold leading-relaxed text-[#172B50]">
                <T text={step.prompt} />
              </h2>
              <StepExcerptView excerpt={step.excerpt} />
              <div className="mt-4">
                <Interaction step={step} draft={draft} setDraft={(d) => setDrafts((m) => ({ ...m, [step.id]: d }))} locked={!!answered[step.id] || pending} feedback={answered[step.id]?.feedback ?? null} />
              </div>
            </div>
          </div>

          {answered[step.id]?.feedback ? <FeedbackBox fb={answered[step.id]!.feedback!} lang={view.set.lang} /> : answered[step.id] ? <p className="text-center text-sm font-bold text-[#15803D]">حُفظت إجابتك.</p> : null}

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} aria-label="الخطوة السابقة" className="flex size-12 items-center justify-center rounded-full border border-[#C9D7EE] bg-white text-[#1457C5] disabled:opacity-30">
              <ChevronRight className="size-6" aria-hidden />
            </button>
            {!answered[step.id] ? (
              <button type="button" className={cn(DECK_BUTTON, 'flex-1')} onClick={submit} disabled={pending} data-testid="exam-check">
                {practice ? 'تحقّق' : 'احفظ إجابتي'}
              </button>
            ) : index < steps.length - 1 || done < totalSteps ? (
              <button type="button" className={cn(DECK_BUTTON, 'flex-1')} onClick={() => setIndex((i) => Math.min(i + 1, steps.length - 1))} data-testid="exam-next">
                التالي <ChevronLeft className="size-6" strokeWidth={3} aria-hidden />
              </button>
            ) : (
              <button type="button" className={cn(DECK_BUTTON, 'flex-1')} onClick={finish} disabled={pending} data-testid="exam-finish">
                <Flag className="size-5" aria-hidden /> أنهِ واعرض النتيجة
              </button>
            )}
            <button type="button" onClick={() => setIndex((i) => Math.min(steps.length - 1, i + 1))} disabled={index >= steps.length - 1 || !answered[step.id]} aria-label="الخطوة التالية" className="flex size-12 items-center justify-center rounded-full border border-[#C9D7EE] bg-white text-[#1457C5] disabled:opacity-30">
              <ChevronLeft className="size-6" aria-hidden />
            </button>
          </div>
          {done > 0 && done < totalSteps ? (
            <button type="button" onClick={finish} disabled={pending} className="mx-auto block min-h-11 rounded-full px-4 text-sm font-bold text-[#5B6B88] underline-offset-4 hover:underline">
              إنهاء المحاولة الآن ({done}/{totalSteps})
            </button>
          ) : null}
        </section>
      ) : null}

      <Dialog open={docsOpen} onOpenChange={setDocsOpen}>
        <DialogContent className="play-deck max-h-[85svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>النصّ والوثائق</DialogTitle>
            <DialogDescription>{view.set.title}</DialogDescription>
          </DialogHeader>
          <div dir={dir} lang={view.set.lang}>
            <Documents docs={docs} />
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </MathContext.Provider>
  )
}
