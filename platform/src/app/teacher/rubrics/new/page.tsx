import { RubricForm } from '@/components/domain/rubric-form'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { t } from '@/i18n'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listSkills } from '@/server/services/reference.service'

export default async function NewRubricPage() {
  const actor = await requirePageActor('TEACHER')
  const skills = await listSkills(await getDb())
  return (
    <>
      <PageHeader title={t('rubrics.new')} />
      <Card className="max-w-3xl">
        <CardContent className="p-6">
          <RubricForm skills={skills.map((s) => ({ id: s.id, name: s.nameAr }))} allowGlobal={actor.role === 'SUPER_ADMIN'} />
        </CardContent>
      </Card>
    </>
  )
}
