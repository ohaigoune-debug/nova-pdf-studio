import { ContentForm } from '@/components/domain/content-form'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { t } from '@/i18n'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { teacherFormOptions } from '@/server/queries/teacher-form-options'

export default async function NewContentPage() {
  const actor = await requirePageActor('TEACHER')
  const opts = await teacherFormOptions(await getDb(), actor)
  return (
    <>
      <PageHeader title={t('contentMgmt.new')} />
      <Card className="max-w-3xl">
        <CardContent className="p-6">
          <ContentForm groups={opts.groups} students={opts.students} levels={opts.levels} streams={opts.streams} skills={opts.skills} files={opts.files} />
        </CardContent>
      </Card>
    </>
  )
}
