import { ArrowRight, ExternalLink, Paperclip } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Markdown } from '@/components/domain/markdown'
import { Badge } from '@/components/ui/badge'
import { tEnum } from '@/i18n'
import { formatDate } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { signFileUrl } from '@/server/lib/storage'
import { getContentForStudent } from '@/server/services/content.service'

export default async function StudentLessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const actor = await requirePageActor('STUDENT')
  const { slug } = await params
  let item
  try {
    item = await getContentForStudent(await getDb(), actor, decodeURIComponent(slug))
  } catch (e) {
    if (isAppError(e)) notFound()
    throw e
  }
  return (
    <article className="mx-auto max-w-3xl">
      <Link href="/student/lessons" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" /> الدروس
      </Link>
      <div className="mb-2 flex flex-wrap gap-2">
        <Badge>{tEnum('contentTypes', item.type)}</Badge>
        {item.levelName ? <Badge variant="muted">{item.levelName}</Badge> : null}
        {item.topic ? <Badge variant="secondary">{item.topic}</Badge> : null}
      </div>
      <h1 className="text-3xl font-extrabold leading-tight">{item.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {item.authorName ? `${item.authorName} · ` : ''}
        {formatDate(item.publishedAt)}
      </p>
      {item.summary ? <p className="mt-6 rounded-lg border-s-4 border-primary bg-primary/5 p-4 text-muted-foreground">{item.summary}</p> : null}
      <div className="mt-4 flex flex-wrap gap-3">
        {item.externalUrl ? (
          <a href={item.externalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
            <ExternalLink className="size-4" /> فتح الرابط
          </a>
        ) : null}
        {item.fileId && item.fileName ? (
          <a href={signFileUrl(item.fileId)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
            <Paperclip className="size-4" /> {item.fileName}
          </a>
        ) : null}
      </div>
      <div className="mt-6">{item.body ? <Markdown body={item.body} /> : null}</div>
    </article>
  )
}
