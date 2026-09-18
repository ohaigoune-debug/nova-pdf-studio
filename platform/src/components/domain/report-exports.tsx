'use client'

import { Download, FileSpreadsheet, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useState } from 'react'
import { FormError, SubmitButton } from '@/components/forms/form-bits'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { formatDateTime } from '@/lib/utils'
import { requestReportAction } from '@/server/actions/reports.actions'
import type { ReportListItem } from '@/server/services/reports.service'

const KINDS: { value: string; label: string; needsGroup: boolean }[] = [
  { value: 'GROUP_ATTENDANCE', label: 'حضور الفوج (حصة × طالب)', needsGroup: true },
  { value: 'GROUP_GRADES', label: 'علامات الفوج (واجبات واختبارات)', needsGroup: true },
  { value: 'GROUP_SKILLS', label: 'خريطة مهارات الفوج', needsGroup: true },
  { value: 'STUDENTS', label: 'قائمة الطلاب وبياناتهم', needsGroup: false }
]

export function ReportExports({ groups, reports }: { groups: { id: string; name: string }[]; reports: ReportListItem[] }) {
  const router = useRouter()
  const [state, action] = useActionState(requestReportAction, null)
  const [kind, setKind] = useState('GROUP_ATTENDANCE')
  const needsGroup = KINDS.find((k) => k.value === kind)?.needsGroup ?? true
  const working = reports.some((r) => r.status === 'QUEUED' || r.status === 'PROCESSING')
  useEffect(() => {
    if (state?.ok) {
      toast('info', t('reports.queued'))
      router.refresh()
    }
  }, [state, router])
  useEffect(() => {
    if (!working) return
    const id = setInterval(() => router.refresh(), 3000)
    return () => clearInterval(id)
  }, [working, router])
  const statusBadge: Record<string, { label: string; variant: 'success' | 'secondary' | 'destructive' | 'muted' }> = {
    QUEUED: { label: t('reports.pending'), variant: 'secondary' },
    PROCESSING: { label: t('reports.pending'), variant: 'secondary' },
    COMPLETED: { label: t('reports.ready'), variant: 'success' },
    FAILED: { label: t('reports.failed'), variant: 'destructive' }
  }
  return (
    <div className="space-y-6">
      <form action={action} className="grid gap-3 sm:grid-cols-3 sm:items-end">
        <Field label={t('reports.kind')} htmlFor="kind">
          <Select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('common.group')} htmlFor="groupId">
          <Select id="groupId" name="groupId" disabled={!needsGroup} required={needsGroup} defaultValue="">
            <option value="">—</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
        <SubmitButton>
          <FileSpreadsheet className="size-4" /> {t('reports.generate')}
        </SubmitButton>
        <div className="sm:col-span-3">
          <FormError state={state} />
        </div>
      </form>
      {reports.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('reports.empty')}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {reports.map((r) => {
            const s = statusBadge[r.status] ?? { label: r.status, variant: 'muted' as const }
            return (
              <li key={r.jobId} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.label}</p>
                  <p className="text-xs text-muted-foreground tabular">
                    {formatDateTime(r.createdAt)}
                    {r.rows !== null ? ` · ${r.rows} صف` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={s.variant}>{s.label}</Badge>
                  {r.status === 'QUEUED' || r.status === 'PROCESSING' ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
                  {r.downloadUrl ? (
                    <a href={r.downloadUrl} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold hover:bg-muted" download>
                      <Download className="size-3.5" /> {t('reports.download')}
                    </a>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
