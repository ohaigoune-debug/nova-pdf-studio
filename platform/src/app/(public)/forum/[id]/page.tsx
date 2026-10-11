import { ArrowRight, Lock, Pin } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PostActions, ReplyForm, ThreadActions } from '@/components/domain/forum'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, Avatar } from '@/components/ui/misc'
import { arCount, REPLIES } from '@/lib/ar-count'
import { cn, formatDateTime } from '@/lib/utils'
import { getCurrentActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { getThread } from '@/server/services/forum.service'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const t = await getThread(await getDb(), null, id)
    return { title: `${t.title} — المنتدى` }
  } catch {
    return { title: 'المنتدى' }
  }
}

export default async function ForumThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await getDb()
  const actor = await getCurrentActor()
  let thread
  try {
    thread = await getThread(db, actor, id)
  } catch (e) {
    if (e instanceof AppError) notFound()
    throw e
  }
  const admin = actor?.role === 'SUPER_ADMIN'
  return (
    <div className="container max-w-3xl py-10">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/forum">
          <ArrowRight className="size-4" /> المنتدى
        </Link>
      </Button>

      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {thread.pinned ? (
              <Badge variant="gold">
                <Pin className="size-3" /> مثبّت
              </Badge>
            ) : null}
            {thread.status === 'LOCKED' ? (
              <Badge variant="muted">
                <Lock className="size-3" /> الردود مقفلة
              </Badge>
            ) : null}
            {thread.status === 'HIDDEN' ? <Badge variant="destructive">مخفي عن الزوار</Badge> : null}
            {thread.subject ? <Badge variant="outline">{thread.subject.name}</Badge> : null}
            {thread.level ? <Badge variant="default">{thread.level.label}</Badge> : null}
          </div>
          <h1 className="text-balance text-2xl font-extrabold leading-snug sm:text-3xl" dir="auto">
            {thread.title}
          </h1>
          <div className="flex items-center gap-2.5">
            <Avatar name={thread.author.name} size="sm" />
            <div className="text-sm">
              <p className="font-semibold">
                {thread.author.name} <Badge variant={thread.author.role === 'TEACHER' ? 'gold' : 'muted'}>{thread.author.badge}</Badge>
              </p>
              <p className="text-xs text-muted-foreground">{formatDateTime(thread.createdAt)}</p>
            </div>
          </div>
          <p className="whitespace-pre-wrap leading-relaxed" dir="auto">
            {thread.body}
          </p>
          <ThreadActions threadId={thread.id} canDelete={thread.canDelete} admin={admin} pinned={thread.pinned} status={thread.status} />
        </CardContent>
      </Card>

      <h2 className="mb-3 mt-8 text-lg font-extrabold">{thread.posts.length ? arCount(thread.posts.length, REPLIES) : 'لا ردود بعد'}</h2>
      <ul className="space-y-3">
        {thread.posts.map((p) => (
          <li key={p.id} id={`p-${p.id}`} className={cn('scroll-mt-24 rounded-xl border bg-card p-4', p.author.role === 'TEACHER' && 'border-accent/40 bg-accent/5', p.hidden && 'opacity-60')}>
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Avatar name={p.author.name} size="sm" />
                <div className="text-sm">
                  <p className="font-semibold">
                    {p.author.name} <Badge variant={p.author.role === 'TEACHER' ? 'gold' : 'muted'}>{p.author.badge}</Badge> {p.hidden ? <Badge variant="destructive">مخفي</Badge> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(p.createdAt)}</p>
                </div>
              </div>
              <PostActions postId={p.id} canDelete={p.canDelete} admin={admin} hidden={p.hidden} />
            </div>
            <p className="whitespace-pre-wrap leading-relaxed" dir="auto">
              {p.body}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        {thread.canReply ? (
          <Card>
            <CardContent className="p-5">
              <ReplyForm threadId={thread.id} />
            </CardContent>
          </Card>
        ) : thread.status === 'LOCKED' ? (
          <Alert tone="info">أقفل المشرف الردود على هذا الموضوع.</Alert>
        ) : actor ? (
          <Alert tone="info">الردّ في المنتدى للتلاميذ والأساتذة.</Alert>
        ) : (
          <Alert tone="info">
            <Link href={`/login?next=/forum/${thread.id}`} className="font-bold text-primary underline">
              سجّل دخولك
            </Link>{' '}
            لتردّ — لا يلزمك كود أستاذ.
          </Alert>
        )}
      </div>
    </div>
  )
}
