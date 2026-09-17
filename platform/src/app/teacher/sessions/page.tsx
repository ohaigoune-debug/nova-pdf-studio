import { CalendarCheck } from 'lucide-react'
import Link from 'next/link'
import { StartSessionDialog } from '@/components/domain/start-session-dialog'
import { SessionStatusBadge } from '@/components/domain/status-badges'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/input'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { t } from '@/i18n'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listSessions } from '@/server/services/class-sessions.service'
import { listGroups } from '@/server/services/groups.service'

export default async function TeacherSessionsPage({ searchParams }: { searchParams: Promise<{ groupId?: string; status?: string }> }) {
  const actor = await requirePageActor('TEACHER')
  const sp = await searchParams
  const db = await getDb()
  const [sessions, groups] = await Promise.all([listSessions(db, actor, { groupId: sp.groupId, status: sp.status ? [sp.status] : undefined, limit: 100 }), listGroups(db, actor)])
  return (
    <>
      <PageHeader title={t('sessions.title')} actions={<StartSessionDialog groups={groups.filter((g) => g.status === 'ACTIVE').map((g) => ({ id: g.id, name: g.name, hasOpenSession: g.hasOpenSession }))} />} />
      <form className="mb-4 flex flex-wrap gap-2">
        <Select name="groupId" defaultValue={sp.groupId ?? ''} className="w-auto min-w-48">
          <option value="">{t('common.all')} — {t('common.groups')}</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
        <Select name="status" defaultValue={sp.status ?? ''} className="w-auto min-w-40">
          <option value="">{t('common.all')} — {t('common.status')}</option>
          <option value="OPEN">{t('sessionStatus.OPEN')}</option>
          <option value="CLOSED">{t('sessionStatus.CLOSED')}</option>
          <option value="CANCELLED">{t('sessionStatus.CANCELLED')}</option>
        </Select>
        <Button type="submit" variant="secondary">
          {t('common.filter')}
        </Button>
      </form>
      {sessions.length === 0 ? (
        <EmptyState icon={CalendarCheck} title={t('sessions.noSessions')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common.date')}</TableHead>
              <TableHead>{t('common.group')}</TableHead>
              <TableHead>{t('sessions.titleField')}</TableHead>
              <TableHead>{t('common.status')}</TableHead>
              <TableHead>{t('sessions.present')}</TableHead>
              <TableHead>{t('sessions.late')}</TableHead>
              <TableHead>{t('sessions.absent')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="tabular">{formatDateTime(s.scheduledAt)}</TableCell>
                <TableCell>{s.groupName}</TableCell>
                <TableCell>{s.title ?? '—'}</TableCell>
                <TableCell>
                  <SessionStatusBadge status={s.status} />
                </TableCell>
                <TableCell className="tabular text-success">{s.present}</TableCell>
                <TableCell className="tabular text-amber-600">{s.late}</TableCell>
                <TableCell className="tabular text-destructive">{s.absent}</TableCell>
                <TableCell className="text-end">
                  <div className="flex justify-end gap-1">
                    {s.status === 'OPEN' ? (
                      <Button asChild size="sm">
                        <Link href={`/teacher/scanner?session=${s.id}`}>{t('nav.scanner')}</Link>
                      </Button>
                    ) : null}
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/teacher/sessions/${s.id}`}>{t('common.details')}</Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
