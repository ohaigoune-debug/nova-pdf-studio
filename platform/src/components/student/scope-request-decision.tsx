'use client'

import { Check, X } from 'lucide-react'
import { useActionState, useState } from 'react'
import { FormError, SubmitButton } from '@/components/forms/form-bits'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { decideScopeRequestAction } from '@/server/actions/student-scope.actions'

/** قبول الطلب (يُطبَّق على الحساب فورًا) أو رفضه بسبب يصل إلى التلميذ — نموذجان منفصلان بقرار صريح لكلٍّ */
export function ScopeRequestDecision({ id }: { id: string }) {
  const [state, action] = useActionState(decideScopeRequestAction, null)
  const [rejecting, setRejecting] = useState(false)
  if (state?.ok) return <span className="text-sm font-semibold text-muted-foreground">تمّ</span>
  return (
    <div className="space-y-2">
      {rejecting ? (
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="decision" value="reject" />
          <Input name="note" required maxLength={300} placeholder="سبب الرفض (يصل إلى التلميذ)" className="h-9 w-56" aria-label="سبب الرفض" />
          <SubmitButton size="sm" variant="destructive">
            ارفض
          </SubmitButton>
          <Button type="button" size="sm" variant="ghost" onClick={() => setRejecting(false)}>
            إلغاء
          </Button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <form action={action}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="decision" value="approve" />
            <SubmitButton size="sm">
              <Check className="size-4" /> أكّد التغيير
            </SubmitButton>
          </form>
          <Button type="button" size="sm" variant="outline" onClick={() => setRejecting(true)}>
            <X className="size-4" /> رفض
          </Button>
        </div>
      )}
      <FormError state={state} />
    </div>
  )
}
