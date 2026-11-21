import Link from 'next/link'
import { cn } from '@/lib/utils'

/** تبويبات الأفواج أعلى الساحة: التبويب الأول (بلا فوج) ثم كل فوج */
export function GroupTabs({ groups, current, basePath, allLabel = 'كل الأفواج', showAll = true }: { groups: { id: string; name: string }[]; current: string | null; basePath: string; allLabel?: string; showAll?: boolean }) {
  const cls = (on: boolean) => cn('whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors', on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/50')
  return (
    <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {showAll ? (
        <Link href={basePath} className={cls(!current)}>
          {allLabel}
        </Link>
      ) : null}
      {groups.map((g) => (
        <Link key={g.id} href={`${basePath}?group=${g.id}`} className={cls(current === g.id)}>
          {g.name}
        </Link>
      ))}
    </nav>
  )
}
