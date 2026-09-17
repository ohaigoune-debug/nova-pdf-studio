import { KeyRound, QrCode } from 'lucide-react'
import Link from 'next/link'
import { EnrollmentStatusBadge } from '@/components/domain/status-badges'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState, PageHeader, Progress } from '@/components/ui/misc'
import { dayName, t } from '@/i18n'
import { formatClock } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { studentHome } from '@/server/services/students.service'

export default async function StudentGroupsPage() {
  const actor = await requirePageActor('STUDENT')
  const home = await studentHome(await getDb(), actor)
  return (
    <>
      <PageHeader
        title={t('studentPages.myGroups')}
        actions={
          <Button asChild variant="outline">
            <Link href="/activate-code">
              <KeyRound className="size-4" /> {t('nav.activateCode')}
            </Link>
          </Button>
        }
      />
      {home.groups.length === 0 ? (
        <EmptyState icon={KeyRound} title={t('studentPages.noGroups')} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {home.groups.map((g) => (
            <Card key={g.groupId}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold">{g.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {dayName(g.dayOfWeek)} {formatClock(g.startTime)} {g.room ? `· ${g.room}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">{[g.levelName, g.streamName].filter(Boolean).join(' · ')}</p>
                  </div>
                  <EnrollmentStatusBadge status={g.status} />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>{t('groups.unexcusedCount')}</span>
                    <span className="tabular">
                      {g.unexcused}/{g.maxUnexcused}
                    </span>
                  </div>
                  <Progress value={(g.unexcused / g.maxUnexcused) * 100} tone={g.unexcused >= g.maxUnexcused - 1 ? 'destructive' : 'warning'} />
                </div>
                {g.status === 'ACTIVE' ? (
                  <Button asChild size="sm" variant={g.hasOpenSession ? 'default' : 'outline'} className="w-full">
                    <Link href={`/student/attendance/card?group=${g.groupId}`}>
                      <QrCode className="size-4" /> {g.hasOpenSession ? t('qr.sessionOpen') : t('nav.attendanceCard')}
                    </Link>
                  </Button>
                ) : (
                  <p className="text-xs text-destructive">{t('qr.suspendedHint')}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
