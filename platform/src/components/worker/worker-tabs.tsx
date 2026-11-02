'use client'

import { ListChecks, Search } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/worker', label: 'حجوزاتي', icon: ListChecks },
  { href: '/worker/search', label: 'بحث وتفعيل', icon: Search }
]

/** شريط سفلي بتبويبين كبيرين، في متناول الإبهام */
export function WorkerTabs() {
  const path = usePathname()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto grid max-w-xl grid-cols-2">
        {TABS.map((t) => {
          const on = t.href === '/worker' ? path === '/worker' : path.startsWith(t.href)
          return (
            <Link key={t.href} href={t.href} className={cn('flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold', on ? 'text-primary' : 'text-muted-foreground')}>
              <t.icon className="size-5" />
              {t.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
