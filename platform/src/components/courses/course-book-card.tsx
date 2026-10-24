'use client'

import { BookOpen } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useTransition } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Alert } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { chooseCourseBookAction, setCourseBookAction } from '@/server/actions/courses.actions'

export interface CourseBookCardProps {
  courseId: string
  courseTitle: string
  book: { id: string; title: string; priceDzd: number; stock: number | null; status: string } | null
  purchasable: boolean
  issueText: string | null
  /** كتب مرتبطة سابقاً (دورات قديمة) يمكن اعتماد أحدها */
  candidates: { id: string; title: string; priceDzd: number }[]
}

/** الكتاب المرفق بالدورة: يُنشأ ويُعدَّل هنا (بلا صفحة متجر). سعره هو سعر الدورة. */
export function CourseBookCard({ courseId, courseTitle, book, purchasable, issueText, candidates }: CourseBookCardProps) {
  const router = useRouter()
  const [state, action] = useActionState(setCourseBookAction, null)
  const [pending, start] = useTransition()
  useEffect(() => {
    if (state?.ok) {
      toast('success', state.data.purchasable ? 'حُفظ الكتاب — الدورة قابلة للشراء' : 'حُفظ الكتاب')
      router.refresh()
    }
  }, [state, router])
  const choose = (productId: string) =>
    start(async () => {
      const r = await chooseCourseBookAction(courseId, productId)
      if (!r.ok) return toast('error', r.error.message)
      toast('success', 'اعتُمد الكتاب للدورة')
      router.refresh()
    })
  return (
    <Card className={purchasable ? '' : 'border-warning/60'}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <BookOpen className="size-5 text-primary" /> الكتاب المرفق بالدورة
          {purchasable ? <Badge variant="success">الشراء مفتوح</Badge> : <Badge variant="warning">الشراء متوقف</Badge>}
        </CardTitle>
        <CardDescription>كل دورة مدفوعة تشمل كتاباً ورقياً. سعر الكتاب هو سعر الدورة؛ التلميذ يشتري «الدورة مع الكتاب» وتُفعَّل عند التسليم.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {issueText ? <Alert tone="warning">{issueText} الاشتراكات الحالية لا تتأثر.</Alert> : null}
        {!book && candidates.length ? (
          <div className="space-y-2 rounded-lg border p-3 text-sm">
            <p className="font-semibold">كتب مرتبطة سابقاً بهذه الدورة — اعتمد أحدها:</p>
            {candidates.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2">
                <span>
                  {c.title} · {c.priceDzd} دج
                </span>
                <Button size="sm" variant="outline" loading={pending} onClick={() => choose(c.id)}>
                  اعتماد
                </Button>
              </div>
            ))}
          </div>
        ) : null}
        <form action={action} className="grid gap-3 sm:grid-cols-4">
          <input type="hidden" name="courseId" value={courseId} />
          <Field label="اسم الكتاب" htmlFor="book-title" error={fieldError(state, 'title')} className="sm:col-span-2">
            <Input id="book-title" name="title" defaultValue={book?.title ?? `كتاب ${courseTitle}`} required />
          </Field>
          <Field label="سعر الدورة مع الكتاب (دج)" htmlFor="book-price" error={fieldError(state, 'priceDzd')}>
            <Input id="book-price" name="priceDzd" type="number" min={1} defaultValue={book?.priceDzd ?? ''} required dir="ltr" />
          </Field>
          <Field label="المخزون (فارغ = غير محدود)" htmlFor="book-stock" error={fieldError(state, 'stock')}>
            <Input id="book-stock" name="stock" type="number" min={0} defaultValue={book?.stock ?? ''} dir="ltr" />
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-3">
            <input type="checkbox" name="active" className="size-4" defaultChecked={book ? book.status === 'PUBLISHED' : true} /> متاح للشراء
          </label>
          <SubmitButton>{book ? 'حفظ الكتاب' : 'إضافة الكتاب'}</SubmitButton>
          <div className="sm:col-span-4">
            <FormError state={state} />
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
