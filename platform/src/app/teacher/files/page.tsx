import { FolderOpen } from 'lucide-react'
import { EmptyState, PageHeader, PhaseNote } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { t } from '@/i18n'
import { formatDate } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listWorkspaceFiles } from '@/server/queries/teacher-extras.queries'

export default async function TeacherFilesPage() {
  const actor = await requirePageActor('TEACHER')
  const items = await listWorkspaceFiles(await getDb(), actor)
  return (
    <>
      <PageHeader title={t('teacherPages.filesTitle')} />
      <PhaseNote phase={4} />
      {items.length === 0 ? (
        <EmptyState icon={FolderOpen} title="لا توجد ملفات مرفوعة بعد." description="رفع الملفات إلى تخزين خاص مع روابط موقّعة قصيرة العمر — المرحلة 4." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common.name')}</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>الحجم</TableHead>
              <TableHead>{t('common.date')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-semibold">{f.originalName}</TableCell>
                <TableCell dir="ltr">{f.mimeType}</TableCell>
                <TableCell className="tabular">{Math.round(f.sizeBytes / 1024)} KB</TableCell>
                <TableCell>{formatDate(f.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
