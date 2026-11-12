'use client'

import { useActionState, useEffect } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { setCommercialSettingsAction } from '@/server/actions/commercial.actions'
import type { CommercialChange, CommercialKey, CommercialSettings } from '@/server/services/commercial-settings.service'

const FIELDS: { key: CommercialKey; label: string; hint: string; min: number; max: number }[] = [
  { key: 'shippingFallbackDzd', label: 'رسم التوصيل الاحتياطي (دج)', hint: 'يُستعمل حين لا يوجد جدول EcoTrack للولاية. بين 0 و5000.', min: 0, max: 5000 },
  { key: 'playTrialHours', label: 'مدة تجربة PLAY المجانية (ساعات)', hint: 'للتلاميذ غير المشتركين. تمسّ التجارب التي تبدأ بعد الحفظ فقط. بين 1 و720.', min: 1, max: 720 },
  { key: 'marketplaceTeacherSharePct', label: 'نصيب الأستاذ في سوق الأساتذة (%)', hint: 'يُطبَّق على المنتجات التي تُقبل بعد الحفظ. بين 0 و100.', min: 0, max: 100 }
]

const LABEL: Record<CommercialKey, string> = Object.fromEntries(FIELDS.map((f) => [f.key, f.label])) as Record<CommercialKey, string>
const when = (d: Date) => new Intl.DateTimeFormat('ar-DZ', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Algiers' }).format(new Date(d))

/**
 * الإعدادات التجارية (البند ب5): ما كان في ملف البيئة أو في الكود صار يُغيَّر من هنا دون برمجة ولا إعادة تشغيل.
 * قبل الحفظ تأكيد يذكر ما سيتغيّر، وتحت النموذج آخر التغييرات (من ومتى).
 */
export function CommercialSettingsForm({ value, history }: { value: CommercialSettings; history: CommercialChange[] }) {
  const [state, action] = useActionState(setCommercialSettingsAction, null)
  useEffect(() => {
    if (state?.ok) toast('success', 'حُفظت الإعدادات التجارية، وتسري على الطلبات التالية')
  }, [state])
  const current = state?.ok ? state.data : value

  const confirmChanges = (e: React.FormEvent<HTMLFormElement>) => {
    const fd = new FormData(e.currentTarget)
    const diff = FIELDS.filter((f) => String(fd.get(f.key) ?? '').trim() !== '' && Number(fd.get(f.key)) !== current[f.key]).map((f) => `${f.label}: ${current[f.key]} ← ${fd.get(f.key)}`)
    if (!diff.length) {
      e.preventDefault()
      toast('info', 'لم يتغيّر شيء')
      return
    }
    if (!window.confirm(`سيتغيّر فورًا على المنصة:\n\n${diff.join('\n')}\n\nمتابعة؟`)) e.preventDefault()
  }

  return (
    <form action={action} onSubmit={confirmChanges} className="space-y-4" data-testid="commercial-settings">
      <p className="text-sm text-muted-foreground">أسعار الدورات والكتب، والإحالة، وعمولات نقاط البيع والمسوّقين في صفحاتها. هنا ما بقي خارج اللوحة.</p>
      {FIELDS.map((f) => (
        <Field key={f.key} label={f.label} htmlFor={`cs-${f.key}`} hint={f.hint} error={fieldError(state, f.key)}>
          <Input id={`cs-${f.key}`} name={f.key} type="number" inputMode="numeric" dir="ltr" min={f.min} max={f.max} step={1} defaultValue={current[f.key]} key={`${f.key}-${current[f.key]}`} required />
        </Field>
      ))}
      <FormError state={state} />
      <SubmitButton>حفظ</SubmitButton>
      {history.length ? (
        <div className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">آخر التغييرات</p>
          <ul className="space-y-1">
            {history.map((h, i) => (
              <li key={i}>
                {when(h.at)} · {h.by ?? '—'}: {h.changes.map((c) => `${LABEL[c.key] ?? c.label} ${c.from ?? '—'} ← ${c.to ?? '—'}`).join('، ')}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </form>
  )
}
