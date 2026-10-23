import { Plus, Radio } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, PageHeader, StatCard } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn, formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { LIVE_PROVIDER_AR, LIVE_STATUS_AR, coursesForLiveForm, listLiveAdmin } from '@/server/services/live.service'
import type { LiveProvider, LiveSessionStatus } from '@/server/db/schema/enums'

export const dynamic = 'force-dynamic'

const STATUS_VARIANT: Record<string, 'secondary' | 'success' | 'warning' | 'muted' | 'destructive'> = { SCHEDULED: 'secondary', LIVE: 'destructive', ENDED: 'success', CANCELLED: 'muted' }

/** إدارة الحصص المباشرة: قائمة (تصفية بالدورة) + إنشاء */
export default async function AdminLivePage({ searchParams }: { searchParams: Promise<{ course?: string }> }) {
  const actor = await requirePageActor('SUPER_ADMIN')
  const sp = await searchParams
  const courseId = sp.course && /^[0-9a-f-]{36}$/i.test(sp.course) ? sp.course : null
  const db = await getDb()
  const [sessions, courses] = await Promise.all([listLiveAdmin(db, actor, { courseId }), coursesForLiveForm(db, actor)])
  const now = Date.now()
  const upcoming = sessions.filter((s) => s.status === 'SCHEDULED' && s.startsAt.getTime() >= now).length
  const live = sessions.filter((s) => s.status === 'LIVE').length
  return (
    <div className="space-y-6">
      <PageHeader
        title="البث المباشر"
        description="حصص Zoom/Meet داخل الدورات المدفوعة. الرابط مشفّر ولا يُفتح للتلميذ إلا قبل الموعد بـ15 دقيقة وبعد قبول الشروط؛ كل انضمام يُسجَّل حضوراً. تذكير تلقائي قبل 30 دقيقة."
        actions={
          <Button asChild>
            <Link href="/admin/live/new">
              <Plus className="size-4" /> حصة جديدة
            </Link>
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="على الهواء الآن" value={live} icon={Radio} tone={live ? 'destructive' : 'default'} />
        <StatCard label="قادمة" value={upcoming} icon={Radio} />
        <StatCard label="الكل" value={sessions.length} />
        <StatCard label="الدورات" value={courses.length} />
      </div>
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>الحصص</CardTitle>
          <nav className="flex flex-wrap gap-1 text-xs">
            <Link href="/admin/live" className={cn('rounded-full border px-2.5 py-1', !courseId ? 'border-primary bg-primary text-primary-foreground' : '')}>
              كل الدورات
            </Link>
            {courses.map((c) => (
              <Link key={c.id} href={`/admin/live?course=${c.id}`} className={cn('rounded-full border px-2.5 py-1', courseId === c.id ? 'border-primary bg-primary text-primary-foreground' : '')}>
                {c.title}
              </Link>
            ))}
          </nav>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <EmptyState icon={Radio} title="لا حصص بعد" description="أنشئ أول حصة مباشرة لدورة." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الحصة</TableHead>
                  <TableHead>الدورة</TableHead>
                  <TableHead>الموعد</TableHead>
                  <TableHead>المنصة</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>تذكير</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link href={`/admin/live/${s.id}`} className="font-semibold text-primary hover:underline">
                        {s.title}
                      </Link>
                      {!s.hasJoinUrl ? <span className="ms-2 text-xs text-destructive">بلا رابط</span> : null}
                    </TableCell>
                    <TableCell className="text-xs">{s.courseTitle}</TableCell>
                    <TableCell className="text-xs" dir="ltr">
                      {formatDateTime(s.startsAt)} · {s.durationMinutes}د
                    </TableCell>
                    <TableCell className="text-xs">{LIVE_PROVIDER_AR[s.provider as LiveProvider] ?? s.provider}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[s.status] ?? 'muted'}>{LIVE_STATUS_AR[s.status as LiveSessionStatus] ?? s.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.reminderSentAt ? formatDateTime(s.reminderSentAt) : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
