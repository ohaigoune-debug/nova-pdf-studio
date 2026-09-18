import Link from 'next/link'
import { t } from '@/i18n'
import { cn, formatShortDate, percent } from '@/lib/utils'
import type { AttendanceMatrix } from '@/server/queries/teacher-extras.queries'

const cellClass: Record<string, string> = {
  PRESENT: 'bg-success',
  LATE: 'bg-warning',
  EXCUSED: 'bg-muted-foreground/40',
  UNEXCUSED: 'bg-destructive',
  ABSENT: 'bg-destructive'
}
const cellLabel: Record<string, string> = {
  PRESENT: t('attendanceStatus.PRESENT'),
  LATE: t('attendanceStatus.LATE'),
  EXCUSED: t('attendanceStatus.EXCUSED'),
  UNEXCUSED: t('attendanceStatus.UNEXCUSED'),
  ABSENT: t('attendanceStatus.ABSENT')
}

export function AttendanceHeatmap({ matrix }: { matrix: AttendanceMatrix }) {
  if (matrix.sessions.length === 0 || matrix.rows.length === 0) return <p className="text-sm text-muted-foreground">{t('sessions.noSessions')}</p>
  return (
    <div className="overflow-x-auto">
      <table className="text-xs">
        <thead>
          <tr>
            <th className="sticky start-0 bg-card pe-3 text-start font-semibold">{t('common.student')}</th>
            {matrix.sessions.map((s) => (
              <th key={s.id} className="px-0.5 pb-1 font-normal text-muted-foreground" title={s.title ?? ''}>
                <Link href={`/teacher/sessions/${s.id}`} className="block w-6 rotate-0 truncate text-center text-[10px] hover:underline">
                  {formatShortDate(s.scheduledAt).replace(/\s.*$/, '')}
                </Link>
              </th>
            ))}
            <th className="ps-3 text-start font-semibold">{t('groups.attendanceRate')}</th>
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((r) => (
            <tr key={r.studentId}>
              <td className="sticky start-0 whitespace-nowrap bg-card pe-3 py-0.5">
                <Link href={`/teacher/students/${r.studentId}`} className="hover:underline">
                  {r.fullName}
                </Link>
              </td>
              {r.cells.map((c, i) => (
                <td key={i} className="px-0.5 py-0.5">
                  <span className={cn('block size-6 rounded-sm', c ? cellClass[c] : 'bg-muted')} title={c ? cellLabel[c] : '—'} />
                </td>
              ))}
              <td className={cn('ps-3 font-bold tabular', r.rate !== null && r.rate < 70 && 'text-destructive')}>{percent(r.rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {Object.entries(cellLabel)
          .filter(([k]) => k !== 'ABSENT')
          .map(([k, v]) => (
            <span key={k} className="flex items-center gap-1">
              <span className={cn('size-3 rounded-sm', cellClass[k])} /> {v}
            </span>
          ))}
      </div>
    </div>
  )
}
