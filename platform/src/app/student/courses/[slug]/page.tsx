import { ArrowLeft, BookOpen, ClipboardCheck, TrendingUp, Clock, FileText, FolderOpen, Gamepad2, MessagesSquare, PlayCircle, Radio, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CourseLandingView } from '@/components/academy/course-landing'
import { NextLiveBanner } from '@/components/live/next-live-banner'
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
import { courseLanding } from '@/server/services/academy-catalog.service'
import type { SectionItem } from '@/server/lib/course-sections'
import { COURSE_DOOR_LABELS_AR, groupIntoDoors, type ContentDoorId } from '@/server/lib/course-doors'
import { courseHome, type CourseContentItem } from '@/server/services/courses.service'
import { upcomingForStudent } from '@/server/services/live.service'
import { isPathHidden } from '@/lib/student-menu'
import { studentHiddenPaths } from '@/server/services/ios-only.service'
import { bookUpgradeOffer, courseBookStateById, courseDigitalStateById } from '@/server/services/course-purchase.service'

export const dynamic = 'force-dynamic'

/** الأبواب الثلاثة ذات المحتوى (الأبواب الخمسة: قرار المالك 2026-11-13) */
const DOOR_UI: Record<ContentDoorId, { icon: LucideIcon; tone: string; hint: string; empty: string }> = {
  recorded: { icon: PlayCircle, tone: 'bg-warning/10 text-warning', hint: 'دروس وتسجيلات', empty: 'لا حصص مسجلة بعد. تظهر هنا الدروس وتسجيلات الحصص المباشرة.' },
  files: { icon: FolderOpen, tone: 'bg-cyan/10 text-cyan', hint: 'ملفات ووثائق', empty: 'لا ملفات بعد.' },
  practice: { icon: ClipboardCheck, tone: 'bg-success/10 text-success', hint: 'فروض واختبارات', empty: 'لا فروض ولا اختبارات بعد. نتائجك وتقدّمك في الزر أدناه.' }
}


/** قائمة قسم: شارة برقم الحصة إن وُجد، وإلا أيقونة النوع */
function SectionList({ items }: { items: SectionItem<CourseContentItem>[] }) {
  return (
    <ul className="divide-y rounded-lg border">
      {items.map((c) => (
        <li key={c.id}>
          <Link href={c.href} className="flex items-center gap-3 p-3 text-sm transition-colors hover:bg-muted/60">
            {c.session !== null ? (
              <span className="flex size-9 shrink-0 flex-col items-center justify-center rounded-full bg-primary text-primary-foreground" aria-label={`الحصة ${c.session}`}>
                <span className="text-[9px] leading-none opacity-80">حصة</span>
                <span className="text-sm font-bold leading-none tabular-nums">{c.session}</span>
              </span>
            ) : (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">{c.type === 'VIDEO' ? <PlayCircle className="size-4" /> : <FileText className="size-4" />}</span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{c.displayTitle}</span>
              <span className="block text-xs text-muted-foreground">
                {tEnum('contentTypes', c.type)}
                {c.publishedAt ? ` · ${formatDate(c.publishedAt)}` : ''}
              </span>
            </span>
            <ArrowLeft className="size-4 shrink-0 text-muted-foreground ltr:rotate-180" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default async function StudentCoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const actor = await requirePageActor('STUDENT')
  // الرابط العربي يصل مرمَّزاً (%D8%AF…) — يُفكّ كما في صفحات الدروس والمتجر، وإلا لا تُوجد الدورة فتظهر صفحة فارغة
  const { slug: rawSlug } = await params
  let slug = rawSlug
  try {
    slug = decodeURIComponent(rawSlug)
  } catch {
    slug = rawSlug
  }
  const db = await getDb()
  let home: Awaited<ReturnType<typeof courseHome>>
  try {
    home = await courseHome(db, actor, slug)
  } catch (err) {
    // غير مشترك أو اشتراك منتهٍ/ملغى: صفحة التعريف (بيانات العرض فقط) بدل 404 — الاكتشاف مفصول عن الوصول.
    if (isAppError(err) && (err.code === 'COURSE_NOT_FOUND' || err.code === 'COURSE_NOT_ENROLLED')) {
      try {
        const landing = await courseLanding(db, actor, slug)
        const [purchase, digital] = await Promise.all([courseBookStateById(db, landing.course.id), courseDigitalStateById(db, landing.course.id)])
        return <CourseLandingView landing={landing} purchase={purchase} digital={digital.purchasable && digital.priceDzd ? { priceDzd: digital.priceDzd } : null} />
      } catch (e2) {
        if (isAppError(e2) && e2.code === 'COURSE_NOT_FOUND') notFound()
        throw e2
      }
    }
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

  const { course, nextLive, upcoming, sections, playHref, classroomHref, expiresAt } = home
  const [liveNext, upgrade, hidden] = await Promise.all([
    upcomingForStudent(db, actor)
      .catch(() => [])
      .then((ls) => ls.find((l) => l.courseId === course.id) ?? null),
    // اشترى النسخة الرقمية: يمكنه طلب الكتاب الورقي بدفع الفرق فقط
    bookUpgradeOffer(db, actor, course.id).catch(() => null),
    studentHiddenPaths(db)
  ])
  const showPlay = !isPathHidden('/student/play', hidden)
  const doors = groupIntoDoors(sections)
  const count = (id: ContentDoorId) => doors.find((d) => d.id === id)?.count ?? 0
  const liveHint = liveNext ? formatDateTime(liveNext.startsAt) : upcoming.length > 0 ? `${upcoming.length} · مجدولة` : 'لا حصص مجدولة'
  const tiles: Array<{ href: string; label: string; hint: string; icon: LucideIcon; tone: string }> = [
    { href: '#live', label: COURSE_DOOR_LABELS_AR.live, hint: liveHint, icon: Radio, tone: 'bg-primary/10 text-primary' },
    ...(['recorded', 'files', 'practice'] as const).map((id) => ({ href: `#${id}`, label: COURSE_DOOR_LABELS_AR[id], hint: `${count(id)} · ${DOOR_UI[id].hint}`, icon: DOOR_UI[id].icon, tone: DOOR_UI[id].tone })),
    { href: classroomHref, label: COURSE_DOOR_LABELS_AR.classroom, hint: 'أسئلة ومناقشات', icon: MessagesSquare, tone: 'bg-destructive/10 text-destructive' }
  ]
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

      {upgrade ? (
        <Alert tone="info" title="تريد الكتاب الورقي أيضًا؟">
          <span className="flex flex-wrap items-center justify-between gap-3">
            <span>
              اشتركت بالنسخة الرقمية. اطلب كتاب «{upgrade.bookTitle}» وادفع الفرق فقط: <strong className="tabular-nums">{upgrade.priceDzd} دج</strong> + التوصيل.
            </span>
            <Button asChild size="sm">
              <Link href={`/student/courses/${encodeURIComponent(course.slug)}/order`}>
                <BookOpen className="size-4" /> اطلب الكتاب
              </Link>
            </Button>
          </span>
        </Alert>
      ) : null}

      {/* الحصة المباشرة القادمة لهذه الدورة: عدّ تنازلي + زر «انضم» (يُفتح قبل الموعد بـ15 دقيقة) */}
      {liveNext ? (
        <NextLiveBanner session={{ ...liveNext, startsAt: liveNext.startsAt.toISOString() }} />
      ) : nextLive ? (
        <Alert tone="info" title={`البث القادم: ${nextLive.title}`}>
          <p className="flex flex-wrap items-center gap-2">
            <Radio className="size-4 text-primary" />
            <span>
              {formatDateTime(nextLive.startsAt)} · {nextLive.durationMinutes} دقيقة
            </span>
          </p>
        </Alert>
      ) : null}

      {/* الأبواب الخمسة: المباشرة، المسجلة، الملفات، تماريني ونتائجي، القسم الافتراضي */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((item) => (
          <Link key={item.href} href={item.href} className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-lg border bg-card p-5 text-center shadow-soft transition-colors last:col-span-2 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:last:col-span-1">
            <span className={`flex size-14 items-center justify-center rounded-full ${item.tone}`}><item.icon className="size-6" /></span>
            <span className="font-bold">{item.label}</span>
            <span className="text-xs text-muted-foreground">{item.hint}</span>
          </Link>
        ))}
      </div>

      <Card id="live">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="size-5 text-primary" /> {COURSE_DOOR_LABELS_AR.live}
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

      <div className="grid gap-6 lg:grid-cols-2">
        {doors.map((d) => {
          const ui = DOOR_UI[d.id]
          return (
            <Card key={d.id} id={d.id} className={d.id === 'recorded' ? 'lg:col-span-2' : undefined}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ui.icon className="size-5 text-primary" /> {d.label}
                  <Badge variant="secondary">{d.count}</Badge>
                </CardTitle>
                {d.id === 'recorded' ? <CardDescription>بترتيب الحصص: الحصة 1 ثم 2 ثم 3… تُشاهَد داخل المنصة فقط وتختفي بعد انتهاء الدورة.</CardDescription> : null}
              </CardHeader>
              <CardContent className="space-y-4">
                {d.count === 0 ? (
                  <p className="text-sm text-muted-foreground">{ui.empty}</p>
                ) : (
                  d.groups.map((g) => (
                    <div key={g.id} className="space-y-2">
                      {d.groups.length > 1 ? <h3 className="text-sm font-semibold text-muted-foreground">{g.label}</h3> : null}
                      <SectionList items={g.items} />
                    </div>
                  ))
                )}
                {d.id === 'practice' ? (
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href="/student/progress">
                        <TrendingUp className="size-4" /> نتائجي وتقدمي
                      </Link>
                    </Button>
                    {showPlay ? (
                      <Button asChild variant="outline" size="sm">
                        <Link href={playHref}>
                          <Gamepad2 className="size-4" /> التدريب PLAY
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
