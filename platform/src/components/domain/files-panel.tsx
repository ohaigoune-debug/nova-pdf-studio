'use client'

import { Download, FolderUp, Loader2, Trash2, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { formatDateTime } from '@/lib/utils'
import { deleteFileAction } from '@/server/actions/content.actions'
import { ANY_ACCEPT } from '@/lib/file-types'
import { acceptedOnly, uploadMany } from '@/lib/upload-client'

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
  const [pending, start] = useTransition()
  return (
    <div className="space-y-6">
      <FilesUploader />
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

const FOLDER_PROPS = { webkitdirectory: '', directory: '' } as Record<string, string>

/** رفع ملفات كثيرة أو مجلد كامل إلى «ملفاتي» — عبر مسار الرفع المباشر (حتى 40 MB للملف) */
function FilesUploader() {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const go = async (list: FileList | null, input: HTMLInputElement) => {
    const picked = list ? acceptedOnly(list, ANY_ACCEPT) : []
    input.value = ''
    if (picked.length === 0) return
    const { ok, failed } = await uploadMany(picked, setBusy)
    setBusy(null)
    for (const f of failed.slice(0, 3)) toast('error', f)
    if (ok.length) toast('success', t('filesMgmt.uploaded'), `${ok.length} ملف`)
    router.refresh()
  }
  const cls = 'flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm font-bold hover:bg-muted'
  if (busy)
    return (
      <p className={cls}>
        <Loader2 className="size-4 animate-spin" /> {busy}
      </p>
    )
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <label className={cls}>
        <Upload className="size-4" /> {t('filesMgmt.upload')} (يمكن اختيار عدة ملفات)
        <input type="file" multiple accept={ANY_ACCEPT} className="sr-only" onChange={(e) => void go(e.target.files, e.target)} />
      </label>
      <label className={cls}>
        <FolderUp className="size-4" /> رفع مجلد كامل
        <input type="file" multiple {...FOLDER_PROPS} className="sr-only" onChange={(e) => void go(e.target.files, e.target)} />
      </label>
    </div>
  )
}
