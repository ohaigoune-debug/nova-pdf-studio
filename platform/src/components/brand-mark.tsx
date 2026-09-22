import { cn } from '@/lib/utils'

/**
 * علامة المنصة: وجه الأستاذ داخل حلقة ذهبية على الحبر. الأستاذ هو البراند،
 * فالعلامة نفسها تظهر في الشريط الجانبي والرأس وشاشة الدخول وأيقونة التطبيق.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn('relative inline-flex shrink-0 overflow-hidden rounded-full bg-[hsl(200_42%_9%)] ring-2 ring-accent ring-offset-2 ring-offset-transparent', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand-face.webp" alt="" width={512} height={512} className="size-full object-cover object-top" />
    </span>
  )
}
