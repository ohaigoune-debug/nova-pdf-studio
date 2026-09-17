'use client'

import { Play } from 'lucide-react'
import { useActionState, useState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Button, type ButtonProps } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input, Select } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { t } from '@/i18n'
import { startSessionAction } from '@/server/actions/sessions.actions'

export interface GroupOption {
  id: string
  name: string
  lateAfterMinutes?: number
  hasOpenSession?: boolean
}

export function StartSessionDialog({ groups, defaultGroupId, label, variant, size, className }: { groups: GroupOption[]; defaultGroupId?: string; label?: string; variant?: ButtonProps['variant']; size?: ButtonProps['size']; className?: string }) {
  const [open, setOpen] = useState(false)
  const [state, action] = useActionState(startSessionAction, null)
  const [groupId, setGroupId] = useState(defaultGroupId ?? groups[0]?.id ?? '')
  const selected = groups.find((g) => g.id === groupId)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className} disabled={groups.length === 0}>
          <Play className="size-4" /> {label ?? t('sessions.start')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('sessions.start')}</DialogTitle>
          <DialogDescription>{t('sessions.startFor')}</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <Field label={t('common.group')} htmlFor="groupId" error={fieldError(state, 'groupId')}>
            <Select id="groupId" name="groupId" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} {g.hasOpenSession ? '— (مفتوحة)' : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('sessions.titleField')} htmlFor="title">
            <Input id="title" name="title" placeholder={t('sessions.titlePlaceholder')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('sessions.topic')} htmlFor="topic">
              <Input id="topic" name="topic" />
            </Field>
            <Field label={t('groups.lateAfter')} htmlFor="lateAfterMinutes">
              <Input id="lateAfterMinutes" name="lateAfterMinutes" type="number" min={0} max={120} defaultValue={selected?.lateAfterMinutes ?? 10} />
            </Field>
          </div>
          <FormError state={state} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <SubmitButton name="redirectTo" value="scanner" className="flex-1">
              {t('sessions.start')} + {t('dashboard.openScanner')}
            </SubmitButton>
            <SubmitButton name="redirectTo" value="session" variant="outline" className="flex-1">
              {t('sessions.start')}
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
