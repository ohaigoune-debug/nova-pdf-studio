'use client'

import { useActionState, useEffect } from 'react'
import { FormError, SubmitButton } from '@/components/forms/form-bits'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { updateAiSettingsAction } from '@/server/actions/ai.actions'

export function AiSettingsForm({ autoEvaluate }: { autoEvaluate: boolean }) {
  const [state, action] = useActionState(updateAiSettingsAction, null)
  useEffect(() => {
    if (state?.ok) toast('success', t('ai.settingsSaved'))
  }, [state])
  return (
    <form action={action} className="space-y-3">
      <label className="flex items-start gap-3 rounded-lg border p-3">
        <input type="checkbox" name="autoEvaluate" defaultChecked={autoEvaluate} className="mt-1 size-4" />
        <span>
          <span className="block text-sm font-semibold">{t('ai.autoEvaluate')}</span>
          <span className="block text-xs text-muted-foreground">{t('ai.autoEvaluateHint')}</span>
        </span>
      </label>
      <FormError state={state} />
      <SubmitButton size="sm">{t('common.save')}</SubmitButton>
    </form>
  )
}
