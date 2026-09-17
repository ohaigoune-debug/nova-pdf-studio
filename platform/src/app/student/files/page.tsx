import { FolderOpen } from 'lucide-react'
import { EmptyState, PageHeader, PhaseNote } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { t, tEnum } from '@/i18n'
import { formatDate } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listStudentFiles } from '@/server/queries/student-extras.queries'

export default async function StudentFilesPage() {
  const actor = await requirePageActor('STUDENT')
  const items = await listStudentFiles(await getDb(), actor)
  return (
    <>
      <PageHeader title={t('nav.files')} />
      <PhaseNote phase={4} />
      {items.length === 0 ? (
        <EmptyState icon={FolderOpen} title="لا توجد ملفات مشتركة معك بعد." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common.name')}</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>{t('common.date')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-semibold">{f.title}</TableCell>
                <TableCell>{tEnum('contentTypes', f.type)}</TableCell>
                <TableCell>{formatDate(f.publishedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
