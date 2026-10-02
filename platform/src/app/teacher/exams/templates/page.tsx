import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { TemplatesGallery } from '@/components/studio/templates-gallery'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { subjects, teachers } from '@/server/db/schema'
import { listStudioTemplates } from '@/server/services/exam-studio.service'
import { listExams } from '@/server/services/exams.service'

export const dynamic = 'force-dynamic'

/** معرض القوالب: Madrasadz الرسمية + قوالبي + المفضّلة */
export default async function TemplatesPage() {
  const actor = await requirePageActor('TEACHER')
  const db = await getDb()
  // مادة الأستاذ نصّ حرّ في ملفه؛ نطابقه باسم المادة في المرجع لإبراز القوالب المناسبة
  const [t] = await db.select({ subject: teachers.subject }).from(teachers).where(eq(teachers.userId, actor.userId)).limit(1)
  const all = await db.select({ code: subjects.code, name: subjects.nameAr }).from(subjects)
  const subjectCode = t?.subject ? (all.find((s) => s.name === t.subject) ?? all.find((s) => t.subject.includes(s.name) || s.name.includes(t.subject)))?.code ?? null : null
  const [mine, favorites] = await Promise.all([listExams(db, actor, { scope: 'templates' }), listExams(db, actor, { scope: 'favorites' })])
  const official = listStudioTemplates(subjectCode).sort((a, b) => Number(b.matches) - Number(a.matches))
  return (
    <>
      <PageHeader
        title="القوالب"
        description="ابدأ من هيكلة رسمية جاهزة أو من قوالبك: الترويسة والتخطيط والتمارين بنقاطها، ثم عدّل في الاستوديو."
        actions={
          <Button asChild variant="outline">
            <Link href="/teacher/exams">
              <ArrowRight className="size-4" /> ورشة الامتحانات
            </Link>
          </Button>
        }
      />
      <TemplatesGallery official={official} mine={mine} favorites={favorites} />
    </>
  )
}
