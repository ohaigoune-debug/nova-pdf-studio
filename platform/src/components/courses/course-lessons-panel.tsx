'use client'

import { ArrowDown, ArrowUp, FileText, Pencil, PlayCircle, Plus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/toast'
import { moveCourseLessonAction, setCourseLessonPublishedAction } from '@/server/actions/course-lessons.actions'

export interface PanelLesson {
  id: string
  title: string
  published: boolean
  hasPdf: boolean
  video: string | null
}

/** دروس الدورة مرتّبة: أضف، عدّل، قدّم/أخّر، انشر/أخفِ — للمشرف ولرافع المحتوى */
export function CourseLessonsPanel({ courseId, basePath, lessons }: { courseId: string; basePath: string; lessons: PanelLesson[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>) =>
    start(async () => {
      const r = await fn()
      if (!r.ok) toast('error', r.error?.message ?? 'تعذّر')
      router.refresh()
    })
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle>دروس الدورة</CardTitle>
          <CardDescription>كل درس: ملف PDF وفيديو. يظهر للتلاميذ المشتركين بهذا الترتيب.</CardDescription>
        </div>
        <Button asChild>
          <Link href={`${basePath}/lessons/new`}>
            <Plus className="size-4" /> أضف درسًا
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {lessons.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">لا دروس بعد. اضغط «أضف درسًا» وارفع ملف PDF والفيديو.</p>
        ) : (
          <ol className="divide-y rounded-lg border">
            {lessons.map((l, i) => (
              <li key={l.id} className="flex flex-wrap items-center gap-2 p-2.5 text-sm">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{l.title}</span>
                  <span className="mt-0.5 flex flex-wrap gap-1">
                    {l.hasPdf ? <Badge variant="secondary"><FileText className="size-3" /> PDF</Badge> : null}
                    {l.video ? <Badge variant="secondary"><PlayCircle className="size-3" /> فيديو</Badge> : null}
                    {l.published ? <Badge variant="success">منشور</Badge> : <Badge variant="warning">مسودة</Badge>}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" aria-label="تقديم" disabled={pending || i === 0} onClick={() => run(() => moveCourseLessonAction(courseId, l.id, 'up'))}>
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="تأخير" disabled={pending || i === lessons.length - 1} onClick={() => run(() => moveCourseLessonAction(courseId, l.id, 'down'))}>
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setCourseLessonPublishedAction(courseId, l.id, !l.published))}>
                    {l.published ? 'أخفِ' : 'انشر'}
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`${basePath}/lessons/${l.id}`}>
                      <Pencil className="size-3.5" /> تعديل
                    </Link>
                  </Button>
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
