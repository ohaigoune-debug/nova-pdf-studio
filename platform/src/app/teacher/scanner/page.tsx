import { ScanLine } from 'lucide-react'
import { StartSessionDialog } from '@/components/domain/start-session-dialog'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { t } from '@/i18n'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listSessionAttendance } from '@/server/services/attendance.service'
import { listSessions } from '@/server/services/class-sessions.service'
import { listGroups } from '@/server/services/groups.service'
import { ScannerConsole } from './scanner-console'

export default async function ScannerPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const actor = await requirePageActor('TEACHER')
  const { session } = await searchParams
  const db = await getDb()
  const [openSessions, groups] = await Promise.all([listSessions(db, actor, { status: ['OPEN'], limit: 20 }), listGroups(db, actor)])
  const selected = openSessions.find((s) => s.id === session) ?? openSessions[0]
  const rows = selected ? await listSessionAttendance(db, actor, selected.id) : []
  const groupOptions = groups.filter((g) => g.status === 'ACTIVE').map((g) => ({ id: g.id, name: g.name, hasOpenSession: g.hasOpenSession }))

  return (
    <>
      <PageHeader title={t('scanner.title')} description={t('scanner.subtitle')} actions={<StartSessionDialog groups={groupOptions} variant="outline" />} />
      {!selected ? (
        <EmptyState icon={ScanLine} title={t('scanner.noOpenSessions')} action={<StartSessionDialog groups={groupOptions} />} />
      ) : (
        <ScannerConsole
          sessions={openSessions.map((s) => ({ id: s.id, label: `${s.groupName}${s.title ? ` — ${s.title}` : ''}`, groupName: s.groupName, startedAt: s.startedAt ?? s.scheduledAt }))}
          sessionId={selected.id}
          initial={{
            present: rows.filter((r) => r.status === 'PRESENT').length,
            late: rows.filter((r) => r.status === 'LATE').length,
            active: rows.filter((r) => r.enrollmentStatus === 'ACTIVE').length,
            recorded: rows.filter((r) => !!r.status).length
          }}
        />
      )}
    </>
  )
}
