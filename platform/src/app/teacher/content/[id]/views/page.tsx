import { AlertTriangle, ArrowRight, Eye } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Alert, Avatar, EmptyState, PageHeader } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { t } from '@/i18n'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { listContentViews, maxConcurrentDevices } from '@/server/services/media.service'

/** مشاهدات محتوى: من شاهد، كم دقيقة، إلى أين وصل، ومن كم جهاز — مع تنبيه مشاركة الحساب */
export default async function ContentViewsPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('TEACHER')
  const { id } = await params
  let data
  try {
    data = await listContentViews(await getDb(), actor, id)
  } catch (e) {
    if (isAppError(e)) notFound()
    throw e
  }
  const flagged = data.rows.filter((r) => r.flagged)
  return (
    <div className="space-y-6">
      <Link href="/teacher/content" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" /> {t('contentMgmt.title')}
      </Link>
      <PageHeader title={t('contentMgmt.viewsTitle', { title: data.title })} description={`${data.rows.length} ${t('common.students')}`} />
      {flagged.length > 0 ? (
        <Alert tone="warning" title={t('contentMgmt.flagged')}>
          {flagged.map((f) => f.fullName).join('، ')} — {t('contentMgmt.flaggedHint', { n: maxConcurrentDevices() })}
        </Alert>
      ) : null}
      {data.rows.length === 0 ? (
        <EmptyState icon={Eye} title={t('contentMgmt.noViews')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common.student')}</TableHead>
              <TableHead>{t('contentMgmt.watchSessions')}</TableHead>
              <TableHead>{t('contentMgmt.watchedMinutes')}</TableHead>
              <TableHead>{t('contentMgmt.reached')}</TableHead>
              <TableHead>{t('contentMgmt.devices')}</TableHead>
              <TableHead>{t('contentMgmt.lastSeen')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((r) => (
              <TableRow key={r.userId} className={r.flagged ? 'bg-warning/10' : undefined}>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <Avatar name={r.fullName} size="sm" />
                    <span>
                      <span className="block font-semibold">
                        {r.studentId ? (
                          <Link href={`/teacher/students/${r.studentId}`} className="hover:underline">
                            {r.fullName}
                          </Link>
                        ) : (
                          r.fullName
                        )}
                      </span>
                      <span className="block text-[11px] text-muted-foreground" dir="ltr">
                        {r.email}
                      </span>
                    </span>
                  </span>
                </TableCell>
                <TableCell className="tabular">{r.sessions}</TableCell>
                <TableCell className="tabular">{Math.round(r.secondsWatched / 60)}</TableCell>
                <TableCell className="tabular">
                  {r.maxPosition ? `${Math.floor(r.maxPosition / 60)}:${String(r.maxPosition % 60).padStart(2, '0')}` : '—'} {r.completed ? <Badge variant="success">{t('contentMgmt.completed')}</Badge> : null}
                </TableCell>
                <TableCell className="tabular">
                  {r.distinctIps}{' '}
                  {r.flagged ? (
                    <Badge variant="warning" className="inline-flex items-center gap-1">
                      <AlertTriangle className="size-3" /> {t('contentMgmt.flagged')}
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell className="text-xs tabular">{formatDateTime(r.lastSeenAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
