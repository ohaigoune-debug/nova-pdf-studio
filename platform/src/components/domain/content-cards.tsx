import { BookOpen, ExternalLink, FileText, Film, Headphones, Image as ImageIcon, Link2, ListChecks, PencilLine, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/misc'
import { t, tEnum, type Locale } from '@/i18n'
import { formatShortDate } from '@/lib/utils'
import { youtubeThumbnail } from '@/server/lib/youtube'
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
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((c) => {
        const Icon = icons[c.type] ?? FileText
        const href = c.type === 'LINK' && c.externalUrl ? c.externalUrl : `${basePath}/${c.slug}`
        const thumb = c.type === 'VIDEO' && c.youtubeId ? youtubeThumbnail(c.youtubeId) : null
        return (
          <Link key={c.id} href={href} className="group block">
            <Card className="h-full overflow-hidden transition-all group-hover:-translate-y-1 group-hover:shadow-lift">
              {/* فيديو يوتيوب: صورته المصغّرة تُغني عن أيقونة — والمشغّل نفسه لا يُحمَّل قبل الفتح */}
              {thumb ? (
                <div className="relative aspect-video overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumb} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <span className="absolute bottom-3 start-3 flex size-9 items-center justify-center rounded-full bg-white/90 text-primary shadow-lift">
                    <Film className="size-4" />
                  </span>
                </div>
              ) : null}
              <CardContent className={thumb ? 'flex flex-col gap-3 p-5' : 'flex h-full flex-col gap-3 p-5'}>
                <div className="flex items-center justify-between">
                  {thumb ? (
                    <span />
                  ) : (
                    <span className="flex size-10 items-center justify-center rounded-md bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-inset ring-primary/10">
                      <Icon className="size-4" />
                    </span>
                  )}
                  <Badge variant="muted">{tEnum('contentTypes', c.type, locale)}</Badge>
                </div>
                <h3 className="font-bold leading-snug transition-colors group-hover:text-primary">{c.title}</h3>
                {c.summary ? <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{c.summary}</p> : null}
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
