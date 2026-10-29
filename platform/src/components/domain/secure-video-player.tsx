'use client'

import { Maximize2, Minimize2, Play, ShieldCheck } from 'lucide-react'
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { t } from '@/i18n'
import { deviceViewerKey } from './device-key'

const HEARTBEAT_MS = 15_000

const makeViewerKey = deviceViewerKey

/**
 * تكبير يحفظ العلامة المائية: الشاشة الكاملة الأصلية للفيديو (مشغّل iPhone) تعرض الفيديو وحده
 * فتختفي العلامة. هنا يُكبَّر الإطار كله (الفيديو + العلامة): شاشة كاملة حقيقية حيث يدعمها المتصفح
 * للعناصر (الحاسوب، iPad)، وإلا غطاء يملأ النافذة (iPhone) — أدِر الهاتف أفقيًا لصورة أكبر.
 */
function useProtectedFullscreen(ref: RefObject<HTMLElement | null>) {
  const [expanded, setExpanded] = useState(false)
  const enter = useCallback(() => {
    const el = ref.current
    setExpanded(true)
    if (el && document.fullscreenEnabled && typeof el.requestFullscreen === 'function' && !document.fullscreenElement) {
      void el.requestFullscreen().catch(() => {})
    }
  }, [ref])
  const exit = useCallback(() => {
    setExpanded(false)
    if (document.fullscreenElement && document.fullscreenElement === ref.current) void document.exitFullscreen().catch(() => {})
  }, [ref])
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement && ref.current && expanded) setExpanded(false)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [ref, expanded])
  useEffect(() => {
    if (!expanded) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [expanded])
  return { expanded, enter, exit }
}

/** الغلاف والإطار 16:9 في الوضعين: الأصناف تتغيّر فقط، فلا يُعاد تحميل المشغّل عند التكبير */
function frameClasses(expanded: boolean) {
  return {
    wrapper: expanded ? 'fixed inset-0 z-[70] flex items-center justify-center bg-black' : '',
    box: expanded ? 'relative select-none overflow-hidden bg-black' : 'relative select-none overflow-hidden rounded-xl border bg-black',
    boxStyle: expanded ? { aspectRatio: '16 / 9', width: 'min(100vw, calc(100dvh * 16 / 9))' } : { aspectRatio: '16 / 9' }
  }
}

function ExpandButton({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={expanded ? 'تصغير الفيديو' : 'تكبير الفيديو'}
      className="absolute left-2 top-2 z-30 flex size-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      {expanded ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
    </button>
  )
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
  const frameRef = useRef<HTMLDivElement>(null)
  const { expanded, enter, exit } = useProtectedFullscreen(frameRef)
  const frame = frameClasses(expanded)
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

  // زر الشاشة الكاملة في أدوات الفيديو نفسها (iPhone/الحاسوب) يُحوَّل إلى التكبير المحمي
  useEffect(() => {
    const v = videoRef.current as (HTMLVideoElement & { webkitExitFullscreen?: () => void }) | null
    if (!v) return
    const onNativeBegin = () => {
      v.webkitExitFullscreen?.()
      enter()
    }
    const onFullscreen = () => {
      if (document.fullscreenElement === v) void document.exitFullscreen().then(enter).catch(enter)
    }
    v.addEventListener('webkitbeginfullscreen', onNativeBegin)
    document.addEventListener('fullscreenchange', onFullscreen)
    return () => {
      v.removeEventListener('webkitbeginfullscreen', onNativeBegin)
      document.removeEventListener('fullscreenchange', onFullscreen)
    }
  }, [enter])

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
      <div ref={frameRef} className={frame.wrapper}>
      <div className={frame.box} onContextMenu={(e) => e.preventDefault()} style={frame.boxStyle}>
        <ExpandButton expanded={expanded} onToggle={expanded ? exit : enter} />
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          controls
          controlsList="nodownload noremoteplayback nofullscreen"
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
        <div className={`pointer-events-none absolute z-10 rounded bg-black/30 px-2 py-1 font-mono leading-tight text-white/80 transition-all duration-1000 ${expanded ? 'text-sm' : 'text-[11px]'}`} style={{ top: `${wmPos.top}%`, left: `${wmPos.left}%` }} dir="ltr">
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
      </div>
      <Alert tone="info" className="text-xs">
        {t('media.watermarkHint')}
      </Alert>
    </div>
  )
}

/**
 * مشغّل مضمَّن محمي (Bunny Stream أو يوتيوب):
 * - علامة مائية فوق الإطار تتحرك ببطء (اسم التلميذ/بريده + معرّف + التاريخ) — لا تُزال من المشغّل.
 * - نبضات مشاهدة كل 15 ثانية ما دامت الصفحة ظاهرة (الإطار لا يكشف موضع التشغيل، فيُحتسب الزمن المنقضي).
 * - جهاز واحد فقط: عند رفض الخادم يُزال الإطار فيتوقف التشغيل.
 * - رابط Bunny مؤقّت (ساعتان): عند انتهائه يُطلب إعادة تحميل الصفحة.
 */
export function SecureEmbedPlayer({ src, expires, contentId, watermark, title, allow, hint }: { src: string; expires?: number; contentId: string; watermark: string[]; title: string; allow: string; hint: string }) {
  const viewerKey = useMemo(() => makeViewerKey(), [])
  const frameRef = useRef<HTMLDivElement>(null)
  const { expanded, enter, exit } = useProtectedFullscreen(frameRef)
  const frame = frameClasses(expanded)
  const [blocked, setBlocked] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)
  const elapsed = useRef(0)
  const lastTick = useRef<number>(0)

  const heartbeat = useCallback(async () => {
    const now = Date.now()
    const delta = lastTick.current ? Math.min(120, Math.round((now - lastTick.current) / 1000)) : 0
    lastTick.current = now
    elapsed.current += delta
    try {
      const r = await fetch('/api/v1/media/heartbeat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contentId, viewerKey, position: Math.min(24 * 3600, elapsed.current), delta, completed: false })
      })
      const j = await r.json()
      if (!j.ok && j.error?.code === 'MEDIA_TOO_MANY_DEVICES') setBlocked(j.error.message)
    } catch {
      /* الشبكة: لا نوقف العرض */
    }
  }, [contentId, viewerKey])

  useEffect(() => {
    if (blocked) return
    lastTick.current = Date.now()
    void heartbeat()
    const iv = setInterval(() => {
      if (document.hidden) {
        lastTick.current = 0
        return
      }
      if (expires && Date.now() / 1000 >= expires) {
        setExpired(true)
        return
      }
      void heartbeat()
    }, HEARTBEAT_MS)
    return () => clearInterval(iv)
  }, [heartbeat, expires, blocked])

  return (
    <div className="space-y-2">
      <div ref={frameRef} className={frame.wrapper}>
      <div className={frame.box} onContextMenu={(e) => e.preventDefault()} style={frame.boxStyle}>
        {/* بلا allowFullScreen: الشاشة الكاملة الأصلية للمشغّل تُسقط العلامة؛ التكبير من زرّنا */}
        {!expired && !blocked ? (
          <iframe
            src={src}
            title={title}
            loading="lazy"
            className="absolute inset-0 h-full w-full border-0"
            allow={allow}
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : null}
        <ExpandButton expanded={expanded} onToggle={expanded ? exit : enter} />
        {/* علامة مائية بطيئة الحركة (CSS) فوق الإطار؛ لا تلتقط النقر فيبقى التحكم بالمشغّل */}
        <div className={`madrasa-wm pointer-events-none absolute z-10 rounded bg-black/35 px-2 py-1 font-mono leading-tight text-white/85 ${expanded ? 'text-sm' : 'text-[11px]'}`} dir="ltr">
          {watermark.map((l) => (
            <span key={l} className="block">
              {l}
            </span>
          ))}
        </div>
        <style>{`
          .madrasa-wm { top: 8%; left: 6%; animation: madrasa-wm-drift 48s ease-in-out infinite alternate; }
          @keyframes madrasa-wm-drift {
            0% { top: 8%; left: 6%; }
            25% { top: 70%; left: 60%; }
            50% { top: 15%; left: 65%; }
            75% { top: 75%; left: 10%; }
            100% { top: 40%; left: 35%; }
          }
        `}</style>
        {blocked ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/85 p-6 text-center text-white">
            <ShieldCheck className="size-10 text-amber-300" />
            <p className="text-lg font-bold">{t('media.playerBlocked')}</p>
            <p className="text-sm text-white/80">{blocked}</p>
            <Button variant="secondary" onClick={() => setBlocked(null)}>
              {t('media.resume')}
            </Button>
          </div>
        ) : expired ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/85 p-6 text-center text-white">
            <p className="text-sm">{t('media.bunnyExpired')}</p>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              {t('media.resume')}
            </Button>
          </div>
        ) : null}
      </div>
      </div>
      <Alert tone="info" className="text-xs">
        {hint}
      </Alert>
    </div>
  )
}

/** مشغّل Bunny Stream: إطار تضمين برابط موقّع مؤقّت (ساعتان) يولّده الخادم بعد التحقق من الأحقية. */
export function SecureBunnyPlayer({ src, expires, contentId, watermark, title }: { src: string; expires: number; contentId: string; watermark: string[]; title: string }) {
  return (
    <SecureEmbedPlayer src={src} expires={expires} contentId={contentId} watermark={watermark} title={title}
      allow="accelerometer; gyroscope; encrypted-media" hint={t('media.bunnyWatermarkHint')} />
  )
}

/**
 * فيديو يوتيوب لتلميذ مسجّل: نفس العلامة المائية وحدّ الجهاز الواحد وسجل المشاهدة.
 * لا يمنع تنزيل الفيديو من يوتيوب نفسه؛ الحماية الأقوى بنقل الدورات المدفوعة إلى Bunny.
 */
export function SecureYouTubePlayer({ src, contentId, watermark, title }: { src: string; contentId: string; watermark: string[]; title: string }) {
  return (
    <SecureEmbedPlayer src={src} contentId={contentId} watermark={watermark} title={title}
      allow="accelerometer; encrypted-media; gyroscope" hint={t('media.bunnyWatermarkHint')} />
  )
}
