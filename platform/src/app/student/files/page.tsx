import { HubTabs } from '@/components/student/hub-tabs'
import { FolderOpen } from 'lucide-react'
import Link from 'next/link'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { signFileUrl } from '@/server/lib/storage'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { t, tEnum } from '@/i18n'
import { formatDate } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listStudentFiles } from '@/server/queries/student-extras.queries'
import { isRawDownloadAllowed } from '@/server/lib/download-policy'

export default async function StudentFilesPage() {
  const actor = await requirePageActor('STUDENT')
  const items = await listStudentFiles(await getDb(), actor)
  return (
    <>
      <HubTabs hub="lessons" />
      <PageHeader title={t('nav.files')} description="الملفات المرفقة بالدروس المتاحة لك. ملفات PDF والفيديو المحمية تُفتح داخل المنصة؛ وروابط التنزيل موقّعة وتنتهي بعد 10 دقائق." />
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
                  {isRawDownloadAllowed(f) ? (
                    <a href={signFileUrl(f.fileId)} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                      {t('filesMgmt.download')}
                    </a>
                  ) : (
                    <Link href={`/student/lessons/${f.slug}`} className="text-sm text-primary hover:underline">
                      فتح داخل المنصة
                    </Link>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
