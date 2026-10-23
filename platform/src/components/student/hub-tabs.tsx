'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { STUDENT_HUBS, type StudentHubKey } from '@/lib/student-hubs'

/**
 * شريط تبويبات «المجمّعات» في واجهة التلميذ: صفحات متشابهة دُمجت تحت مدخل واحد في القائمة
 * (تدرّب = PLAY + اختبارات أستاذي + تدريب حرّ…). كل تبويب مسار قائم بذاته، فالروابط القديمة
 * والتطبيق والإشعارات تبقى تعمل، والتبويب يبيّن أين أنت داخل المجمّع.
 */
export function HubTabs({ hub }: { hub: StudentHubKey }) {
  const pathname = usePathname()
  const def: { label: string; tabs: readonly { href: string; label: string; exact?: boolean }[] } = STUDENT_HUBS[hub]
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(href + '/'))
  return (
    <nav className="mb-5 -mx-1 flex gap-1 overflow-x-auto border-b px-1 pb-px" aria-label={def.label}>
      {def.tabs.map((tab) => {
        const active = isActive(tab.href, tab.exact)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              '-mb-px whitespace-nowrap rounded-t-md border-b-2 px-3 py-2 text-sm font-semibold transition-colors',
              active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
