import { BookOpen, Eye, Plus } from 'lucide-react'
import Link from 'next/link'
import { ContentRowActions } from '@/components/domain/content-row-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { t, tEnum } from '@/i18n'
import { formatDate } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listWorkspaceContent } from '@/server/queries/teacher-extras.queries'
import { viewCountsForWorkspace } from '@/server/services/media.service'

const visibilityLabel: Record<string, string> = {
  PUBLIC: t('contentMgmt.visibilityPUBLIC'),
  STUDENTS_ONLY: t('contentMgmt.visibilitySTUDENTS_ONLY'),
  GROUP_ONLY: t('contentMgmt.visibilityGROUP_ONLY'),
  SPECIFIC_STUDENTS: t('contentMgmt.visibilitySPECIFIC_STUDENTS'),
  TEACHERS_ONLY: t('contentMgmt.visibilityTEACHERS_ONLY')
}

export default async function TeacherContentPage() {
  const actor = await requirePageActor('TEACHER')
  const db = await getDb()
  const [items, views] = await Promise.all([listWorkspaceContent(db, actor), viewCountsForWorkspace(db, actor)])
  return (
    <>
      <PageHeader
        title={t('contentMgmt.title')}
        actions={
          <Button asChild>
            <Link href="/teacher/content/new">
              <Plus className="size-4" /> {t('contentMgmt.new')}
            </Link>
          </Button>
        }
      />
      {items.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={t('contentMgmt.noContent')}
          action={
            <Button asChild>
              <Link href="/teacher/content/new">{t('contentMgmt.new')}</Link>
            </Button>
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('contentMgmt.titleField')}</TableHead>
              <TableHead>{t('contentMgmt.type')}</TableHead>
              <TableHead>{t('contentMgmt.visibility')}</TableHead>
              <TableHead>{t('common.status')}</TableHead>
              <TableHead>{t('contentMgmt.views')}</TableHead>
              <TableHead>{t('common.date')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link href={`/teacher/content/${c.id}/edit`} className="font-semibold hover:underline">
                    {c.title}
                  </Link>
                  {c.topic ? <span className="block text-xs text-muted-foreground">{c.topic}</span> : null}
                </TableCell>
                <TableCell>{tEnum('contentTypes', c.type)}</TableCell>
                <TableCell>
                  <Badge variant="muted">{visibilityLabel[c.visibility] ?? c.visibility}</Badge>
                </TableCell>
                <TableCell>{c.publishedAt ? <Badge variant="success">{t('contentMgmt.published')}</Badge> : <Badge variant="warning">{t('contentMgmt.unpublished')}</Badge>}</TableCell>
                <TableCell>
                  <Link href={`/teacher/content/${c.id}/views`} className="inline-flex items-center gap-1 text-sm tabular hover:underline">
                    <Eye className="size-4 text-muted-foreground" /> {views[c.id] ?? 0}
                  </Link>
                </TableCell>
                <TableCell className="text-xs">{formatDate(c.publishedAt ?? c.createdAt)}</TableCell>
                <TableCell className="text-end">
                  <ContentRowActions id={c.id} published={!!c.publishedAt} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
