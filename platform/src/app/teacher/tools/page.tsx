import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { TEACHER_TOOLS } from '@/components/layout/nav'
import { requirePageActor } from '@/server/auth/current-user'

export const metadata = { title: 'أدوات أخرى' }

/** كل أدوات الأستاذ التي خرجت من القائمة المبسّطة — لا شيء حُذف، والمسارات القديمة كما هي */
export default async function TeacherToolsPage() {
  await requirePageActor('TEACHER')
  const groups = Array.from(new Set(TEACHER_TOOLS.map((x) => x.group)))
  return (
    <>
      <PageHeader title="أدوات أخرى" description="الأفواج الحضورية والحضور والتقييم والمتابعة. القائمة الجانبية تعرض الأساسيات فقط." />
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((g) => (
          <Card key={g}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{g}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y rounded-lg border text-sm">
                {TEACHER_TOOLS.filter((x) => x.group === g).map((x) => (
                  <li key={x.href}>
                    <Link href={x.href} className="block p-2.5 font-semibold hover:bg-muted/60">
                      {x.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
