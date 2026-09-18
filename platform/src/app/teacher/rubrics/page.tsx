import { ClipboardCheck, Plus } from 'lucide-react'
import Link from 'next/link'
import { RubricRowActions } from '@/components/domain/rubric-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { t } from '@/i18n'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listRubrics } from '@/server/services/rubrics.service'

export default async function RubricsPage() {
  const actor = await requirePageActor('TEACHER')
  const items = await listRubrics(await getDb(), actor)
  return (
    <>
      <PageHeader
        title={t('rubrics.title')}
        description="تُلحق بالواجبات ليكون التصحيح بنداً بنداً، ويُصحّح الذكاء الاصطناعي لاحقاً حسبها لا حسب اجتهاده."
        actions={
          <Button asChild>
            <Link href="/teacher/rubrics/new">
              <Plus className="size-4" /> {t('rubrics.new')}
            </Link>
          </Button>
        }
      />
      {items.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title={t('rubrics.noRubrics')} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((r) => (
            <Card key={r.id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold">{r.name}</h3>
                    {r.description ? <p className="text-sm text-muted-foreground">{r.description}</p> : null}
                  </div>
                  <div className="flex items-center gap-1">
                    {r.isGlobal ? <Badge variant="muted">{t('rubrics.global')}</Badge> : null}
                    <Badge>{Number(r.maxScore)} ن</Badge>
                  </div>
                </div>
                <ul className="divide-y text-sm">
                  {r.items.map((it) => (
                    <li key={it.id} className="flex justify-between py-1">
                      <span>{it.label}</span>
                      <span className="tabular text-muted-foreground">{Number(it.maxPoints)}</span>
                    </li>
                  ))}
                </ul>
                {!r.isGlobal || actor.role === 'SUPER_ADMIN' ? <RubricRowActions id={r.id} /> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
