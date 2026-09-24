'use client'

import { Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useActionState, useState } from 'react'
import { FormError, SubmitButton } from '@/components/forms/form-bits'
import { Alert } from '@/components/ui/misc'
import { Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { t } from '@/i18n'
import { requestFileImportAction } from '@/server/actions/file-import.actions'
import { MultiFilePicker, type PickableFile } from './multi-file-picker'

type Opt = { id: string; name: string }

/** استيراد ملفات كثيرة (من الجهاز أو Drive) دروساً مرتّبة بالذكاء الاصطناعي */
export function FileImportForm({ files, levels, streams, groups, aiEnabled }: { files: PickableFile[]; levels: Opt[]; streams: Opt[]; groups: Opt[]; aiEnabled: boolean }) {
  const [state, action] = useActionState(requestFileImportAction, null)
  const [visibility, setVisibility] = useState('STUDENTS_ONLY')
  if (state?.ok) {
    return (
      <Alert tone="success" title="بدأ الاستيراد">
        <p>تُقرأ الملفات وتُرتَّب دروساً. ستصلك إشعار حين تنتهي، فتراجعها في «المحتوى» وتنشرها.</p>
        <p className="mt-2">
          <Link href="/teacher/content" className="font-bold text-primary">
            إلى المحتوى
          </Link>
        </p>
      </Alert>
    )
  }
  return (
    <form action={action} className="space-y-5">
      <Field label="ملفات من جهازك أو من ملفاتك على المنصة">
        <MultiFilePicker files={files} />
      </Field>
      <Field label="أو روابط Google Drive (ملف أو مجلد — رابط في كل سطر)" htmlFor="import-drive" hint="تبقى الملفات على Drive، ويصير كل ملف درساً يُفتح منها. المشاركة: «أي شخص لديه الرابط — عارض».">
        <Textarea id="import-drive" name="driveLinks" rows={3} dir="ltr" placeholder="https://drive.google.com/drive/folders/…" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t('contentMgmt.level')} htmlFor="imp-level">
          <Select id="imp-level" name="levelId" defaultValue="">
            <option value="">—</option>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('contentMgmt.stream')} htmlFor="imp-stream">
          <Select id="imp-stream" name="streamId" defaultValue="">
            <option value="">—</option>
            {streams.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('contentMgmt.visibility')} htmlFor="imp-vis">
          <Select id="imp-vis" name="visibility" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            {['STUDENTS_ONLY', 'GROUP_ONLY', 'PUBLIC'].map((v) => (
              <option key={v} value={v}>
                {t(`contentMgmt.visibility${v}` as never)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {visibility === 'GROUP_ONLY' ? (
        <div className="flex flex-wrap gap-2 text-sm">
          {groups.map((g) => (
            <label key={g.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
              <input type="checkbox" name="groupIds" value={g.id} className="size-4 accent-[hsl(var(--primary))]" /> {g.name}
            </label>
          ))}
        </div>
      ) : null}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="organize" defaultChecked={aiEnabled} disabled={!aiEnabled} className="mt-1 size-4 accent-[hsl(var(--primary))]" />
        <span>
          <strong>نظّم بالذكاء الاصطناعي:</strong> عنوان درس من مضمون كل ملف، وملخّص سطرين، والمحور، وترتيب بيداغوجي.
          {!aiEnabled ? <span className="block text-xs text-muted-foreground">الذكاء الاصطناعي غير مفعّل على الخادم.</span> : null}
        </span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="publish" className="size-4 accent-[hsl(var(--primary))]" /> انشرها فوراً (وإلا تبقى مسوّدات تراجعها)
      </label>
      <FormError state={state} />
      <SubmitButton>
        <Sparkles className="size-4" /> استورد الملفات دروساً
      </SubmitButton>
    </form>
  )
}
