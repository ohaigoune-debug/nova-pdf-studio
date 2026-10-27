'use client'

import { Play, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { t } from '@/i18n'
import { loadBunnyPlayer, playerValue, type BunnyPlayer, type BunnyPlayerConstructor } from '@/lib/bunny-player'
import { HeartbeatGuard, HEARTBEAT_INTERVAL_MS, REQUEST_TIMEOUT_MS, parseHeartbeatResponse, type HeartbeatBlockReason } from '@/lib/video-playback-guard'
import { VideoFrame, VideoWatermark } from './video-frame'

function makeViewerKey(): string {
  try {
    const stored = sessionStorage.getItem('madrasa_viewer_key')
    if (stored) return stored
    const fresh = crypto.randomUUID().replace(/-/g, '').slice(0, 24)
    sessionStorage.setItem('madrasa_viewer_key', fresh)
    return fresh
  } catch { return Math.random().toString(36).slice(2, 26) }
}

function PlaybackBlocked({ reason }: { reason: HeartbeatBlockReason | 'player' }) {
  const message = reason === 'devices' ? t('media.tooManyDevices') : reason === 'connection' ? t('media.heartbeatLost') : reason === 'player' ? t('media.playerUnavailable') : t('media.accessLost')
  return <div data-testid="video-blocked" role="alert" className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 overflow-auto bg-black p-6 text-center text-white">
    <ShieldCheck className="size-10 shrink-0 text-amber-300" />
    <p className="text-lg font-bold">{t('media.playerBlocked')}</p>
    <p className="text-sm text-white/85">{message}</p>
    <Button variant="secondary" onClick={() => window.location.reload()}>{t('media.reloadPlayer')}</Button>
  </div>
}

/** At most one bounded heartbeat. A denied instance never resumes locally. */
function usePlaybackHeartbeat(contentId: string, position: () => number, onBlock: () => void) {
  const viewerKey = useMemo(makeViewerKey, [])
  const guard = useRef(new HeartbeatGuard())
  const [blocked, setBlocked] = useState<HeartbeatBlockReason | null>(null)
  const alive = useRef(true)
  const inFlight = useRef<AbortController | null>(null)
  const lastTick = useRef<number>(0)
  const positionRef = useRef(position)
  const onBlockRef = useRef(onBlock)
  positionRef.current = position
  onBlockRef.current = onBlock
  // Reset elapsed viewing time, not the failure counter. Pausing/returning to
  // a tab must not count idle time or become a way to dismiss a denial.
  const resetClock = useCallback(() => { lastTick.current = 0 }, [])
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; inFlight.current?.abort() }
  }, [])
  const reject = useCallback((code?: string, message?: string) => {
    if (!alive.current) return
    const result = guard.current.recordFailure(code, message)
    if (result.blocked && result.reason) { onBlockRef.current(); setBlocked(result.reason) }
  }, [])
  const send = useCallback(async (completed = false) => {
    if (!alive.current || guard.current.blocked || inFlight.current) return
    const controller = new AbortController()
    inFlight.current = controller
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    const now = Date.now()
    const delta = lastTick.current ? Math.max(0, Math.min(120, Math.round((now - lastTick.current) / 1000))) : 0
    lastTick.current = now
    const accept = (ok: boolean, code?: string, message?: string) => {
      if (!alive.current) return
      if (!ok) { reject(code, message); return }
      const result = guard.current.recordSuccess()
      if (result.blocked && result.reason) { onBlockRef.current(); setBlocked(result.reason) }
    }
    try {
      const response = await fetch('/api/v1/media/heartbeat', {
        method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', signal: controller.signal,
        body: JSON.stringify({ contentId, viewerKey, position: Math.max(0, Math.min(24 * 3600, Math.floor(positionRef.current()))), delta, completed })
      })
      const result = parseHeartbeatResponse(response.status, await response.json().catch(() => null))
      if (result.ok) accept(true)
      else accept(false, result.code, result.message)
    } catch { accept(false) }
    finally { window.clearTimeout(timeout); if (inFlight.current === controller) inFlight.current = null }
  }, [contentId, viewerKey, reject])
  return { blocked, send, viewerKey, reject, resetClock }
}

/** A watermarked container; native video fullscreen controls are deliberately off. */
export function SecureVideoPlayer({ src, contentId, watermark, poster }: { src: string; contentId: string; watermark: string[]; poster?: string }) {
  const video = useRef<HTMLVideoElement>(null)
  const [paused, setPaused] = useState(false)
  const { blocked, send, resetClock } = usePlaybackHeartbeat(contentId, () => video.current?.currentTime ?? 0, () => {
    const element = video.current
    if (element) { element.pause(); element.removeAttribute('src'); element.load() }
  })
  useEffect(() => {
    const interval = window.setInterval(() => { if (video.current && !video.current.paused && !video.current.ended) void send() }, HEARTBEAT_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [send])
  useEffect(() => {
    const hidden = () => {
      if (document.hidden && video.current && !video.current.paused) { video.current.pause(); setPaused(true) }
    }
    document.addEventListener('visibilitychange', hidden)
    return () => document.removeEventListener('visibilitychange', hidden)
  }, [])
  return <div className="space-y-2">
    <VideoFrame>
      {!blocked ? <video ref={video} src={src} poster={poster} controls controlsList="nodownload noremoteplayback nofullscreen" disablePictureInPicture disableRemotePlayback playsInline preload="metadata" className="absolute inset-0 h-full w-full object-contain" onPlay={() => { resetClock(); setPaused(false); void send() }} onPause={() => void send()} onEnded={() => void send(true)} onContextMenu={(event) => event.preventDefault()} /> : null}
      <VideoWatermark lines={watermark} />
      {blocked ? <PlaybackBlocked reason={blocked} /> : paused ? <button type="button" className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-black/70 text-white" onClick={() => void video.current?.play()}><Play className="size-12" /><span>{t('media.tabHidden')}</span></button> : null}
    </VideoFrame>
    <Alert tone="info" className="text-xs">{t('media.watermarkHint')}</Alert>
  </div>
}

type Embed = { url: string; expires: number }
type Playback = { time: number; paused: boolean }
const RENEW_EARLY_MS = 60_000

/** Short admission URLs with player.js renewal; expires never tears down playback. */
export function SecureBunnyPlayer({ src, expires, contentId, watermark, title }: { src: string; expires: number; contentId: string; watermark: string[]; title: string }) {
  const iframe = useRef<HTMLIFrameElement>(null)
  const player = useRef<BunnyPlayer | null>(null)
  const frameReady = useRef<(() => void) | null>(null)
  const [Player, setPlayer] = useState<BunnyPlayerConstructor | null>(null)
  const [embed, setEmbed] = useState<Embed>({ url: src, expires })
  const [playerFailed, setPlayerFailed] = useState(false)
  const [renewing, setRenewing] = useState(false)
  const playback = useRef<Playback>({ time: 0, paused: true })
  const restore = useRef<Playback | null>(null)
  const alive = useRef(true)
  const terminal = useRef(false)
  const renewalInFlight = useRef<AbortController | null>(null)
  const renewalFailures = useRef(0)
  const stop = useCallback(() => {
    terminal.current = true
    try { player.current?.pause() } catch { /* Removal is unconditional. */ }
    if (iframe.current) iframe.current.src = 'about:blank'
    renewalInFlight.current?.abort()
  }, [])
  const { blocked, send, viewerKey, reject, resetClock } = usePlaybackHeartbeat(contentId, () => playback.current.time, stop)
  useEffect(() => {
    alive.current = true
    loadBunnyPlayer().then((Constructor) => { if (alive.current) setPlayer(() => Constructor) }).catch(() => { if (alive.current) { stop(); setPlayerFailed(true) } })
    return () => { alive.current = false; renewalInFlight.current?.abort() }
  }, [stop])
  useEffect(() => {
    if (!Player || !iframe.current || blocked || playerFailed) return
    const current = new Player(iframe.current)
    player.current = current
    const time = (value?: unknown) => {
      const seconds = typeof value === 'number' ? value : value && typeof value === 'object' && 'seconds' in value ? value.seconds : null
      if (!terminal.current && typeof seconds === 'number' && Number.isFinite(seconds)) playback.current.time = Math.max(0, Math.min(86400, seconds))
    }
    const play = () => { if (!terminal.current) playback.current.paused = false }
    const pause = () => { if (!restore.current) playback.current.paused = true }
    const ready = () => {
      if (terminal.current || !alive.current) return
      current.off('timeupdate', time); current.off('play', play); current.off('pause', pause)
      current.on('timeupdate', time); current.on('play', play); current.on('pause', pause)
      const saved = restore.current
      if (saved) {
        restore.current = null
        playback.current = saved
        current.setCurrentTime(saved.time)
        if (!saved.paused && !document.hidden) current.play()
        else current.pause()
      }
      setRenewing(false)
    }
    frameReady.current = () => { current.off('ready', ready); current.on('ready', ready) }
    current.on('ready', ready)
    return () => {
      frameReady.current = null
      current.off('ready', ready); current.off('timeupdate', time); current.off('play', play); current.off('pause', pause)
      try { current.pause() } catch { /* Unmount removes the frame. */ }
      if (player.current === current) player.current = null
    }
  }, [Player, blocked, playerFailed])
  useEffect(() => {
    if (blocked || playerFailed) return
    void send()
    const interval = window.setInterval(() => { if (!document.hidden) void send() }, HEARTBEAT_INTERVAL_MS)
    const visibility = () => {
      if (document.hidden) { resetClock(); try { player.current?.pause() } catch { /* Remain paused on restoration. */ } playback.current.paused = true }
      else void send()
    }
    document.addEventListener('visibilitychange', visibility)
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', visibility) }
  }, [send, blocked, playerFailed, resetClock])

  useEffect(() => {
    if (!Player || blocked || playerFailed) return
    let disposed = false
    let timer: number
    const renew = async () => {
      if (disposed || terminal.current) return
      if (document.hidden || !player.current) { timer = window.setTimeout(() => void renew(), HEARTBEAT_INTERVAL_MS); return }
      const controller = new AbortController()
      renewalInFlight.current = controller
      const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      try {
        const response = await fetch('/api/v1/media/bunny/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', signal: controller.signal, body: JSON.stringify({ contentId, viewerKey }) })
        const payload: unknown = await response.json().catch(() => null)
        if (disposed || terminal.current || !alive.current) return
        const result = parseHeartbeatResponse(response.status, payload)
        if (!result.ok) {
          if (result.code && ['MEDIA_TOO_MANY_DEVICES', 'AUTH_REQUIRED', 'FORBIDDEN', 'CONTENT_NOT_FOUND'].includes(result.code)) { reject(result.code, result.message); return }
          throw new Error('renewal unavailable')
        }
        const value = (payload as { data?: Partial<Embed> }).data
        if (!value || typeof value.url !== 'string' || typeof value.expires !== 'number' || !Number.isFinite(value.expires)) throw new Error('invalid renewal')
        const target = new URL(value.url)
        if (target.origin !== 'https://iframe.mediadelivery.net' || target.username || target.password || !target.pathname.startsWith('/embed/') || value.expires <= embed.expires || value.expires * 1000 <= Date.now()) throw new Error('invalid renewal')
        const current = player.current
        if (!current) throw new Error('player unavailable')
        const wasPaused = await playerValue<boolean>((callback) => current.getPaused(callback), playback.current.paused)
        if (disposed || terminal.current || !alive.current) return
        current.pause()
        const position = await playerValue<number>((callback) => current.getCurrentTime(callback), playback.current.time)
        if (disposed || terminal.current || !alive.current) return
        restore.current = { time: Number.isFinite(position) ? Math.max(0, Math.min(86400, position)) : playback.current.time, paused: typeof wasPaused === 'boolean' ? wasPaused : playback.current.paused }
        renewalFailures.current = 0
        setRenewing(true)
        setEmbed({ url: value.url, expires: value.expires })
      } catch {
        if (disposed || terminal.current || !alive.current) return
        renewalFailures.current += 1
        if (renewalFailures.current >= 4) { stop(); setPlayerFailed(true) }
        else timer = window.setTimeout(() => void renew(), HEARTBEAT_INTERVAL_MS)
      } finally { window.clearTimeout(timeout); if (renewalInFlight.current === controller) renewalInFlight.current = null }
    }
    timer = window.setTimeout(() => void renew(), Math.max(1000, embed.expires * 1000 - Date.now() - RENEW_EARLY_MS))
    return () => { disposed = true; window.clearTimeout(timer); renewalInFlight.current?.abort() }
  }, [Player, embed.expires, contentId, viewerKey, blocked, playerFailed, stop, reject])
  return <div className="space-y-2">
    <VideoFrame>
      {Player && !blocked && !playerFailed ? <iframe ref={iframe} src={embed.url} title={title} loading="eager" className="absolute inset-0 h-full w-full border-0" allow="autoplay; encrypted-media" referrerPolicy="strict-origin-when-cross-origin" onLoad={() => frameReady.current?.()} /> : null}
      <VideoWatermark lines={watermark} />
      {blocked ? <PlaybackBlocked reason={blocked} /> : playerFailed ? <PlaybackBlocked reason="player" /> : !Player || renewing ? <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-5 text-center text-white" role="status">{t('media.renewing')}</div> : null}
    </VideoFrame>
    <Alert tone="info" className="text-xs">{t('media.bunnyWatermarkHint')}</Alert>
  </div>
}
