'use client'

import { useActionState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { dayName, t } from '@/i18n'
import { createGroupAction, updateGroupAction } from '@/server/actions/groups.actions'
import type { ActionResult } from '@/server/lib/action-result'

type Opt = { id: string; name: string }

export interface GroupFormDefaults {
  name?: string
  wilayaId?: string | null
  schoolId?: string | null
  levelId?: string | null
  streamId?: string | null
  academicYearId?: string | null
  dayOfWeek?: number | null
  startTime?: string | null
  durationMinutes?: number
  room?: string | null
  capacity?: number | null
  startsOn?: string | null
  endsOn?: string | null
  status?: string
  lateAfterMinutes?: number
  maxUnexcusedAbsences?: number
  notes?: string | null
}

export function GroupForm({
  groupId,
  defaults = {},
  wilayas,
  schools,
  levels,
  streams,
  years
}: {
  groupId?: string
  defaults?: GroupFormDefaults
  wilayas: Opt[]
  schools: (Opt & { wilayaId: string })[]
  levels: Opt[]
  streams: Opt[]
  years: Opt[]
}) {
  const action = groupId ? (updateGroupAction.bind(null, groupId) as (prev: ActionResult<unknown> | null, fd: FormData) => Promise<ActionResult<unknown>>) : (createGroupAction as (prev: ActionResult<unknown> | null, fd: FormData) => Promise<ActionResult<unknown>>)
  const [state, formAction] = useActionState(action, null)
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => dayName(i))
  return (
    <form action={formAction} className="space-y-5">
      <Field label={t('groups.name')} htmlFor="name" error={fieldError(state, 'name')}>
        <Input id="name" name="name" defaultValue={defaults.name ?? ''} placeholder={t('groups.namePlaceholder')} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('common.wilaya')} htmlFor="wilayaId">
          <Select id="wilayaId" name="wilayaId" defaultValue={defaults.wilayaId ?? ''}>
            <option value="">—</option>
            {wilayas.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('common.school')} htmlFor="schoolId">
          <Select id="schoolId" name="schoolId" defaultValue={defaults.schoolId ?? ''}>
            <option value="">—</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('common.level')} htmlFor="levelId">
          <Select id="levelId" name="levelId" defaultValue={defaults.levelId ?? ''}>
            <option value="">—</option>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('common.stream')} htmlFor="streamId">
          <Select id="streamId" name="streamId" defaultValue={defaults.streamId ?? ''}>
            <option value="">—</option>
            {streams.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('common.academicYear')} htmlFor="academicYearId">
          <Select id="academicYearId" name="academicYearId" defaultValue={defaults.academicYearId ?? years[years.length - 1]?.id ?? ''}>
            <option value="">—</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('common.status')} htmlFor="status">
          <Select id="status" name="status" defaultValue={defaults.status ?? 'ACTIVE'}>
            <option value="ACTIVE">{t('groupStatus.ACTIVE')}</option>
            <option value="PAUSED">{t('groupStatus.PAUSED')}</option>
            <option value="COMPLETED">{t('groupStatus.COMPLETED')}</option>
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t('common.day')} htmlFor="dayOfWeek">
          <Select id="dayOfWeek" name="dayOfWeek" defaultValue={defaults.dayOfWeek ?? ''}>
            <option value="">—</option>
            {days.map((d, i) => (
              <option key={i} value={i}>
                {d}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('common.startTime')} htmlFor="startTime">
          <Input id="startTime" name="startTime" type="time" defaultValue={defaults.startTime?.slice(0, 5) ?? ''} dir="ltr" />
        </Field>
        <Field label={`المدة (${t('common.minutes')})`} htmlFor="durationMinutes">
          <Input id="durationMinutes" name="durationMinutes" type="number" min={15} max={300} defaultValue={defaults.durationMinutes ?? 90} />
        </Field>
        <Field label={t('common.room')} htmlFor="room">
          <Input id="room" name="room" defaultValue={defaults.room ?? ''} />
        </Field>
        <Field label={t('common.capacity')} htmlFor="capacity">
          <Input id="capacity" name="capacity" type="number" min={1} max={500} defaultValue={defaults.capacity ?? ''} />
        </Field>
        <div />
        <Field label="تاريخ البداية" htmlFor="startsOn">
          <Input id="startsOn" name="startsOn" type="date" defaultValue={defaults.startsOn ?? ''} dir="ltr" />
        </Field>
        <Field label="تاريخ النهاية" htmlFor="endsOn">
          <Input id="endsOn" name="endsOn" type="date" defaultValue={defaults.endsOn ?? ''} dir="ltr" />
        </Field>
      </div>
      <div className="grid gap-4 rounded-lg border border-dashed p-4 sm:grid-cols-2">
        <Field label={t('groups.lateAfter')} htmlFor="lateAfterMinutes">
          <Input id="lateAfterMinutes" name="lateAfterMinutes" type="number" min={0} max={120} defaultValue={defaults.lateAfterMinutes ?? 10} />
        </Field>
        <Field label={t('groups.maxUnexcused')} htmlFor="maxUnexcusedAbsences">
          <Input id="maxUnexcusedAbsences" name="maxUnexcusedAbsences" type="number" min={1} max={30} defaultValue={defaults.maxUnexcusedAbsences ?? 4} />
        </Field>
      </div>
      <Field label={t('common.notes')} htmlFor="notes">
        <Textarea id="notes" name="notes" defaultValue={defaults.notes ?? ''} />
      </Field>
      <FormError state={state} />
      {state?.ok && groupId ? <p className="text-sm text-success">{t('groups.updated')}</p> : null}
      <SubmitButton size="lg">{groupId ? t('common.save') : t('common.create')}</SubmitButton>
    </form>
  )
}
