import { GraduationCap, Plus, Radio, Users } from 'lucide-react'
import Link from 'next/link'
import { CourseStatusActions } from '@/components/courses/course-admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, PageHeader, StatCard } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import type { CourseStatus } from '@/server/db/schema/enums'
import { COURSE_PLAN_AR, COURSE_STATUS_AR, listCoursesAdmin } from '@/server/services/courses.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'الدورات المدفوعة' }

const STATUS_VARIANT: Record<string, 'secondary' | 'success' | 'muted'> = { DRAFT: 'secondary', PUBLISHED: 'success', ARCHIVED: 'muted' }

export default async function AdminCoursesPage() {
  const actor = await requirePageActor('SUPER_ADMIN')
  const rows = await listCoursesAdmin(await getDb(), actor)
  const published = rows.filter((r) => r.status === 'PUBLISHED').length
  const active = rows.reduce((n, r) => n + r.activeEnrollments, 0)
  const upcoming = rows.reduce((n, r) => n + r.upcomingSessions, 0)
  return (
    <div className="space-y-6">
      <PageHeader
        title="الدورات المدفوعة"
        description="كل دورة = فوج يملكه أستاذ المنصة؛ شراء الكتاب المرتبط يفعّل الاشتراك تلقائياً، ويمكن التفعيل يدوياً. المحتوى يُنشر من صفحة الفوج."
        actions={
          <Button asChild>
            <Link href="/admin/courses/new">
              <Plus className="size-4" /> دورة جديدة
            </Link>
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="الدورات" value={rows.length} hint={`${published} منشورة`} icon={GraduationCap} />
        <StatCard label="اشتراكات نشطة" value={active} icon={Users} tone="success" />
        <StatCard label="حصص مباشرة قادمة" value={upcoming} icon={Radio} />
        <StatCard label="مؤرشفة" value={rows.filter((r) => r.status === 'ARCHIVED').length} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>قائمة الدورات</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="لا دورات بعد"
              description="أنشئ أول دورة مدفوعة واربطها بكتاب من المتجر."
              action={
                <Button asChild>
                  <Link href="/admin/courses/new">دورة جديدة</Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الدورة</TableHead>
                  <TableHead>الأستاذ</TableHead>
                  <TableHead>الصيغة</TableHead>
                  <TableHead>السعر</TableHead>
                  <TableHead>مشتركون</TableHead>
                  <TableHead>منتجات</TableHead>
                  <TableHead>بث قادم</TableHead>
                  <TableHead>ينتهي الوصول</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/admin/courses/${c.id}`} className="font-semibold hover:underline">
                        {c.title}
                      </Link>
                      <span className="block text-xs text-muted-foreground">{[c.season, c.levelName, c.subjectName].filter(Boolean).join(' · ')}</span>
                    </TableCell>
                    <TableCell className="text-sm">{c.teacherName}</TableCell>
                    <TableCell className="text-xs">{COURSE_PLAN_AR[c.plan] ?? c.plan}</TableCell>
                    <TableCell className="tabular">{c.priceDzd} دج</TableCell>
                    <TableCell className="tabular">{c.activeEnrollments}</TableCell>
                    <TableCell className="tabular">{c.productsCount}</TableCell>
                    <TableCell className="tabular">{c.upcomingSessions}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.accessEndsOn ? formatDate(c.accessEndsOn) : '—'}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[c.status] ?? 'secondary'}>{COURSE_STATUS_AR[c.status as CourseStatus]}</Badge>
                    </TableCell>
                    <TableCell>
                      <CourseStatusActions id={c.id} status={c.status} />
                    </TableCell>
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
