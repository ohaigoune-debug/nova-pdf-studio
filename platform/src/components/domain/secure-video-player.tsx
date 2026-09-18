'use client'

import { Play, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { t } from '@/i18n'

const HEARTBEAT_MS = 15_000

function makeViewerKey(): string {
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
 * مشغّل الفيديو الخاص:
 * - المصدر رابط موقّع بهوية المشاهد (لا يعمل خارج جلسته) — لا زر تنزيل، لا صورة داخل صورة، لا قائمة يمين.
 * - ختم مائي متحرّك باسم/بريد المشاهد فوق الفيديو (يظهر في أي تصوير شاشة).
 * - نبضات مشاهدة كل 15 ثانية (سجل + كشف تعدّد الأجهزة)؛ عند الرفض يتوقّف التشغيل.
 * - يتوقّف عند مغادرة التبويب.
 */
export function SecureVideoPlayer({ src, contentId, watermark, poster }: { src: string; contentId: string; watermark: string[]; poster?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const viewerKey = useMemo(() => makeViewerKey(), [])
  const [blocked, setBlocked] = useState<string | null>(null)
  const [paused, setPaused] = useState<string | null>(null)
  const [wmPos, setWmPos] = useState({ top: 12, left: 10 })
  const lastTick = useRef<number>(0)

  const heartbeat = useCallback(
    async (completed = false) => {
      const v = videoRef.current
      if (!v) return
      const now = Date.now()
      const delta = lastTick.current ? Math.min(120, Math.round((now - lastTick.current) / 1000)) : 0
      lastTick.current = now
      try {
        const r = await fetch('/api/v1/media/heartbeat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ contentId, viewerKey, position: Math.floor(v.currentTime), delta, completed })
        })
        const j = await r.json()
        if (!j.ok && j.error?.code === 'MEDIA_TOO_MANY_DEVICES') {
          v.pause()
          setBlocked(j.error.message)
        }
      } catch {
        /* الشبكة: لا نوقف التشغيل */
      }
    },
    [contentId, viewerKey]
  )

  // نبضة دورية أثناء التشغيل
  useEffect(() => {
    const iv = setInterval(() => {
      const v = videoRef.current
      if (v && !v.paused && !v.ended) void heartbeat()
    }, HEARTBEAT_MS)
    return () => clearInterval(iv)
  }, [heartbeat])

  // تحريك الختم المائي
  useEffect(() => {
    const iv = setInterval(() => setWmPos({ top: 8 + Math.random() * 70, left: 5 + Math.random() * 60 }), 7000)
    return () => clearInterval(iv)
  }, [])

  // إيقاف عند مغادرة التبويب
  useEffect(() => {
    const onVis = () => {
      const v = videoRef.current
      if (document.hidden && v && !v.paused) {
        v.pause()
        setPaused(t('media.tabHidden'))
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  return (
    <div className="space-y-2">
      <div className="relative select-none overflow-hidden rounded-xl border bg-black" onContextMenu={(e) => e.preventDefault()} style={{ aspectRatio: '16 / 9' }}>
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          controls
          controlsList="nodownload noremoteplayback"
          disablePictureInPicture
          disableRemotePlayback
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full"
          onPlay={() => {
            lastTick.current = Date.now()
            setPaused(null)
            void heartbeat()
          }}
          onPause={() => void heartbeat()}
          onEnded={() => void heartbeat(true)}
          onContextMenu={(e) => e.preventDefault()}
        />
        {/* ختم مائي متحرّك: لا يمكن إزالته من المشغّل وسيظهر في أي تسجيل للشاشة */}
        <div className="pointer-events-none absolute z-10 rounded bg-black/30 px-2 py-1 font-mono text-[11px] leading-tight text-white/80 transition-all duration-1000" style={{ top: `${wmPos.top}%`, left: `${wmPos.left}%` }} dir="ltr">
          {watermark.map((l) => (
            <span key={l} className="block">
              {l}
            </span>
          ))}
        </div>
        {blocked ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/85 p-6 text-center text-white">
            <ShieldCheck className="size-10 text-amber-300" />
            <p className="text-lg font-bold">{t('media.playerBlocked')}</p>
            <p className="text-sm text-white/80">{blocked}</p>
            <Button variant="secondary" onClick={() => setBlocked(null)}>
              {t('media.resume')}
            </Button>
          </div>
        ) : paused ? (
          <button type="button" className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/60 text-white" onClick={() => void videoRef.current?.play()}>
            <Play className="size-12" />
            <span className="text-sm">{paused}</span>
          </button>
        ) : null}
      </div>
      <Alert tone="info" className="text-xs">
        {t('media.watermarkHint')}
      </Alert>
    </div>
  )
}
