import { ClassStream } from '@/components/domain/class-stream'
import { GroupTabs } from '@/components/domain/group-tabs'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { studentStream } from '@/server/services/classroom.service'

export const dynamic = 'force-dynamic'

export default async function StudentClassroomPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const actor = await requirePageActor('STUDENT')
  const { group } = await searchParams
  const { groups, posts } = await studentStream(await getDb(), actor, group ?? null)
  const current = group && groups.some((g) => g.id === group) ? group : null
  return (
    <>
      <PageHeader title="القسم الافتراضي" description="منشورات أستاذك لفوجك — اقرأ وعلّق واسأل." />
      <div className="mx-auto max-w-3xl space-y-4">
        {groups.length === 0 ? (
          <EmptyState title="لست في أي فوج بعد" description="أدخل كود أستاذك لتنضمّ إلى فوجك فتظهر ساحته هنا." />
        ) : (
          <>
            {groups.length > 1 ? <GroupTabs groups={groups} current={current} basePath="/student/classroom" /> : null}
            <ClassStream posts={posts} role="STUDENT" />
          </>
        )}
      </div>
    </>
  )
}
