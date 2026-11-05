'use client'

import { useActionState, useState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Input, Select } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { useT } from '@/i18n/client'
import { completeOAuthSignupAction } from '@/server/actions/auth.actions'

type Opt = { id: string; name: string }

/** نفس حقول التسجيل (register-form) دون البريد وكلمة السر: يأتيان من Google أو Apple */
export function OAuthCompleteForm({
  defaultName,
  email,
  wilayas,
  levels,
  streams,
  referral
}: {
  defaultName: string
  email?: string | null
  wilayas: Opt[]
  levels: (Opt & { secondary?: boolean })[]
  streams: Opt[]
  referral?: { defaultCode: string; welcomeCreditDzd: number } | null
}) {
  const t = useT()
  const [state, action] = useActionState(completeOAuthSignupAction, null)
  const [levelId, setLevelId] = useState('')
  const needsStream = Boolean(levels.find((l) => l.id === levelId)?.secondary)
  return (
    <form action={action} className="space-y-4">
      {email ? (
        <p className="rounded-md bg-secondary px-3 py-2 text-sm text-secondary-foreground">
          البريد: <span dir="ltr" className="font-semibold">{email}</span>
        </p>
      ) : null}
      <Field label={t('auth.fullName')} htmlFor="fullName" error={fieldError(state, 'fullName')}>
        <Input id="fullName" name="fullName" autoComplete="name" defaultValue={defaultName} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="هاتفك" htmlFor="phone" error={fieldError(state, 'phone')} hint="05 / 06 / 07 — يصلك عليه رمز تأكيد">
          <Input id="phone" name="phone" type="tel" autoComplete="tel" dir="ltr" inputMode="tel" placeholder="05XXXXXXXX" required />
        </Field>
        <Field label="هاتف الولي" htmlFor="guardianPhone" error={fieldError(state, 'guardianPhone')} hint="يمكن استلام الكتاب وتفعيل الدورة به">
          <Input id="guardianPhone" name="guardianPhone" type="tel" dir="ltr" inputMode="tel" placeholder="06XXXXXXXX" required />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('common.level')} htmlFor="levelId" error={fieldError(state, 'levelId')}>
          <Select id="levelId" name="levelId" value={levelId} onChange={(e) => setLevelId(e.target.value)} required>
            <option value="">—</option>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('common.stream')} htmlFor="streamId" error={fieldError(state, 'streamId')} hint={needsStream ? 'لا يمكن طلب كتاب أو دورة لشعبة أخرى' : undefined}>
          <Select id="streamId" name="streamId" defaultValue="" required={needsStream} disabled={Boolean(levelId) && !needsStream}>
            <option value="">—</option>
            {streams.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={t('common.wilaya')} htmlFor="wilayaId" error={fieldError(state, 'wilayaId')}>
        <Select id="wilayaId" name="wilayaId" defaultValue="" required>
          <option value="">—</option>
          {wilayas.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </Select>
      </Field>
      {referral ? (
        <Field
          label="كود الدعوة (اختياري)"
          htmlFor="refCode"
          error={fieldError(state, 'refCode')}
          hint={referral.welcomeCreditDzd ? `من زميلك أو من صفحة تتابعها: ${referral.welcomeCreditDzd} دج هدية في رصيدك بعد استلام أول دورة` : 'من زميلك أو من صفحة تتابعها'}
        >
          <Input id="refCode" name="refCode" defaultValue={referral.defaultCode} dir="ltr" autoCapitalize="characters" autoComplete="off" maxLength={24} placeholder="ABCD12" />
        </Field>
      ) : null}
      <FormError state={state} />
      <SubmitButton className="w-full" size="lg">
        إنشاء حسابي
      </SubmitButton>
    </form>
  )
}
