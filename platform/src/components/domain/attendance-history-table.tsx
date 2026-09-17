import { CalendarCheck } from 'lucide-react'
import { AttendanceStatusBadge } from '@/components/domain/status-badges'
import { EmptyState } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { t } from '@/i18n'
import { formatDateTime } from '@/lib/utils'
import type { StudentAttendanceItem } from '@/server/services/attendance.service'
import type { ReactNode } from 'react'

export function AttendanceHistoryTable({ items, renderActions }: { items: StudentAttendanceItem[]; renderActions?: (item: StudentAttendanceItem) => ReactNode }) {
  if (items.length === 0) return <EmptyState icon={CalendarCheck} title={t('common.empty')} />
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('common.date')}</TableHead>
          <TableHead>{t('common.group')}</TableHead>
          <TableHead>{t('common.session')}</TableHead>
          <TableHead>{t('common.status')}</TableHead>
          <TableHead>{t('common.reason')}</TableHead>
          {renderActions ? <TableHead /> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((a) => (
          <TableRow key={a.recordId}>
            <TableCell className="whitespace-nowrap tabular">{formatDateTime(a.scheduledAt)}</TableCell>
            <TableCell>{a.groupName}</TableCell>
            <TableCell>{a.sessionTitle ?? '—'}</TableCell>
            <TableCell>
              <AttendanceStatusBadge status={a.status} />
              {a.status === 'LATE' && a.minutesLate > 0 ? <span className="ms-1 text-xs text-muted-foreground">({a.minutesLate} د)</span> : null}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{a.excuseReason ?? '—'}</TableCell>
            {renderActions ? <TableCell className="text-end">{renderActions(a)}</TableCell> : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
