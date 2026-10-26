import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { UserStatusBadge } from '@/components/domain/status-badges'
import { UserStatusButton } from '@/components/domain/user-status-button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listConfirmers } from '@/server/services/confirmer.service'
import { EmployeeForm } from './employee-form'

export default async function EmployeesPage() {
  const actor = await requirePageActor('SUPER_ADMIN')
  const employees = await listConfirmers(await getDb(), actor)
  return <div className="space-y-6">
    <PageHeader title="موظفو تأكيد الطلبات" description="صلاحيات محددة لطابور التأكيد وطلبات التوصيل." />
    <Card className="max-w-2xl"><CardHeader><CardTitle>حساب موظف جديد</CardTitle></CardHeader><CardContent><EmployeeForm /></CardContent></Card>
    <Card><CardHeader><CardTitle>الموظفون</CardTitle></CardHeader><CardContent>
      {employees.length === 0 ? <p className="text-sm text-muted-foreground">لا موظفين بعد.</p> : <Table><TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>البريد</TableHead><TableHead>الهاتف</TableHead><TableHead>الحالة</TableHead><TableHead /></TableRow></TableHeader><TableBody>{employees.map((employee) => <TableRow key={employee.id}><TableCell>{employee.fullName}</TableCell><TableCell dir="ltr">{employee.email}</TableCell><TableCell dir="ltr">{employee.phone}</TableCell><TableCell><UserStatusBadge status={employee.status} /></TableCell><TableCell><UserStatusButton userId={employee.id} status={employee.status} /></TableCell></TableRow>)}</TableBody></Table>}
    </CardContent></Card>
  </div>
}
