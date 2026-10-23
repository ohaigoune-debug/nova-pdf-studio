'use client'

import { KeyRound, Trash2, Upload, Wifi } from 'lucide-react'
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
import { clearBunnyCredentialsAction, saveBunnyCredentialsAction, testBunnyAction, uploadBunnyVideoAction } from '@/server/actions/video.actions'
import type { BunnyCredentialsView } from '@/server/lib/bunny'

/** اعتمادات Bunny Stream: تُختبر ثم تُحفظ مختومة؛ لا تُعرض بعدها إلا آخر 4 أحرف */
export function BunnySettingsCard({ saved }: { saved: BunnyCredentialsView | null }) {
  const router = useRouter()
  const [state, action] = useActionState(saveBunnyCredentialsAction, null)
  const [pending, start] = useTransition()
  const form = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.ok) {
      toast('success', `حُفظت اعتمادات Bunny وجُرِّبت بنجاح (${state.data.totalItems} فيديو في المكتبة)`)
      form.current?.reset()
    }
  }, [state])

  const test = () =>
    start(async () => {
      const r = await testBunnyAction()
      if (!r.ok) toast('error', r.error.message)
      else toast('success', `الاتصال سليم — ${r.data.totalItems} فيديو في المكتبة`)
    })

  const clear = () => {
    if (!confirm('حذف اعتمادات Bunny المحفوظة؟ ستتوقف فيديوهات Bunny عن العرض حتى تُدخل من جديد.')) return
    start(async () => {
      const r = await clearBunnyCredentialsAction()
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
          <KeyRound className="size-5 text-primary" /> اعتمادات Bunny Stream
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {saved ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3">
            <span>
              المكتبة <strong dir="ltr">{saved.libraryId}</strong> · API{' '}
              <span dir="ltr" className="font-mono">
                …{saved.apiKeyHint}
              </span>{' '}
              · توقيع{' '}
              <span dir="ltr" className="font-mono">
                …{saved.tokenKeyHint}
              </span>
              {saved.updatedAt ? <span className="text-xs text-muted-foreground"> · {formatDateTime(saved.updatedAt)}</span> : null}
              {!saved.usable ? <Badge variant="destructive" className="ms-2">لا تُفتح — أعد الإدخال</Badge> : <Badge variant="success" className="ms-2">مفعّل</Badge>}
            </span>
            <span className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={test} loading={pending}>
                <Wifi className="size-4" /> اختبار الاتصال
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={clear} loading={pending}>
                <Trash2 className="size-4" /> حذف
              </Button>
            </span>
          </div>
        ) : (
          <Alert tone="info">لم تُضبط اعتمادات Bunny بعد. أنشئ مكتبة Stream في لوحة Bunny، وفعّل Token Authentication، ثم أدخل المعطيات هنا.</Alert>
        )}
        <form ref={form} action={action} className="grid gap-3 sm:grid-cols-2">
          <Field label="معرّف المكتبة (Library ID)" htmlFor="libraryId" error={fieldError(state, 'libraryId')}>
            <Input id="libraryId" name="libraryId" dir="ltr" inputMode="numeric" defaultValue={saved?.libraryId ?? ''} required />
          </Field>
          <Field label="اسم مضيف CDN (اختياري)" htmlFor="cdnHostname" hint="مثل vz-xxxx.b-cdn.net" error={fieldError(state, 'cdnHostname')}>
            <Input id="cdnHostname" name="cdnHostname" dir="ltr" defaultValue={saved?.cdnHostname ?? ''} />
          </Field>
          <Field label="مفتاح API للمكتبة" htmlFor="apiKey" hint="من إعدادات المكتبة › API" error={fieldError(state, 'apiKey')}>
            <Input id="apiKey" name="apiKey" dir="ltr" type="password" autoComplete="off" required />
          </Field>
          <Field label="مفتاح التوقيع (Token Authentication Key)" htmlFor="tokenAuthKey" hint="من إعدادات المكتبة › Security" error={fieldError(state, 'tokenAuthKey')}>
            <Input id="tokenAuthKey" name="tokenAuthKey" dir="ltr" type="password" autoComplete="off" required />
          </Field>
          <div className="sm:col-span-2">
            <FormError state={state} />
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>اختبار وحفظ</SubmitButton>
          </div>
        </form>
        <p className="text-xs text-muted-foreground">الحماية تقلّل التسريب ولا تمنعه كلياً؛ العلامة المائية تحمل اسم التلميذ.</p>
      </CardContent>
    </Card>
  )
}

/** رفع فيديو صغير إلى Bunny من الخادم (حتى 200 MB)؛ الأكبر من لوحة Bunny ثم لصق المعرّف */
export function BunnyUploadCard({ enabled }: { enabled: boolean }) {
  const [state, action] = useActionState(uploadBunnyVideoAction, null)
  useEffect(() => {
    if (state?.ok) toast('success', `رُفع الفيديو — المعرّف: ${state.data.videoId}`)
  }, [state])
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="size-5 text-primary" /> رفع فيديو إلى Bunny
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!enabled ? <Alert tone="warning">اضبط الاعتمادات أولاً.</Alert> : null}
        <form action={action} className="space-y-3">
          <Field label="العنوان" htmlFor="bunny-title">
            <Input id="bunny-title" name="title" />
          </Field>
          <Field label="ملف الفيديو (حتى 200 MB)" htmlFor="bunny-file" hint="للملفات الأكبر: ارفعها من لوحة Bunny ثم الصق معرّف الفيديو في نموذج المحتوى." error={fieldError(state, 'file')}>
            <Input id="bunny-file" name="file" type="file" accept="video/*" required disabled={!enabled} />
          </Field>
          <FormError state={state} />
          {state?.ok ? (
            <Alert tone="success">
              معرّف الفيديو: <code dir="ltr">{state.data.videoId}</code> — الصقه في نموذج المحتوى (نوع فيديو › Bunny).
            </Alert>
          ) : null}
          <SubmitButton disabled={!enabled}>رفع</SubmitButton>
        </form>
      </CardContent>
    </Card>
  )
}
