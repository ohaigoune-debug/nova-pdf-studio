import { redirect } from 'next/navigation'
import { ClassStream } from '@/components/domain/class-stream'
import { GroupTabs } from '@/components/domain/group-tabs'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isClassroomAssistant } from '@/server/lib/actor'
import { assistantClassGroups, assistantStream } from '@/server/services/classroom.service'

export const dynamic = 'force-dynamic'

/**
 * «الأستاذ المساعد» (قرار المالك 13-14 نوفمبر 2026): القسم الافتراضي وحده.
 * يرى منشورات الأستاذ، ويردّ على التلاميذ، ويُخفي التعليق غير اللائق. لا ينشر ولا يثبّت.
 */
export default async function AssistantClassroomPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const actor = await requirePageActor('ASSISTANT')
  // مساعد الحضور لا قسم افتراضي له
  if (!isClassroomAssistant(actor)) redirect('/assistant')
  const db = await getDb()
  const groups = await assistantClassGroups(db, actor)
  const { group } = await searchParams
  const current = group && groups.some((g) => g.id === group) ? group : null
  const posts = await assistantStream(db, actor, current)
  return (
    <>
      <PageHeader title="القسم الافتراضي" description="أجب عن أسئلة التلاميذ تحت منشورات الأستاذ، وأخفِ ما لا يليق. تصلك إشعارات بكل سؤال جديد." />
      <div className="mx-auto max-w-3xl space-y-4">
        <GroupTabs groups={groups} current={current} basePath="/assistant/classroom" allLabel="كل المنشورات" />
        <ClassStream posts={posts} role="ASSISTANT" />
      </div>
    </>
  )
}
