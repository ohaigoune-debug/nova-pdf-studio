import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { QuestionForm } from '@/components/play-admin/question-form'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listLessonsAdmin } from '@/server/services/play-admin.service'

export const dynamic = 'force-dynamic'

/** Admin → PLAY → سؤال جديد (يدوي؛ المفتاح يُولَّد تلقائياً 9NNN) */
export default async function PlayNewQuestionPage() {
  const actor = await requirePageActor('SUPER_ADMIN')
  const lessons = await listLessonsAdmin(await getDb(), actor)
  return (
    <>
      <PageHeader
        title="سؤال جديد في PLAY"
        description="يُحفظ السؤال بصيغة ملف المحتوى نفسها ويُدقَّق على الخادم (الاختيارات، الفراغات، بنك الكلمات)."
        actions={
          <Link href="/admin/play/questions" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <ArrowRight className="size-4" /> إلى البنك
          </Link>
        }
      />
      {lessons.length === 0 ? (
        <Alert tone="warning" title="لا دروس في منهاج PLAY بعد">
          شغّل استيراد المنهاج (play catalog) أولاً حتى تتوفر قوائم السنة/المادة/الوحدة/الدرس.
        </Alert>
      ) : (
        <Card>
          <CardContent className="p-5 sm:p-6">
            <QuestionForm lessons={lessons} />
          </CardContent>
        </Card>
      )}
    </>
  )
}
