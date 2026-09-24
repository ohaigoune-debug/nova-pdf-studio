'use client'

import { ExternalLink, FileDown, Lock, LockOpen, MessageSquare, Pin, PinOff, Send, Trash2, UsersRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { Avatar, EmptyState } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { formatDateTime } from '@/lib/utils'
import { addCommentAction, deleteCommentAction, deletePostAction, updatePostAction } from '@/server/actions/classroom.actions'
import type { StreamPost } from '@/server/services/classroom.service'

/** ساحة القسم الافتراضي: المنشورات وتعليقاتها — للأستاذ أدوات الإدارة، وللتلميذ التعليق */
export function ClassStream({ posts, role }: { posts: StreamPost[]; role: 'TEACHER' | 'STUDENT' }) {
  if (posts.length === 0) {
    return <EmptyState icon={MessageSquare} title="لا منشورات بعد" description={role === 'TEACHER' ? 'اكتب أوّل منشور لتلاميذك أعلاه.' : 'حين ينشر أستاذك شيئاً يظهر هنا وتستطيع التعليق عليه.'} />
  }
  return (
    <div className="space-y-4">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} role={role} />
      ))}
    </div>
  )
}

function PostCard({ post, role }: { post: StreamPost; role: 'TEACHER' | 'STUDENT' }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [comment, setComment] = useState('')
  const teacher = role === 'TEACHER'
  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, done?: () => void) =>
    start(async () => {
      const r = await fn()
      if (!r.ok) toast('error', r.error?.message ?? 'تعذّر')
      else {
        done?.()
        router.refresh()
      }
    })
  const canComment = post.allowComments || teacher

  return (
    <article id={`post-${post.id}`} className={`scroll-mt-24 rounded-lg border bg-card shadow-soft ${post.pinned ? 'border-accent/60' : ''}`}>
      <header className="flex items-start justify-between gap-3 p-4 pb-2">
        <div className="flex items-center gap-3">
          <Avatar name={post.authorName} size="sm" />
          <div>
            <p className="text-sm font-bold">{post.authorName}</p>
            <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              {formatDateTime(post.createdAt)}
              <Badge variant="secondary" className="gap-1 px-1.5 py-0 text-[10px]">
                <UsersRound className="size-3" /> {post.groupName ?? 'كل الأفواج'}
              </Badge>
              {post.pinned ? (
                <Badge variant="warning" className="gap-1 px-1.5 py-0 text-[10px]">
                  <Pin className="size-3" /> مثبّت
                </Badge>
              ) : null}
            </p>
          </div>
        </div>
        {teacher ? (
          <div className="flex gap-1">
            <Button type="button" size="sm" variant="ghost" title={post.pinned ? 'إلغاء التثبيت' : 'تثبيت أعلى الساحة'} onClick={() => run(() => updatePostAction(post.id, { pinned: !post.pinned }))} disabled={pending}>
              {post.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
            </Button>
            <Button type="button" size="sm" variant="ghost" title={post.allowComments ? 'إغلاق التعليقات' : 'فتح التعليقات'} onClick={() => run(() => updatePostAction(post.id, { allowComments: !post.allowComments }))} disabled={pending}>
              {post.allowComments ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
            </Button>
            <Button type="button" size="sm" variant="ghost" title="حذف المنشور" onClick={() => confirm('حذف المنشور وتعليقاته؟') && run(() => deletePostAction(post.id))} disabled={pending}>
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        ) : null}
      </header>
      <div className="whitespace-pre-wrap px-4 pb-3 leading-relaxed">{post.body}</div>
      {post.linkUrl || post.file ? (
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {post.linkUrl ? (
            <a href={post.linkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1.5 truncate rounded-md border px-3 py-1.5 text-sm hover:bg-muted" dir="ltr">
              <ExternalLink className="size-4 shrink-0" /> <span className="truncate">{post.linkUrl.replace(/^https:\/\//, '')}</span>
            </a>
          ) : null}
          {post.file ? (
            <a href={post.file.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
              <FileDown className="size-4" /> {post.file.name}
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3 border-t bg-muted/30 p-4">
        <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
          <MessageSquare className="size-3.5" /> {post.comments.length} تعليق{!post.allowComments ? ' · التعليقات مغلقة' : ''}
        </p>
        {post.comments.map((c) => (
          <div key={c.id} className="flex items-start gap-2">
            <Avatar name={c.authorName} size="sm" />
            <div className="min-w-0 flex-1 rounded-lg bg-background px-3 py-2">
              <p className="flex flex-wrap items-center gap-1.5 text-xs">
                <strong>{c.authorName}</strong>
                {c.authorRole === 'TEACHER' ? <Badge className="px-1.5 py-0 text-[10px]">الأستاذ</Badge> : null}
                <span className="text-muted-foreground">{formatDateTime(c.createdAt)}</span>
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm">{c.body}</p>
            </div>
            {c.canDelete ? (
              <Button type="button" size="sm" variant="ghost" title="حذف التعليق" onClick={() => confirm('حذف التعليق؟') && run(() => deleteCommentAction(c.id))} disabled={pending}>
                <Trash2 className="size-3.5 text-muted-foreground" />
              </Button>
            ) : null}
          </div>
        ))}
        {canComment ? (
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (comment.trim()) run(() => addCommentAction(post.id, comment), () => setComment(''))
            }}
          >
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={1} maxLength={1500} placeholder={teacher ? 'ردّ على التلاميذ…' : 'أضف تعليقاً…'} className="min-h-10 flex-1 resize-y" />
            <Button type="submit" size="sm" disabled={pending || !comment.trim()} aria-label="إرسال">
              <Send className="size-4" />
            </Button>
          </form>
        ) : null}
      </div>
    </article>
  )
}
