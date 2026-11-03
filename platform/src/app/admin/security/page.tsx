import Link from 'next/link'
import { KeyRound, LogIn, ScanSearch, Shield, UserX } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader, PhaseNote, StatCard } from '@/components/ui/misc'
import { t } from '@/i18n'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { securityStats } from '@/server/queries/admin-extras.queries'

export default async function AdminSecurityPage() {
  const actor = await requirePageActor('SUPER_ADMIN')
  const s = await securityStats(await getDb(), actor)
  return (
    <>
      <PageHeader title={t('admin.securityTitle')} />
      <PhaseNote phase={8} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="جلسات نشطة" value={s.activeSessions} icon={KeyRound} />
        <StatCard label="عمليات دخول (24 س)" value={s.logins24h} icon={LogIn} />
        <StatCard label="حسابات معطّلة" value={s.disabledUsers} icon={UserX} />
        <StatCard label="مشرفون نشطون" value={s.admins} icon={Shield} />
      </div>
      <Link href="/admin/security/leaks" className="mb-6 flex items-center gap-3 rounded-xl border bg-card p-4 font-bold hover:border-primary/50">
        <ScanSearch className="size-5 text-primary" /> كشف التسريب: من رمز العلامة المائية إلى الحساب
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>إجراءات حساسة أخيرة</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">
            {s.sensitive.map((x) => (
              <li key={x.id} className="flex justify-between py-2">
                <code className="text-xs">{x.action}</code>
                <span className="text-[11px] text-muted-foreground tabular">{formatDateTime(x.createdAt)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  )
}
