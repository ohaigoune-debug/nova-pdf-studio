import { BookOpen } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { EmptyState, PageHeader, PhaseNote } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { t, tEnum } from '@/i18n'
import { formatDate } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listWorkspaceContent } from '@/server/queries/teacher-extras.queries'

export default async function TeacherContentPage() {
  const actor = await requirePageActor('TEACHER')
  const items = await listWorkspaceContent(await getDb(), actor)
  return (
    <>
      <PageHeader title={t('teacherPages.contentTitle')} />
      <PhaseNote phase={4} />
      {items.length === 0 ? (
        <EmptyState icon={BookOpen} title="لم تنشئ محتوى خاصاً بعد." description="إدارة الدروس والمقالات والملفات والفيديو مع الرؤية (عام/طلاب/فوج/طلاب محددون) — المرحلة 4." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>العنوان</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>الرؤية</TableHead>
              <TableHead>{t('common.date')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-semibold">{c.title}</TableCell>
                <TableCell>{tEnum('contentTypes', c.type)}</TableCell>
                <TableCell>
                  <Badge variant="muted">{c.visibility}</Badge>
                </TableCell>
                <TableCell>{formatDate(c.publishedAt ?? c.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
