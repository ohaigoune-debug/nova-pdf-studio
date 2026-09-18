'use client'

import { Download, Maximize2 } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Alert } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { t } from '@/i18n'

function viewerKey(): string {
  try {
    const k = sessionStorage.getItem('madrasa_viewer_key')
    if (k) return k
    const fresh = crypto.randomUUID().replace(/-/g, '').slice(0, 24)
    sessionStorage.setItem('madrasa_viewer_key', fresh)
    return fresh
  } catch {
    return Math.random().toString(36).slice(2, 26)
  }
}

/**
 * عارض PDF داخل التطبيق: الملف المُقدَّم مختوم في الخادم باسم/بريد المشاهد (لا نسخة نظيفة تصل المتصفح)،
 * شريط الأدوات مخفي، ولا رابط تنزيل إلا إن سمح الأستاذ. يرسل نبضة مشاهدة عند الفتح ثم كل 30 ثانية.
 */
export function SecurePdfViewer({ src, contentId, allowDownload, watermark, track = true }: { src: string; contentId: string; allowDownload: boolean; watermark: string[]; track?: boolean }) {
  const key = useMemo(() => viewerKey(), [])
  useEffect(() => {
    if (!track) return
    let last = Date.now()
    const send = () => {
      const now = Date.now()
      const delta = Math.min(60, Math.round((now - last) / 1000))
      last = now
      void fetch('/api/v1/media/heartbeat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contentId, viewerKey: key, position: 0, delta }) }).catch(() => {})
    }
    send()
    const iv = setInterval(() => {
      if (!document.hidden) send()
    }, 30_000)
    return () => clearInterval(iv)
  }, [contentId, key, track])
  const viewSrc = `${src}#toolbar=${allowDownload ? 1 : 0}&navpanes=0&view=FitH`
  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-xl border bg-muted" onContextMenu={(e) => e.preventDefault()}>
        <iframe src={viewSrc} title="PDF" className="h-[75vh] w-full bg-white" />
        <div className="pointer-events-none absolute end-3 top-3 rounded bg-black/40 px-2 py-1 font-mono text-[11px] text-white/85" dir="ltr">
          {watermark.join(' · ')}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <a href={viewSrc} target="_blank" rel="noreferrer">
            <Maximize2 className="size-4" /> {t('media.openPdf')}
          </a>
        </Button>
        {allowDownload ? (
          <Button asChild variant="ghost" size="sm">
            <a href={src} download>
              <Download className="size-4" /> {t('media.downloadPdf')}
            </a>
          </Button>
        ) : null}
      </div>
      {!allowDownload ? (
        <Alert tone="info" className="text-xs">
          {t('media.watermarkHint')}
        </Alert>
      ) : null}
    </div>
  )
}
