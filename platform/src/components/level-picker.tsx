'use client'

import { GraduationCap } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { LEVEL_COOKIE, levelCodeOf, PICKER_LEVELS, STAGE_LABEL } from '@/lib/levels'
import { cn } from '@/lib/utils'

/**
 * «مستواك»: يختار الزائر صفّه مرة واحدة (4 متوسط، 1 ثانوي…) فتعرض الدروس والفروض والاختبارات والفيديوهات ما يناسبه.
 * الاختيار يُحفظ سنة في الكوكي، ويُزال ?level= من الرابط حتى لا يطغى عليه.
 */
export function LevelPicker({ saved, className }: { saved: string | null; className?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, start] = useTransition()
  const fromUrl = params.get('level')
  const current = fromUrl === 'all' ? '' : (levelCodeOf(fromUrl) ?? saved ?? '')

  const choose = (code: string) => {
    try {
      document.cookie = code ? `${LEVEL_COOKIE}=${code}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax` : `${LEVEL_COOKIE}=; path=/; max-age=0; samesite=lax`
    } catch {
      /* متصفح يمنع الكوكي: يبقى المستوى في الرابط */
    }
    const next = new URLSearchParams(params.toString())
    next.delete('cursor')
    if (code) next.set('level', code)
    else next.set('level', 'all')
    start(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
      router.refresh()
    })
  }

  return (
    <label className={cn('inline-flex min-w-0 items-center gap-1.5 text-xs', className)}>
      <GraduationCap className="size-4 shrink-0 text-primary" aria-hidden />
      <span className="sr-only">مستواك الدراسي</span>
      <select
        aria-label="مستواك الدراسي"
        className={cn('h-9 max-w-[11rem] rounded-full border bg-card px-3 text-xs font-bold', current ? 'border-primary/60 text-primary' : 'text-foreground/80', pending && 'opacity-60')}
        value={current}
        disabled={pending}
        onChange={(e) => choose(e.target.value)}
      >
        <option value="">كل المستويات</option>
        {(['MIDDLE', 'SECONDARY'] as const).map((stage) => (
          <optgroup key={stage} label={STAGE_LABEL[stage]}>
            {PICKER_LEVELS.filter((l) => l.stage === stage).map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}
