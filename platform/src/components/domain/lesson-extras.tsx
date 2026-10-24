'use client'

import { Check, ClipboardCheck, MessageSquare, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Select, Textarea } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { formatDateTime } from '@/lib/utils'
import { addLessonCommentAction, moderateLessonCommentAction, setLessonQuizAction } from '@/server/actions/lesson-extras.actions'

/** زر اختبار QCM تحت فيديو الحصة */
export function LessonQuizButton({ quiz }: { quiz: { id: string; title: string; questions: number } }) {
  return (
    <Link href={`/student/quizzes/${quiz.id}`} className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 transition-colors hover:bg-primary/10">
      <ClipboardCheck className="size-7 shrink-0 text-primary" />
      <span className="min-w-0">
        <span className="block font-bold">اختبر فهمك — QCM</span>
        <span className="block text-xs text-muted-foreground">
          {quiz.title}
          {quiz.questions ? ` · ${quiz.questions} سؤالاً` : ''}
        </span>
      </span>
    </Link>
  )
}

interface CommentView {
  id: string
  body: string
  status: string
  reply: string | null
  authorName: string
  mine: boolean
  createdAt: string
}

/** تعليقات الحصة: الموافَق عليها للجميع، وتعليقات التلميذ نفسه بحالتها. الجديد ينتظر موافقة الأستاذ. */
export function LessonComments({ slug, comments }: { slug: string; comments: CommentView[] }) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [pending, start] = useTransition()
  const send = () =>
    start(async () => {
      const r = await addLessonCommentAction(slug, body)
      if (!r.ok) return toast('error', r.error.message)
      setBody('')
      toast('success', 'أُرسل تعليقك؛ يظهر بعد موافقة الأستاذ')
      router.refresh()
    })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="size-5 text-primary" /> التعليقات
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={1000} placeholder="سؤالك أو ملاحظتك عن هذه الحصة… (يظهر بعد موافقة الأستاذ)" dir="auto" />
          <Button size="sm" onClick={send} loading={pending} disabled={body.trim().length < 2}>
            إرسال
          </Button>
        </div>
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا تعليقات بعد.</p>
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="rounded-lg border p-3 text-sm">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{c.authorName}</span>
                  <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    {c.mine && c.status === 'PENDING' ? <Badge variant="warning">بانتظار الموافقة</Badge> : null}
                    {c.mine && c.status === 'REJECTED' ? <Badge variant="muted">لم يُنشر</Badge> : null}
                    {formatDateTime(new Date(c.createdAt))}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{c.body}</p>
                {c.reply ? <p className="mt-2 rounded-md bg-primary/5 p-2 text-xs"><span className="font-bold">ردّ الأستاذ:</span> {c.reply}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

/** طابور موافقة الأستاذ على التعليقات */
export function CommentModeration({ items }: { items: { id: string; body: string; authorName: string; contentTitle: string; contentSlug: string; createdAt: string }[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [replies, setReplies] = useState<Record<string, string>>({})
  const act = (id: string, decision: 'APPROVED' | 'REJECTED') =>
    start(async () => {
      const r = await moderateLessonCommentAction(id, decision, replies[id] ?? null)
      if (!r.ok) return toast('error', r.error.message)
      toast('success', decision === 'APPROVED' ? 'نُشر التعليق' : 'رُفض التعليق')
      router.refresh()
    })
  if (items.length === 0) return <p className="text-sm text-muted-foreground">لا تعليقات تنتظر موافقتك.</p>
  return (
    <ul className="space-y-3">
      {items.map((c) => (
        <li key={c.id} className="space-y-2 rounded-lg border p-3 text-sm">
          <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">{c.authorName}</span> على «{c.contentTitle}»
            </span>
            <span>{formatDateTime(new Date(c.createdAt))}</span>
          </div>
          <p className="whitespace-pre-wrap">{c.body}</p>
          <Input value={replies[c.id] ?? ''} onChange={(e) => setReplies((s) => ({ ...s, [c.id]: e.target.value }))} placeholder="ردّ (اختياري) يظهر تحت التعليق" dir="auto" />
          <div className="flex gap-2">
            <Button size="sm" loading={pending} onClick={() => act(c.id, 'APPROVED')}>
              <Check className="size-4" /> نشر
            </Button>
            <Button size="sm" variant="ghost" loading={pending} onClick={() => act(c.id, 'REJECTED')}>
              <X className="size-4 text-destructive" /> رفض
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}

/** في صفحة تعديل الدرس: اختيار اختبار QCM للحصة */
export function LessonQuizPicker({ contentId, quizzes, current }: { contentId: string; quizzes: { id: string; title: string }[]; current: string | null }) {
  const router = useRouter()
  const [value, setValue] = useState(current ?? '')
  const [pending, start] = useTransition()
  const save = () =>
    start(async () => {
      const r = await setLessonQuizAction(contentId, value || null)
      if (!r.ok) return toast('error', r.error.message)
      toast('success', value ? 'رُبط الاختبار بالحصة' : 'فُكّ الربط')
      router.refresh()
    })
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <Select value={value} onChange={(e) => setValue(e.target.value)} className="flex-1">
        <option value="">— بلا اختبار —</option>
        {quizzes.map((q) => (
          <option key={q.id} value={q.id}>
            {q.title}
          </option>
        ))}
      </Select>
      <Button type="button" onClick={save} loading={pending}>
        حفظ
      </Button>
    </div>
  )
}
