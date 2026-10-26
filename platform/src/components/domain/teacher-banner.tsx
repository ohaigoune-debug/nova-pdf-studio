import type { ReactNode } from 'react'
import type { AboutSettings } from '@/server/services/about.service'

/**
 * رأس صفحة في فضاء الطالب: عنوان ووصف قصير وإجراء اختياري على سطح فاتح.
 * هوية v2: لا يُكرَّر اسم الأستاذ أو صورته كهوية عامة في فضاء الطالب (يظهر الأستاذ في سياق دورته فقط)،
 * فلا يُعرض `about` هنا؛ المعامل باقٍ لتوافق الاستدعاءات القائمة.
 */
export function TeacherBanner({ greeting, subtitle, action }: { about?: AboutSettings; greeting: string; subtitle: string; action?: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-soft sm:p-6">
      <h1 className="font-heading text-[28px] font-bold leading-[1.4] sm:text-4xl">{greeting}</h1>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  )
}
