'use client'

import { FolderOpen, Unlink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useTransition } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { linkDriveAction, unlinkDriveAction } from '@/server/actions/drive.actions'
import type { DriveSource } from '@/server/services/drive-source.service'

/** مجلد Google Drive الذي تُولَّد منه التمارين — ولا مصدر غيره */
export function DriveSourceCard({ source }: { source: DriveSource | null }) {
  const router = useRouter()
  const [state, action] = useActionState(linkDriveAction, null)
  const [pending, start] = useTransition()
  const unlink = () =>
    start(async () => {
      const r = await unlinkDriveAction()
      if (!r.ok) toast('error', r.error.message)
      else router.refresh()
    })
  const current = state?.ok ? state.data : source
  return (
    <Card id="drive">
      <CardHeader>
        <CardTitle>مصدر التمارين: مجلد Google Drive</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          التمارين العلاجية تُولَّد من دروسك في هذا المجلد <strong className="text-foreground">وحدها</strong>: كل سؤال وإجابته من نصوصك، ولا يضيف الذكاء
          الاصطناعي شيئاً من عنده. إن لم يجد في المجلد ما يخصّ المهارة، لا يولّد شيئاً ويخبرك.
        </p>
        {current ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3">
            <span className="flex items-center gap-2 font-bold">
              <FolderOpen className="size-5 text-primary" /> {current.folderName || 'مجلد Drive'} — {current.files} ملف
            </span>
            <Button type="button" size="sm" variant="ghost" onClick={unlink} loading={pending}>
              <Unlink className="size-4" /> فكّ الربط
            </Button>
          </div>
        ) : null}
        <form action={action} className="space-y-3">
          <Field label={current ? 'تغيير المجلد' : 'رابط المجلد'} htmlFor="drive-url" error={fieldError(state, 'url')}>
            <Input id="drive-url" name="url" dir="ltr" placeholder="https://drive.google.com/drive/folders/…" required />
          </Field>
          <FormError state={state} />
          <SubmitButton>{current ? 'ربط المجلد الجديد' : 'ربط المجلد'}</SubmitButton>
        </form>
        <ol className="list-decimal space-y-1 ps-5 text-xs text-muted-foreground">
          <li>ضع دروسك في مجلد واحد: مستندات Google، أو عروضها، أو PDF فيها نصّ، أو Word. المجلدات الفرعية تُقرأ أيضاً.</li>
          <li>في Drive: زرّ «مشاركة» ← «أي شخص لديه الرابط» ← «عارض»، ثم «نسخ الرابط».</li>
          <li>الصق الرابط هنا. ما تضيفه لاحقاً إلى المجلد يُقرأ تلقائياً عند التوليد التالي.</li>
        </ol>
      </CardContent>
    </Card>
  )
}
