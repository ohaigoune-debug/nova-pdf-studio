import { ArrowLeft, BookOpen, ClipboardCheck, ClipboardList, TrendingUp, Clock, FileText, FolderOpen, Gamepad2, MessagesSquare, PlayCircle, Radio, type LucideIcon } from 'lucide-react'
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
import type { CourseSectionId, SectionItem } from '@/server/lib/course-sections'
import { courseHome, type CourseContentItem } from '@/server/services/courses.service'
import { upcomingForStudent } from '@/server/services/live.service'
import { courseBookStateById } from '@/server/services/course-purchase.service'

export const dynamic = 'force-dynamic'

const SECTION_UI: Record<CourseSectionId, { icon: LucideIcon; tone: string; hint: string }> = {
  lessons: { icon: BookOpen, tone: 'bg-success/10 text-success', hint: 'بترتيب الحصص' },
  videos: { icon: PlayCircle, tone: 'bg-warning/10 text-warning', hint: 'تسجيلات وشروح' },
  homework: { icon: ClipboardList, tone: 'bg-primary/10 text-primary', hint: 'فروض ومواضيع' },
  tests: { icon: ClipboardCheck, tone: 'bg-destructive/10 text-destructive', hint: 'اختبارات وامتحانات' },
  files: { icon: FolderOpen, tone: 'bg-cyan/10 text-cyan', hint: 'ملفات ووثائق' }
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
        const purchase = await courseBookStateById(db, landing.course.id)
        return <CourseLandingView landing={landing} purchase={purchase} />
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
  const liveNext = (await upcomingForStudent(db, actor).catch(() => [])).find((l) => l.courseId === course.id) ?? null
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { href: '#live', label: 'الحصص المباشرة', hint: 'مواعيد الدورة', icon: Radio, tone: 'bg-primary/10 text-primary' },
          ...sections.map((section) => ({ href: `#${section.id}`, label: section.label, hint: `${section.items.length} · ${SECTION_UI[section.id].hint}`, icon: SECTION_UI[section.id].icon, tone: SECTION_UI[section.id].tone })),
          { href: playHref, label: 'التدريب PLAY', hint: 'تدرّب واختبر نفسك', icon: Gamepad2, tone: 'bg-purple/10 text-purple' },
          { href: classroomHref, label: 'القسم الافتراضي', hint: 'أسئلة ومناقشات', icon: MessagesSquare, tone: 'bg-destructive/10 text-destructive' },
          { href: '/student/progress', label: 'تقدمي', hint: 'إنجازاتي ومهاراتي', icon: TrendingUp, tone: 'bg-cyan/10 text-cyan' }
        ].map((item) => (
          <Link key={item.href} href={item.href} className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-lg border bg-card p-5 text-center shadow-soft transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className={`flex size-14 items-center justify-center rounded-full ${item.tone}`}><item.icon className="size-6" /></span>
            <span className="font-bold">{item.label}</span>
            <span className="text-xs text-muted-foreground">{item.hint}</span>
          </Link>
        ))}
      </div>

      {sections.length === 0 ? (
        <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">لا محتوى منشور في هذه الدورة بعد — ستظهر هنا الحصص والفيديوهات والفروض والاختبارات والملفات.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {sections.map((section) => {
            const Icon = SECTION_UI[section.id].icon
            return (
              <Card key={section.id} id={section.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="size-5 text-primary" /> {section.label}
                    <Badge variant="secondary">{section.items.length}</Badge>
                  </CardTitle>
                  {section.id === 'videos' ? <CardDescription>تُشاهَد داخل المنصة فقط وتختفي بعد انتهاء الدورة.</CardDescription> : null}
                  {section.id === 'lessons' ? <CardDescription>بترتيب الحصص: الحصة 1 ثم 2 ثم 3…</CardDescription> : null}
                </CardHeader>
                <CardContent>
                  <SectionList items={section.items} />
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Card id="live">
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
