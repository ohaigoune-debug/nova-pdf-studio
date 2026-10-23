'use client'

import { Plus, Save, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { upsertPlayQuestionAction, type PlayQuestionInput } from '@/server/actions/play-admin.actions'
import { PLAY_DIFFICULTIES, PLAY_QUESTION_TYPES, PLAY_REVIEW_STATUSES, gradeByCode, streamName, subjectName, type PlayDifficulty, type PlayQuestionType, type PlayReviewStatus } from '@/server/play/constants'
import { DIFFICULTY_AR, STATUS_AR, TYPE_AR } from './labels'

export interface LessonOpt {
  id: string
  gradeCode: string
  streamCodes: string[]
  subjectCode: string
  unitCode: string
  unitName: string
  lessonCode: string
  lessonName: string
}

export interface QuestionFormInitial {
  key?: string
  type?: PlayQuestionType
  grade?: string
  streams?: string[]
  subject?: string
  unit?: string
  lesson?: string
  objective?: string
  difficulty?: PlayDifficulty
  question?: string
  options?: string[]
  correct?: number
  blanks?: (string | string[])[]
  bank?: string[]
  pairs?: { left: string; right: string }[]
  order?: string[]
  explanation?: string
  tags?: string[]
  reviewStatus?: PlayReviewStatus
  note?: string
}

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)

export function QuestionForm({ lessons, initial, existingId }: { lessons: LessonOpt[]; initial?: QuestionFormInitial; existingId?: string | null }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [type, setType] = useState<PlayQuestionType>(initial?.type ?? 'MCQ')
  const [grade, setGrade] = useState(initial?.grade ?? lessons[0]?.gradeCode ?? '3AS')
  const [subject, setSubject] = useState(initial?.subject ?? '')
  const [unit, setUnit] = useState(initial?.unit ?? '')
  const [lesson, setLesson] = useState(initial?.lesson ?? '')
  const [streams, setStreams] = useState<string[]>(initial?.streams ?? [])
  const [difficulty, setDifficulty] = useState<PlayDifficulty>(initial?.difficulty ?? 'MEDIUM')
  const [reviewStatus, setReviewStatus] = useState<PlayReviewStatus>(initial?.reviewStatus ?? 'APPROVED')
  const [question, setQuestion] = useState(initial?.question ?? '')
  const [explanation, setExplanation] = useState(initial?.explanation ?? '')
  const [objective, setObjective] = useState(initial?.objective ?? '')
  const [tags, setTags] = useState((initial?.tags ?? []).join('، '))
  const [note, setNote] = useState(initial?.note ?? '')
  const [options, setOptions] = useState<string[]>(initial?.options?.length ? initial.options : ['', '', '', ''])
  const [correct, setCorrect] = useState(initial?.correct ?? 0)
  const [blanks, setBlanks] = useState<string[]>((initial?.blanks ?? []).map((b) => (Array.isArray(b) ? b.join(' | ') : b)))
  const [bank, setBank] = useState((initial?.bank ?? []).join('\n'))
  const [pairs, setPairs] = useState<{ left: string; right: string }[]>(initial?.pairs?.length ? initial.pairs : [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }])
  const [order, setOrder] = useState((initial?.order ?? []).join('\n'))
  const [errors, setErrors] = useState<string[]>([])

  const grades = useMemo(() => [...new Set(lessons.map((l) => l.gradeCode))].sort((a, b) => (gradeByCode(a)?.sortOrder ?? 99) - (gradeByCode(b)?.sortOrder ?? 99)), [lessons])
  const subjects = useMemo(() => [...new Set(lessons.filter((l) => l.gradeCode === grade).map((l) => l.subjectCode))], [lessons, grade])
  const units = useMemo(() => {
    const seen = new Map<string, string>()
    for (const l of lessons) if (l.gradeCode === grade && l.subjectCode === subject && !seen.has(l.unitCode)) seen.set(l.unitCode, l.unitName)
    return [...seen.entries()]
  }, [lessons, grade, subject])
  const lessonOpts = useMemo(() => {
    const seen = new Map<string, string>()
    for (const l of lessons) if (l.gradeCode === grade && l.subjectCode === subject && l.unitCode === unit && !seen.has(l.lessonCode)) seen.set(l.lessonCode, l.lessonName)
    return [...seen.entries()]
  }, [lessons, grade, subject, unit])
  const gradeStreams = gradeByCode(grade)?.streams ?? []
  const blankCount = (question.match(/_{3,}/g) ?? []).length

  const localErrors = (): string[] => {
    const e: string[] = []
    if (!grade || !subject || !unit || !lesson) e.push('اختر السنة والمادة والوحدة والدرس')
    if (question.trim().length < 8) e.push('نص السؤال قصير جداً')
    if (explanation.trim().length < 15) e.push('التفسير قصير جداً (15 حرفاً على الأقل)')
    if (type === 'MCQ') {
      const opts = options.map((o) => o.trim()).filter(Boolean)
      if (opts.length < 3) e.push('المطلوب 3 اختيارات على الأقل (يُفضَّل 4)')
      if (!options[correct]?.trim()) e.push('حدّد الاختيار الصحيح')
    }
    if (type === 'FILL_BLANK') {
      if (blankCount === 0) e.push('ضع ____ في موضع كل فراغ داخل نص السؤال')
      if (blanks.length !== blankCount) e.push(`عدد إجابات الفراغات (${blanks.length}) لا يطابق عدد الفراغات (${blankCount})`)
      if (lines(bank).length < blankCount + 1) e.push('بنك الكلمات يحتاج مشتتاً واحداً على الأقل')
    }
    if (type === 'MATCHING' && pairs.filter((p) => p.left.trim() && p.right.trim()).length < 3) e.push('المطلوب 3 أزواج على الأقل')
    if (type === 'ORDERING' && lines(order).length < 3) e.push('المطلوب 3 عناصر على الأقل')
    return e
  }

  const submit = () => {
    const e = localErrors()
    setErrors(e)
    if (e.length) return
    const payload: PlayQuestionInput = {
      key: initial?.key,
      type,
      grade,
      streams,
      subject,
      unit,
      lesson,
      objective: objective.trim() || undefined,
      difficulty,
      question: question.trim(),
      explanation: explanation.trim(),
      tags: tags.split(/[،,]/).map((t) => t.trim()).filter(Boolean),
      reviewStatus,
      note: note.trim() || undefined,
      options: type === 'MCQ' ? options.map((o) => o.trim()).filter(Boolean) : undefined,
      correct: type === 'MCQ' ? correct : undefined,
      blanks: type === 'FILL_BLANK' ? blanks.map((b) => (b.includes('|') ? b.split('|').map((x) => x.trim()).filter(Boolean) : b.trim())) : undefined,
      bank: type === 'FILL_BLANK' ? lines(bank) : undefined,
      pairs: type === 'MATCHING' ? pairs.filter((p) => p.left.trim() && p.right.trim()).map((p) => ({ left: p.left.trim(), right: p.right.trim() })) : undefined,
      order: type === 'ORDERING' ? lines(order) : undefined
    }
    start(async () => {
      const r = await upsertPlayQuestionAction(payload, existingId ?? null)
      if (!r.ok) {
        const fields = r.error.fieldErrors ? Object.entries(r.error.fieldErrors).map(([k, v]) => `${k}: ${v}`) : []
        setErrors([r.error.message, ...fields])
        return toast('error', r.error.message)
      }
      toast('success', existingId ? 'حُفظت التعديلات' : 'أُنشئ السؤال')
      router.push(`/admin/play/questions/${r.data.id}`)
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      {errors.length ? (
        <ul className="list-disc space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3 ps-7 text-sm text-destructive">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label>السنة</Label>
          <Select value={grade} onChange={(e) => { setGrade(e.target.value); setSubject(''); setUnit(''); setLesson(''); setStreams([]) }} disabled={!!existingId}>
            {grades.map((g) => (
              <option key={g} value={g}>
                {gradeByCode(g)?.nameAr ?? g}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>المادة</Label>
          <Select value={subject} onChange={(e) => { setSubject(e.target.value); setUnit(''); setLesson('') }} disabled={!!existingId}>
            <option value="">—</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {subjectName(s)}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>الوحدة</Label>
          <Select value={unit} onChange={(e) => { setUnit(e.target.value); setLesson('') }} disabled={!!existingId}>
            <option value="">—</option>
            {units.map(([code, name]) => (
              <option key={code} value={code}>
                {code} · {name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>الدرس</Label>
          <Select value={lesson} onChange={(e) => setLesson(e.target.value)} disabled={!!existingId}>
            <option value="">—</option>
            {lessonOpts.map(([code, name]) => (
              <option key={code} value={code}>
                {code} · {name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {gradeStreams.length ? (
        <div className="space-y-1.5">
          <Label>الشعب (فارغة = كل شعب السنة)</Label>
          <div className="flex flex-wrap gap-3 text-sm">
            {gradeStreams.map((s) => (
              <label key={s} className="flex items-center gap-1.5">
                <input type="checkbox" className="size-4 accent-primary" checked={streams.includes(s)} onChange={(e) => setStreams(e.target.checked ? [...streams, s] : streams.filter((x) => x !== s))} />
                {streamName(s)}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>النوع</Label>
          <Select value={type} onChange={(e) => setType(e.target.value as PlayQuestionType)}>
            {PLAY_QUESTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_AR[t]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>الصعوبة</Label>
          <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value as PlayDifficulty)}>
            {PLAY_DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_AR[d]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>حالة المراجعة</Label>
          <Select value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value as PlayReviewStatus)}>
            {PLAY_REVIEW_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_AR[s]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>نص السؤال {type === 'FILL_BLANK' ? <span className="text-xs text-muted-foreground">(ضع ____ لكل فراغ — الفراغات المكتشفة: {blankCount})</span> : null}</Label>
        <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="يدعم المعادلات بين $…$" />
      </div>

      {type === 'MCQ' ? (
        <div className="space-y-2">
          <Label>الاختيارات (حدّد الصحيح)</Label>
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name="correct" aria-label={`الاختيار ${i + 1} صحيح`} className="size-4 accent-primary" checked={correct === i} onChange={() => setCorrect(i)} />
              <Input value={o} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`الاختيار ${i + 1}`} />
              {options.length > 3 ? (
                <Button type="button" size="sm" variant="ghost" aria-label="حذف الاختيار" onClick={() => { setOptions(options.filter((_, j) => j !== i)); if (correct >= options.length - 1) setCorrect(0) }}>
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>
          ))}
          {options.length < 6 ? (
            <Button type="button" size="sm" variant="outline" onClick={() => setOptions([...options, ''])}>
              <Plus className="size-4" /> اختيار
            </Button>
          ) : null}
        </div>
      ) : null}

      {type === 'FILL_BLANK' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>إجابة كل فراغ بالترتيب (بدائل مفصولة بـ |)</Label>
            {Array.from({ length: Math.max(blankCount, blanks.length) }).map((_, i) => (
              <Input key={i} value={blanks[i] ?? ''} onChange={(e) => setBlanks(Array.from({ length: Math.max(blankCount, blanks.length) }, (_, j) => (j === i ? e.target.value : blanks[j] ?? '')))} placeholder={`الفراغ ${i + 1}`} />
            ))}
            {blanks.length !== blankCount ? (
              <Button type="button" size="sm" variant="outline" onClick={() => setBlanks(Array.from({ length: blankCount }, (_, j) => blanks[j] ?? ''))}>
                مطابقة عدد الفراغات ({blankCount})
              </Button>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>بنك الكلمات (كلمة في كل سطر؛ الصحيحة + المشتتات)</Label>
            <Textarea value={bank} onChange={(e) => setBank(e.target.value)} className="min-h-[140px]" />
          </div>
        </div>
      ) : null}

      {type === 'MATCHING' ? (
        <div className="space-y-2">
          <Label>الأزواج (يسار ↔ يمين)، 3–6</Label>
          {pairs.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={p.left} onChange={(e) => setPairs(pairs.map((x, j) => (j === i ? { ...x, left: e.target.value } : x)))} placeholder="العنصر" />
              <Input value={p.right} onChange={(e) => setPairs(pairs.map((x, j) => (j === i ? { ...x, right: e.target.value } : x)))} placeholder="ما يطابقه" />
              {pairs.length > 3 ? (
                <Button type="button" size="sm" variant="ghost" aria-label="حذف الزوج" onClick={() => setPairs(pairs.filter((_, j) => j !== i))}>
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>
          ))}
          {pairs.length < 6 ? (
            <Button type="button" size="sm" variant="outline" onClick={() => setPairs([...pairs, { left: '', right: '' }])}>
              <Plus className="size-4" /> زوج
            </Button>
          ) : null}
        </div>
      ) : null}

      {type === 'ORDERING' ? (
        <div className="space-y-1.5">
          <Label>العناصر بالترتيب الصحيح (عنصر في كل سطر، 3–7)</Label>
          <Textarea value={order} onChange={(e) => setOrder(e.target.value)} className="min-h-[140px]" />
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label>التفسير (يظهر للتلميذ بعد الإجابة)</Label>
        <Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>الهدف التعلّمي (اختياري)</Label>
          <Input value={objective} onChange={(e) => setObjective(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>الوسوم (مفصولة بفاصلة)</Label>
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="بلاغة، استعارة" />
        </div>
        <div className="space-y-1.5">
          <Label>ملاحظة داخلية (اختياري)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" onClick={submit} loading={pending}>
          <Save className="size-4" /> {existingId ? 'حفظ التعديلات' : 'إنشاء السؤال'}
        </Button>
        {initial?.key ? (
          <span className="font-mono text-xs text-muted-foreground" dir="ltr">
            {initial.key}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">المفتاح يُولَّد تلقائياً بصيغة GRADE-SUBJECT-UNIT-LESSON-9NNN</span>
        )}
      </div>
    </div>
  )
}
