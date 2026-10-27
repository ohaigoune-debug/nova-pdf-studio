'use client'

import { Maximize, Minimize } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { t } from '@/i18n'

type FullscreenContainer = HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> | void; webkitRequestFullScreen?: () => Promise<void> | void }
type FullscreenDocument = Document & { webkitFullscreenElement?: Element; webkitCurrentFullScreenElement?: Element; webkitExitFullscreen?: () => Promise<void> | void; webkitCancelFullScreen?: () => Promise<void> | void }

/** Fullscreen includes the watermark; browsers without element fullscreen use CSS. */
export function VideoFrame({ children }: { children: ReactNode }) {
  const container = useRef<FullscreenContainer>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  const [mode, setMode] = useState<'inline' | 'native' | 'pseudo'>('inline')
  const fullscreenElement = useCallback(() => {
    const doc = document as FullscreenDocument
    return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? doc.webkitCurrentFullScreenElement
  }, [])
  const exit = useCallback(async () => {
    const doc = document as FullscreenDocument
    if (fullscreenElement() === container.current) {
      const end = doc.exitFullscreen ?? doc.webkitExitFullscreen ?? doc.webkitCancelFullScreen
      try { await end?.call(doc) } catch { /* The exit control remains available. */ }
    }
    setMode('inline')
    toggle.current?.focus()
  }, [fullscreenElement])
  useEffect(() => {
    const onChange = () => setMode((current) => fullscreenElement() === container.current ? 'native' : current === 'native' ? 'inline' : current)
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') void exit() }
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    document.addEventListener('keydown', onKey)
    const element = container.current
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
      document.removeEventListener('keydown', onKey)
      if (fullscreenElement() === element) {
        const doc = document as FullscreenDocument
        const end = doc.exitFullscreen ?? doc.webkitExitFullscreen ?? doc.webkitCancelFullScreen
        void Promise.resolve(end?.call(doc)).catch(() => {})
      }
    }
  }, [exit, fullscreenElement])
  useEffect(() => {
    if (mode !== 'pseudo') return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    toggle.current?.focus()
    return () => { document.body.style.overflow = previous }
  }, [mode])
  const enter = async () => {
    const element = container.current
    if (!element) return
    const request = element.requestFullscreen ?? element.webkitRequestFullscreen ?? element.webkitRequestFullScreen
    if (request) {
      try { await request.call(element); setMode('native'); return } catch { /* iPhone / denied fullscreen. */ }
    }
    setMode('pseudo')
  }
  return <div ref={container} data-testid="video-container" className="madrasa-video-frame relative isolate select-none overflow-hidden rounded-xl border bg-black" style={mode === 'pseudo' ? { position: 'fixed', inset: 0, zIndex: 2147483000, width: '100%', height: '100dvh', borderRadius: 0 } : { aspectRatio: '16 / 9' }} role={mode === 'pseudo' ? 'dialog' : undefined} aria-modal={mode === 'pseudo' ? true : undefined} aria-label={mode === 'pseudo' ? t('media.fullscreen') : undefined} onContextMenu={(event) => event.preventDefault()}>
    {children}
    <button ref={toggle} data-testid="video-fullscreen-toggle" type="button" className="absolute start-2 top-2 z-40 flex size-11 items-center justify-center rounded-lg bg-black/75 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" onClick={() => void (mode === 'inline' ? enter() : exit())} aria-label={t(mode === 'inline' ? 'media.fullscreen' : 'media.exitFullscreen')}>
      {mode === 'inline' ? <Maximize className="size-5" /> : <Minimize className="size-5" />}
    </button>
    <style>{`.madrasa-video-frame:fullscreen,.madrasa-video-frame:-webkit-full-screen{width:100%;height:100%;border-radius:0;aspect-ratio:auto!important}.madrasa-video-frame video::-webkit-media-controls-fullscreen-button{display:none!important}`}</style>
  </div>
}

/** A DOM deterrent, not a burned-in watermark or an anti-recording guarantee. */
export function VideoWatermark({ lines }: { lines: string[] }) {
  return <>
    <div data-testid="video-watermark" className="madrasa-video-watermark pointer-events-none absolute z-20 max-w-[75%] rounded bg-black/40 px-2 py-1 font-mono text-[11px] leading-tight text-white/85" dir="ltr">{lines.map((line) => <span key={line} className="block break-words">{line}</span>)}</div>
    <style>{`.madrasa-video-watermark{top:12%;left:10%;animation:madrasa-video-watermark-drift 48s ease-in-out infinite alternate}@keyframes madrasa-video-watermark-drift{0%{top:12%;left:10%}25%{top:65%;left:35%}50%{top:18%;left:45%}75%{top:70%;left:8%}100%{top:40%;left:30%}}@media(prefers-reduced-motion:reduce){.madrasa-video-watermark{animation:none}}`}</style>
  </>
}
