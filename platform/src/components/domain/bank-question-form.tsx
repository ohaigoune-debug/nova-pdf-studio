'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { createBankQuestionAction, updateBankQuestionAction } from '@/server/actions/bank.actions'
import type { BankQuestionRow } from '@/server/db/schema'
import { DIFF_AR, EXAM_KIND_AR, KIND_AR, RIGHTS_AR, TYPE_AR } from '@/lib/bank-labels'

type Opt = { id: string; name: string }
export interface BankFormOptions {
  subjects: Opt[]
  levels: Opt[]
  streams: Opt[]
  /** عقد المنهاج للمادة/الصف الحاليين (تُحدَّث بعد الحفظ إن غيّرتهما) */
  nodes: Opt[]
}

const keyText = (q?: BankQuestionRow | null): string => {
  const k = q?.answerKey as Record<string, unknown> | null | undefined
  if (!k) return ''
  if (Array.isArray(k.accepted)) return (k.accepted as string[]).join(' | ')
  if (Array.isArray(k.blanks)) return (k.blanks as string[][]).map((b) => b[0] ?? '').join(' | ')
  if (Array.isArray(k.pairs)) return (k.pairs as { left: string; right: string }[]).map((p) => `${p.left}=${p.right}`).join('\n')
  return ''
}

/** نموذج سؤال البنك: التصنيف والمصدر والحقوق، ثم النصّ والمفتاح حسب النوع، ثم الحلّ والسلّم */
export function BankQuestionForm({ question, options, parentId }: { question?: BankQuestionRow | null; options: BankFormOptions; parentId?: string | null }) {
  const router = useRouter()
  const action = question ? updateBankQuestionAction.bind(null, question.id) : createBankQuestionAction
  const [state, formAction] = useActionState(action as (p: unknown, fd: FormData) => Promise<{ ok: boolean; data?: { id: string } }>, null)
  const [type, setType] = useState(question?.type ?? 'OPEN')
  const [optCount, setOptCount] = useState(Math.max(4, question?.options.length ?? 0))
  const [baremeCount, setBaremeCount] = useState(Math.max(2, question?.bareme.length ?? 0))

  useEffect(() => {
    if (state?.ok) {
      toast('success', question ? 'حُفظ التعديل' : 'أُضيف السؤال')
      router.push(question ? `/teacher/bank/${question.id}` : state.data?.id ? `/teacher/bank/${state.data.id}` : '/teacher/bank')
    }
  }, [state, question, router])

  const s = state as Parameters<typeof fieldError>[0]
  return (
    <form action={formAction} className="space-y-6">
      {parentId ? <input type="hidden" name="parentId" value={parentId} /> : null}
      <section className="grid gap-3 sm:grid-cols-3">
        <Field label="الطبيعة" htmlFor="kind">
          <Select id="kind" name="kind" defaultValue={question?.kind ?? (parentId ? 'QUESTION' : 'QUESTION')}>
            {Object.entries(KIND_AR).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="نوع السؤال" htmlFor="type" error={fieldError(s, 'type')}>
          <Select id="type" name="type" value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(TYPE_AR).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الصعوبة" htmlFor="difficulty">
          <Select id="difficulty" name="difficulty" defaultValue={String(question?.difficulty ?? 2)}>
            {[1, 2, 3, 4].map((d) => (
              <option key={d} value={d}>
                {DIFF_AR[d]!.label}
              </option>
            ))}
          </Select>
        </Field>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="المادة" htmlFor="subjectId">
          <Select id="subjectId" name="subjectId" defaultValue={question?.subjectId ?? ''}>
            <option value="">—</option>
            {options.subjects.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الصف" htmlFor="levelId">
          <Select id="levelId" name="levelId" defaultValue={question?.levelId ?? ''}>
            <option value="">—</option>
            {options.levels.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الشعبة" htmlFor="streamId">
          <Select id="streamId" name="streamId" defaultValue={question?.streamId ?? ''}>
            <option value="">كل الشعب</option>
            {options.streams.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الوحدة/الدرس" htmlFor="curriculumNodeId" hint={options.nodes.length ? undefined : 'تظهر الوحدات بعد اختيار المادة والصف وحفظ السؤال'}>
          <Select id="curriculumNodeId" name="curriculumNodeId" defaultValue={question?.curriculumNodeId ?? ''}>
            <option value="">—</option>
            {options.nodes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الفصل الدراسي" htmlFor="schoolTerm">
          <Select id="schoolTerm" name="schoolTerm" defaultValue={question?.schoolTerm ? String(question.schoolTerm) : ''}>
            <option value="">—</option>
            <option value="1">الفصل الأول</option>
            <option value="2">الفصل الثاني</option>
            <option value="3">الفصل الثالث</option>
          </Select>
        </Field>
        <Field label="النقاط" htmlFor="points" error={fieldError(s, 'points')}>
          <Input id="points" name="points" type="number" step="0.5" min="0.5" max="100" defaultValue={question ? Number(question.points) : 1} dir="ltr" />
        </Field>
        <Field label="المدة المتوقعة (دقائق)" htmlFor="estimatedMinutes">
          <Input id="estimatedMinutes" name="estimatedMinutes" type="number" min="1" max="240" defaultValue={question?.estimatedMinutes ?? ''} dir="ltr" />
        </Field>
        <Field label="نوع الامتحان الأصلي" htmlFor="examKind">
          <Select id="examKind" name="examKind" defaultValue={question?.examKind ?? ''}>
            <option value="">—</option>
            {Object.entries(EXAM_KIND_AR).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
      </section>

      <section className="space-y-3">
        <Field label="العنوان (اختياري)" htmlFor="title">
          <Input id="title" name="title" defaultValue={question?.title ?? ''} placeholder="التمرين الأول: الاستعارة في النصّ…" />
        </Field>
        <Field label="نصّ السؤال / التمرين" htmlFor="body" error={fieldError(s, 'body')} hint="Markdown مسموح؛ المعادلات بين $…$ (LaTeX). في «ملء فراغات» ضع ___ مكان كل فراغ.">
          <Textarea id="body" name="body" required rows={8} defaultValue={question?.body ?? ''} dir="auto" />
        </Field>

        {type === 'MCQ' || type === 'IMAGE' ? (
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-sm font-semibold">الاختيارات (حدّد الصحيح)</p>
            {Array.from({ length: optCount }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="checkbox" name={`correct_${i}`} defaultChecked={question?.options[i]?.isCorrect ?? false} className="size-4" aria-label="صحيح" />
                <Input name={`option_${i}`} defaultValue={question?.options[i]?.label ?? ''} placeholder={`الاختيار ${i + 1}`} />
              </div>
            ))}
            {optCount < 8 ? (
              <button type="button" className="text-xs text-primary underline" onClick={() => setOptCount((n) => n + 1)}>
                + اختيار
              </button>
            ) : null}
          </div>
        ) : null}
        {type === 'TRUE_FALSE' ? (
          <Field label="الإجابة الصحيحة" htmlFor="answerBool">
            <Select id="answerBool" name="answerBool" defaultValue={String((question?.answerKey as { value?: boolean } | null)?.value ?? true)}>
              <option value="true">صحيح</option>
              <option value="false">خطأ</option>
            </Select>
          </Field>
        ) : null}
        {type === 'SHORT_ANSWER' || type === 'FILL_BLANK' ? (
          <Field label={type === 'FILL_BLANK' ? 'إجابات الفراغات بالترتيب (افصل بـ |)' : 'الإجابات المقبولة (افصل بـ |)'} htmlFor="answerText" error={fieldError(s, 'answerKey')}>
            <Input id="answerText" name="answerText" defaultValue={keyText(question)} dir="auto" />
          </Field>
        ) : null}
        {type === 'MATCHING' ? (
          <Field label="أزواج المطابقة (سطر لكل زوج: يسار=يمين)" htmlFor="answerText">
            <Textarea id="answerText" name="answerText" rows={4} defaultValue={keyText(question)} dir="auto" />
          </Field>
        ) : null}
      </section>

      <section className="space-y-3">
        <Field label="الحلّ النموذجي (اختياري)" htmlFor="solution" hint="يظهر في PDF التصحيح فقط.">
          <Textarea id="solution" name="solution" rows={5} defaultValue={question?.solution ?? ''} dir="auto" />
        </Field>
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-sm font-semibold">سلّم التنقيط (اختياري)</p>
          {Array.from({ length: baremeCount }).map((_, i) => (
            <div key={i} className="grid grid-cols-[1fr_90px] gap-2">
              <Input name={`bareme_label_${i}`} defaultValue={question?.bareme[i]?.label ?? ''} placeholder="الفهم / المنهجية / اللغة…" />
              <Input name={`bareme_points_${i}`} type="number" step="0.25" min="0" defaultValue={question?.bareme[i]?.points ?? ''} placeholder="ن" dir="ltr" />
            </div>
          ))}
          {baremeCount < 20 ? (
            <button type="button" className="text-xs text-primary underline" onClick={() => setBaremeCount((n) => n + 1)}>
              + بند
            </button>
          ) : null}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="المصدر" htmlFor="sourceLabel" hint="مثال: بكالوريا 2024 — آداب وفلسفة">
          <Input id="sourceLabel" name="sourceLabel" defaultValue={question?.sourceLabel ?? ''} />
        </Field>
        <Field label="السنة" htmlFor="sourceYear">
          <Input id="sourceYear" name="sourceYear" type="number" min="1990" max="2100" defaultValue={question?.sourceYear ?? ''} dir="ltr" />
        </Field>
        <Field label="الحقوق" htmlFor="rightsStatus">
          <Select id="rightsStatus" name="rightsStatus" defaultValue={question?.rightsStatus ?? 'OWN'}>
            {Object.entries(RIGHTS_AR).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الكلمات المفتاحية" htmlFor="keywords" hint="افصل بفاصلة">
          <Input id="keywords" name="keywords" defaultValue={question?.keywords.join('، ') ?? ''} />
        </Field>
        <Field label="الرؤية" htmlFor="visibility" hint="العام يراه الأساتذة الآخرون في البنك المشترك">
          <Select id="visibility" name="visibility" defaultValue={question?.visibility ?? 'PRIVATE'}>
            <option value="PRIVATE">خاص بي</option>
            <option value="PUBLIC">عام</option>
          </Select>
        </Field>
        <Field label="الحالة" htmlFor="status">
          <Select id="status" name="status" defaultValue={question?.status === 'NEEDS_REVIEW' ? 'PUBLISHED' : (question?.status ?? 'PUBLISHED')}>
            <option value="PUBLISHED">جاهز للاستعمال</option>
            <option value="DRAFT">مسودة</option>
          </Select>
        </Field>
      </section>

      <FormError state={s} />
      <SubmitButton>{question ? 'حفظ التعديل' : 'إضافة إلى البنك'}</SubmitButton>
    </form>
  )
}
