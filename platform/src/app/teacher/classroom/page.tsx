import { ClassComposer } from '@/components/domain/class-composer'
import { ClassStream } from '@/components/domain/class-stream'
import { GroupTabs } from '@/components/domain/group-tabs'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { teacherFormOptions } from '@/server/queries/teacher-form-options'
import { teacherStream } from '@/server/services/classroom.service'

export const dynamic = 'force-dynamic'

export default async function TeacherClassroomPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const actor = await requirePageActor('TEACHER')
  const db = await getDb()
  const opts = await teacherFormOptions(db, actor)
  const { group } = await searchParams
  const current = group && opts.groups.some((g) => g.id === group) ? group : null
  const posts = await teacherStream(db, actor, current)
  return (
    <>
      <PageHeader title="القسم الافتراضي" description="ساحة لكل فوج: تنشر فيها، ويعلّق تلاميذك ويتناقشون. منشور «كل الأفواج» يظهر في كل ساحة." />
      <div className="mx-auto max-w-3xl space-y-4">
        <GroupTabs groups={opts.groups} current={current} basePath="/teacher/classroom" />
        <ClassComposer groups={opts.groups} files={opts.files} defaultGroup={current} />
        <ClassStream posts={posts} role="TEACHER" />
      </div>
    </>
  )
}
