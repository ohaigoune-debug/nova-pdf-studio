import { notFound } from 'next/navigation'
import { RubricForm } from '@/components/domain/rubric-form'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { t } from '@/i18n'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { listSkills } from '@/server/services/reference.service'
import { getRubric } from '@/server/services/rubrics.service'

export default async function EditRubricPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('TEACHER')
  const { id } = await params
  const db = await getDb()
  let r
  try {
    r = await getRubric(db, actor, id)
  } catch (e) {
    if (isAppError(e)) notFound()
    throw e
  }
  const skills = await listSkills(db)
  return (
    <>
      <PageHeader title={t('rubrics.edit')} description={r.name} />
      <Card className="max-w-3xl">
        <CardContent className="p-6">
          <RubricForm rubricId={r.id} defaults={{ name: r.name, description: r.description, items: r.items.map((i) => ({ id: i.id, label: i.label, description: i.description ?? '', maxPoints: Number(i.maxPoints), skillId: i.skillId ?? '' })) }} skills={skills.map((s) => ({ id: s.id, name: s.nameAr }))} />
        </CardContent>
      </Card>
    </>
  )
}
