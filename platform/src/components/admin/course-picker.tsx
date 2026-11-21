'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Select } from '@/components/ui/input'

export interface CoursePickerOption {
  id: string
  title: string
  active: number
  archived: boolean
}

/** قائمة الدورات في صفحة التلاميذ: اختيار دورة يفتح قائمة المسجَّلين فيها فورًا */
export function CoursePicker({ options, value }: { options: CoursePickerOption[]; value: string | null }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Select
      aria-label="الدورة"
      value={value ?? ''}
      disabled={pending}
      className="h-11 text-base font-semibold"
      onChange={(e) => {
        const id = e.currentTarget.value
        start(() => router.push(id ? `/admin/students?course=${id}` : '/admin/students'))
      }}
    >
      <option value="">كل التلاميذ (دون تحديد دورة)</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.title} — {o.active} مسجَّل{o.archived ? ' (مؤرشفة)' : ''}
        </option>
      ))}
    </Select>
  )
}
