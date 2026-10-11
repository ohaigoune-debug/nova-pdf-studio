'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export interface PublicLink {
  href: string
  label: string
}

/** الأقسام الستة في أعلى الموقع: نفس الروابط على الحاسوب (سطر واحد) وعلى الهاتف (شريط أفقي)، والقسم الحالي مميَّز */
export function PublicNav({ links, variant }: { links: PublicLink[]; variant: 'desktop' | 'mobile' }) {
  const pathname = usePathname()
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  if (variant === 'desktop')
    return (
      <nav className="hidden items-center gap-0.5 xl:flex" aria-label="أقسام المنصة">
        {links.map((l) => (
          <Link key={l.href} href={l.href} aria-current={active(l.href) ? 'page' : undefined} className={cn('whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold transition-colors', active(l.href) ? 'bg-primary/10 text-primary' : 'text-foreground/75 hover:bg-muted hover:text-foreground')}>
            {l.label}
          </Link>
        ))}
      </nav>
    )
  return (
    <>
      {links.map((l) => (
        <Link key={l.href} href={l.href} aria-current={active(l.href) ? 'page' : undefined} className={cn('shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold shadow-soft', active(l.href) ? 'border-primary bg-primary text-primary-foreground' : 'border-border/80 bg-card')}>
          {l.label}
        </Link>
      ))}
    </>
  )
}
