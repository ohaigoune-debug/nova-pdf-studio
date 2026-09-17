import { KeyRound } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { t } from '@/i18n'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listStudentActiveGroups } from '@/server/services/attendance.service'
import { QrCard } from './qr-card'

export default async function AttendanceCardPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const actor = await requirePageActor('STUDENT')
  const { group } = await searchParams
  const groups = await listStudentActiveGroups(await getDb(), actor)
  const ttl = Number(process.env.QR_TOKEN_TTL_SECONDS ?? 60)
  const active = groups.filter((g) => g.status === 'ACTIVE')
  const preferred = active.find((g) => g.groupId === group) ?? active.find((g) => g.hasOpenSession) ?? active[0]
  return (
    <>
      <PageHeader title={t('qr.title')} description={t('qr.subtitle', { s: ttl })} />
      {active.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title={t('qr.noActiveGroups')}
          action={
            <Button asChild>
              <Link href="/activate-code">{t('nav.activateCode')}</Link>
            </Button>
          }
        />
      ) : (
        <QrCard
          studentName={actor.fullName}
          groups={active.map((g) => ({ id: g.groupId, name: g.name, hasOpenSession: g.hasOpenSession }))}
          initialGroupId={preferred!.groupId}
          ttlSeconds={ttl}
        />
      )}
    </>
  )
}
