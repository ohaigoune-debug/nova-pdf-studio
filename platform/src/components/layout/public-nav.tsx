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
          <Link key={l.href} href={l.href} aria-current={active(l.href) ? 'page' : undefined} className={cn('whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold transition-colors duration-150', active(l.href) ? 'bg-secondary text-secondary-foreground' : 'text-foreground/80 hover:bg-muted hover:text-foreground')}>
            {l.label}
          </Link>
        ))}
      </nav>
    )
  return (
    <>
      {links.map((l) => (
        <Link key={l.href} href={l.href} aria-current={active(l.href) ? 'page' : undefined} className={cn('flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 text-xs font-semibold transition-colors duration-150', active(l.href) ? 'border-primary/40 bg-secondary text-secondary-foreground' : 'border-border bg-card text-foreground/80 hover:border-primary/40')}>
          {l.label}
        </Link>
      ))}
    </>
  )
}
