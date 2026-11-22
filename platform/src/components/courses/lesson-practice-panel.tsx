'use client'

import { ArrowDown, ArrowUp, Check, Gamepad2, NotebookPen, Plus, Search, Target, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input, Select } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { addLessonPracticeAction, moveLessonPracticeAction, removeLessonPracticeAction, searchPracticeBankAction } from '@/server/actions/lesson-practice.actions'
import { PLAY_GRADES, PLAY_SUBJECTS } from '@/server/play/constants'
import type { LessonPracticeAdminItem, PracticeBankItem } from '@/server/services/lesson-practice.service'

type Kind = 'LESSON' | 'EXAM_SET'

const GRADES = PLAY_GRADES.filter((g) => g.cycle === 'SECONDARY' || g.code === '4AM')
const EXAM_KINDS: { v: '' | 'BAC' | 'DEVOIR' | 'TEST'; label: string }[] = [
  { v: '', label: 'الكل' },
  { v: 'BAC', label: 'بكالوريا' },
  { v: 'DEVOIR', label: 'فروض' },
  { v: 'TEST', label: 'اختبارات' }
]

function KindIcon({ kind }: { kind: Kind }) {
  return (
    <span className={cn('flex size-11 flex-none items-center justify-center rounded-2xl', kind === 'LESSON' ? 'bg-primary/10 text-primary' : 'bg-amber-100 text-amber-700')}>
      {kind === 'LESSON' ? <Gamepad2 className="size-5" /> : <NotebookPen className="size-5" />}
    </span>
  )
}

/**
 * «تمارين QCM تحت هذا الدرس» في محرّر درس الدورة (22 نوفمبر 2026): من بنك مدرسة PLAY —
 * لعبة درس من المنهاج، أو بكالوريا/فرض محوَّل. تظهر لمشتركي الدورة تحت فيديو الدرس.
 */
export function LessonPracticePanel({ courseId, lessonId, items }: { courseId: string; lessonId: string; items: LessonPracticeAdminItem[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(false)
  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, done?: string) =>
    start(async () => {
      const r = await fn()
      if (!r.ok) return toast('error', r.error?.message ?? 'تعذّر الحفظ')
      if (done) toast('success', done)
      router.refresh()
    })
  return (
    <Card className="border-2 border-primary/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="size-5 text-primary" /> تمارين QCM تحت هذا الدرس
        </CardTitle>
        <CardDescription>من بنك مدرسة: لعبة درس أو بكالوريا أو فرض. تظهر لمشتركي الدورة تحت فيديو الدرس، ويلعبونها بالبطاقات نفسها.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? <p className="text-sm text-muted-foreground">لا تمارين بعد تحت هذا الدرس.</p> : null}
        {items.map((it, i) => (
          <div key={it.linkId} className="flex items-center gap-3 rounded-2xl border p-3">
            <KindIcon kind={it.kind} />
            <div className="min-w-0 flex-1">
              <p className="font-bold leading-snug">{it.title}</p>
              <p className="text-xs text-muted-foreground">{it.subtitle}</p>
            </div>
            <div className="flex flex-none items-center">
              <Button size="sm" variant="ghost" aria-label="أعلى" disabled={pending || i === 0} onClick={() => run(() => moveLessonPracticeAction({ courseId, lessonId, linkId: it.linkId, direction: 'up' }))}>
                <ArrowUp className="size-4" />
              </Button>
              <Button size="sm" variant="ghost" aria-label="أسفل" disabled={pending || i === items.length - 1} onClick={() => run(() => moveLessonPracticeAction({ courseId, lessonId, linkId: it.linkId, direction: 'down' }))}>
                <ArrowDown className="size-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label="حذف"
                className="text-destructive"
                disabled={pending}
                onClick={() => confirm(`حذف «${it.title}» من تحت الدرس؟`) && run(() => removeLessonPracticeAction({ courseId, lessonId, linkId: it.linkId }), 'حُذف التمرين')}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
        <Button className="w-full" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> أضف من بنك مدرسة
        </Button>
      </CardContent>
      <BankDialog open={open} onOpenChange={setOpen} courseId={courseId} lessonId={lessonId} added={new Set(items.map((i) => i.refId))} onAdded={() => router.refresh()} />
    </Card>
  )
}

function BankDialog({ open, onOpenChange, courseId, lessonId, added, onAdded }: { open: boolean; onOpenChange: (v: boolean) => void; courseId: string; lessonId: string; added: Set<string>; onAdded: () => void }) {
  const [kind, setKind] = useState<Kind>('LESSON')
  const [q, setQ] = useState('')
  const [grade, setGrade] = useState('3AS')
  const [subject, setSubject] = useState('AR')
  const [examKind, setExamKind] = useState<'' | 'BAC' | 'DEVOIR' | 'TEST'>('')
  const [results, setResults] = useState<PracticeBankItem[] | null>(null)
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [adding, startAdd] = useTransition()

  useEffect(() => {
    if (!open) return
    let alive = true
    const t = window.setTimeout(async () => {
      setLoading(true)
      const r = await searchPracticeBankAction({ kind, q: q || undefined, gradeCode: grade || undefined, subjectCode: subject || undefined, examKind: kind === 'EXAM_SET' && examKind ? examKind : undefined })
      if (!alive) return
      setLoading(false)
      if (!r.ok) {
        toast('error', r.error.message)
        setResults([])
      } else setResults(r.data)
    }, 300)
    return () => {
      alive = false
      window.clearTimeout(t)
    }
  }, [open, kind, q, grade, subject, examKind])

  const isAdded = (refId: string) => added.has(refId) || justAdded.has(refId)
  const add = (item: PracticeBankItem) =>
    startAdd(async () => {
      const r = await addLessonPracticeAction({ courseId, lessonId, kind: item.kind, refId: item.refId })
      if (!r.ok) return toast('error', r.error.message)
      setJustAdded((s) => new Set(s).add(item.refId))
      toast('success', 'أُضيف تحت الدرس')
      onAdded()
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>أضف من بنك مدرسة</DialogTitle>
          <DialogDescription>دروس PLAY بكل أسئلتها، والبكالوريات والفروض المحوّلة إلى أسئلة تفاعلية.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1" role="tablist">
          {(
            [
              ['LESSON', 'درس (لعبة)'],
              ['EXAM_SET', 'بكالوريا وفروض']
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => setKind(k)}
              className={cn('flex min-h-10 items-center justify-center gap-2 rounded-xl text-sm font-bold', kind === k ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground')}
            >
              {k === 'LESSON' ? <Gamepad2 className="size-4" /> : <NotebookPen className="size-4" />} {label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={kind === 'LESSON' ? 'ابحث: الجملة الواقعة خبرًا، التشبيه…' : 'ابحث: 2016، البارودي، لغات أجنبية…'} className="ps-9" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="المادة">
            {PLAY_SUBJECTS.map((s) => (
              <option key={s.code} value={s.code}>
                {s.nameAr}
              </option>
            ))}
          </Select>
          <Select value={grade} onChange={(e) => setGrade(e.target.value)} aria-label="السنة">
            {GRADES.map((g) => (
              <option key={g.code} value={g.code}>
                {g.shortAr}
              </option>
            ))}
          </Select>
          {kind === 'EXAM_SET' ? (
            <Select value={examKind} onChange={(e) => setExamKind(e.target.value as typeof examKind)} aria-label="النوع">
              {EXAM_KINDS.map((k) => (
                <option key={k.v} value={k.v}>
                  {k.label}
                </option>
              ))}
            </Select>
          ) : (
            <span />
          )}
        </div>
        <div className="space-y-2">
          {loading && !results ? <p className="text-sm text-muted-foreground">جارٍ البحث…</p> : null}
          {results && results.length === 0 ? <p className="text-sm text-muted-foreground">لا نتائج. غيّر البحث أو المادة أو السنة.</p> : null}
          {results?.map((r) => (
            <div key={r.refId} className="flex items-center gap-3 rounded-2xl border p-3">
              <KindIcon kind={r.kind} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-snug">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.subtitle}</p>
              </div>
              {isAdded(r.refId) ? (
                <span className="inline-flex flex-none items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                  مضاف <Check className="size-3.5" />
                </span>
              ) : (
                <Button size="sm" className="flex-none" loading={adding} onClick={() => add(r)}>
                  أضف
                </Button>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
