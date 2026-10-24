import { CommentModeration } from '@/components/domain/lesson-extras'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listPendingComments } from '@/server/services/lesson-extras.service'

export const dynamic = 'force-dynamic'

/** تعليقات التلاميذ تحت الحصص: لا يظهر شيء قبل موافقة الأستاذ */
export default async function TeacherCommentsPage() {
  const actor = await requirePageActor('TEACHER')
  const items = await listPendingComments(await getDb(), actor)
  return (
    <>
      <PageHeader title="التعليقات" description="تعليقات التلاميذ تحت الحصص — انشر (مع ردّ اختياري) أو ارفض. لا يظهر تعليق قبل موافقتك." />
      <Card className="max-w-3xl">
        <CardContent className="p-6">
          <CommentModeration items={items.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))} />
        </CardContent>
      </Card>
    </>
  )
}
