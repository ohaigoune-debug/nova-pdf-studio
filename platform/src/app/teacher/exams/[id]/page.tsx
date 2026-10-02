import { BookTemplate, History } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ExamStudio } from '@/components/studio/studio'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/misc'
import { aiProviderInfo } from '@/server/ai/provider'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { bankFormOptions } from '@/server/queries/bank-options'
import { getExam } from '@/server/services/exams.service'
import { listGroups } from '@/server/services/groups.service'

export const dynamic = 'force-dynamic'

export default async function ExamBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('TEACHER')
  const { id } = await params
  const db = await getDb()
  let exam
  try {
    exam = await getExam(db, actor, id)
  } catch (e) {
    if (e instanceof AppError) notFound()
    throw e
  }
  const [opts, groups] = await Promise.all([bankFormOptions(db, actor), listGroups(db, actor)])
  return (
    <>
      <PageHeader
        title={exam.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {exam.isTemplate ? (
              <Badge variant="secondary">
                <BookTemplate className="size-3" /> قالب
              </Badge>
            ) : null}
            {exam.status === 'ARCHIVED' ? <Badge variant="muted">مؤرشف</Badge> : exam.status === 'READY' ? <Badge variant="success">جاهز</Badge> : <Badge variant="secondary">مسودة</Badge>}
            <span>الاستوديو: كتل وبنك على اليمين، الورقة في الوسط، الترويسة والنقاط على اليسار. كل تغيير يُحفظ فوراً ويمكن التراجع عنه.</span>
          </span>
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/teacher/exams/${exam.id}/history`}>
              <History className="size-4" /> السجلّ
            </Link>
          </Button>
        }
      />
      <ExamStudio exam={exam} options={{ subjects: opts.subjects, levels: opts.levels, streams: opts.streams, groups: groups.filter((g) => g.status === 'ACTIVE').map((g) => ({ id: g.id, name: g.name })) }} aiConfigured={aiProviderInfo().configured} />
    </>
  )
}
