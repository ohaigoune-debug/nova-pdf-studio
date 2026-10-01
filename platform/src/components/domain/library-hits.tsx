import { BookOpen, ExternalLink, FileText, Library, PlayCircle, Search } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/misc'
import type { LibraryHit } from '@/server/services/library.service'

const ICON = { RESOURCE: FileText, QUESTION: Library, CONTENT: BookOpen }

/** قائمة نتائج/موارد المكتبة: العنوان، النوع، المادة والصف، المصدر، ورابط (داخلي أو إلى المصدر) */
export function LibraryHits({ hits, empty = 'لا نتائج.' }: { hits: LibraryHit[]; empty?: string }) {
  if (hits.length === 0) return <EmptyState icon={Search} title={empty} />
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {hits.map((h) => {
        const Icon = h.typeLabel === 'فيديو' ? PlayCircle : ICON[h.kind]
        const inner = (
          <>
            <Icon className="mt-1 size-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{h.title}</span>
                <Badge variant="secondary">{h.typeLabel}</Badge>
                {h.official ? <Badge variant="success">رسمي</Badge> : null}
                {h.year ? <Badge variant="muted">{h.year}</Badge> : null}
              </span>
              {h.snippet ? (
                <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground" dir="auto">
                  {h.snippet}
                </span>
              ) : null}
              <span className="mt-1 block text-[11px] text-muted-foreground">
                {[h.subjectName, h.levelName].filter(Boolean).join(' · ')}
                {h.source ? ` · المصدر: ${h.source}` : ''}
              </span>
            </span>
            {h.external ? <ExternalLink className="mt-1 size-3.5 shrink-0 text-muted-foreground" /> : null}
          </>
        )
        const cls = 'flex items-start gap-3 p-3 text-sm transition-colors hover:bg-muted/50'
        return (
          <li key={`${h.kind}-${h.id}`}>
            {h.external ? (
              <a href={h.href} target="_blank" rel="noreferrer noopener" className={cls}>
                {inner}
              </a>
            ) : (
              <Link href={h.href} className={cls}>
                {inner}
              </Link>
            )}
          </li>
        )
      })}
    </ul>
  )
}
