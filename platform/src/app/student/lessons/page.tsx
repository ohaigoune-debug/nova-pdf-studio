import { ContentGrid } from '@/components/domain/content-cards'
import { TeacherBanner } from '@/components/domain/teacher-banner'
import { t } from '@/i18n'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listStudentContent } from '@/server/queries/student-extras.queries'
import { getAboutSettings } from '@/server/services/about.service'

export default async function StudentLessonsPage() {
  const actor = await requirePageActor('STUDENT')
  const db = await getDb()
  const [items, about] = await Promise.all([
    listStudentContent(db, actor, { types: ['LESSON', 'ARTICLE', 'EXERCISE', 'VIDEO', 'PDF', 'AUDIO', 'IMAGE'] }),
    getAboutSettings(db)
  ])
  return (
    <div className="space-y-6">
      <TeacherBanner about={about} greeting={t('nav.myLessons')} subtitle="الدروس والفيديوهات وملفات PDF العامة والموجّهة لأفواجك." image="/teacher-lessons.webp" />
      <ContentGrid items={items} basePath="/student/lessons" />
    </div>
  )
}
