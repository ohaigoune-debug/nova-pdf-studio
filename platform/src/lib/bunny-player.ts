export const BUNNY_PLAYER_SDK = 'https://assets.mediadelivery.net/playerjs/playerjs-latest.min.js'
export interface BunnyPlayer {
  on(event: string, callback: (value?: unknown) => void): void
  off(event: string, callback: (value?: unknown) => void): void
  getCurrentTime(callback: (time: number) => void): void
  getPaused(callback: (paused: boolean) => void): void
  setCurrentTime(time: number): void
  play(): void
  pause(): void
}
export type BunnyPlayerConstructor = new (iframe: HTMLIFrameElement) => BunnyPlayer
type PlayerWindow = Window & { playerjs?: { Player?: BunnyPlayerConstructor } }
let pending: Promise<BunnyPlayerConstructor> | undefined

/** The official SDK, only its documented fixed HTTPS origin; no arbitrary scripts. */
export function loadBunnyPlayer(): Promise<BunnyPlayerConstructor> {
  const existing = (window as PlayerWindow).playerjs?.Player
  if (existing) return Promise.resolve(existing)
  if (pending) return pending
  pending = new Promise<BunnyPlayerConstructor>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = BUNNY_PLAYER_SDK
    script.async = true
    script.referrerPolicy = 'no-referrer'
    const nonce = document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce
    if (nonce) script.nonce = nonce
    const timer = window.setTimeout(() => { script.remove(); reject(new Error('player SDK timeout')) }, 12_000)
    script.onload = () => {
      window.clearTimeout(timer)
      const Player = (window as PlayerWindow).playerjs?.Player
      if (Player) resolve(Player)
      else reject(new Error('player SDK unavailable'))
    }
    script.onerror = () => { window.clearTimeout(timer); script.remove(); reject(new Error('player SDK unavailable')) }
    document.head.append(script)
  }).catch((error: unknown) => { pending = undefined; throw error })
  return pending
}

export function playerValue<T>(read: (callback: (value: T) => void) => void, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = window.setTimeout(() => resolve(fallback), 1500)
    try { read((value) => { window.clearTimeout(timer); resolve(value) }) }
    catch { window.clearTimeout(timer); resolve(fallback) }
  })
}
