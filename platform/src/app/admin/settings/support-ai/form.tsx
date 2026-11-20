'use client'

import { useActionState, useState, useTransition } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { saveSupportAiAction, testSupportAiAction } from '@/server/actions/support-ai.actions'

export interface SupportAiFormValues {
  mode: 'OFF' | 'DRAFT' | 'PILOT' | 'ALL'
  model: string
  pilotPhones: string[]
  dailyLimit: number
  dailyBudgetUsd: number
  knowledge: string
}

const MODES: { value: SupportAiFormValues['mode']; label: string; hint: string }[] = [
  { value: 'OFF', label: 'متوقف', hint: 'لا يكتب شيئًا. التذاكر كلها للموظفين كما كانت.' },
  { value: 'DRAFT', label: '1 — مسودّات فقط', hint: 'يكتب في كل تذكرة ملاحظة داخلية بجوابه المقترح. التلميذ لا يرى شيئًا، والموظف ينسخ الجواب إن أعجبه.' },
  { value: 'PILOT', label: '2 — تجربة على أرقام محددة', hint: 'يردّ وحده على أصحاب الأرقام أدناه فقط، ومسودّات لبقية التلاميذ.' },
  { value: 'ALL', label: '3 — يردّ على كل التلاميذ', hint: 'يردّ وحده على كل تذكرة. يحوّل إلى موظف كل ما يحتاج إجراءً أو لم يتأكد منه.' }
]

export function SupportAiForm({ values, models }: { values: SupportAiFormValues; models: readonly { id: string; label: string; input: number; output: number }[] }) {
  const [state, action] = useActionState(saveSupportAiAction, null)
  const [mode, setMode] = useState(values.mode)
  const known = models.some((m) => m.id === values.model)
  const [model, setModel] = useState(known ? values.model : '__custom')
  const [pending, start] = useTransition()
  const test = () =>
    start(async () => {
      const r = await testSupportAiAction()
      if (r.ok) toast('success', 'المفتاح يعمل', `النموذج ${r.data.model} متاح لحسابك`)
      else toast('error', r.error.message)
    })
  const picked = models.find((m) => m.id === model)
  return (
    <form action={action} className="space-y-5">
      <Field label="طريقة العمل" htmlFor="sa-mode" error={fieldError(state, 'mode')} hint={MODES.find((m) => m.value === mode)?.hint}>
        <Select id="sa-mode" name="mode" value={mode} onChange={(e) => setMode(e.target.value as SupportAiFormValues['mode'])}>
          {MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="النموذج"
        htmlFor="sa-model"
        error={fieldError(state, 'model')}
        hint={picked ? `${picked.input}$ لكل مليون رمز داخل و${picked.output}$ لكل مليون رمز خارج. الردّ الواحد نحو 4000 رمز داخل و300 خارج.` : 'اكتب معرّف نموذج Claude كما في صفحة النماذج، مثل claude-sonnet-5-5'}
      >
        <Select id="sa-model" name="model" value={model} onChange={(e) => setModel(e.target.value)}>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
          <option value="__custom">نموذج آخر (اكتب معرّفه)</option>
        </Select>
      </Field>
      {model === '__custom' ? <Input name="customModel" dir="ltr" required defaultValue={known ? '' : values.model} placeholder="claude-…" aria-label="معرّف النموذج" /> : null}

      {mode === 'PILOT' ? (
        <Field label="أرقام تلاميذ التجربة" htmlFor="sa-phones" error={fieldError(state, 'pilotPhones')} hint="رقم في كل سطر أو مفصولة بفاصلة، كما سُجّل في حساب التلميذ (06… أو 05… أو 07…). ابدأ بحسابك التجريبي.">
          <Textarea id="sa-phones" name="pilotPhones" dir="ltr" rows={3} defaultValue={values.pilotPhones.join('\n')} />
        </Field>
      ) : (
        <input type="hidden" name="pilotPhones" value={values.pilotPhones.join('\n')} />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="أقصى عدد ردود في اليوم" htmlFor="sa-limit" error={fieldError(state, 'dailyLimit')} hint="ردود ومسودّات معًا. بعده تبقى التذاكر للموظفين.">
          <Input id="sa-limit" name="dailyLimit" type="number" min={0} max={5000} step={1} dir="ltr" defaultValue={values.dailyLimit} />
        </Field>
        <Field label="أقصى تكلفة في اليوم (دولار)" htmlFor="sa-budget" error={fieldError(state, 'dailyBudgetUsd')} hint="تقدير من عدد الرموز. بعده يتوقف المساعد حتى الغد.">
          <Input id="sa-budget" name="dailyBudgetUsd" type="number" min={0} max={500} step="0.5" dir="ltr" defaultValue={values.dailyBudgetUsd} />
        </Field>
      </div>

      <Field
        label="ما يجب أن يعرفه المساعد عن المنصة"
        htmlFor="sa-knowledge"
        error={fieldError(state, 'knowledge')}
        hint="اكتب بجمل قصيرة: أين يجد التلميذ الأشياء، القواعد، مواعيد الحصص، مدة التوصيل، ما يفعله إن لم تظهر الدورة… لا يجيب المساعد إلا بما هنا وبما في حساب التلميذ."
      >
        <Textarea
          id="sa-knowledge"
          name="knowledge"
          rows={12}
          maxLength={12000}
          defaultValue={values.knowledge}
          placeholder={'مثال:\n- الدورة تُفعَّل بعد استلام الكتاب ومسح رمز QR الذي في أوله.\n- الحصص المباشرة تُفتح من «دوراتي» قبل موعدها بعشر دقائق.\n- التوصيل مع 48HR من يومين إلى خمسة أيام حسب الولاية.'}
        />
      </Field>

      <FormError state={state} />
      {state?.ok ? <p className="text-sm text-success" role="status">حُفظت الإعدادات.</p> : null}
      <div className="flex flex-wrap gap-2">
        <SubmitButton>حفظ</SubmitButton>
        <Button type="button" variant="outline" loading={pending} onClick={test}>
          اختبر المفتاح والنموذج
        </Button>
      </div>
    </form>
  )
}
