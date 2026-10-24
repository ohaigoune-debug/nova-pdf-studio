'use client'

import { Copy, PhoneIncoming, RefreshCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useRef } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { formatDateTime } from '@/lib/utils'
import { saveCallConfirmAction, type CallConfirmView } from '@/server/actions/ecotrack.actions'

/**
 * إعداد التأكيد بالمكالمة الفائتة (تطبيق NOVA Call على هاتف المشرف):
 * الرقم المعلَن للزبائن، النافذة الزمنية، قطع المكالمة المطابقة، وعنوان الاقتران بسرّه.
 */
export function CallConfirmForm({ cfg }: { cfg: CallConfirmView }) {
  const router = useRouter()
  const [state, action] = useActionState(saveCallConfirmAction, null)
  const rotate = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (state?.ok) {
      toast('success', 'حُفظ إعداد التأكيد بالمكالمة')
      router.refresh()
    }
  }, [state, router])
  const view = state?.ok ? state.data : cfg
  const copy = () => {
    if (view.pairingUrl) void navigator.clipboard.writeText(view.pairingUrl).then(() => toast('success', 'نُسخ العنوان'))
  }
  const seen = view.lastSeenAt ? new Date(view.lastSeenAt) : null
  const alive = seen ? Date.now() - seen.getTime() < 2 * 3_600_000 : false
  return (
    <form action={action} className="space-y-4 text-sm">
      <label className="flex items-start gap-3 rounded-lg border p-3">
        <input type="checkbox" name="enabled" className="mt-1 size-4" defaultChecked={view.enabled} />
        <span>
          <span className="flex items-center gap-1 font-semibold">
            <PhoneIncoming className="size-4" /> تفعيل التأكيد بالمكالمة الفائتة
          </span>
          <span className="block text-xs text-muted-foreground">يُقال للزبون: «اتصل بهذا الرقم ولا تنتظر الردّ». مكالمة من هاتف طلب معلّق تؤكّده تلقائياً وتُخطرك.</span>
        </span>
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="الرقم الذي يتصل به الزبون" htmlFor="cc-number" error={fieldError(state, 'number')} hint="هاتف المشرف الذي عليه التطبيق">
          <Input id="cc-number" name="number" dir="ltr" inputMode="tel" placeholder="05XXXXXXXX" defaultValue={view.number} />
        </Field>
        <Field label="نافذة المطابقة" htmlFor="cc-window" hint="تؤكّد المكالمة الطلبات المنشأة خلالها">
          <Select id="cc-window" name="windowHours" defaultValue={String(view.windowHours)}>
            <option value="24">24 ساعة</option>
            <option value="72">3 أيام</option>
            <option value="168">7 أيام</option>
          </Select>
        </Field>
        <label className="flex items-start gap-2 self-end rounded-lg border p-3">
          <input type="checkbox" name="autoReject" className="mt-0.5 size-4" defaultChecked={view.autoReject} />
          <span className="text-xs">قطع المكالمة المطابقة بعد أول رنّة (لا تكلّف الزبون شيئاً)</span>
        </label>
      </div>
      <input ref={rotate} type="hidden" name="rotate" value="0" />
      <div className="rounded-lg border bg-muted/40 p-3">
        <p className="font-semibold">عنوان الاقتران في تطبيق NOVA Call</p>
        {view.pairingUrl ? (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <code dir="ltr" className="break-all rounded bg-background px-2 py-1 text-xs">
              {view.pairingUrl}
            </code>
            <Button type="button" size="sm" variant="outline" onClick={copy}>
              <Copy className="size-4" /> نسخ
            </Button>
            <SubmitButton
              size="sm"
              variant="ghost"
              onClick={() => {
                if (rotate.current) rotate.current.value = confirm('تدوير السرّ؟ يتوقف العنوان القديم فوراً وتعيد الاقتران في التطبيق.') ? '1' : '0'
              }}
            >
              <RefreshCcw className="size-4" /> تدوير السرّ
            </SubmitButton>
          </div>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">يظهر بعد أول حفظ (ويحتاج APP_URL في البيئة).</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          التطبيق: {seen ? <Badge variant={alive ? 'success' : 'warning'}>{alive ? 'متصل' : 'لم يصل منذ مدة'} · آخر إشارة {formatDateTime(seen)}{view.appVersion ? ` · v${view.appVersion}` : ''}</Badge> : <Badge variant="muted">لم يتصل بعد</Badge>}
        </p>
      </div>
      <FormError state={state} />
      <SubmitButton size="sm">حفظ</SubmitButton>
    </form>
  )
}
