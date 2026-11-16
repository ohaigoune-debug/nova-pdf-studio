'use client'

import { Trash2, Video } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useRef, useTransition } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Alert } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { formatDateTime } from '@/lib/utils'
import { clearZoomSdkAction, saveZoomSdkAction } from '@/server/actions/zoom.actions'
import type { ZoomSdkView } from '@/server/lib/zoom'

/**
 * اعتمادات Zoom Meeting SDK: بها يدخل التلميذ الحصة داخل المنصة باسمه (رفع اليد، الميكروفون بإذن الأستاذ،
 * الدردشة) دون أن يرى رابط Zoom ولا رمزه. تُحفظ مختومة ولا يُعرض بعدها إلا آخر 4 أحرف.
 */
export function ZoomSettingsCard({ saved }: { saved: ZoomSdkView | null }) {
  const router = useRouter()
  const [state, action] = useActionState(saveZoomSdkAction, null)
  const [pending, start] = useTransition()
  const form = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.ok) {
      toast('success', 'حُفظت اعتمادات Zoom Meeting SDK')
      form.current?.reset()
      router.refresh()
    }
  }, [state, router])

  const clear = () => {
    if (!confirm('حذف اعتمادات Zoom؟ ستعود الحصص إلى فتح رابط Zoom الخارجي.')) return
    start(async () => {
      const r = await clearZoomSdkAction()
      if (!r.ok) toast('error', r.error.message)
      else {
        toast('success', 'حُذفت الاعتمادات')
        router.refresh()
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="size-5 text-primary" /> الحصص داخل المنصة (Zoom Meeting SDK)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {saved ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3">
            <span>
              Client ID{' '}
              <span dir="ltr" className="font-mono">
                …{saved.sdkKeyHint}
              </span>{' '}
              · Secret{' '}
              <span dir="ltr" className="font-mono">
                …{saved.secretHint}
              </span>
              {saved.updatedAt ? <span className="text-xs text-muted-foreground"> · {formatDateTime(saved.updatedAt)}</span> : null}
              {!saved.usable ? <Badge variant="destructive" className="ms-2">لا تُفتح — أعد الإدخال</Badge> : <Badge variant="success" className="ms-2">مفعّل</Badge>}
            </span>
            <Button type="button" size="sm" variant="ghost" onClick={clear} loading={pending}>
              <Trash2 className="size-4" /> حذف
            </Button>
          </div>
        ) : (
          <Alert tone="info">
            غير مضبوط: الحصص تفتح رابط Zoom في نافذة خارجية. للدخول من داخل المنصة: في Zoom Marketplace أنشئ تطبيقًا (General app) بالحساب نفسه الذي
            تبدأ منه الحصص، وفعّل فيه Meeting SDK، ثم انسخ Client ID وClient Secret هنا. لا يحتاج نشر التطبيق في Marketplace ما دامت الحصص على حسابك.
          </Alert>
        )}
        <form ref={form} action={action} className="grid gap-3 sm:grid-cols-2">
          <Field label="Client ID (SDK Key)" htmlFor="zoom-sdkKey" error={fieldError(state, 'sdkKey')}>
            <Input id="zoom-sdkKey" name="sdkKey" dir="ltr" autoComplete="off" spellCheck={false} required />
          </Field>
          <Field label="Client Secret (SDK Secret)" htmlFor="zoom-sdkSecret" error={fieldError(state, 'sdkSecret')}>
            <Input id="zoom-sdkSecret" name="sdkSecret" dir="ltr" type="password" autoComplete="off" required />
          </Field>
          <div className="sm:col-span-2">
            <FormError state={state} />
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>حفظ</SubmitButton>
          </div>
        </form>
        <p className="text-xs text-muted-foreground">
          في كل حصة: أدخل رقم الاجتماع ورمز الدخول. يدخل التلميذ باسم حسابه، ويُسجَّل حضوره. اشتراك Zoom الذي يسع 500 مشارك: Pro مع إضافة Large Meeting.
        </p>
      </CardContent>
    </Card>
  )
}
