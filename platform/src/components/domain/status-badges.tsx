import { Badge, type BadgeProps } from '@/components/ui/badge'
import { tEnum } from '@/i18n'

type Variant = NonNullable<BadgeProps['variant']>

const enrollment: Record<string, Variant> = {
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  SUSPENDED_DUE_TO_ABSENCE: 'destructive',
  INACTIVE: 'muted',
  COMPLETED: 'secondary',
  LEFT_GROUP: 'muted'
}
const attendance: Record<string, Variant> = {
  PRESENT: 'success',
  LATE: 'warning',
  ABSENT: 'destructive',
  EXCUSED: 'secondary',
  UNEXCUSED: 'destructive'
}
const session: Record<string, Variant> = { PLANNED: 'secondary', OPEN: 'success', CLOSED: 'muted', CANCELLED: 'destructive' }
const group: Record<string, Variant> = { ACTIVE: 'success', PAUSED: 'warning', COMPLETED: 'secondary', ARCHIVED: 'muted' }
const code: Record<string, Variant> = { ACTIVE: 'success', USED: 'secondary', DISABLED: 'muted', EXPIRED: 'warning' }
const user: Record<string, Variant> = { ACTIVE: 'success', DISABLED: 'destructive' }

export function EnrollmentStatusBadge({ status }: { status: string }) {
  return <Badge variant={enrollment[status] ?? 'outline'}>{tEnum('enrollmentStatus', status)}</Badge>
}
export function AttendanceStatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge variant="outline">لم يُسجَّل</Badge>
  return <Badge variant={attendance[status] ?? 'outline'}>{tEnum('attendanceStatus', status)}</Badge>
}
export function SessionStatusBadge({ status }: { status: string }) {
  return <Badge variant={session[status] ?? 'outline'}>{tEnum('sessionStatus', status)}</Badge>
}
export function GroupStatusBadge({ status }: { status: string }) {
  return <Badge variant={group[status] ?? 'outline'}>{tEnum('groupStatus', status)}</Badge>
}
export function CodeStatusBadge({ status }: { status: string }) {
  return <Badge variant={code[status] ?? 'outline'}>{tEnum('codeStatus', status)}</Badge>
}
export function UserStatusBadge({ status }: { status: string }) {
  return <Badge variant={user[status] ?? 'outline'}>{status === 'ACTIVE' ? 'نشط' : 'معطّل'}</Badge>
}
export function RoleBadge({ role }: { role: string }) {
  return <Badge variant="default">{tEnum('roles', role)}</Badge>
}
