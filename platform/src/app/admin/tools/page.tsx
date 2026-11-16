import Link from 'next/link'
import { iconByName } from '@/components/icon-registry'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { ADMIN_TOOLS } from '@/components/layout/nav'
import { requirePageActor } from '@/server/auth/current-user'

export const metadata = { title: 'أدوات متقدمة' }

/** كل أدوات المشرف التي خرجت من القائمة الجانبية (16 نوفمبر 2026) — لا شيء حُذف، والمسارات كما هي */
export default async function AdminToolsPage() {
  await requirePageActor('SUPER_ADMIN')
  const groups = Array.from(new Set(ADMIN_TOOLS.map((x) => x.group)))
  return (
    <>
      <PageHeader title="أدوات متقدمة" description="أدوات لا تحتاجها كل يوم. القائمة الجانبية تعرض الأساسيات فقط: الرئيسية، الدورات، التلاميذ، الطلبات، الإعدادات." />
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((g) => (
          <Card key={g}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{g}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y rounded-lg border text-sm">
                {ADMIN_TOOLS.filter((x) => x.group === g).map((x) => {
                  const Icon = iconByName(x.iconKey)
                  return (
                    <li key={x.href}>
                      <Link href={x.href} className="flex items-center gap-2.5 p-2.5 font-semibold hover:bg-muted/60">
                        {Icon ? <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
                        {x.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
