import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { tEnum } from '@/i18n'
import { formatDate } from '@/lib/utils'
import { getDb } from '@/server/db/client'
import { getPublicContentBySlug } from '@/server/queries/content.queries'

export const dynamic = 'force-dynamic'

/** عرض Markdown مبسّط وآمن (عناوين، قوائم، فقرات) بلا HTML خام */
function renderBody(body: string) {
  const lines = body.split(/\r?\n/)
  const out: React.ReactNode[] = []
  let list: string[] = []
  const flush = () => {
    if (list.length) {
      out.push(
        <ul key={out.length} className="list-disc space-y-1 ps-6">
          {list.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )
      list = []
    }
  }
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      flush()
      continue
    }
    if (line.startsWith('## ')) {
      flush()
      out.push(
        <h2 key={out.length} className="mt-6 text-xl font-extrabold">
          {line.slice(3)}
        </h2>
      )
    } else if (line.startsWith('# ')) {
      flush()
      out.push(
        <h2 key={out.length} className="mt-6 text-2xl font-extrabold">
          {line.slice(2)}
        </h2>
      )
    } else if (/^[-*]\s/.test(line) || /^\d+\.\s/.test(line)) {
      list.push(line.replace(/^([-*]|\d+\.)\s/, ''))
    } else {
      flush()
      out.push(
        <p key={out.length} className="leading-8">
          {line}
        </p>
      )
    }
  }
  flush()
  return out
}

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const item = await getPublicContentBySlug(await getDb(), slug)
  if (!item) notFound()
  return (
    <article className="container max-w-3xl py-10">
      <Link href="/lessons" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
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
      <div className="prose-ar mt-6 space-y-3 text-[17px]">{item.body ? renderBody(item.body) : <p className="text-muted-foreground">المحتوى سيُضاف قريباً.</p>}</div>
    </article>
  )
}
