'use client'

import { useFormStatus } from 'react-dom'
import { Button, type ButtonProps } from '@/components/ui/button'
import { Alert } from '@/components/ui/misc'
import type { ActionResult } from '@/server/lib/action-result'

export function SubmitButton({ children, ...props }: ButtonProps) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" loading={pending} {...props}>
      {children}
    </Button>
  )
}

export function FormError({ state }: { state: ActionResult<unknown> | null }) {
  if (!state || state.ok) return null
  return (
    <Alert tone="destructive">
      <p>{state.error.message}</p>
      {state.error.fieldErrors ? (
        <ul className="mt-1 list-disc ps-5 text-xs">
          {Object.entries(state.error.fieldErrors).map(([k, v]) => (
            <li key={k}>{v}</li>
          ))}
        </ul>
      ) : null}
    </Alert>
  )
}

export function fieldError(state: ActionResult<unknown> | null, field: string): string | undefined {
  if (!state || state.ok) return undefined
  return state.error.fieldErrors?.[field]
}
