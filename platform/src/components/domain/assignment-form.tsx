'use client'

import { useActionState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { t } from '@/i18n'
import { createAssignmentAction, updateAssignmentAction } from '@/server/actions/assignments.actions'
import type { ActionResult } from '@/server/lib/action-result'

type Opt = { id: string; name: string }

export interface AssignmentFormDefaults {
  title?: string
  description?: string | null
  subject?: string | null
  topic?: string | null
  skillId?: string | null
  startsAt?: Date | null
  dueAt?: Date | null
  maxScore?: string | number
  attachmentFileId?: string | null
  groupIds?: string[]
  studentIds?: string[]
}

function toLocalInput(d: Date | null | undefined): string {
  if (!d) return ''
  const x = new Date(d)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`
}

export function AssignmentForm({ assignmentId, defaults = {}, groups, students, skills, files }: { assignmentId?: string; defaults?: AssignmentFormDefaults; groups: Opt[]; students: Opt[]; skills: Opt[]; files: Opt[] }) {
  const action = assignmentId
    ? (updateAssignmentAction.bind(null, assignmentId) as (p: ActionResult<unknown> | null, fd: FormData) => Promise<ActionResult<unknown>>)
    : (createAssignmentAction as (p: ActionResult<unknown> | null, fd: FormData) => Promise<ActionResult<unknown>>)
  const [state, formAction] = useActionState(action, null)
  return (
    <form action={formAction} className="space-y-5">
      <Field label={t('assignments.titleField')} htmlFor="title" error={fieldError(state, 'title')}>
        <Input id="title" name="title" defaultValue={defaults.title ?? ''} placeholder={t('assignments.titlePlaceholder')} required />
      </Field>
      <Field label={t('assignments.description')} htmlFor="description">
        <Textarea id="description" name="description" rows={6} defaultValue={defaults.description ?? ''} placeholder={t('assignments.descriptionPlaceholder')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t('assignments.subject')} htmlFor="subject">
          <Input id="subject" name="subject" defaultValue={defaults.subject ?? 'اللغة العربية'} />
        </Field>
        <Field label={t('assignments.topic')} htmlFor="topic">
          <Input id="topic" name="topic" defaultValue={defaults.topic ?? ''} />
        </Field>
        <Field label={t('assignments.skill')} htmlFor="skillId">
          <Select id="skillId" name="skillId" defaultValue={defaults.skillId ?? ''}>
            <option value="">—</option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('assignments.startsAt')} htmlFor="startsAt">
          <Input id="startsAt" name="startsAt" type="datetime-local" defaultValue={toLocalInput(defaults.startsAt)} dir="ltr" />
        </Field>
        <Field label={t('assignments.dueAt')} htmlFor="dueAt" error={fieldError(state, 'dueAt')}>
          <Input id="dueAt" name="dueAt" type="datetime-local" defaultValue={toLocalInput(defaults.dueAt)} dir="ltr" />
        </Field>
        <Field label={t('assignments.maxScore')} htmlFor="maxScore" error={fieldError(state, 'maxScore')}>
          <Input id="maxScore" name="maxScore" type="number" min={1} max={1000} step="0.5" defaultValue={defaults.maxScore ?? 20} />
        </Field>
      </div>
      <Field label={t('assignments.attachment')} htmlFor="attachmentFileId" hint="الملفات تُرفع من صفحة الملفات.">
        <Select id="attachmentFileId" name="attachmentFileId" defaultValue={defaults.attachmentFileId ?? ''}>
          <option value="">—</option>
          {files.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>
      </Field>
      <fieldset className="rounded-lg border p-4">
        <legend className="px-1 text-sm font-bold">{t('assignments.targets')}</legend>
        <p className="mb-3 text-xs text-muted-foreground">{t('assignments.targetHint')}</p>
        {fieldError(state, 'targets') ? <p className="mb-2 text-xs text-destructive">{fieldError(state, 'targets')}</p> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold">{t('assignments.targetGroups')}</p>
            <div className="space-y-1">
              {groups.map((g) => (
                <label key={g.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="groupIds" value={g.id} defaultChecked={defaults.groupIds?.includes(g.id)} className="size-4" />
                  {g.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold">{t('assignments.targetStudents')}</p>
            <select name="studentIds" multiple defaultValue={defaults.studentIds ?? []} className="h-40 w-full rounded-md border bg-background p-2 text-sm">
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>
      <FormError state={state} />
      {state?.ok && assignmentId ? <p className="text-sm text-success">{t('assignments.updated')}</p> : null}
      <SubmitButton size="lg">{assignmentId ? t('common.save') : t('common.create')}</SubmitButton>
    </form>
  )
}
