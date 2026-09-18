import { notFound } from 'next/navigation'
import { ContentForm } from '@/components/domain/content-form'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { t } from '@/i18n'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { teacherFormOptions } from '@/server/queries/teacher-form-options'
import { getContentForEdit } from '@/server/services/content.service'

export default async function EditContentPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('TEACHER')
  const { id } = await params
  const db = await getDb()
  let c
  try {
    c = await getContentForEdit(db, actor, id)
  } catch (e) {
    if (isAppError(e)) notFound()
    throw e
  }
  const opts = await teacherFormOptions(db, actor)
  return (
    <>
      <PageHeader title={t('contentMgmt.edit')} description={c.title} />
      <Card className="max-w-3xl">
        <CardContent className="p-6">
          <ContentForm contentId={c.id} defaults={{ ...c, published: !!c.publishedAt }} groups={opts.groups} students={opts.students} levels={opts.levels} streams={opts.streams} skills={opts.skills} files={opts.files} />
        </CardContent>
      </Card>
    </>
  )
}
