import { ArrowLeft, BookMarked, CalendarClock, CheckCircle2, ClipboardList, Compass, Flame, Gamepad2, RotateCcw, Smartphone, Sparkles, Trophy } from 'lucide-react'
import Link from 'next/link'
import { ContentGrid } from '@/components/domain/content-cards'
import { PhoneVerifyBanner } from '@/components/domain/otp-banner'
import { NextLiveBanner } from '@/components/live/next-live-banner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/misc'
import { t } from '@/i18n'
import { expandHidden, isPathHidden } from '@/lib/student-menu'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { apkSizeMb, appDownload } from '@/server/lib/android-apk'
import { listStudentContent } from '@/server/queries/student-extras.queries'
import { upcomingForStudent } from '@/server/services/live.service'
import { isPhoneVerified } from '@/server/services/otp.service'
import { getHiddenStudentEntries } from '@/server/services/student-menu.service'
import { studentToday, type TodayCourse } from '@/server/services/student-today.service'

export const metadata = { title: 'اليوم' }

const DZ = 'Africa/Algiers'

function greeting(now: Date): string {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: DZ }).format(now))
  return hour >= 5 && hour < 12 ? 'صباح الخير' : 'مساء الخير'
}

function dueLabel(dueAt: Date | null, now: Date): string {
  if (!dueAt) return 'بلا موعد'
  const hours = (dueAt.getTime() - now.getTime()) / 3_600_000
  if (hours < 24) return `قبل ${formatDateTime(dueAt)} · اليوم`
  return `قبل ${formatDateTime(dueAt)}`
}

/** دورة واحدة: أين توقّف، وكم بقي، وزر واحد للمتابعة */
function CourseResume({ course }: { course: TodayCourse }) {
  const pct = course.total ? Math.round((course.seen / course.total) * 100) : 0
  const done = !course.needsTerms && course.total > 0 && !course.next
  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col gap-4 p-5">
        <div className="min-w-0">
          <Link href={course.href} className="line-clamp-2 font-heading text-lg font-semibold leading-snug hover:underline">
            {course.title}
          </Link>
          <p className="text-xs text-muted-foreground">{course.teacherName}</p>
        </div>
        {course.needsTerms ? (
          <p className="text-sm text-muted-foreground">اقرأ شروط الدورة ووافق عليها لتبدأ.</p>
        ) : course.total > 0 ? (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>تقدّمك</span>
              <span>
                {course.seen} من {course.total}
              </span>
            </div>
            <Progress value={pct} tone={done ? 'success' : 'primary'} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">لم يُنشر محتوى في هذه الدورة بعد.</p>
        )}
        {course.nextLive ? (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <CalendarClock className="size-4" /> حصة مباشرة {formatDateTime(course.nextLive.startsAt)}
          </p>
        ) : null}
        <div className="mt-auto">
          {course.needsTerms ? (
            <Button asChild className="w-full">
              <Link href={course.href}>الشروط والبدء</Link>
            </Button>
          ) : course.next ? (
            <Button asChild className="h-auto min-h-11 w-full justify-between gap-3 py-2 text-start">
              <Link href={course.next.href}>
                <span className="min-w-0">
                  <span className="block text-[11px] font-normal opacity-80">{course.next.started ? 'التالي' : 'ابدأ من هنا'}</span>
                  <span className="block truncate">{course.next.title}</span>
                </span>
                <ArrowLeft className="size-4 shrink-0 ltr:rotate-180" />
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline" className="w-full">
              <Link href={course.href}>{done ? 'أكملت كل المحتوى — راجع الدورة' : 'دخول الدورة'}</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * «اليوم» (3 نوفمبر 2026): الصفحة الأولى للتلميذ تقول له ماذا يفعل الآن — أين توقّف في دوراته،
 * ما ينتظره من واجبات، وتحدي PLAY — لا قائمة أقسام (الأبواب الثلاثة في القائمة وشريط الهاتف).
 */
export default async function StudentTodayPage({ searchParams }: { searchParams: Promise<{ verify?: string }> }) {
  const actor = await requirePageActor('STUDENT')
  const q = await searchParams
  const db = await getDb()
  const now = new Date()
  const [today, apk, phoneV, hiddenRaw, upcoming] = await Promise.all([
    studentToday(db, actor, now),
    appDownload({ onlyAndroid: true }),
    isPhoneVerified(db, actor.userId),
    getHiddenStudentEntries(db),
    upcomingForStudent(db, actor).catch(() => [])
  ])
  const hidden = expandHidden(hiddenRaw)
  const show = (path: string) => !isPathHidden(path, hidden)
  const nextLive = upcoming[0] ?? null
  const suggested = !today.hasCourses && show('/student/lessons') ? await listStudentContent(db, actor, { limit: 3 }) : []
  const firstName = actor.fullName.trim().split(/\s+/)[0] ?? ''
  const dateLine = new Intl.DateTimeFormat('ar-DZ', { weekday: 'long', day: 'numeric', month: 'long', timeZone: DZ }).format(now)
  const { play } = today
  const showPlay = show('/student/play')
  const showAssignments = show('/student/assignments') && today.assignments.length > 0

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">{dateLine}</p>
        <h1 className="mt-1 font-heading text-[26px] font-bold leading-[1.4] sm:text-3xl">
          {greeting(now)}، {firstName}
        </h1>
      </header>

      {/* الحصة المباشرة القادمة (دورات مدفوعة): لا شيء إن لم تكن حصة */}
      <NextLiveBanner session={nextLive ? { ...nextLive, startsAt: nextLive.startsAt.toISOString() } : null} />
      {/* الهاتف غير مؤكَّد: شريط صغير يفتح بطاقة OTP (مفتوحة مباشرة بعد التسجيل) */}
      {!phoneV.verified ? <PhoneVerifyBanner phone={phoneV.phone} open={q.verify === '1'} /> : null}

      <section aria-labelledby="resume-title" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="resume-title" className="font-heading text-xl font-bold">
            أكمل من حيث توقّفت
          </h2>
          {today.hasCourses ? (
            <Button asChild variant="link" size="sm">
              <Link href="/student/courses">كل دوراتي</Link>
            </Button>
          ) : null}
        </div>
        {today.courses.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {today.courses.map((c) => (
              <CourseResume key={c.id} course={c} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                <BookMarked className="size-6" />
              </span>
              <p className="text-sm text-muted-foreground sm:flex-1">لا دورة مفعّلة بعد. اطلب كتاب الدورة: يصلك بالدفع عند الاستلام وتُفعَّل الدورة عند التسليم.</p>
              {show('/student/courses/catalog') ? (
                <Button asChild className="shrink-0">
                  <Link href="/student/courses/catalog">
                    <Compass className="size-4" /> اكتشف الدورات
                  </Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        )}
      </section>

      {showAssignments || showPlay ? (
        <div className={showAssignments && showPlay ? 'grid gap-6 lg:grid-cols-2' : 'grid gap-6'}>
          {showAssignments ? (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ClipboardList className="size-5 text-primary" /> واجبات تنتظرك
                </CardTitle>
                <Button asChild variant="link" size="sm">
                  <Link href="/student/assignments">الكل</Link>
                </Button>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {today.assignments.map((a) => (
                    <li key={a.id}>
                      <Link href={`/student/assignments/${a.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-primary">
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{a.title}</span>
                          <span className="block text-xs text-muted-foreground">
                            {a.teacherName ? `${a.teacherName} · ` : ''}
                            {dueLabel(a.dueAt, now)}
                          </span>
                        </span>
                        <ArrowLeft className="size-4 shrink-0 text-muted-foreground ltr:rotate-180" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {showPlay ? (
            <Card className="border-primary/25">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Gamepad2 className="size-5 text-primary" /> PLAY اليوم
                </CardTitle>
                {play.ready ? (
                  <span className="text-xs font-semibold text-muted-foreground">
                    {play.levelTitle} · {play.xpTotal} XP
                  </span>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-4">
                {play.ready ? (
                  <>
                    <ul className="space-y-2.5 text-sm">
                      <li className="flex items-center gap-2">
                        {play.dailyDone ? <CheckCircle2 className="size-5 text-success" /> : <Sparkles className="size-5 text-primary" />}
                        {play.dailyDone ? 'أنهيت تحدي اليوم' : 'تحدي اليوم ينتظرك'}
                      </li>
                      {play.mistakesDue > 0 ? (
                        <li>
                          <Link href="/student/play/mistakes" className="flex items-center gap-2 hover:text-primary hover:underline">
                            <RotateCcw className="size-5 text-warning" /> {play.mistakesDue} {play.mistakesDue === 1 ? 'سؤال أخطأت فيه حان وقت مراجعته' : 'أسئلة أخطأت فيها حان وقت مراجعتها'}
                          </Link>
                        </li>
                      ) : null}
                      <li className="flex items-center gap-2">
                        <Flame className={play.streakDays > 0 ? 'size-5 text-warning' : 'size-5 text-muted-foreground'} />
                        {play.streakDays > 0 ? `سلسلتك: ${play.streakDays} ${play.streakDays === 1 ? 'يوم' : 'أيام'} — لا تقطعها` : 'ابدأ سلسلتك اليوم'}
                      </li>
                    </ul>
                    <Button asChild className="w-full">
                      <Link href="/student/play">
                        <Trophy className="size-4" /> {play.dailyDone ? 'العب مرة أخرى' : 'العب الآن'}
                      </Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">بطاقات الدروس، الفروض والبكالوريات في لعبة واحدة. اختر قسمك وابدأ.</p>
                    <Button asChild className="w-full">
                      <Link href="/student/play/setup">ابدأ PLAY</Link>
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {suggested.length ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-xl font-bold">دروس مجانية لتبدأ بها</h2>
            <Button asChild variant="link" size="sm">
              <Link href="/student/lessons">{t('common.viewAll')}</Link>
            </Button>
          </div>
          <ContentGrid items={suggested} basePath="/student/lessons" />
        </section>
      ) : null}

      {apk ? (
        <a href="/download/android" className="flex items-center gap-3 rounded-lg border border-primary/25 bg-primary/5 p-4 transition-colors hover:bg-primary/10">
          <Smartphone className="size-7 shrink-0 text-primary" />
          <span className="min-w-0 leading-tight">
            <span className="block font-bold">{t('public.androidApp')}</span>
            <span className="block text-xs text-muted-foreground">{t('public.androidAppD', { size: apkSizeMb(apk.size) })}</span>
          </span>
        </a>
      ) : null}
    </div>
  )
}
