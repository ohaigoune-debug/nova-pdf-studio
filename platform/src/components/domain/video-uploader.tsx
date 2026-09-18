'use client'

import { Film, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'

/**
 * رفع فيديو كبير بشريط تقدّم: تذكرة من الخادم → PUT (إلى S3 مباشرة أو تيار عبر الخادم) → إكمال.
 * لا يمرّ الملف عبر Server Action (حدّها 10 MB) ولا يُحمَّل كله في ذاكرة الخادم.
 */
export function VideoUploader({ maxMb }: { maxMb: number }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pct, setPct] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const upload = async (file: File) => {
    setBusy(true)
    setPct(0)
    try {
      const tr = await fetch('/api/v1/files/upload-ticket', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: file.name, mime: file.type || 'video/mp4', size: file.size })
      })
      const tj = await tr.json()
      if (!tj.ok) throw new Error(tj.error?.message ?? t('media.uploadFailed'))
      const ticket = tj.data as { fileId: string; url: string; headers: Record<string, string>; direct: boolean }
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', ticket.url, true)
        for (const [k, v] of Object.entries(ticket.headers)) {
          if (k.toLowerCase() === 'content-length') continue
          xhr.setRequestHeader(k, v)
        }
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setPct(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload ${xhr.status}`)))
        xhr.onerror = () => reject(new Error('network'))
        xhr.send(file)
      })
      const cr = await fetch(`/api/v1/files/${ticket.fileId}/complete`, { method: 'POST' })
      const cj = await cr.json()
      if (!cj.ok) throw new Error(cj.error?.message ?? t('media.uploadFailed'))
      toast('success', t('media.uploadDone'), cj.data.name)
      setPct(100)
      router.refresh()
    } catch (err) {
      toast('error', t('media.uploadFailed'), err instanceof Error ? err.message : undefined)
      setPct(null)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="rounded-lg border border-dashed p-4">
      <p className="mb-1 flex items-center gap-2 text-sm font-bold">
        <Film className="size-4" /> {t('media.uploadVideoTitle', { mb: maxMb })}
      </p>
      <p className="mb-3 text-xs text-muted-foreground">{t('media.uploadVideoHint')}</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input ref={inputRef} type="file" accept="video/mp4,video/*" className="block w-full text-sm" disabled={busy} onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
        <Button type="button" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Upload className="size-4" /> {t('filesMgmt.upload')}
        </Button>
      </div>
      {pct !== null ? (
        <div className="mt-3">
          <Progress value={pct} />
          <p className="mt-1 text-xs text-muted-foreground tabular">{pct < 100 ? t('media.uploading', { pct }) : t('media.uploadDone')}</p>
        </div>
      ) : null}
    </div>
  )
}
