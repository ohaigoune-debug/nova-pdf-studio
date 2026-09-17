import { KeyRound } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { t } from '@/i18n'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { getGroupDashboard, listGroups } from '@/server/services/groups.service'

export default async function TeacherCodesPage() {
  const actor = await requirePageActor('TEACHER')
  const db = await getDb()
  const groups = await listGroups(db, actor)
  const withCodes = await Promise.all(groups.map(async (g) => ({ ...g, dash: await getGroupDashboard(db, actor, g.id) })))
  return (
    <>
      <PageHeader title={t('codes.title')} description={t('codes.selectGroup')} />
      {groups.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title={t('groups.noGroups')}
          action={
            <Button asChild>
              <Link href="/teacher/groups/new">{t('groups.new')}</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {withCodes.map((g) => (
            <Card key={g.id}>
              <CardContent className="space-y-3 p-5">
                <h3 className="font-bold">{g.name}</h3>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-md bg-success/10 p-2">
                    <p className="text-lg font-extrabold tabular">{g.dash.activeCodes}</p>
                    <p className="text-muted-foreground">{t('codes.unused')}</p>
                  </div>
                  <div className="rounded-md bg-muted p-2">
                    <p className="text-lg font-extrabold tabular">{g.dash.usedCodes}</p>
                    <p className="text-muted-foreground">{t('codes.used')}</p>
                  </div>
                  <div className="rounded-md bg-primary/10 p-2">
                    <p className="text-lg font-extrabold tabular">{g.activeStudents}</p>
                    <p className="text-muted-foreground">{t('groups.active')}</p>
                  </div>
                </div>
                <Button asChild className="w-full">
                  <Link href={`/teacher/groups/${g.id}/codes`}>
                    <KeyRound className="size-4" /> {t('codes.generate')}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
