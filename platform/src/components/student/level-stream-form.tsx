'use client'

import { useActionState, useState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Select } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { saveMyLevelStreamAction } from '@/server/actions/student-scope.actions'

export interface LevelStreamOptions {
  levels: { id: string; name: string; secondary: boolean; streamIds: string[] }[]
  streams: { id: string; name: string }[]
}

/**
 * اختيار المستوى والشعبة وحفظهما في حساب التلميذ (نفس قواعد التسجيل: الشعبة إلزامية للثانوي ومن شعب سنته).
 * يُستعمل مرة واحدة في «دروسي» لمن لا مستوى له، وفي «حسابي» للتغيير.
 */
export function LevelStreamForm({ options, levelId: initialLevel, streamId: initialStream, submitLabel, savedText }: { options: LevelStreamOptions; levelId?: string | null; streamId?: string | null; submitLabel: string; savedText?: string }) {
  const [state, action] = useActionState(saveMyLevelStreamAction, null)
  const [levelId, setLevelId] = useState(initialLevel ?? '')
  const [streamId, setStreamId] = useState(initialStream ?? '')
  const level = options.levels.find((l) => l.id === levelId)
  const needsStream = Boolean(level?.secondary)
  const levelStreams = level?.streamIds.length ? options.streams.filter((s) => level.streamIds.includes(s.id)) : options.streams
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="المستوى" htmlFor="scope-level" error={fieldError(state, 'levelId')}>
          <Select id="scope-level" name="levelId" value={levelId} onChange={(e) => { setLevelId(e.target.value); setStreamId('') }} required>
            <option value="">—</option>
            {options.levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الشعبة" htmlFor="scope-stream" error={fieldError(state, 'streamId')} hint={levelId && !needsStream ? 'لا شعب في هذا المستوى' : undefined}>
          <Select id="scope-stream" name="streamId" value={needsStream ? streamId : ''} onChange={(e) => setStreamId(e.target.value)} required={needsStream} disabled={!needsStream}>
            <option value="">—</option>
            {levelStreams.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <FormError state={state} />
      {state?.ok && savedText ? <p role="status" className="text-sm font-semibold">{savedText}</p> : null}
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  )
}
