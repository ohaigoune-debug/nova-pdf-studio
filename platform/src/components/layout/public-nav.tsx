'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export interface PublicLink {
  href: string
  label: string
}

/** الأقسام الستة في أعلى الموقع: سطر الترويسة على الشاشات العريضة جداً، وشريط ثانٍ تحتها فيما دون ذلك؛ القسم الحالي مميَّز */
export function PublicNav({ links, variant }: { links: PublicLink[]; variant: 'desktop' | 'mobile' }) {
  const pathname = usePathname()
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  if (variant === 'desktop')
    return (
      <nav className="hidden items-center gap-0.5 min-[1720px]:flex" aria-label="أقسام المنصة">
        {links.map((l) => (
          <Link key={l.href} href={l.href} aria-current={active(l.href) ? 'page' : undefined} className={cn('whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold transition-colors', active(l.href) ? 'bg-white/20 text-white' : 'text-white/90 hover:bg-white/10')}>
            {l.label}
          </Link>
        ))}
      </nav>
    )
  return (
    <>
      {links.map((l) => (
        <Link key={l.href} href={l.href} aria-current={active(l.href) ? 'page' : undefined} className={cn('shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold shadow-soft', active(l.href) ? 'border-white/40 bg-white/20 text-white' : 'border-white/20 bg-white/10 text-white')}>
          {l.label}
        </Link>
      ))}
    </>
  )
}
