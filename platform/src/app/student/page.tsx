import { ArrowLeft, CheckCheck, BookMarked, BookOpen, Compass, FileStack, Gamepad2, ShoppingBag, Smartphone, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { ContentGrid } from '@/components/domain/content-cards'
import { PhoneVerifyBanner } from '@/components/domain/otp-banner'
import { NextLiveBanner } from '@/components/live/next-live-banner'
import { upcomingForStudent } from '@/server/services/live.service'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, StatCard } from '@/components/ui/misc'
import { t } from '@/i18n'
import { formatDateTime, percent } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { apkSizeMb, appDownload } from '@/server/lib/android-apk'
import { listStudentContent } from '@/server/queries/student-extras.queries'
import { myCourses } from '@/server/services/courses.service'
import { isPhoneVerified } from '@/server/services/otp.service'
import { skillMap } from '@/server/services/skills.service'

export default async function StudentHomePage({ searchParams }: { searchParams: Promise<{ verify?: string }> }) {
  const actor = await requirePageActor('STUDENT')
  const q = await searchParams
  const db = await getDb()
  const [courses, suggested, skills, apk, phoneV] = await Promise.all([myCourses(db, actor), listStudentContent(db, actor, { limit: 3 }), skillMap(db, actor.studentId!), appDownload({ onlyAndroid: true }), isPhoneVerified(db, actor.userId)])
  const nextLive = (await upcomingForStudent(db, actor).catch(() => []))[0] ?? null
  const avgSkill = skills.length ? skills.reduce((s, k) => s + k.score, 0) / skills.length : null
  const active = courses.filter((c) => c.status === 'ACTIVE')
  // «متابعة التعلّم» لا تظهر إلا برابط حقيقي: أول دورة مفعّلة (الحصة القادمة أولاً إن وُجدت)
  const resume = [...active].sort((a, b) => Number(Boolean(b.nextLive)) - Number(Boolean(a.nextLive)))[0] ?? null
  // الأقسام الخمسة (قرار المالك 2026-10-24): الحضور والأفواج مخفية من واجهة التلميذ
  const tiles = [
    { href: '/student/lessons', label: 'الدروس', hint: 'المحتوى المجاني', icon: BookOpen, tone: 'bg-secondary text-secondary-foreground' },
    { href: '/student/courses', label: 'دوراتي', hint: active.length ? `${active.length} دورة مفعّلة` : 'حصص وتسجيلات', icon: BookMarked, tone: 'bg-secondary text-secondary-foreground' },
    { href: '/student/exams', label: 'الفروض والاختبارات', hint: 'مراجعة وتحضير', icon: CheckCheck, tone: 'bg-secondary text-secondary-foreground' },
    { href: '/student/play', label: 'مدرسة PLAY', hint: 'تعلّم بطريقة ممتعة', icon: Gamepad2, tone: 'bg-accent text-accent-foreground' }
  ]

  return (
    <div className="space-y-6">
      {/* ترحيب قصير باسم الطالب ثم ما يتابعه الآن — بلا هوية أستاذ عامة في فضاء الطالب */}
      <section className="rounded-xl border bg-card p-5 shadow-soft sm:p-6">
        <p className="text-sm text-muted-foreground">{t('dashboard.studentTitle')}</p>
        <h1 className="mt-1 font-heading text-[28px] font-bold leading-[1.4] sm:text-4xl">{t('dashboard.welcome', { name: actor.fullName })}</h1>
        {resume ? (
          <div className="mt-5 flex flex-col gap-4 rounded-lg bg-secondary p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-secondary-foreground">متابعة التعلّم</p>
              <p className="truncate font-heading text-xl font-semibold">{resume.title}</p>
              <p className="text-sm text-muted-foreground">
                {resume.teacherName}
                {resume.nextLive ? ` · الحصة القادمة ${formatDateTime(resume.nextLive.startsAt)}` : ''}
              </p>
            </div>
            <Button asChild size="lg" className="shrink-0">
              <Link href={resume.href}>
                متابعة التعلّم <ArrowLeft className="size-4 rtl:rotate-0 ltr:rotate-180" />
              </Link>
            </Button>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="text-sm text-muted-foreground sm:flex-1">لا دورة مفعّلة بعد. اطلب كتاب الدورة: يصلك بالدفع عند الاستلام وتُفعَّل الدورة عند التسليم.</p>
            <Button asChild size="lg" className="shrink-0">
              <Link href="/student/courses/catalog">
                <Compass className="size-5" /> اكتشف الدورات
              </Link>
            </Button>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/student/courses/catalog">
              <Compass className="size-4" /> اكتشف الدورات
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/student/courses/orders">
              <ShoppingBag className="size-4" /> طلباتي
            </Link>
          </Button>
        </div>
      </section>
      {/* الحصة المباشرة القادمة (دورات مدفوعة): لا شيء إن لم تكن حصة */}
      <NextLiveBanner session={nextLive ? { ...nextLive, startsAt: nextLive.startsAt.toISOString() } : null} />
      {/* الهاتف غير مؤكَّد: شريط صغير يفتح بطاقة OTP (مفتوحة مباشرة بعد التسجيل) */}
      {!phoneV.verified ? <PhoneVerifyBanner phone={phoneV.phone} open={q.verify === '1'} /> : null}
      {apk ? (
        <a href="/download/android" className="flex items-center gap-3 rounded-lg border border-primary/25 bg-primary/5 p-4 transition-colors hover:bg-primary/10">
          <Smartphone className="size-7 shrink-0 text-primary" />
          <span className="min-w-0 leading-tight">
            <span className="block font-bold">{t('public.androidApp')}</span>
            <span className="block text-xs text-muted-foreground">{t('public.androidAppD', { size: apkSizeMb(apk.size) })}</span>
          </span>
        </a>
      ) : null}

      <h2 className="font-heading text-[22px] font-bold sm:text-2xl">ماذا تريد أن تتعلم اليوم؟</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Link key={tile.href} href={tile.href} className="group flex min-h-36 flex-col items-center justify-center rounded-lg border bg-card p-5 text-center shadow-soft transition-colors duration-150 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className={`flex size-14 items-center justify-center rounded-full ${tile.tone}`}><tile.icon className="size-6" /></span>
            <span className="mt-2 block font-heading text-lg font-semibold">{tile.label}</span>
            <span className="block text-xs text-muted-foreground">{tile.hint}</span>
          </Link>
        ))}
      </div>

      <Button asChild variant="outline"><Link href="/bac"><FileStack className="size-5" /> بنك البكالوريات</Link></Button>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>دوراتي</CardTitle>
            <Button asChild variant="link" size="sm">
              <Link href="/student/courses/catalog">شراء دورة</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {active.length === 0 ? (
              <EmptyState icon={BookMarked} title="لا دورة مفعّلة بعد" description="اطلب كتاب الدورة: يصلك بالدفع عند الاستلام وتُفعَّل الدورة لحظة التسليم." action={<Button asChild><Link href="/student/courses/catalog">تصفّح الدورات</Link></Button>} />
            ) : (
              <ul className="divide-y">
                {active.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <Link href={c.href} className="truncate font-bold hover:underline">
                        {c.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {c.teacherName} · {c.videos} فيديو · {c.lessons} درس
                        {c.nextLive ? ` · الحصة القادمة ${formatDateTime(c.nextLive.startsAt)}` : ''}
                      </p>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href={c.href}>دخول</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <StatCard label={t('dashboard.skillsLevel')} value={percent(avgSkill)} hint={avgSkill === null ? t('studentPages.skillsEmpty') : `${skills.length} مهارة مقيَّمة`} icon={TrendingUp} tone={avgSkill !== null && avgSkill < 60 ? 'warning' : 'default'} />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-[22px] font-bold">{t('dashboard.suggested')}</h2>
          <Button asChild variant="link" size="sm">
            <Link href="/student/lessons">{t('common.viewAll')}</Link>
          </Button>
        </div>
        <ContentGrid items={suggested} basePath="/student/lessons" />
      </section>
    </div>
  )
}
