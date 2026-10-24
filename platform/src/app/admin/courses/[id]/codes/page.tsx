import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CodesPanel } from '@/components/domain/codes-panel'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { getCourseAdmin } from '@/server/services/courses.service'
import { listBatches, listCodes } from '@/server/services/enrollment-codes.service'

export const dynamic = 'force-dynamic'

/**
 * أكواد تفعيل الدورة (تُطبع داخل الكتاب أو على ملصق): الكود يُستعمل مرة واحدة من حساب التلميذ
 * (/activate-code أو صفحته الرئيسية) فيُفعَّل الاشتراك مباشرة — طريق التفعيل الثاني إلى جانب تسليم الطلب.
 */
export default async function CourseCodesPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('SUPER_ADMIN')
  const { id } = await params
  const db = await getDb()
  let data
  try {
    data = await getCourseAdmin(db, actor, id)
  } catch (e) {
    if (isAppError(e)) notFound()
    throw e
  }
  const groupId = data.course.groupId
  const [codes, batches] = await Promise.all([listCodes(db, actor, groupId), listBatches(db, actor, groupId)])
  return (
    <div className="space-y-6">
      <PageHeader
        title="أكواد الكتاب"
        description={
          <>
            <Link href={`/admin/courses/${data.course.id}`} className="hover:underline">
              {data.course.title}
            </Link>
            {' — '}كل كود يفعّل الدورة مرة واحدة على حساب التلميذ الذي يُدخله. ولّد دفعة بعدد النسخ المطبوعة، وصدّرها للطباعة.
          </>
        }
      />
      <CodesPanel groupId={groupId} groupName={data.course.title} codes={codes} batches={batches} />
    </div>
  )
}
