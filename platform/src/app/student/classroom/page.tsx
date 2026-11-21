import { MessagesSquare } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ClassStream } from '@/components/domain/class-stream'
import { GroupTabs } from '@/components/domain/group-tabs'
import { Button } from '@/components/ui/button'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { studentCourseForums, studentStream } from '@/server/services/classroom.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'المنتدى' }

/**
 * منتدى الدورة (قرار المالك 21 نوفمبر 2026): لكل دورة منتداها، يُفتح من بابها في صفحة الدورة.
 * «القسم العام» لكل تلاميذ المنصة لم يعد يظهر للتلميذ: بلا ?group= يُفتح منتدى أول دورة له.
 */
export default async function StudentClassroomPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const actor = await requirePageActor('STUDENT')
  const { group } = await searchParams
  const db = await getDb()
  const forums = await studentCourseForums(db, actor)
  if (!group) {
    if (forums[0]) redirect(`/student/classroom?group=${forums[0].id}`)
    return (
      <>
        <PageHeader title="المنتدى" description="لكل دورة منتداها: أسئلتك ومناقشاتك مع أستاذك وزملائك في الدورة." />
        <EmptyState
          icon={MessagesSquare}
          title="لا منتدى بعد"
          description="يُفتح منتدى الدورة حين تفعّل دورة."
          action={
            <Button asChild>
              <Link href="/student/courses">دوراتي</Link>
            </Button>
          }
        />
      </>
    )
  }
  const { groups, posts } = await studentStream(db, actor, group)
  const current = groups.some((g) => g.id === group) ? group : null
  return (
    <>
      <PageHeader title="منتدى الدورة" description="منشورات أستاذك لهذه الدورة: اقرأ وعلّق واسأل." />
      <div className="mx-auto max-w-3xl space-y-4">
        {forums.length > 1 ? <GroupTabs groups={forums} current={current} basePath="/student/classroom" showAll={false} /> : null}
        {current && posts.length ? <ClassStream posts={posts} role="STUDENT" /> : <EmptyState title="لا منشورات بعد" description="حين ينشر أستاذك شيئًا في منتدى هذه الدورة يظهر هنا." />}
      </div>
    </>
  )
}
