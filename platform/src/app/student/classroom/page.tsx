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
  // ?group= قسم الدورة (منشورات فوجها وحدها)، وبلا group القسم العام لكل التلاميذ
  const { groups, posts: all } = await studentStream(await getDb(), actor, group ?? null)
  const current = group && groups.some((g) => g.id === group) ? group : null
  const posts = group && !current ? [] : all
  return (
    <>
      <PageHeader title={current ? 'قسم الدورة' : 'القسم العام'} description={current ? 'منشورات أستاذك لفوج هذه الدورة — اقرأ وعلّق واسأل.' : 'منشورات الأساتذة والإدارة لكل تلاميذ المنصة — اقرأ وعلّق.'} />
      <div className="mx-auto max-w-3xl space-y-4">
        {groups.length ? <GroupTabs groups={groups} current={current} basePath="/student/classroom" allLabel="القسم العام" /> : null}
        {posts.length ? <ClassStream posts={posts} role="STUDENT" /> : <EmptyState title="لا منشورات بعد" description={current ? 'حين ينشر أستاذك شيئًا لفوج هذه الدورة يظهر هنا.' : 'حين ينشر الأساتذة أو الإدارة في القسم العام يظهر هنا.'} />}
      </div>
    </>
  )
}
