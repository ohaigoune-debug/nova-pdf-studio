import { Activity, AlertTriangle, CalendarCheck, Cpu, GraduationCap, HardDrive, ScrollText, UserPlus, Users, UsersRound } from 'lucide-react'
import Link from 'next/link'
import { AlgeriaMap } from '@/components/domain/algeria-map'
import { RoleTiles, type RoleTile } from '@/components/domain/role-tiles'
import { navFor } from '@/components/layout/nav'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/misc'
import { t } from '@/i18n'
import { formatDateTime, percent } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listAuditLogs, platformStats } from '@/server/services/admin.service'
import { storageStats } from '@/server/queries/admin-extras.queries'
import { studentsPerWilaya } from '@/server/queries/map.queries'
import { listConfirmationQueue } from '@/server/services/store.service'

/** أوامر المشرف الأساسية في مربعات (قرار المالك 2026-10-28): الأكثر استعمالًا أولًا */
const MAIN_TILES: Omit<RoleTile, 'badge'>[] = [
  { href: '/admin/courses', label: 'الدورات والدروس', hint: 'أنشئ دورة وأضف دروسها: PDF وفيديو وترتيب ونشر', iconKey: 'GraduationCap' },
  { href: '/admin/store/confirm', label: 'طابور التأكيد', hint: 'اتصل بالزبائن وأكّد الطلبات', iconKey: 'PhoneCall' },
  { href: '/admin/store', label: 'طلبات الدورات', hint: 'كل الطلبات وحالاتها', iconKey: 'ShoppingBag' },
  { href: '/admin/delivery', label: 'التوصيل', hint: 'الطرود وشركات التوصيل', iconKey: 'Truck' },
  { href: '/admin/students', label: 'التلاميذ', hint: 'الحسابات والاشتراكات', iconKey: 'Users' },
  { href: '/admin/employees', label: 'الموظفون ورافعو المحتوى', hint: 'حسابات التأكيد ورفع الدروس', iconKey: 'UsersRound' },
  { href: '/admin/publish', label: 'النشر في المكتبة العامة', hint: 'دروس وفروض عامة خارج الدورات', iconKey: 'Upload' },
  { href: '/admin/settings', label: 'الإعدادات', hint: 'المنصة والفيديو والدفع', iconKey: 'Settings' }
]

export default async function AdminHomePage() {
  const actor = await requirePageActor('SUPER_ADMIN')
  const db = await getDb()
  const [s, storage, logs, map, queue] = await Promise.all([platformStats(db, actor), storageStats(db, actor), listAuditLogs(db, actor, 10), studentsPerWilaya(db), listConfirmationQueue(db, actor)])
  const awaiting = queue.filter((o) => o.status === 'PENDING').length
  const dateLine = new Intl.DateTimeFormat('ar-DZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Algiers' }).format(new Date())
  const tiles: RoleTile[] = MAIN_TILES.map((tile) => (tile.href === '/admin/store/confirm' ? { ...tile, badge: awaiting } : tile))
  // بقية أوامر القائمة الجانبية (مداخل الأبواب الفرعية) روابط صغيرة تحت المربعات، من المصدر نفسه فلا تختلف عنه
  const mainHrefs = new Set(MAIN_TILES.map((x) => x.href))
  const more = Array.from(
    new Map(
      navFor('SUPER_ADMIN')
        .flatMap((section) => section.items)
        .flatMap((item) => [item, ...(item.children ?? [])])
        .filter((item) => item.href !== '/admin' && !mainHrefs.has(item.href))
        .map((item) => [item.href, { href: item.href, label: item.label, iconKey: item.iconKey }] as const)
    ).values()
  )
  const topWilayas = map.filter((w) => w.students > 0).sort((a, b) => b.students - a.students).slice(0, 8)
  return (
    <div className="space-y-6">
      {/* رأس فاخر بهوية مدرسة (طلب المالك 21 نوفمبر 2026): كحلي بزخرفة، ثلاثة أرقام اليوم، وزرّ ذهبي */}
      <header className="brand-band brand-band--strong rounded-[24px] border-b-[3px] border-[#C29B45] px-5 py-6 text-[#FFFDF7] sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="band-eyebrow text-sm font-semibold">{dateLine}</p>
            <h1 className="mt-1 font-heading text-[28px] font-bold leading-tight sm:text-4xl">{t('dashboard.adminTitle')}</h1>
            <p className="mt-1 text-sm text-[#F5EEDF]/85">{t('dashboard.welcome', { name: actor.fullName })}</p>
          </div>
          <Button asChild className="border-0 bg-gradient-to-br from-[#F3DFA6] to-[#C29B45] font-bold text-[#0F2544] shadow-[0_8px_20px_-8px_rgba(194,155,69,.9)] hover:from-[#F7E7B9] hover:to-[#D1AA55]">
            <Link href="/admin/teachers/new">
              <UserPlus className="size-4" /> {t('admin.newTeacher')}
            </Link>
          </Button>
        </div>
        <dl className="mt-5 grid grid-cols-3 gap-2 sm:max-w-xl sm:gap-3">
          {[
            { label: 'بانتظار التأكيد', value: awaiting, href: '/admin/store/confirm' },
            { label: 'التلاميذ', value: s.students, href: '/admin/students' },
            { label: 'نشِطون اليوم', value: s.activeUsersToday, href: null }
          ].map((k) => {
            const body = (
              <>
                <dd className="font-heading text-2xl font-bold tabular-nums text-white sm:text-3xl">{k.value.toLocaleString('en-US')}</dd>
                <dt className="text-[11px] font-semibold text-[#E6CF95] sm:text-xs">{k.label}</dt>
              </>
            )
            const cls = 'flex flex-col-reverse items-center gap-0.5 rounded-2xl border border-[#C29B45]/30 bg-[#0F2544]/45 px-2 py-2.5 text-center backdrop-blur-sm'
            return k.href ? (
              <Link key={k.label} href={k.href} className={cls + ' transition-colors hover:border-[#C29B45]/70 hover:bg-[#0F2544]/60'}>
                {body}
              </Link>
            ) : (
              <div key={k.label} className={cls}>
                {body}
              </div>
            )
          })}
        </dl>
      </header>
      <RoleTiles tiles={tiles} more={more} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t('dashboard.usersCount')} value={s.users} icon={Users} />
        <StatCard label={t('dashboard.studentsCount')} value={s.students} icon={GraduationCap} />
        <StatCard label={t('dashboard.teachersCount')} value={s.teachers} icon={UsersRound} />
        <StatCard label={t('dashboard.activeGroups')} value={s.activeGroups} icon={UsersRound} />
        <StatCard label={t('dashboard.sessionsToday')} value={s.sessionsToday} icon={CalendarCheck} />
        <StatCard label={t('dashboard.attendanceRate')} value={percent(s.attendanceRate)} icon={CalendarCheck} tone="success" />
        <StatCard label={t('dashboard.activeUsersToday')} value={s.activeUsersToday} icon={Activity} />
        <StatCard label={t('dashboard.aiOpsToday')} value={s.aiJobsToday} icon={Cpu} />
        <StatCard label={t('dashboard.storageUsage')} value={`${(storage.bytes / 1024 / 1024).toFixed(1)} MB`} hint={`${storage.files} ملف · ${storage.content} محتوى`} icon={HardDrive} />
        <StatCard label={t('dashboard.errors')} value={s.failedJobs} icon={AlertTriangle} tone={s.failedJobs > 0 ? 'destructive' : 'default'} />
        <StatCard label={t('dashboard.securityAlerts')} value="—" hint="غير متاح حالياً" icon={AlertTriangle} />
        <StatCard label={t('admin.logsTitle')} value={s.auditToday} hint={t('common.today')} icon={ScrollText} />
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>الطلاب عبر ولايات الجزائر</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="bg-ink rounded-lg p-4">
            <AlgeriaMap data={map} showCounts />
          </div>
          <div>
            <p className="mb-3 text-sm text-muted-foreground">
              {topWilayas.length > 0 ? `طلاب في ${map.filter((w) => w.students > 0).length} ولاية من 58` : 'لم يسجّل أي طالب ولايته بعد.'}
            </p>
            <ol className="divide-y rounded-lg border">
              {topWilayas.map((w, i) => (
                <li key={w.code} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="flex items-center gap-3">
                    <span className="w-5 text-xs text-muted-foreground tabular">{i + 1}</span>
                    <span className="font-semibold">{w.name}</span>
                  </span>
                  <span className="font-bold tabular">{w.students}</span>
                </li>
              ))}
            </ol>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{t('dashboard.recentActivity')}</CardTitle>
          <Button asChild variant="link" size="sm">
            <Link href="/admin/logs">{t('common.viewAll')}</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <b>{l.actorName ?? l.actorEmail ?? 'النظام'}</b> · <code className="text-xs">{l.action}</code> {l.workspaceName ? <span className="text-muted-foreground">— {l.workspaceName}</span> : null}
                </span>
                <span className="text-[11px] text-muted-foreground tabular">{formatDateTime(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
