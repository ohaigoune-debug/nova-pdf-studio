'use client'

import { Download, Trash2, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useRef, useTransition } from 'react'
import { FormError, SubmitButton } from '@/components/forms/form-bits'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { formatDateTime } from '@/lib/utils'
import { deleteFileAction, uploadFileAction } from '@/server/actions/content.actions'

export interface FileRow {
  id: string
  originalName: string
  mimeType: string
  sizeBytes: number
  status?: string
  createdAt: Date
  downloadUrl: string
}

export function FilesPanel({ files }: { files: FileRow[] }) {
  const router = useRouter()
  const [state, action] = useActionState(uploadFileAction, null)
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, start] = useTransition()
  useEffect(() => {
    if (state?.ok) {
      toast('success', t('filesMgmt.uploaded'), state.data.name)
      formRef.current?.reset()
      router.refresh()
    }
  }, [state, router])
  return (
    <div className="space-y-6">
      <form ref={formRef} action={action} className="flex flex-col gap-3 rounded-lg border border-dashed p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="file" className="mb-1 block text-sm font-semibold">
            {t('filesMgmt.choose')}
          </label>
          <input id="file" name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.webp,.mp3,.m4a,.mp4,.docx,.txt" className="block w-full text-sm" />
        </div>
        <SubmitButton>
          <Upload className="size-4" /> {t('filesMgmt.upload')}
        </SubmitButton>
      </form>
      <FormError state={state} />
      <p className="text-xs text-muted-foreground">{t('filesMgmt.signedHint')}</p>
      {files.length === 0 ? (
        <EmptyState title={t('filesMgmt.noFiles')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common.name')}</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>{t('filesMgmt.size')}</TableHead>
              <TableHead>{t('common.date')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-semibold">
                  {f.originalName} {f.status === 'PENDING' ? <span className="ms-1 rounded bg-warning/20 px-1.5 py-0.5 text-[10px]">{t('media.pending')}</span> : null}
                </TableCell>
                <TableCell dir="ltr" className="text-start text-xs">
                  {f.mimeType}
                </TableCell>
                <TableCell className="tabular">{f.sizeBytes > 1024 * 1024 ? `${(f.sizeBytes / (1024 * 1024)).toFixed(1)} MB` : `${(f.sizeBytes / 1024).toFixed(0)} KB`}</TableCell>
                <TableCell className="text-xs tabular">{formatDateTime(f.createdAt)}</TableCell>
                <TableCell className="text-end">
                  <div className="flex justify-end gap-1">
                    <Button asChild size="sm" variant="ghost">
                      <a href={f.downloadUrl} target="_blank" rel="noreferrer">
                        <Download className="size-4" /> {t('filesMgmt.download')}
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={pending}
                      onClick={() => {
                        if (!confirm(t('filesMgmt.deleteConfirm'))) return
                        start(async () => {
                          const r = await deleteFileAction(f.id)
                          if (!r.ok) toast('error', r.error.message)
                          else router.refresh()
                        })
                      }}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
