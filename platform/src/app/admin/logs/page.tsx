import { PageHeader } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { t } from '@/i18n'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listAuditLogs } from '@/server/services/admin.service'

export default async function AdminLogsPage() {
  const actor = await requirePageActor('SUPER_ADMIN')
  const logs = await listAuditLogs(await getDb(), actor, 200)
  return (
    <>
      <PageHeader title={t('admin.logsTitle')} description="من عدّل العلامة؟ من برّر الغياب؟ من أعاد التفعيل؟ من أنشأ الأكواد؟" />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('common.date')}</TableHead>
            <TableHead>{t('admin.actor')}</TableHead>
            <TableHead>{t('admin.action')}</TableHead>
            <TableHead>{t('admin.entity')}</TableHead>
            <TableHead>{t('admin.oldValue')}</TableHead>
            <TableHead>{t('admin.newValue')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="whitespace-nowrap text-xs tabular">{formatDateTime(l.createdAt)}</TableCell>
              <TableCell className="text-sm">
                {l.actorName ?? l.actorEmail ?? 'النظام'}
                {l.workspaceName ? <span className="block text-[11px] text-muted-foreground">{l.workspaceName}</span> : null}
              </TableCell>
              <TableCell>
                <code className="text-xs">{l.action}</code>
              </TableCell>
              <TableCell className="text-xs">
                {l.entityType}
                <span className="block font-mono text-[10px] text-muted-foreground" dir="ltr">
                  {l.entityId?.slice(0, 8)}
                </span>
              </TableCell>
              <TableCell className="max-w-48 truncate font-mono text-[10px]" dir="ltr">
                {l.oldValue ? JSON.stringify(l.oldValue) : '—'}
              </TableCell>
              <TableCell className="max-w-48 truncate font-mono text-[10px]" dir="ltr">
                {l.newValue ? JSON.stringify(l.newValue) : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}
