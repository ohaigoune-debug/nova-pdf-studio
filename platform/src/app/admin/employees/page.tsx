import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { UserStatusBadge } from '@/components/domain/status-badges'
import { UserStatusButton } from '@/components/domain/user-status-button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import type { OrderStatus } from '@/server/db/schema/enums'
import { confirmerStats, listConfirmerActivity, listConfirmers } from '@/server/services/confirmer.service'
import { ORDER_STATUS_AR } from '@/server/services/order-status.service'
import { EmployeeForm } from './employee-form'
import { UploaderCoursesForm, UploaderForm } from './uploader-forms'
import { listContentUploaders, listEditableCourses } from '@/server/services/course-staff.service'

export const dynamic = 'force-dynamic'

const STATUS_VARIANT: Partial<Record<OrderStatus, 'success' | 'destructive' | 'secondary'>> = { CONFIRMED: 'success', CANCELLED: 'destructive' }
const statusLabel = (s: string | null) => (s ? (ORDER_STATUS_AR[s as OrderStatus] ?? s) : '—')

export default async function EmployeesPage() {
  const actor = await requirePageActor('SUPER_ADMIN')
  const db = await getDb()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const [employees, stats, activity, uploaders, courseOpts, managers] = await Promise.all([listConfirmers(db, actor), confirmerStats(db, actor, since), listConfirmerActivity(db, actor, 100), listContentUploaders(db, actor), listEditableCourses(db, actor), listConfirmers(db, actor, 'MANAGER')])
  const courses = courseOpts.map((c) => ({ id: c.id, title: c.title }))
  return <div className="space-y-6">
    <PageHeader title="الموظفون ورافعو المحتوى" description="رافع المحتوى يرفع دروس الدورات المسندة إليه فقط؛ موظف التأكيد يعمل على الطلبات فقط." />
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>رافع محتوى جديد</CardTitle><CardDescription>لا يرى المال ولا الأسعار ولا التلاميذ ولا الإعدادات.</CardDescription></CardHeader><CardContent><UploaderForm courses={courses} /></CardContent></Card>
      <Card><CardHeader><CardTitle>رافعو المحتوى</CardTitle></CardHeader><CardContent className="space-y-4">
        {uploaders.length === 0 ? <p className="text-sm text-muted-foreground">لا أحد بعد.</p> : uploaders.map((u) => (
          <div key={u.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><span><span className="font-semibold">{u.fullName}</span> <span className="text-xs text-muted-foreground" dir="ltr">{u.email}</span></span><span className="flex items-center gap-2"><UserStatusBadge status={u.status} /><UserStatusButton userId={u.id} status={u.status} /></span></div>
            <UploaderCoursesForm userId={u.id} courses={courses} selected={u.courses.map((c) => c.id)} />
          </div>
        ))}
      </CardContent></Card>
    </div>
    <Card className="max-w-2xl"><CardHeader><CardTitle>موظف جديد</CardTitle><CardDescription>موظف تأكيد الطلبات، أو «مدير العمليات» لنقاط البيع.</CardDescription></CardHeader><CardContent><EmployeeForm /></CardContent></Card>
    <Card><CardHeader><CardTitle>مديرو العمليات</CardTitle><CardDescription>نقاط البيع، والباقات، والأكواد، والمال المستلَم منها. كل حركة في سجلّ التدقيق باسمه.</CardDescription></CardHeader><CardContent>
      {managers.length === 0 ? <p className="text-sm text-muted-foreground">لا أحد بعد.</p> : <Table><TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>البريد</TableHead><TableHead>الهاتف</TableHead><TableHead>الحالة</TableHead><TableHead /></TableRow></TableHeader><TableBody>{managers.map((m) => <TableRow key={m.id}><TableCell>{m.fullName}</TableCell><TableCell dir="ltr">{m.email}</TableCell><TableCell dir="ltr">{m.phone}</TableCell><TableCell><UserStatusBadge status={m.status} /></TableCell><TableCell><UserStatusButton userId={m.id} status={m.status} /></TableCell></TableRow>)}</TableBody></Table>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>موظفو التأكيد</CardTitle><CardDescription>الأرقام لآخر 24 ساعة.</CardDescription></CardHeader><CardContent>
      {employees.length === 0 ? <p className="text-sm text-muted-foreground">لا موظفين بعد.</p> : <Table><TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>البريد</TableHead><TableHead>الهاتف</TableHead><TableHead>أكّد</TableHead><TableHead>ألغى</TableHead><TableHead>لا يردّ/لاحقاً</TableHead><TableHead>الحالة</TableHead><TableHead /></TableRow></TableHeader><TableBody>{employees.map((employee) => {
        const s = stats.get(employee.id)
        return <TableRow key={employee.id}><TableCell>{employee.fullName}</TableCell><TableCell dir="ltr">{employee.email}</TableCell><TableCell dir="ltr">{employee.phone}</TableCell><TableCell className="tabular">{s?.confirmed ?? 0}</TableCell><TableCell className="tabular">{s?.cancelled ?? 0}</TableCell><TableCell className="tabular">{s?.followUp ?? 0}</TableCell><TableCell><UserStatusBadge status={employee.status} /></TableCell><TableCell><UserStatusButton userId={employee.id} status={employee.status} /></TableCell></TableRow>
      })}</TableBody></Table>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>سجلّ عمل الموظفين</CardTitle><CardDescription>آخر 100 تغيير قام به الموظفون على الطلبات، مع السبب عند الإلغاء.</CardDescription></CardHeader><CardContent>
      {activity.length === 0 ? <p className="text-sm text-muted-foreground">لا نشاط مسجَّل بعد.</p> : <Table><TableHeader><TableRow><TableHead>الوقت</TableHead><TableHead>الموظف</TableHead><TableHead>الطلب</TableHead><TableHead>التغيير</TableHead><TableHead>السبب</TableHead></TableRow></TableHeader><TableBody>{activity.map((a) => <TableRow key={a.id}>
        <TableCell className="text-xs">{formatDateTime(a.at)}</TableCell>
        <TableCell>{a.employee}</TableCell>
        <TableCell>{a.orderId && a.orderNumber ? <Link href={`/store/orders/${a.orderId}`} dir="ltr" className="font-mono text-xs hover:underline">{a.orderNumber}</Link> : '—'}</TableCell>
        <TableCell className="text-xs">{a.kind === 'status' ? <><span className="text-muted-foreground">{statusLabel(a.from)}</span> ← <Badge variant={STATUS_VARIANT[a.to as OrderStatus] ?? 'secondary'}>{statusLabel(a.to)}</Badge></> : <Badge variant={a.kind === 'ban' ? 'destructive' : 'secondary'}>{a.detail}</Badge>}</TableCell>
        <TableCell className="max-w-[240px] text-xs">{a.reason || '—'}</TableCell>
      </TableRow>)}</TableBody></Table>}
    </CardContent></Card>
  </div>
}
