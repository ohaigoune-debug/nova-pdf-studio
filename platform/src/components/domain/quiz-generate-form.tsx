'use client'

import { FolderOpen, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useActionState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Alert } from '@/components/ui/misc'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { requestQuizGenerationAction } from '@/server/actions/quiz-generate.actions'
import { MultiFilePicker, type PickableFile } from './multi-file-picker'

const TYPES = [
  { v: 'MCQ', label: 'اختيار من متعدد' },
  { v: 'TRUE_FALSE', label: 'صحيح / خطأ' },
  { v: 'FILL_BLANK', label: 'املأ الفراغ' },
  { v: 'SHORT_ANSWER', label: 'إجابة قصيرة' }
]

export function QuizGenerateForm({ groups, files, linkedFolder }: { groups: { id: string; name: string }[]; files: PickableFile[]; linkedFolder: { name: string; files: number } | null }) {
  const [state, action] = useActionState(requestQuizGenerationAction, null)
  if (state?.ok) {
    return (
      <Alert tone="success" title="بدأ التوليد">
        <p>يقرأ الذكاء الاصطناعي مصادرك ويبني الأسئلة منها وحدها. ستصلك إشعار حين تجهز المسودة (دقيقة إلى دقيقتين)، فتراجعها وتنشرها.</p>
        <p className="mt-2">
          <Link href="/teacher/quizzes" className="font-bold text-primary">
            العودة إلى الاختبارات
          </Link>
        </p>
      </Alert>
    )
  }
  return (
    <form action={action} className="space-y-6">
      <section className="space-y-3">
        <h2 className="font-extrabold">١. المصادر — لا يُسأل إلا عمّا فيها</h2>
        {linkedFolder ? (
          <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
            <input type="checkbox" name="useLinkedFolder" defaultChecked className="size-4 accent-[hsl(var(--primary))]" />
            <FolderOpen className="size-4 text-primary" /> مجلد Drive المربوط: <strong>{linkedFolder.name}</strong> ({linkedFolder.files} ملف)
          </label>
        ) : (
          <p className="text-xs text-muted-foreground">
            لا مجلد Drive مربوط.{' '}
            <Link href="/teacher/settings#drive" className="font-bold text-primary">
              اربطه من الإعدادات
            </Link>{' '}
            أو استعمل الروابط والملفات أدناه.
          </p>
        )}
        <Field label="روابط Google Drive (ملف أو مجلد — رابط في كل سطر)" htmlFor="driveLinks" hint="المشاركة: «أي شخص لديه الرابط — عارض».">
          <Textarea id="driveLinks" name="driveLinks" rows={3} dir="ltr" placeholder="https://drive.google.com/file/d/…" />
        </Field>
        <Field label="ملفاتك (PDF، Word، نص)" error={fieldError(state, 'sources')}>
          <MultiFilePicker files={files} />
        </Field>
      </section>

      <section className="space-y-3">
        <h2 className="font-extrabold">٢. الاختبار</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="الموضوع (اختياري)" htmlFor="topic" hint="مثل «الاستعارة». فارغاً: الاختبار يشمل المصادر المختارة كلّها.">
            <Input id="topic" name="topic" />
          </Field>
          <Field label="عنوان الاختبار (اختياري)" htmlFor="title">
            <Input id="title" name="title" />
          </Field>
          <Field label="عدد الأسئلة" htmlFor="count">
            <Select id="count" name="count" defaultValue="10">
              {[5, 10, 15, 20].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          {TYPES.map((x) => (
            <label key={x.v} className="flex items-center gap-2 rounded-md border px-3 py-2">
              <input type="checkbox" name="questionTypes" value={x.v} defaultChecked className="size-4 accent-[hsl(var(--primary))]" /> {x.label}
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-extrabold">٣. لمن؟</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          {groups.map((g) => (
            <label key={g.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
              <input type="checkbox" name="groupIds" value={g.id} className="size-4 accent-[hsl(var(--primary))]" /> {g.name}
            </label>
          ))}
          {groups.length === 0 ? <p className="text-xs text-muted-foreground">أنشئ فوجاً أولاً.</p> : null}
        </div>
        <p className="text-xs text-muted-foreground">الاختبار يبقى مسودة لا يراها التلاميذ حتى تراجعه وتنشره.</p>
      </section>

      <FormError state={state} />
      <SubmitButton size="lg">
        <Sparkles className="size-4" /> ولّد الاختبار من مصادري
      </SubmitButton>
    </form>
  )
}
