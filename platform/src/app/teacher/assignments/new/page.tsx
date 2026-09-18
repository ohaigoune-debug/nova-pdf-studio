import { AssignmentForm } from '@/components/domain/assignment-form'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { t } from '@/i18n'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { teacherFormOptions } from '@/server/queries/teacher-form-options'

export default async function NewAssignmentPage() {
  const actor = await requirePageActor('TEACHER')
  const opts = await teacherFormOptions(await getDb(), actor)
  return (
    <>
      <PageHeader title={t('assignments.new')} description="يكتب الطالب إجابته نصاً كرسالة داخل المنصة، ثم تصحّحها وتتحاوران حولها." />
      <Card className="max-w-3xl">
        <CardContent className="p-6">
          <AssignmentForm groups={opts.groups} students={opts.students} skills={opts.skills} files={opts.files} rubrics={opts.rubrics} />
        </CardContent>
      </Card>
    </>
  )
}
