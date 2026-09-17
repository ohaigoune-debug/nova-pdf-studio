import { Plus, UsersRound } from 'lucide-react'
import Link from 'next/link'
import { GroupStatusBadge } from '@/components/domain/status-badges'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { dayName, t } from '@/i18n'
import { formatClock } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listGroups } from '@/server/services/groups.service'

export default async function TeacherGroupsPage() {
  const actor = await requirePageActor('TEACHER')
  const groups = await listGroups(await getDb(), actor, { includeArchived: false })
  return (
    <>
      <PageHeader
        title={t('groups.title')}
        actions={
          <Button asChild>
            <Link href="/teacher/groups/new">
              <Plus className="size-4" /> {t('groups.new')}
            </Link>
          </Button>
        }
      />
      {groups.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title={t('groups.noGroups')}
          action={
            <Button asChild>
              <Link href="/teacher/groups/new">{t('groups.new')}</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => (
            <Link key={g.id} href={`/teacher/groups/${g.id}`} className="group">
              <Card className="h-full transition-shadow group-hover:shadow-md">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold leading-snug group-hover:text-primary">{g.name}</h3>
                    {g.hasOpenSession ? <Badge variant="success">{t('sessions.open')}</Badge> : <GroupStatusBadge status={g.status} />}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {dayName(g.dayOfWeek)} {formatClock(g.startTime)} {g.room ? `· ${g.room}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">{[g.levelName, g.streamName, g.schoolName, g.wilayaName].filter(Boolean).join(' · ')}</p>
                  <div className="flex items-center gap-4 pt-1 text-sm">
                    <span>
                      <span className="font-bold tabular">{g.activeStudents}</span> <span className="text-muted-foreground">{t('groups.active')}</span>
                    </span>
                    {g.suspendedStudents > 0 ? (
                      <span className="text-destructive">
                        <span className="font-bold tabular">{g.suspendedStudents}</span> {t('groups.suspended')}
                      </span>
                    ) : null}
                    {g.capacity ? (
                      <span className="ms-auto text-xs text-muted-foreground tabular">
                        {g.totalStudents}/{g.capacity}
                      </span>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
