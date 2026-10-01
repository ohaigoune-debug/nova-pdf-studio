import { FileText, Plus } from 'lucide-react'
import Link from 'next/link'
import { ExamListActions } from '@/components/domain/exam-list-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import type { ExamKind } from '@/server/db/schema/enums'
import { EXAM_KIND_AR, listExams } from '@/server/services/exams.service'

export const dynamic = 'force-dynamic'

export default async function ExamsPage() {
  const actor = await requirePageActor('TEACHER')
  const rows = await listExams(await getDb(), actor)
  return (
    <>
      <PageHeader
        title="الامتحانات"
        description="اختبارات وفروض ورقية تُبنى من بنك الأسئلة في دقائق."
        actions={
          <Button asChild>
            <Link href="/teacher/exams/new">
              <Plus className="size-4" /> امتحان جديد
            </Link>
          </Button>
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={FileText} title="لا امتحانات بعد" description="أنشئ امتحاناً، ثم اسحب الأسئلة من البنك إلى الورقة." action={<Button asChild><Link href="/teacher/exams/new">امتحان جديد</Link></Button>} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>العنوان</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>التصنيف</TableHead>
              <TableHead>العناصر</TableHead>
              <TableHead>النقاط</TableHead>
              <TableHead>آخر تعديل</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link href={`/teacher/exams/${r.id}`} className="font-semibold hover:underline">
                    {r.title}
                  </Link>{' '}
                  {r.status === 'READY' ? <Badge variant="success">جاهز</Badge> : <Badge variant="secondary">مسودة</Badge>}
                </TableCell>
                <TableCell>{EXAM_KIND_AR[r.kind as ExamKind] ?? r.kind}{r.schoolTerm ? ` · الفصل ${r.schoolTerm}` : ''}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{[r.subjectName, r.levelName, r.streamName].filter(Boolean).join(' · ') || '—'}</TableCell>
                <TableCell className="tabular">{r.items}</TableCell>
                <TableCell className="tabular">
                  {Number(r.totalPoints)} / {Number(r.targetPoints)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(r.updatedAt)}</TableCell>
                <TableCell>
                  <ExamListActions id={r.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
