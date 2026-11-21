import { cookies } from 'next/headers'
import { Smartphone } from 'lucide-react'
import Link from 'next/link'
import { iconByName } from '@/components/icon-registry'
import { PhoneVerifyBanner } from '@/components/domain/otp-banner'
import { ChooseScopeCard } from '@/components/student/student-scope-ui'
import { t } from '@/i18n'
import { STUDENT_HUBS, STUDENT_MENU_ORDER } from '@/lib/student-hubs'
import { hubEntry } from '@/lib/student-menu'
import { STUDENT_HINTS, STUDENT_TONES } from '@/lib/student-tiles'
import { untilLabel } from '@/lib/live-time'
import { cn } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { readPendingCode } from '@/server/lib/pending-code'
import { apkSizeMb, appDownload } from '@/server/lib/android-apk'
import { iosAppDownload } from '@/server/services/ios-app.service'
import { LANDING_COOKIE, landingResumeFor } from '@/server/services/landing.service'
import { joinWindow, upcomingForStudent } from '@/server/services/live.service'
import { isPhoneVerified } from '@/server/services/otp.service'
import { studentHiddenPaths } from '@/server/services/ios-only.service'
import { levelStreamOptions, studentScope } from '@/server/services/student-scope.service'
import { studentToday } from '@/server/services/student-today.service'

export const metadata = { title: 'الرئيسية' }

const DZ = 'Africa/Algiers'

function greeting(now: Date): string {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: DZ }).format(now))
  return hour >= 5 && hour < 12 ? 'صباح الخير' : 'مساء الخير'
}

/**
 * الرئيسية (قرار المالك 21 نوفمبر 2026، بدل «اليوم»): تحيّة وموعد الحصة المباشرة القادمة،
 * ثم أيقونات كبيرة للمداخل الستة نفسها التي في القائمة — لا دروس مجانية ولا أقسام أخرى.
 */
export default async function StudentHomePage({ searchParams }: { searchParams: Promise<{ verify?: string }> }) {
  const actor = await requirePageActor('STUDENT')
  const q = await searchParams
  const db = await getDb()
  const now = new Date()
  const [today, apk, ios, phoneV, hidden, upcoming] = await Promise.all([
    studentToday(db, actor, now),
    appDownload({ onlyAndroid: true }),
    iosAppDownload(db, { onlyAppleMobile: true }),
    isPhoneVerified(db, actor.userId),
    studentHiddenPaths(db),
    upcomingForStudent(db, actor).catch(() => [])
  ])
  // حساب قديم بلا مستوى أو شعبة: يختارهما أولًا (لا يُرسل كتاب شعبة أخرى، قرار المالك 22 نوفمبر 2026)
  const scope = await studentScope(db, actor.studentId!)
  const scopeOptions = scope.complete ? null : await levelStreamOptions(db)
  // جاء من صفحة هبوط ولم يطلب بعد: «أكمل طلب دورتك» (17 نوفمبر 2026)
  const resume = await landingResumeFor(db, actor, (await cookies()).get(LANDING_COOKIE)?.value).catch(() => null)
  const pendingCode = await readPendingCode()
  const firstName = actor.fullName.trim().split(/\s+/)[0] ?? ''
  const dateLine = new Intl.DateTimeFormat('ar-DZ', { weekday: 'long', day: 'numeric', month: 'long', timeZone: DZ }).format(now)

  const nextLive = upcoming[0] ?? null
  const liveCourse = nextLive ? today.courses.find((c) => c.id === nextLive.courseId) : null
  const liveOpen = nextLive ? (() => { const w = joinWindow(nextLive.startsAt, nextLive.durationMinutes); return now >= w.opensAt && now <= w.closesAt })() : false
  const liveWhen = nextLive ? new Intl.DateTimeFormat('ar-DZ', { weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: DZ }).format(nextLive.startsAt) : ''

  const coursesHint = today.courses.length === 1 ? today.courses[0]!.title : today.courses.length > 1 ? `${today.courses.length} دورات مفعّلة` : 'لا دورة مفعّلة بعد'
  const tiles = STUDENT_MENU_ORDER.flatMap((key) => {
    const entry = hubEntry(key, hidden)
    return entry ? [{ key, href: entry.href, label: entry.label, icon: iconByName(STUDENT_HUBS[key].iconKey), hint: key === 'courses' ? coursesHint : STUDENT_HINTS[key] }] : []
  })

  return (
    <div className="space-y-6">
      {/* شريط الهوية الكحلي، وفيه موعد الحصة المباشرة القادمة */}
      <header className="brand-band rounded-2xl px-5 py-5 sm:px-8 sm:py-7">
        <p className="band-eyebrow text-sm font-semibold">{dateLine}</p>
        <h1 className="mt-1 font-heading text-[26px] font-bold leading-[1.4] sm:text-3xl">
          {greeting(now)}، {firstName}
        </h1>
        {nextLive ? (
          <Link
            href={liveCourse ? `${liveCourse.href}#live` : '/student/courses'}
            className={cn(
              'mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-[13px] transition-colors',
              liveOpen ? 'border-white/40 bg-destructive/90 font-bold text-white hover:bg-destructive' : 'border-white/20 bg-white/10 hover:bg-white/15'
            )}
          >
            <span className="size-2.5 shrink-0 rounded-full bg-[#F04438] shadow-[0_0_0_3px_rgba(240,68,56,.3)]" aria-hidden />
            {liveOpen ? (
              <span className="min-w-0 truncate">الحصة المباشرة مفتوحة الآن: اضغط لتنضمّ</span>
            ) : (
              <span className="min-w-0 truncate">
                الحصة المباشرة القادمة: <b className="text-[#E6CF95]">{liveWhen}</b> · {untilLabel(nextLive.startsAt.getTime() - now.getTime())}
              </span>
            )}
          </Link>
        ) : null}
      </header>

      {scopeOptions ? <ChooseScopeCard options={scopeOptions} levelId={scope.levelId} streamId={scope.streamId} /> : null}

      {/* كتب كوده قبل أن يكون له حساب: زرّ واحد يُكمل التفعيل (21 نوفمبر 2026) */}
      {pendingCode ? (
        <Link href="/student/code" className="flex items-center justify-between gap-3 rounded-xl border-2 border-success bg-success/10 p-4 transition-colors hover:bg-success/15">
          <span className="min-w-0 leading-tight">
            <span className="block font-bold">🔑 كودك محفوظ</span>
            <span className="block text-sm text-muted-foreground">اضغط لتفعيل دورتك الآن</span>
          </span>
          <span className="shrink-0 rounded-lg bg-success px-3 py-2 text-sm font-bold text-white">فعّل الآن</span>
        </Link>
      ) : null}

      {resume ? (
        <Link href={resume.href} className="flex items-center justify-between gap-3 rounded-xl border-2 border-primary bg-primary/5 p-4 transition-colors hover:bg-primary/10">
          <span className="min-w-0 leading-tight">
            <span className="block font-bold">أكمل طلب دورتك</span>
            <span className="block truncate text-sm text-muted-foreground">{resume.courseTitle}</span>
          </span>
          <span className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground">اطلب الآن</span>
        </Link>
      ) : null}

      {/* الهاتف غير مؤكَّد: شريط صغير يفتح بطاقة OTP (مفتوحة مباشرة بعد التسجيل) */}
      {!phoneV.verified ? <PhoneVerifyBanner phone={phoneV.phone} open={q.verify === '1'} /> : null}

      <section aria-labelledby="doors-title" className="space-y-3">
        <h2 id="doors-title" className="font-heading text-lg font-bold">
          ماذا تريد اليوم؟
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tiles.map((tile) => (
            <Link
              key={tile.key}
              href={tile.href}
              className="flex min-h-[124px] flex-col justify-between gap-3 rounded-[20px] border bg-card p-4 shadow-soft transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[140px] sm:p-5"
            >
              <span className={cn('flex size-[52px] items-center justify-center rounded-2xl', STUDENT_TONES[tile.key])}>{tile.icon ? <tile.icon className="size-7" /> : null}</span>
              <span className="min-w-0">
                <span className="block text-base font-bold leading-snug">{tile.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{tile.hint}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {ios ? (
        <a href={ios.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border border-primary/25 bg-primary/5 p-4 transition-colors hover:bg-primary/10">
          <Smartphone className="size-7 shrink-0 text-primary" />
          <span className="min-w-0 leading-tight">
            <span className="block font-bold">{t('public.iosApp')}</span>
            <span className="block text-xs text-muted-foreground">{t('public.iosAppD')}</span>
          </span>
        </a>
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
