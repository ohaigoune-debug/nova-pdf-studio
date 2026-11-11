/**
 * مراجعة الموجة (أ): تنظيف الكاش المُشغَّل من الكتابة يجب ألا يتراكم.
 * قبل الإصلاح: كل كتابة تكتمل أثناء تنظيف جارٍ كانت تصفّ تنظيفاً كاملاً جديداً خلفه، ثم تنطلق كلها معاً
 * (مئات الجولات على المجلد كله في خيوط libuv الأربعة)، فيتجاوز الكاش سقفه أضعافاً تحت الفتحات المتزامنة.
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const ROOT = path.join(os.tmpdir(), `stamp-sweep-test-${process.pid}-${Date.now()}`)
const MB = 1024 * 1024
let n = 0
const newKey = () => createHash('sha256').update(`k${n++}`).digest('hex')

function usage(dir: string): number {
  if (!fs.existsSync(dir)) return 0
  let bytes = 0
  for (const s of fs.readdirSync(dir)) {
    for (const name of fs.readdirSync(path.join(dir, s))) {
      try {
        bytes += fs.statSync(path.join(dir, s, name)).size
      } catch {
        /* حُذف أثناء العدّ */
      }
    }
  }
  return bytes
}

async function freshCache(sub: string, maxMb: number) {
  process.env.UPLOADS_DIR = path.join(ROOT, sub)
  delete process.env.PDF_STAMP_CACHE_DIR
  process.env.PDF_STAMP_CACHE_MAX_MB = String(maxMb)
  vi.resetModules()
  return import('@/server/lib/pdf-stamp-cache')
}

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.PDF_STAMP_CACHE_MAX_MB
  fs.rmSync(ROOT, { recursive: true, force: true })
})

describe('كاش ختم PDF: التنظيف تحت الكتابة المتزامنة', () => {
  it('كتابات تكتمل أثناء تنظيف جارٍ لا تصفّ تنظيفاً لكلٍّ منها: جولة واحدة جارية وواحدة لاحقة على الأكثر', async () => {
    const cache = await freshCache('herd', 16) // العتبة = 1 MB: كل كتابة تتجاوزها
    const root = cache.stampCacheDir()
    const realReaddir = fsp.readdir.bind(fsp)
    let rootScans = 0
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => (release = r))
    vi.spyOn(fsp, 'readdir').mockImplementation((async (...args: unknown[]) => {
      if (args[0] === root) {
        rootScans++
        if (rootScans === 1) await gate // التنظيف الأول معلَّق: قرص بطيء/خيوط مشغولة
      }
      return (realReaddir as (...a: unknown[]) => Promise<unknown>)(...args)
    }) as never)
    const blob = Buffer.alloc(MB, 7)
    for (let i = 0; i < 20; i++) await cache.getOrCreateStamped(newKey(), async () => blob)
    await new Promise((r) => setTimeout(r, 50))
    expect(rootScans).toBe(1)
    release()
    await new Promise((r) => setTimeout(r, 300))
    // قبل الإصلاح: 20 جولة (واحدة لكل كتابة) تنطلق معاً
    expect(rootScans).toBeLessThanOrEqual(2)
    // والسقف مفروض في النهاية: ما كُتب أثناء التنظيف المعلَّق نُظّف بجولة لاحقة واحدة
    expect(usage(root)).toBeLessThanOrEqual(16 * MB)
  })

  it('8 فتحات متزامنة متواصلة عبر سقف 32 MB: الكاش يبقى قرب سقفه ويعود إليه', async () => {
    const cache = await freshCache('burst', 32)
    const root = cache.stampCacheDir()
    const blob = Buffer.alloc(MB, 7)
    // الختم الحقيقي يكلّف 100 ms فأكثر من المعالج لكل ملف؛ 15 ms هنا تكفي ليتنفّس التنظيف بين الكتابات
    const stamp = async () => {
      await new Promise((r) => setTimeout(r, 15))
      return blob
    }
    let peak = 0
    for (let round = 0; round < 30; round++) {
      await Promise.all(Array.from({ length: 8 }, () => cache.getOrCreateStamped(newKey(), stamp)))
      peak = Math.max(peak, usage(root))
    }
    // بلا تأخير الختم كانت الذروة قبل الإصلاح ≈ 12 ضعف السقف (385 MB). الهامش واسع عمداً (آلة CI بطيئة).
    expect(peak).toBeLessThanOrEqual(4 * 32 * MB)
    // وبعد توقف الكتابة يعود إلى السقف (+ عتبة 1/16) دون انتظار المهمة اليومية
    for (let i = 0; i < 50 && usage(root) > 34 * MB; i++) await new Promise((r) => setTimeout(r, 100))
    expect(usage(root)).toBeLessThanOrEqual(34 * MB)
  })
})
