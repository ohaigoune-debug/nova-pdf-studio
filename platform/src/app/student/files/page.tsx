import { FolderOpen } from 'lucide-react'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { signFileUrl } from '@/server/lib/storage'
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
      <PageHeader title={t('nav.files')} description="الملفات المرفقة بالدروس المتاحة لك. الروابط موقّعة وتنتهي بعد 10 دقائق." />
      {items.length === 0 ? (
        <EmptyState icon={FolderOpen} title="لا توجد ملفات مشتركة معك بعد." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common.name')}</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>{t('common.date')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-semibold">
                  {f.title}
                  <span className="block text-xs text-muted-foreground">{f.fileName}</span>
                </TableCell>
                <TableCell>{tEnum('contentTypes', f.type)}</TableCell>
                <TableCell>{formatDate(f.publishedAt)}</TableCell>
                <TableCell className="text-end">
                  <a href={signFileUrl(f.fileId)} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                    {t('filesMgmt.download')}
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
