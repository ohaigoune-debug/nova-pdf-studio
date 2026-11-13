'use client'

import { useActionState } from 'react'
import { FormError, SubmitButton } from '@/components/forms/form-bits'
import { savePlayBacIosOnlyAction } from '@/server/actions/student-menu.actions'

/** PLAY وبنك البكالوريات: في تطبيق آيفون وحده، أو في الموقع أيضًا */
export function IosOnlyForm({ iosOnly }: { iosOnly: boolean }) {
  const [state, action] = useActionState(savePlayBacIosOnlyAction, null)
  return (
    <form action={action} className="space-y-3">
      <label className="flex min-h-11 items-start gap-3 text-sm">
        <input type="checkbox" name="iosOnly" defaultChecked={iosOnly} className="mt-0.5 size-5 shrink-0" />
        <span className="min-w-0">
          <span className="block font-bold">PLAY وبنك البكالوريات في تطبيق آيفون وحده</span>
          <span className="mt-1 block leading-relaxed text-muted-foreground">
            <b>مؤشَّر:</b> يختفيان من الموقع ومن تطبيق أندرويد (القائمة، والتبويبات، والصفحة الرئيسية، وصفحة الدورة، والمكتبة)، وتُحوَّل روابطهما إلى الرئيسية. يبقيان في تطبيق آيفون، وتراهما أنت ورافع المحتوى في الموقع للمراجعة.
          </span>
          <span className="mt-1 block leading-relaxed text-muted-foreground"><b>غير مؤشَّر:</b> يظهران للجميع كما كانا.</span>
        </span>
      </label>
      <FormError state={state} />
      {state?.ok ? <p className="text-sm text-success" role="status">حُفظ. يسري خلال 15 ثانية على الأكثر.</p> : null}
      <SubmitButton>حفظ</SubmitButton>
    </form>
  )
}
