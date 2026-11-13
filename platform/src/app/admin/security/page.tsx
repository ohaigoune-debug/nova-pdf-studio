import Link from 'next/link'
import { headers } from 'next/headers'
import { Cloud, KeyRound, LogIn, ScanSearch, Shield, UserX } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader, PhaseNote, StatCard } from '@/components/ui/misc'
import { t } from '@/i18n'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { clientIp, cloudflareHop } from '@/server/lib/client-ip'
import { securityStats } from '@/server/queries/admin-extras.queries'

export default async function AdminSecurityPage() {
  const actor = await requirePageActor('SUPER_ADMIN')
  const s = await securityStats(await getDb(), actor)
  const h = await headers()
  const ip = clientIp(h)
  const cf = cloudflareHop(h)
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
      {/* فحص وساطة Cloudflare: يُقرأ بعد تحويل السحابة إلى برتقالية (docs/DEPLOYMENT.md) */}
      <div id="cloudflare" className={`mb-6 rounded-xl border p-4 text-sm ${cf.leaked ? 'border-destructive bg-destructive/5' : 'bg-card'}`}>
        <p className="flex items-center gap-2 font-bold"><Cloud className="size-5 text-primary" /> عنوانك كما تراه المنصة</p>
        <p className="mt-2 tabular" dir="ltr" data-client-ip>{ip ?? '—'}</p>
        <p className="mt-1 text-muted-foreground" data-cloudflare={cf.via ? 'on' : 'off'}>
          {cf.via ? `الطلب مرّ عبر Cloudflare${cf.pop ? ` (مركز ${cf.pop})` : ''}.` : 'الطلب وصل إلى الخادم مباشرة، دون Cloudflare.'}
        </p>
        {cf.leaked ? (
          <p className="mt-2 font-bold text-destructive" role="alert">المنصة ترى عنوان Cloudflare لا عنوانك: كل التلاميذ سيتقاسمون حدود المحاولات نفسها. أعد السحابة رمادية الآن.</p>
        ) : cf.via ? (
          <p className="mt-2 text-success">طابِقه بعنوان شبكتك (مثلًا من ifconfig.me على هاتفك): إن تطابقا فالإعداد سليم.</p>
        ) : null}
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
