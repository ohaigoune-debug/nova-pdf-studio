import { Search } from 'lucide-react'
import { ContentGrid } from '@/components/domain/content-cards'
import { Input } from '@/components/ui/input'
import { t } from '@/i18n'
import { getDb } from '@/server/db/client'
import type { ContentType } from '@/server/db/schema/enums'
import { listPublicContent, listTopics } from '@/server/queries/content.queries'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export async function PublicContentPage({
  title,
  description,
  types,
  basePath,
  searchParams
}: {
  title: string
  description?: string
  types?: ContentType[]
  basePath: string
  searchParams: Promise<{ q?: string; topic?: string }>
}) {
  const sp = await searchParams
  const db = await getDb()
  const [items, topics] = await Promise.all([listPublicContent(db, { types, search: sp.q, topic: sp.topic }), listTopics(db)])
  return (
    <div className="container py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold">{title}</h1>
        {description ? <p className="mt-1 text-muted-foreground">{description}</p> : null}
      </div>
      <form className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={sp.q ?? ''} placeholder={t('public.searchContent')} className="ps-9" />
        </div>
        {sp.topic ? <input type="hidden" name="topic" value={sp.topic} /> : null}
      </form>
      {topics.length > 0 ? (
        <div className="mb-6 flex flex-wrap gap-2">
          <Link href={basePath} className={cn('rounded-full border px-3 py-1 text-xs font-semibold', !sp.topic && 'bg-primary text-primary-foreground')}>
            {t('common.all')}
          </Link>
          {topics.map((tp) => (
            <Link key={tp} href={`${basePath}?topic=${encodeURIComponent(tp)}`} className={cn('rounded-full border px-3 py-1 text-xs font-semibold', sp.topic === tp && 'bg-primary text-primary-foreground')}>
              {tp}
            </Link>
          ))}
        </div>
      ) : null}
      <ContentGrid items={items} />
    </div>
  )
}
