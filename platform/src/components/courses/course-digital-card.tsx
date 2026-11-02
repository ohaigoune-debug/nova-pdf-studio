'use client'

import { MonitorPlay } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Alert } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { setCourseDigitalPriceAction } from '@/server/actions/courses.actions'

export interface CourseDigitalCardProps {
  courseId: string
  priceDzd: number | null
  /** سعر الدورة مع الكتاب (إن وُجد): النسخة الرقمية أقل منه */
  bookPriceDzd: number | null
  purchasable: boolean
  issueText: string | null
}

/** النسخة الرقمية (اختيارية): سعر واحد. فارغ = لا نسخة رقمية. بطاقتها مستقلة في الكتالوج، والدفع بالبطاقة فقط. */
export function CourseDigitalCard({ courseId, priceDzd, bookPriceDzd, purchasable, issueText }: CourseDigitalCardProps) {
  const router = useRouter()
  const [state, action] = useActionState(setCourseDigitalPriceAction, null)
  useEffect(() => {
    if (state?.ok) {
      toast('success', state.data.purchasable ? 'حُفظ — النسخة الرقمية ظاهرة في الكتالوج' : 'حُفظ')
      router.refresh()
    }
  }, [state, router])
  return (
    <Card className={priceDzd && !purchasable ? 'border-warning/60' : ''}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <MonitorPlay className="size-5 text-primary" /> النسخة الرقمية — دون كتاب (اختيارية)
          {!priceDzd ? <Badge variant="secondary">غير مفعّلة</Badge> : purchasable ? <Badge variant="success">ظاهرة للتلاميذ</Badge> : <Badge variant="warning">لا تظهر الآن</Badge>}
        </CardTitle>
        <CardDescription>
          بطاقة مستقلة في الكتالوج وصفحة خاصة بها، تفتح هذه الدورة نفسها (لا دورة ثانية ولا محتوى مكرَّر). الدفع بالبطاقة فقط، وتُفتح الدورة فور الدفع، بلا توصيل ولا طابور تأكيد. ومن اشتراها ثم أراد الكتاب يدفع الفرق فقط.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {priceDzd && issueText ? (
          <Alert tone="warning">
            {issueText}{' '}
            {!purchasable && issueText.includes('الدفع') ? (
              <Link href="/admin/settings/payment" className="underline">
                إعدادات الدفع الإلكتروني
              </Link>
            ) : null}
          </Alert>
        ) : null}
        <form action={action} className="grid gap-3 sm:grid-cols-3">
          <input type="hidden" name="courseId" value={courseId} />
          <Field
            label="سعر النسخة الرقمية (دج)"
            htmlFor="digital-price"
            error={fieldError(state, 'digitalPriceDzd')}
            hint={bookPriceDzd ? `50 دج على الأقل، وأقل من سعر الدورة مع الكتاب (${bookPriceDzd} دج). فارغ = إيقافها.` : '50 دج على الأقل. فارغ = لا نسخة رقمية.'}
            className="sm:col-span-2"
          >
            <Input id="digital-price" name="digitalPriceDzd" type="number" min={50} max={bookPriceDzd ? bookPriceDzd - 1 : undefined} defaultValue={priceDzd ?? ''} dir="ltr" />
          </Field>
          <div className="flex items-end">
            <SubmitButton>حفظ</SubmitButton>
          </div>
          <div className="sm:col-span-3">
            <FormError state={state} />
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
