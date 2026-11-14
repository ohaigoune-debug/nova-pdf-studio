import { afterEach, describe, expect, it, vi } from 'vitest'
import { isStaleDeployError, reloadOnceForStaleDeploy, shouldAutoReload, STALE_RELOAD_COOLDOWN_MS, STALE_RELOAD_KEY } from '@/lib/stale-deploy'

describe('صفحة من نسخة سابقة بعد النشر', () => {
  it('يتعرّف على رسائل الملفات المحذوفة في المتصفحات وNext.js', () => {
    for (const e of [
      { name: 'ChunkLoadError', message: 'Loading chunk 4821 failed.' },
      { message: 'Loading chunk app/student/courses/[slug]/page failed.' },
      { message: 'Loading CSS chunk 912 failed' },
      { message: 'Failed to load chunk /_next/static/chunks/abc.js from module 123' },
      { name: 'TypeError', message: 'Failed to fetch dynamically imported module: https://madrasadz.com/_next/static/x.js' },
      { name: 'TypeError', message: 'Importing a module script failed.' },
      { message: 'error loading dynamically imported module' },
      { message: 'Failed to find Server Action "7f3a". This request might be from an older or newer deployment.' }
    ])
      expect(isStaleDeployError(e)).toBe(true)
  })

  it('لا يعيد التحميل لأخطاء أخرى (خطأ خادم، قاعدة، شبكة)', () => {
    for (const e of [
      { message: 'An error occurred in the Server Components render.' },
      { name: 'TypeError', message: "Cannot read properties of undefined (reading 'id')" },
      { name: 'TypeError', message: 'Load failed' },
      { message: '' },
      null,
      undefined
    ])
      expect(isStaleDeployError(e)).toBe(false)
  })

  it('مرة واحدة خلال المهلة، فلا تدور الصفحة إن بقي الخطأ', () => {
    const now = 1_000_000
    expect(shouldAutoReload(null, now)).toBe(true)
    expect(shouldAutoReload(Number.NaN, now)).toBe(true)
    expect(shouldAutoReload(now - 5_000, now)).toBe(false)
    expect(shouldAutoReload(now - STALE_RELOAD_COOLDOWN_MS - 1, now)).toBe(true)
    // ساعة الجهاز رجعت إلى الوراء: لا نعلق
    expect(shouldAutoReload(now + 60_000, now)).toBe(true)
  })
})

describe('reloadOnceForStaleDeploy في المتصفح', () => {
  afterEach(() => vi.unstubAllGlobals())

  const fakeWindow = (store: Map<string, string> | 'broken') => {
    const reload = vi.fn()
    const sessionStorage =
      store === 'broken'
        ? { getItem: () => { throw new Error('SecurityError') }, setItem: () => { throw new Error('SecurityError') } }
        : { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    vi.stubGlobal('window', { sessionStorage, location: { reload } })
    return reload
  }

  it('يعيد التحميل أول مرة ويسجّل الوقت، ثم يمتنع خلال المهلة', () => {
    const store = new Map<string, string>()
    const reload = fakeWindow(store)
    expect(reloadOnceForStaleDeploy(1_000_000)).toBe(true)
    expect(store.get(STALE_RELOAD_KEY)).toBe('1000000')
    expect(reloadOnceForStaleDeploy(1_010_000)).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('التخزين محجوب: لا إعادة تلقائية (لا دوران)، ويبقى الزر', () => {
    const reload = fakeWindow('broken')
    expect(reloadOnceForStaleDeploy(1_000_000)).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })
})
