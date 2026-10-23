import { ArrowLeft, Clock, FileText, Gamepad2, MessagesSquare, PlayCircle, Radio } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { TermsGate } from '@/components/courses/terms-gate'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, PageHeader } from '@/components/ui/misc'
import { tEnum } from '@/i18n'
import { formatDate, formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { courseHome, type CourseContentItem } from '@/server/services/courses.service'

export const dynamic = 'force-dynamic'

function ContentList({ items, empty }: { items: CourseContentItem[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <ul className="divide-y rounded-lg border">
      {items.map((c) => (
        <li key={c.id}>
          <Link href={c.href} className="flex items-center gap-3 p-3 text-sm transition-colors hover:bg-muted/60">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">{c.type === 'VIDEO' ? <PlayCircle className="size-4" /> : <FileText className="size-4" />}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{c.title}</span>
              <span className="block text-xs text-muted-foreground">
                {tEnum('contentTypes', c.type)}
                {c.publishedAt ? ` · ${formatDate(c.publishedAt)}` : ''}
              </span>
            </span>
            <ArrowLeft className="size-4 shrink-0 text-muted-foreground rtl:rotate-0 ltr:rotate-180" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default async function StudentCoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const actor = await requirePageActor('STUDENT')
  const { slug } = await params
  let home: Awaited<ReturnType<typeof courseHome>>
  try {
    home = await courseHome(await getDb(), actor, slug)
  } catch (err) {
    if (isAppError(err) && err.code === 'COURSE_NOT_FOUND') notFound()
    if (isAppError(err) && err.code === 'COURSE_NOT_ENROLLED') redirect('/student/courses')
    throw err
  }

  if (home.needsTerms) {
    return (
      <>
        <PageHeader title={home.course.title} description="خطوة واحدة قبل الدخول." />
        <TermsGate courseId={home.course.id} slug={home.course.slug} title={home.course.title} termsText={home.course.termsText} />
      </>
    )
  }

  const { course, nextLive, upcoming, videos, lessons, playHref, classroomHref, expiresAt } = home
  return (
    <div className="space-y-6">
      <PageHeader
        title={course.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>
              {course.teacherName} · {course.season}
            </span>
            {expiresAt || course.accessEndsOn ? (
              <Badge variant="secondary">
                <Clock className="size-3" /> حتى {formatDate(expiresAt ?? course.accessEndsOn)}
              </Badge>
            ) : null}
          </span>
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/student/courses">دوراتي</Link>
          </Button>
        }
      />

      {course.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={course.coverUrl} alt="" className="max-h-56 w-full rounded-xl border object-cover" />
      ) : null}
      {course.description ? <p className="text-sm leading-relaxed text-muted-foreground">{course.description}</p> : null}

      {nextLive ? (
        <Alert tone="info" title={`البث القادم: ${nextLive.title}`}>
          <p className="flex flex-wrap items-center gap-2">
            <Radio className="size-4 text-primary" />
            <span>
              {formatDateTime(nextLive.startsAt)} · {nextLive.durationMinutes} دقيقة
            </span>
            <span className="text-xs text-muted-foreground">يُفتح رابط الدخول قبل الموعد بدقائق من هذه الصفحة.</span>
          </p>
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Button asChild variant="outline" className="h-auto flex-col gap-1 py-3">
          <Link href={classroomHref}>
            <MessagesSquare className="size-5 text-primary" />
            <span className="text-xs font-semibold">القسم الافتراضي</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto flex-col gap-1 py-3">
          <Link href={playHref}>
            <Gamepad2 className="size-5 text-primary" />
            <span className="text-xs font-semibold">تدرّب في PLAY</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto flex-col gap-1 py-3">
          <Link href="#videos">
            <PlayCircle className="size-5 text-primary" />
            <span className="text-xs font-semibold">{videos.length} فيديو</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto flex-col gap-1 py-3">
          <Link href="#lessons">
            <FileText className="size-5 text-primary" />
            <span className="text-xs font-semibold">{lessons.length} درس/ملف</span>
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="videos">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="size-5 text-primary" /> الفيديوهات المسجّلة
            </CardTitle>
            <CardDescription>الأحدث أولاً. تُشاهَد داخل المنصة فقط وتختفي بعد انتهاء الدورة.</CardDescription>
          </CardHeader>
          <CardContent>
            <ContentList items={videos} empty="لا فيديوهات بعد — ستظهر هنا تسجيلات الحصص والدروس." />
          </CardContent>
        </Card>
        <Card id="lessons">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5 text-primary" /> الدروس والملفات
            </CardTitle>
            <CardDescription>ملخّصات، تمارين، ملفات PDF مختومة باسمك.</CardDescription>
          </CardHeader>
          <CardContent>
            <ContentList items={lessons} empty="لا ملفات بعد." />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="size-5 text-primary" /> الحصص المباشرة القادمة
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا حصص مجدولة حالياً.</p>
          ) : (
            <ul className="divide-y rounded-lg border text-sm">
              {upcoming.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 p-3">
                  <span className="min-w-0">
                    <span className="block font-semibold">{s.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDateTime(s.startsAt)} · {s.durationMinutes} دقيقة
                    </span>
                  </span>
                  <Badge variant="secondary">{s.provider}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
