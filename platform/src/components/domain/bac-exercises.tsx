'use client'

import { ChevronDown, ChevronUp, Eye, EyeOff, ListChecks, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DIFF_AR } from '@/lib/bank-labels'
import { cn } from '@/lib/utils'
import { renderBody } from '@/server/lib/exam-render'
import type { ExamExerciseView } from '@/server/services/bac-bank.service'

const ARABIC_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح']
const Rich = ({ text, className }: { text: string; className?: string }) => <div className={className} dir="auto" dangerouslySetInnerHTML={{ __html: renderBody(text) }} />

/**
 * تمارين موضوع البكالوريا: كل تمرين بأسئلته؛ «إظهار الحلّ» لكل سؤال على حدة (لا كلّها دفعة)،
 * الحلّ الرسمي والحلّ المفصّل لمنصة مدرسة في تبويبين، ووضع «حلّ تفاعلي» يسير سؤالاً سؤالاً.
 */
export function BacExercises({ exercises, interactive = false }: { exercises: ExamExerciseView[]; interactive?: boolean }) {
  const [mode, setMode] = useState<'list' | 'interactive'>(interactive ? 'interactive' : 'list')
  const [cursor, setCursor] = useState(0)
  type Step = { ex: ExamExerciseView; child: ExamExerciseView['children'][number] | null; idx: number }
  const flat = useMemo<Step[]>(() => exercises.flatMap((e): Step[] => (e.children.length ? e.children.map((c, i) => ({ ex: e, child: c, idx: i })) : [{ ex: e, child: null, idx: 0 }])), [exercises])
  if (exercises.length === 0) return <p className="text-sm text-muted-foreground">لم تُستخرج تمارين هذا الموضوع بعد؛ تظهر هنا بعد معالجة المشرف واعتماده.</p>
  if (mode === 'interactive') {
    const cur = flat[Math.min(cursor, flat.length - 1)]!
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-bold">
            حلّ تفاعلي — {cursor + 1} / {flat.length}
          </span>
          <Button size="sm" variant="ghost" onClick={() => setMode('list')}>
            <ListChecks className="size-4" /> كل التمارين
          </Button>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="mb-1 flex flex-wrap items-center gap-2 text-sm font-bold">
            {cur.ex.topicNo ? `الموضوع ${cur.ex.topicNo} — ` : ''}
            {cur.ex.title ?? `التمرين ${cur.ex.exerciseNo ?? ''}`} <Badge variant="muted">{cur.ex.points} ن</Badge>
          </p>
          {cur.idx === 0 || !cur.child ? <Rich text={cur.ex.body} className="studio-paper text-sm leading-relaxed" /> : <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">نصّ التمرين</summary><Rich text={cur.ex.body} /></details>}
          {cur.child ? (
            <div className="mt-3 rounded-lg border bg-background p-3">
              <p className="text-sm font-semibold">
                {cur.idx + 1}) <span className="inline" dir="auto" dangerouslySetInnerHTML={{ __html: renderBody(cur.child.body).replace(/^<p dir="auto">|<\/p>$/g, '') }} /> <span className="text-xs text-muted-foreground">({cur.child.points} ن)</span>
              </p>
              <Reveal official={cur.child.solution} detail={cur.ex.detail?.children?.[cur.idx] ? { shortAnswer: cur.ex.detail.children[cur.idx]!.shortAnswer, steps: cur.ex.detail.children[cur.idx]!.steps, commonMistakes: cur.ex.detail.children[cur.idx]!.commonMistakes } : null} />
            </div>
          ) : (
            <Reveal official={cur.ex.solution} detail={cur.ex.detail ? { shortAnswer: cur.ex.detail.shortAnswer, steps: cur.ex.detail.steps, commonMistakes: cur.ex.detail.commonMistakes, rule: cur.ex.detail.rule, why: cur.ex.detail.why, faster: cur.ex.detail.faster, teacherNotes: cur.ex.detail.teacherNotes, bareme: cur.ex.detail.bareme } : null} />
          )}
        </div>
        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setCursor((c) => Math.max(0, c - 1))} disabled={cursor === 0}>
            السابق
          </Button>
          <Button onClick={() => setCursor((c) => Math.min(flat.length - 1, c + 1))} disabled={cursor >= flat.length - 1}>
            التالي
          </Button>
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => { setMode('interactive'); setCursor(0) }}>
          <Sparkles className="size-4" /> حلّ تفاعلي
        </Button>
      </div>
      <ol className="space-y-3">
        {exercises.map((e) => (
          <li key={e.id} id={`ex-${e.id}`} className="rounded-xl border bg-card p-4">
            <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
              {e.topicNo ? <Badge variant="outline">الموضوع {e.topicNo}</Badge> : null}
              <span>{e.title ?? `التمرين ${e.exerciseNo ?? ''}`}</span>
              <Badge variant="muted">{e.points} ن</Badge>
              <Badge variant={DIFF_AR[e.difficulty]?.variant ?? 'default'}>{DIFF_AR[e.difficulty]?.label}</Badge>
              {e.nodeTitle ? <Badge variant="default">{e.nodeTitle}</Badge> : null}
              {e.detail ? (
                <Badge variant="gold">
                  <Sparkles className="size-3" /> حلّ مفصّل
                </Badge>
              ) : null}
            </p>
            <Rich text={e.body} className="studio-paper mt-2 text-sm leading-relaxed" />
            {e.options.length ? (
              <ol className="mt-1 ps-5 text-sm">
                {e.options.map((o, i) => (
                  <li key={i}>
                    {ARABIC_LETTERS[i]}) {o.label}
                  </li>
                ))}
              </ol>
            ) : null}
            {e.children.length ? (
              <ol className="mt-2 space-y-2 ps-1">
                {e.children.map((c, i) => (
                  <li key={c.id} className="rounded-lg border bg-background p-3">
                    <p className="text-sm">
                      <span className="font-semibold">{i + 1})</span> <span dir="auto" dangerouslySetInnerHTML={{ __html: renderBody(c.body).replace(/^<p dir="auto">|<\/p>$/g, '') }} /> <span className="text-xs text-muted-foreground">({c.points} ن)</span>
                    </p>
                    <Reveal official={c.solution} detail={e.detail?.children?.[i] ? { shortAnswer: e.detail.children[i]!.shortAnswer, steps: e.detail.children[i]!.steps, commonMistakes: e.detail.children[i]!.commonMistakes } : null} />
                  </li>
                ))}
              </ol>
            ) : null}
            <Reveal official={e.solution} detail={e.detail ? { shortAnswer: e.detail.shortAnswer, steps: e.detail.steps, commonMistakes: e.detail.commonMistakes, rule: e.detail.rule, why: e.detail.why, faster: e.detail.faster, teacherNotes: e.detail.teacherNotes, bareme: e.detail.bareme } : null} label={e.children.length ? 'الحلّ الكامل للتمرين' : 'إظهار الحلّ'} />
          </li>
        ))}
      </ol>
    </div>
  )
}

type DetailView = { shortAnswer: string; steps: string[]; commonMistakes: string[]; rule?: string | null; why?: string | null; faster?: string | null; teacherNotes?: string | null; bareme?: { label: string; points: number }[] }

/** زرّ «إظهار الحلّ» لسؤال واحد: الرسمي ثم المفصّل (مدرسة) إن وُجد */
function Reveal({ official, detail, label = 'إظهار الحلّ' }: { official: string | null; detail: DetailView | null; label?: string }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'official' | 'detail'>(official ? 'official' : 'detail')
  if (!official && !detail) return null
  return (
    <div className="mt-2">
      <Button size="sm" variant={open ? 'default' : 'outline'} onClick={() => setOpen((v) => !v)}>
        {open ? <EyeOff className="size-4" /> : <Eye className="size-4" />} {open ? 'إخفاء الحلّ' : label}
      </Button>
      {open ? (
        <div className="mt-2 rounded-lg border bg-muted/30 p-3 text-sm">
          {official && detail ? (
            <div className="mb-2 flex gap-1 text-xs">
              <button type="button" onClick={() => setTab('official')} className={cn('rounded-full border px-2 py-0.5', tab === 'official' ? 'border-primary bg-primary text-primary-foreground' : '')}>
                الحلّ الرسمي
              </button>
              <button type="button" onClick={() => setTab('detail')} className={cn('rounded-full border px-2 py-0.5', tab === 'detail' ? 'border-primary bg-primary text-primary-foreground' : '')}>
                الحلّ المفصّل (مدرسة)
              </button>
            </div>
          ) : null}
          {tab === 'official' && official ? <Rich text={official} className="studio-paper leading-relaxed" /> : null}
          {(tab === 'detail' || !official) && detail ? <DetailBlock d={detail} /> : null}
        </div>
      ) : null}
    </div>
  )
}

function DetailBlock({ d }: { d: DetailView }) {
  const [more, setMore] = useState(false)
  return (
    <div className="space-y-2">
      <p>
        <strong>الإجابة النهائية:</strong> <span dir="auto" dangerouslySetInnerHTML={{ __html: renderBody(d.shortAnswer).replace(/^<p dir="auto">|<\/p>$/g, '') }} />
      </p>
      <div>
        <p className="font-semibold">خطوات الحلّ:</p>
        <ol className="list-decimal space-y-1 ps-6">
          {d.steps.map((s, i) => (
            <li key={i}>
              <span dir="auto" dangerouslySetInnerHTML={{ __html: renderBody(s).replace(/^<p dir="auto">|<\/p>$/g, '') }} />
            </li>
          ))}
        </ol>
      </div>
      {d.rule ? (
        <p>
          <strong>القاعدة المستعملة:</strong> <span dir="auto" dangerouslySetInnerHTML={{ __html: renderBody(d.rule).replace(/^<p dir="auto">|<\/p>$/g, '') }} />
        </p>
      ) : null}
      {d.commonMistakes.length ? (
        <p>
          <strong>أخطاء شائعة:</strong> {d.commonMistakes.join(' · ')}
        </p>
      ) : null}
      {d.why || d.faster || d.teacherNotes || d.bareme?.length ? (
        <button type="button" className="flex items-center gap-1 text-xs text-primary" onClick={() => setMore((v) => !v)}>
          {more ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />} {more ? 'أقلّ' : 'لماذا هذه الطريقة؟ طريقة أسرع، ملاحظات الأستاذ، سلّم النقاط'}
        </button>
      ) : null}
      {more ? (
        <div className="space-y-1 text-xs">
          {d.why ? <p><strong>لماذا؟</strong> {d.why}</p> : null}
          {d.faster ? <p><strong>طريقة أسرع:</strong> {d.faster}</p> : null}
          {d.teacherNotes ? <p><strong>ملاحظات الأستاذ:</strong> {d.teacherNotes}</p> : null}
          {d.bareme?.length ? <p><strong>سلّم النقاط:</strong> {d.bareme.map((b) => `${b.label} (${b.points})`).join(' · ')}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
