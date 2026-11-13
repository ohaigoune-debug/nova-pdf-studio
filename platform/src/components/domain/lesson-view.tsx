import { ChevronRight, ExternalLink, Paperclip } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { LessonMedia, type LessonMediaItem } from '@/components/domain/lesson-media'
import { Markdown } from '@/components/domain/markdown'
import { Badge } from '@/components/ui/badge'
import { tEnum } from '@/i18n'
import { cn, formatDate } from '@/lib/utils'
import type { Actor } from '@/server/lib/actor'

/**
 * صفحة الدرس الواحدة (البند ب2، 13 نوفمبر 2026).
 * كانت ثلاث صفحات تتشارك الوسائط فقط: حساب التلميذ (/student/lessons)، والصفحة العامة (/lessons)، وتطبيق آيفون (/ios/lesson).
 * صار شكل الدرس كله هنا، وكل مسار يمرّر ما يُسمح له به:
 *  - student: كل شيء، ومعه اختبار الدرس والتعليقات.
 *  - public:  الدرس العام كما يراه الزائر، بلا اختبار ولا تعليقات.
 *  - ios:     بلا شارات ولا روابط خارجية ولا أي إشارة إلى شراء أو سعر (قاعدة المالك لتطبيق آيفون).
 */
export type LessonSurface = 'student' | 'public' | 'ios'

export interface LessonViewItem extends LessonMediaItem {
  slug?: string
  summary?: string | null
  body?: string | null
  levelName?: string | null
  topic?: string | null
  authorName?: string | null
  publishedAt?: Date | string | null
  externalUrl?: string | null
  fileName?: string | null
}

interface Surface {
  meta: boolean
  links: boolean
  wide: boolean
}

/** ما يظهر في كل مسار. آيفون: لا شارات ولا روابط خارجية (قد تقود إلى صفحة شراء) */
export const LESSON_SURFACES: Readonly<Record<LessonSurface, Surface>> = {
  student: { meta: true, links: true, wide: true },
  public: { meta: true, links: true, wide: true },
  ios: { meta: false, links: false, wide: false }
}

const hasVideo = (i: LessonViewItem) => i.videoProvider === 'BUNNY' || i.videoProvider === 'YOUTUBE'

export function LessonView({
  item,
  actor,
  surface,
  back,
  extras,
  footer,
  className
}: {
  item: LessonViewItem
  actor: Actor | null
  surface: LessonSurface
  back: { href: string; label: string }
  /** تحت الوسائط: اختبار الدرس (للتلميذ وحده) */
  extras?: ReactNode
  /** آخر الصفحة: التعليقات (للتلميذ وحده) */
  footer?: ReactNode
  className?: string
}) {
  const s = LESSON_SURFACES[surface]
  // PDF وفيديو معًا: الصفحة أعرض في الحاسوب ليظهرا جنبًا إلى جنب
  const width = s.wide ? (item.fileMime === 'application/pdf' && hasVideo(item) ? 'max-w-6xl' : 'max-w-3xl') : ''
  const empty = !item.body && !item.youtubeId && !item.fileId && !hasVideo(item)
  const showFile = s.links && item.fileId && item.fileName && item.allowDownload && item.fileMime !== 'application/pdf' && !item.fileMime?.startsWith('video/')
  const showLink = s.links && item.externalUrl && item.videoProvider !== 'YOUTUBE'
  return (
    <article data-lesson-surface={surface} className={cn('mx-auto space-y-5', width, className)}>
      <Link href={back.href} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ChevronRight className="size-4 ltr:rotate-180" aria-hidden /> {back.label}
      </Link>
      <header className="space-y-2">
        {s.meta ? (
          <div className="flex flex-wrap gap-2">
            <Badge>{tEnum('contentTypes', item.type)}</Badge>
            {item.levelName ? <Badge variant="muted">{item.levelName}</Badge> : null}
            {item.topic ? <Badge variant="secondary">{item.topic}</Badge> : null}
          </div>
        ) : null}
        <h1 className="text-2xl font-extrabold leading-snug sm:text-3xl">{item.title}</h1>
        {s.meta && (item.authorName || item.publishedAt) ? (
          <p className="text-sm text-muted-foreground">
            {item.authorName ? `${item.authorName} · ` : ''}
            {item.publishedAt ? formatDate(item.publishedAt) : ''}
          </p>
        ) : null}
      </header>
      {item.summary ? <p className="rounded-lg border-s-4 border-primary bg-primary/5 p-4 leading-relaxed text-muted-foreground">{item.summary}</p> : null}
      <LessonMedia item={item} actor={actor} />
      {showLink || showFile ? (
        <div className="flex flex-wrap gap-3">
          {showLink ? (
            <a href={item.externalUrl!} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm text-primary hover:underline">
              <ExternalLink className="size-4" aria-hidden /> فتح الرابط
            </a>
          ) : null}
          {showFile ? (
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Paperclip className="size-4" aria-hidden /> {item.fileName}
            </span>
          ) : null}
        </div>
      ) : null}
      {extras}
      {item.body ? <Markdown body={item.body} className="prose-ar space-y-3 text-[17px]" /> : empty ? <p className="text-muted-foreground">المحتوى سيُضاف قريبًا.</p> : null}
      {footer}
    </article>
  )
}
