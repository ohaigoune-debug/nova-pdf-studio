'use client'

import { Ban, Copy, Download, KeyRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useState, useTransition } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { formatDate, formatDateTime } from '@/lib/utils'
import { disableCourseCodeBatchAction, generateCourseCodesAction, type CourseCodesData } from '@/server/actions/courses.actions'

interface Batch {
  batchId: string
  courseTitle: string
  label: string | null
  total: number
  used: number
  disabled: number
  expiresAt: string | null
  createdAt: string
}

/** يقسم الكود 11 رقماً للقراءة: 482 0391 7562 */
const pretty = (c: string) => `${c.slice(0, 3)} ${c.slice(3, 7)} ${c.slice(7)}`

/** توليد أكواد ← اختيار الدورة الموجّهة لها ← طباعة/تصدير. كل كود يفتح تلك الدورة وحدها، مرة واحدة. */
export function CourseCodesPanel({ courses, batches, defaultCourseId }: { courses: { id: string; title: string }[]; batches: Batch[]; defaultCourseId?: string }) {
  const router = useRouter()
  const [state, action] = useActionState(generateCourseCodesAction, null)
  const [generated, setGenerated] = useState<CourseCodesData | null>(null)
  const [pending, start] = useTransition()
  useEffect(() => {
    if (state?.ok) {
      setGenerated(state.data)
      toast('success', `وُلّد ${state.data.codes.length} كوداً لدورة «${state.data.courseTitle}»`)
      router.refresh()
    }
  }, [state, router])

  const csv = () => {
    if (!generated) return
    const body = ['code,course', ...generated.codes.map((c) => `${c},"${generated.courseTitle.replace(/"/g, '""')}"`)].join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `course-codes-${generated.batchId.slice(0, 8)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  const copy = () => generated && void navigator.clipboard.writeText(generated.codes.join('\n')).then(() => toast('success', 'نُسخت الأكواد'))
  const disable = (batchId: string) =>
    confirm('تعطيل كل الأكواد غير المستعملة في هذه الدفعة؟ لا رجوع.') &&
    start(async () => {
      const r = await disableCourseCodeBatchAction(batchId)
      if (!r.ok) return toast('error', r.error.message)
      toast('success', `عُطّل ${r.data.disabled} كوداً`)
      router.refresh()
    })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" /> توليد أكواد
          </CardTitle>
          <CardDescription>اختر الدورة الموجّهة لها الأكواد. يُدخل التلميذ الكود في «تفعيل دورة» (/claim) فتُفتح له هذه الدورة وحدها. كل كود مرة واحدة.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="grid gap-3 sm:grid-cols-4">
            <Field label="الدورة" htmlFor="cc-course" error={fieldError(state, 'courseId')} className="sm:col-span-2">
              <Select id="cc-course" name="courseId" defaultValue={defaultCourseId ?? ''} required>
                <option value="">اختر الدورة…</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="العدد" htmlFor="cc-count" error={fieldError(state, 'count')}>
              <Input id="cc-count" name="count" type="number" min={1} max={1000} defaultValue={50} required dir="ltr" />
            </Field>
            <Field label="ينتهي في (اختياري)" htmlFor="cc-exp">
              <Input id="cc-exp" name="expiresOn" type="date" dir="ltr" />
            </Field>
            <Field label="اسم الدفعة (اختياري)" htmlFor="cc-label" className="sm:col-span-3">
              <Input id="cc-label" name="label" maxLength={80} placeholder="مثال: طبعة أكتوبر — مكتبة بوسعادة" />
            </Field>
            <div className="flex items-end">
              <SubmitButton className="w-full">توليد</SubmitButton>
            </div>
            <div className="sm:col-span-4">
              <FormError state={state} />
            </div>
          </form>
        </CardContent>
      </Card>

      {generated ? (
        <Card className="border-primary/40">
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>
              {generated.codes.length} كود — «{generated.courseTitle}»
            </CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copy}>
                <Copy className="size-4" /> نسخ
              </Button>
              <Button size="sm" onClick={csv}>
                <Download className="size-4" /> تنزيل CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-destructive">احفظها الآن: لا تُعرض الأكواد مرة أخرى (نحفظ بصمتها فقط).</p>
            <div className="grid gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
              {generated.codes.map((c) => (
                <code key={c} dir="ltr" className="rounded border bg-muted/40 px-2 py-1 text-center font-mono text-sm">
                  {pretty(c)}
                </code>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>الدفعات</CardTitle>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا دفعات بعد.</p>
          ) : (
            <ul className="divide-y text-sm">
              {batches.map((b) => (
                <li key={b.batchId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span>
                    <span className="font-semibold">{b.courseTitle}</span>
                    {b.label ? <span className="text-muted-foreground"> · {b.label}</span> : null}
                    <span className="block text-xs text-muted-foreground">
                      {formatDateTime(new Date(b.createdAt))}
                      {b.expiresAt ? ` · ينتهي ${formatDate(b.expiresAt.slice(0, 10))}` : ''}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant="success">{b.used} مستعمل</Badge>
                    <Badge variant="secondary">{b.total - b.used - b.disabled} متاح</Badge>
                    {b.disabled ? <Badge variant="muted">{b.disabled} معطَّل</Badge> : null}
                    {b.total - b.used - b.disabled > 0 ? (
                      <Button size="sm" variant="ghost" loading={pending} onClick={() => disable(b.batchId)} title="تعطيل غير المستعمل">
                        <Ban className="size-4 text-destructive" />
                      </Button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
