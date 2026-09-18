'use client'

import { Check, Clock, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { ExcuseDialog } from '@/components/domain/excuse-dialog'
import { AttendanceStatusBadge, EnrollmentStatusBadge } from '@/components/domain/status-badges'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { formatTime } from '@/lib/utils'
import { setManualAttendanceAction } from '@/server/actions/attendance.actions'
import type { SessionAttendanceRow } from '@/server/services/attendance.service'

export function SessionAttendanceTable({ sessionId, sessionStatus, rows, basePath = '/teacher', canExcuse = true }: { sessionId: string; sessionStatus: string; rows: SessionAttendanceRow[]; basePath?: string; canExcuse?: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const editable = sessionStatus !== 'CANCELLED'
  const mark = (studentId: string, status: 'PRESENT' | 'LATE' | 'UNEXCUSED') =>
    start(async () => {
      const r = await setManualAttendanceAction({ classSessionId: sessionId, studentId, status })
      if (!r.ok) toast('error', r.error.message)
      else router.refresh()
    })
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('common.student')}</TableHead>
          <TableHead>{t('common.status')}</TableHead>
          <TableHead>{t('common.time')}</TableHead>
          <TableHead>{t('groups.unexcusedCount')}</TableHead>
          {editable ? <TableHead /> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.groupStudentId} className={r.enrollmentStatus !== 'ACTIVE' ? 'opacity-70' : undefined}>
            <TableCell>
              <Link href={`${basePath}/students/${r.studentId}`} className="flex items-center gap-2 hover:underline">
                <Avatar name={r.fullName} size="sm" />
                <span>
                  <span className="block font-semibold">{r.fullName}</span>
                  {r.enrollmentStatus !== 'ACTIVE' ? <EnrollmentStatusBadge status={r.enrollmentStatus} /> : null}
                </span>
              </Link>
            </TableCell>
            <TableCell>
              <AttendanceStatusBadge status={r.status} />
              {r.status === 'LATE' && r.minutesLate ? <span className="ms-1 text-xs text-muted-foreground">({r.minutesLate} د)</span> : null}
              {r.excuseReason ? <span className="block text-[11px] text-muted-foreground">{r.excuseReason}</span> : null}
              {r.source === 'MANUAL' ? <span className="block text-[10px] text-muted-foreground">يدوي</span> : null}
            </TableCell>
            <TableCell className="tabular">{r.recordedAt ? formatTime(r.recordedAt) : '—'}</TableCell>
            <TableCell className="tabular">{r.unexcusedCount}</TableCell>
            {editable ? (
              <TableCell className="text-end">
                <div className="flex flex-wrap justify-end gap-1">
                  {r.status !== 'PRESENT' ? (
                    <Button size="sm" variant="ghost" loading={pending} onClick={() => mark(r.studentId, 'PRESENT')} title={t('sessions.markPresent')}>
                      <Check className="size-4 text-success" />
                    </Button>
                  ) : null}
                  {r.status !== 'LATE' ? (
                    <Button size="sm" variant="ghost" loading={pending} onClick={() => mark(r.studentId, 'LATE')} title={t('sessions.markLate')}>
                      <Clock className="size-4 text-amber-600" />
                    </Button>
                  ) : null}
                  {r.status !== 'UNEXCUSED' && r.status !== 'EXCUSED' ? (
                    <Button size="sm" variant="ghost" loading={pending} onClick={() => mark(r.studentId, 'UNEXCUSED')} title={t('sessions.markAbsent')}>
                      <X className="size-4 text-destructive" />
                    </Button>
                  ) : null}
                  {canExcuse && r.recordId && (r.status === 'UNEXCUSED' || r.status === 'ABSENT') ? <ExcuseDialog recordId={r.recordId} studentName={r.fullName} /> : null}
                </div>
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
