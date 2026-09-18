import { ContentGrid } from '@/components/domain/content-cards'
import { PageHeader } from '@/components/ui/misc'
import { t } from '@/i18n'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listStudentContent } from '@/server/queries/student-extras.queries'

export default async function StudentLessonsPage() {
  const actor = await requirePageActor('STUDENT')
  const items = await listStudentContent(await getDb(), actor, { types: ['LESSON', 'ARTICLE', 'EXERCISE', 'VIDEO', 'PDF', 'AUDIO', 'IMAGE'] })
  return (
    <>
      <PageHeader title={t('nav.myLessons')} description="الدروس والفيديوهات وملفات PDF العامة والموجّهة لأفواجك." />
      <ContentGrid items={items} basePath="/student/lessons" />
    </>
  )
}
