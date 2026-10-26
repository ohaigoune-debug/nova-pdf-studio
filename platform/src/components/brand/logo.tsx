import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * شعار مدرسة — MADRASADZ من الملف الأصلي (PNG شفاف بكتابة كحلية).
 * public/brand/madrasadz-logo.png نسخة مشتقّة: قُصّ الهامش الشفاف فقط (24px حول الحروف) وصُغّرت إلى 600×184،
 * دون تغيير الألوان أو النسب. الأصل الكامل محفوظ في public/brand/MADRASADZ-Logo-Transparent.png.
 *
 * الكتابة كحلية فتحتاج سطحاً فاتحاً: `plate` يضع الشعار على لوحة بيضاء دافئة (الشريط الكحلي والوضع الداكن)،
 * و`auto` يفعل ذلك في الوضع الداكن وحده. لا invert ولا تمدد: العرض يحدّد الارتفاع بنسبة الملف.
 */
export const LOGO_RATIO = 600 / 184

export function Logo({
  width = 144,
  surface = 'auto',
  decorative = false,
  priority = false,
  className
}: {
  /** العرض بالبكسل؛ الارتفاع محسوب من نسبة الملف */
  width?: number
  /** light: خلفية فاتحة دائماً · plate: لوحة فاتحة دائماً · auto: لوحة في الوضع الداكن فقط */
  surface?: 'light' | 'plate' | 'auto'
  /** حين يجاوره نصّ ينطق الاسم نفسه (رابط له aria-label) لا يُكرَّر النص البديل */
  decorative?: boolean
  priority?: boolean
  className?: string
}) {
  const height = Math.round(width / LOGO_RATIO)
  const plate = surface === 'plate' ? 'rounded-md bg-brand-paper px-2 py-1' : surface === 'auto' ? 'dark:rounded-md dark:bg-brand-paper dark:px-2 dark:py-1' : ''
  return (
    <span className={cn('inline-flex shrink-0 items-center', plate, className)}>
      <Image
        src="/brand/madrasadz-logo.png"
        alt={decorative ? '' : 'مدرسة — MADRASADZ'}
        width={width}
        height={height}
        priority={priority}
        unoptimized
        draggable={false}
        style={{ width, height }}
      />
    </span>
  )
}
