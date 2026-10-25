import { OtpVerifyCard } from '@/components/domain/otp-verify-card'
import { phoneChannels } from '@/server/services/phone-gate.service'
import { GuardianContactCard } from '@/components/domain/guardian-contact-card'
import Link from 'next/link'
import { BookMarked, ShoppingBag, Bell, LifeBuoy } from 'lucide-react'
import { ChangePasswordCard } from '@/components/domain/change-password-card'
import { DeleteAccountCard } from '@/components/domain/delete-account-card'
import { DevicesList } from '@/components/domain/devices-list'
import { EnrollmentStatusBadge } from '@/components/domain/status-badges'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, PageHeader } from '@/components/ui/misc'
import { t, tEnum } from '@/i18n'
import { formatDate } from '@/lib/utils'
import { listUserSessions } from '@/server/auth/session'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { getStudentProfile } from '@/server/services/students.service'

export default async function StudentProfilePage() {
  const actor = await requirePageActor('STUDENT')
  const db = await getDb()
  const [p, devices, channels] = await Promise.all([getStudentProfile(db, actor, actor.studentId!), listUserSessions(db, actor.userId), phoneChannels(db)])
  const rows: [string, string][] = [
    [t('common.email'), p.email],
    [t('common.phone'), p.phone ?? '—'],
    ['هاتف الأب أو ولي الأمر', p.guardianPhone ?? '—'],
    [t('common.wilaya'), p.wilayaName ?? '—'],
    [t('common.school'), p.schoolName ?? '—'],
    [t('common.level'), p.levelName ?? '—'],
    [t('common.stream'), p.streamName ?? '—'],
    [t('studentPages.studentType'), tEnum('studentTypes', p.studentType)],
    [t('studentPages.registeredAt'), formatDate(p.registeredAt)]
  ]
  return (
    <>
      <PageHeader title={t('studentPages.profile')} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { href: '/student/courses', label: 'دوراتي', icon: BookMarked },
          { href: '/student/courses/orders', label: 'طلباتي', icon: ShoppingBag },
          { href: '/student/notifications', label: 'الإشعارات', icon: Bell },
          { href: '/student/support', label: 'الدعم والمساعدة', icon: LifeBuoy }
        ].map((item) => <Link key={item.href} href={item.href} className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-lg border bg-card p-4 font-semibold shadow-soft hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><item.icon className="size-6 text-primary" />{item.label}</Link>)}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <div className="mb-6 flex items-center gap-4">
              <Avatar name={p.fullName} size="lg" />
              <div>
                <p className="text-xl font-extrabold">{p.fullName}</p>
                <p className="text-sm text-muted-foreground">{tEnum('roles', actor.role)}</p>
              </div>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              {rows.map(([k, v]) => (
                <div key={k} className="rounded-md bg-muted/50 p-3">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('teacherPages.enrollments')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {p.enrollments.map((e) => (
              <div key={e.groupStudentId} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-semibold">{e.groupName}</span>
                <EnrollmentStatusBadge status={e.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      {channels.sms ? <section className="mt-6"><OtpVerifyCard purpose="REGISTER" phone={p.phone} refreshOnVerified title="تعديل هاتفي والتحقق منه" description="يُحفظ رقمك الجديد بعد التحقق برمز SMS. يبقى رقمك الحالي حتى نجاح التحقق." /></section> : null}
      <section className="mt-6">
        <GuardianContactCard phone={p.guardianPhone} />
      </section>
      <section className="mt-6">
        <ChangePasswordCard />
      </section>
      <section className="mt-6">
        <h2 className="mb-3 text-lg font-extrabold">{t('teacherPages.devicesTitle')}</h2>
        <DevicesList devices={devices} />
      </section>
      <section className="mt-10">
        <DeleteAccountCard />
      </section>
    </>
  )
}
