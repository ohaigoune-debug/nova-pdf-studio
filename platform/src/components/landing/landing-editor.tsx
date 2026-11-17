'use client'

import { Check, Copy } from 'lucide-react'
import { useActionState, useState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { saveLandingAction } from '@/server/actions/landing.actions'

export interface LandingEditorValue {
  id: string
  slug: string
  headline: string
  subheadline: string | null
  videoUrl: string | null
  bullets: string[]
  about: string | null
  faq: { q: string; a: string }[]
  active: boolean
}

const FAQ_SLOTS = 8

/** محرّر صفحة الهبوط: كل ما يحتاجه المشرف في استمارة واحدة، والباقي يأتي من الدورة */
export function LandingEditor({ value, suggestedFaq }: { value: LandingEditorValue; suggestedFaq: string[] }) {
  const [state, action] = useActionState(saveLandingAction, null)
  const faq = Array.from({ length: FAQ_SLOTS }, (_, i) => value.faq[i] ?? { q: '', a: '' })
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={value.id} />
      <label className="flex items-center gap-3 rounded-lg border p-3">
        <input type="checkbox" name="active" defaultChecked={value.active} className="size-5 accent-[var(--color-primary)]" />
        <span>
          <span className="block font-bold">الصفحة مشغّلة</span>
          <span className="block text-xs text-muted-foreground">متوقفة = لا يراها إلا أنت (بزر المعاينة).</span>
        </span>
      </label>
      <Field label="الرابط" htmlFor="lp-slug" hint="madrasadz.com/go/… — حروف لاتينية صغيرة وأرقام وشرطة" error={fieldError(state, 'slug')}>
        <Input id="lp-slug" name="slug" defaultValue={value.slug} dir="ltr" required />
      </Field>
      <Field label="العنوان الكبير" htmlFor="lp-headline" error={fieldError(state, 'headline')}>
        <Input id="lp-headline" name="headline" defaultValue={value.headline} required maxLength={140} />
      </Field>
      <Field label="السطر تحت العنوان" htmlFor="lp-sub">
        <Input id="lp-sub" name="subheadline" defaultValue={value.subheadline ?? ''} maxLength={240} />
      </Field>
      <Field label="فيديو التعريف" htmlFor="lp-video" hint="رابط يوتيوب (عادي أو Shorts) أو Bunny — 30 إلى 60 ثانية تكفي" error={fieldError(state, 'videoUrl')}>
        <Input id="lp-video" name="videoUrl" defaultValue={value.videoUrl ?? ''} dir="ltr" inputMode="url" placeholder="https://youtu.be/…" />
      </Field>
      <Field label="ماذا يحصل عليه التلميذ" htmlFor="lp-bullets" hint="سطر لكل نقطة (حتى 10)">
        <Textarea id="lp-bullets" name="bullets" defaultValue={value.bullets.join('\n')} rows={6} />
      </Field>
      <Field label="عن الأستاذ" htmlFor="lp-about" hint="اختياري — معلومات حقيقية فقط">
        <Textarea id="lp-about" name="about" defaultValue={value.about ?? ''} rows={3} maxLength={800} />
      </Field>
      <fieldset className="space-y-3">
        <legend className="mb-1 font-bold">أسئلة شائعة</legend>
        <p className="text-xs text-muted-foreground">لا يظهر السؤال إلا إذا كتبت جوابه.</p>
        {faq.map((f, i) => (
          <div key={i} className="grid gap-2 rounded-lg border p-3">
            <Input name={`faq_q_${i}`} defaultValue={f.q} placeholder={suggestedFaq[i] ?? 'السؤال'} aria-label={`السؤال ${i + 1}`} maxLength={200} />
            <Textarea name={`faq_a_${i}`} defaultValue={f.a} placeholder="الجواب" aria-label={`الجواب ${i + 1}`} rows={2} maxLength={1000} />
          </div>
        ))}
      </fieldset>
      <FormError state={state} />
      {state?.ok ? <p className="text-sm text-success" role="status">حُفظت الصفحة.</p> : null}
      <SubmitButton>حفظ</SubmitButton>
    </form>
  )
}

/** زر نسخ رابط مصدر */
export function CopyLink({ url }: { url: string }) {
  const [done, setDone] = useState(false)
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => {
        void navigator.clipboard?.writeText(url).then(() => {
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        })
      }}
    >
      {done ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {done ? 'نُسخ' : 'نسخ'}
    </Button>
  )
}
