import { BookOpen, ExternalLink, FileText, Film, Headphones, Image as ImageIcon, Link2, ListChecks, PencilLine, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/misc'
import { t, tEnum, type Locale } from '@/i18n'
import { formatShortDate } from '@/lib/utils'
import type { ContentCard } from '@/server/queries/content.queries'

const icons: Record<string, LucideIcon> = {
  ARTICLE: FileText,
  LESSON: BookOpen,
  PDF: FileText,
  VIDEO: Film,
  AUDIO: Headphones,
  QUIZ: ListChecks,
  EXERCISE: PencilLine,
  IMAGE: ImageIcon,
  LINK: Link2
}

export function ContentGrid({ items, emptyText, basePath = '/lessons', locale = 'ar' }: { items: ContentCard[]; emptyText?: string; basePath?: string; locale?: Locale }) {
  if (items.length === 0) return <EmptyState icon={BookOpen} title={emptyText ?? t('public.noContent', undefined, locale)} />
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((c) => {
        const Icon = icons[c.type] ?? FileText
        const href = c.type === 'LINK' && c.externalUrl ? c.externalUrl : `${basePath}/${c.slug}`
        return (
          <Link key={c.id} href={href} className="group">
            <Card className="h-full transition-shadow group-hover:shadow-md">
              <CardContent className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </span>
                  <Badge variant="muted">{tEnum('contentTypes', c.type, locale)}</Badge>
                </div>
                <h3 className="font-bold leading-snug group-hover:text-primary">{c.title}</h3>
                {c.summary ? <p className="line-clamp-2 text-sm text-muted-foreground">{c.summary}</p> : null}
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-2 text-[11px] text-muted-foreground">
                  {c.levelName ? <span>{c.levelName}</span> : null}
                  {c.topic ? <span>· {c.topic}</span> : null}
                  <span className="ms-auto">{formatShortDate(c.publishedAt)}</span>
                  {c.type === 'LINK' && c.externalUrl ? <ExternalLink className="size-3" /> : null}
                </div>
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
