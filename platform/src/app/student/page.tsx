import { BookMarked, BookOpen, FileStack, FileText, Gamepad2, Smartphone, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { ContentGrid } from '@/components/domain/content-cards'
import { PhoneVerifyBanner } from '@/components/domain/otp-banner'
import { TeacherBanner } from '@/components/domain/teacher-banner'
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
import { getAboutSettings } from '@/server/services/about.service'
import { myCourses } from '@/server/services/courses.service'
import { isPhoneVerified } from '@/server/services/otp.service'
import { skillMap } from '@/server/services/skills.service'

export default async function StudentHomePage({ searchParams }: { searchParams: Promise<{ verify?: string }> }) {
  const actor = await requirePageActor('STUDENT')
  const q = await searchParams
  const db = await getDb()
  const [courses, suggested, skills, about, apk, phoneV] = await Promise.all([myCourses(db, actor), listStudentContent(db, actor, { limit: 3 }), skillMap(db, actor.studentId!), getAboutSettings(db), appDownload({ onlyAndroid: true }), isPhoneVerified(db, actor.userId)])
  const nextLive = (await upcomingForStudent(db, actor).catch(() => []))[0] ?? null
  const avgSkill = skills.length ? skills.reduce((s, k) => s + k.score, 0) / skills.length : null
  const active = courses.filter((c) => c.status === 'ACTIVE')
  // الأقسام الخمسة (قرار المالك 2026-10-24): الحضور والأفواج مخفية من واجهة التلميذ
  const tiles = [
    { href: '/student/lessons', label: 'الدروس', hint: 'منظَّمة بالمادة والشعبة', icon: BookOpen },
    { href: '/student/exams', label: 'الفروض', hint: 'فروض واختبارات مع الحلول', icon: FileText },
    { href: '/bac', label: 'بنك البكالوريات', hint: 'مواضيع السنوات السابقة', icon: FileStack },
    { href: '/student/play', label: 'تدرّب', hint: 'MADRASADZ PLAY وتمارين', icon: Gamepad2 },
    { href: '/student/courses', label: 'الدورات', hint: active.length ? `${active.length} دورة مفعّلة` : 'اشترِ دورة مع الكتاب', icon: BookMarked }
  ]

  return (
    <div className="space-y-6">
      <TeacherBanner
        about={about}
        greeting={t('dashboard.welcome', { name: actor.fullName })}
        subtitle={t('dashboard.studentTitle')}
        action={
          <span className="flex flex-wrap gap-2">
            <Button asChild size="lg" variant="gold">
              <Link href={active.length ? '/student/courses' : '/student/courses/catalog'}>
                <BookMarked className="size-5" /> {active.length ? 'دوراتي' : 'شراء دورة'}
              </Link>
            </Button>
          </span>
        }
      />
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((tile) => (
          <Link key={tile.href} href={tile.href} className="group rounded-xl border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-primary/5">
            <tile.icon className="size-6 text-primary" />
            <span className="mt-2 block font-extrabold">{tile.label}</span>
            <span className="block text-xs text-muted-foreground">{tile.hint}</span>
          </Link>
        ))}
      </div>

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
          <h2 className="text-lg font-extrabold">{t('dashboard.suggested')}</h2>
          <Button asChild variant="link" size="sm">
            <Link href="/student/lessons">{t('common.viewAll')}</Link>
          </Button>
        </div>
        <ContentGrid items={suggested} basePath="/student/lessons" />
      </section>
    </div>
  )
}
