import { notFound } from 'next/navigation'
import { AssignmentForm } from '@/components/domain/assignment-form'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { t } from '@/i18n'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { teacherFormOptions } from '@/server/queries/teacher-form-options'
import { getAssignmentForTeacher } from '@/server/services/assignments.service'

export default async function EditAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('TEACHER')
  const { id } = await params
  const db = await getDb()
  let d
  try {
    d = await getAssignmentForTeacher(db, actor, id)
  } catch (e) {
    if (isAppError(e)) notFound()
    throw e
  }
  const opts = await teacherFormOptions(db, actor)
  return (
    <>
      <PageHeader title={t('assignments.edit')} description={d.assignment.title} />
      <Card className="max-w-3xl">
        <CardContent className="p-6">
          <AssignmentForm
            assignmentId={d.assignment.id}
            defaults={{ ...d.assignment, groupIds: d.targets.groups.map((g) => g.id), studentIds: d.targets.students.map((s) => s.id) }}
            groups={opts.groups}
            students={opts.students}
            skills={opts.skills}
            files={opts.files}
          />
        </CardContent>
      </Card>
    </>
  )
}
