/**
 * صفحة مفتوحة من نسخة سابقة بعد نشر جديد: ملفات JavaScript القديمة حُذفت من الخادم، فيفشل التنقل
 * في المتصفح (لا يصل شيء إلى الخادم، ولا يظهر في سجلّه). العلاج إعادة تحميل كاملة تجلب النسخة الجديدة.
 * صفحة الخطأ تعيد التحميل تلقائيًا مرة واحدة، فلا يرى التلميذ «حدث خطأ غير متوقع» بعد كل نشر.
 * دوال نقية تُختبر وحدها، ومعها غلاف صغير للمتصفح.
 */

/** رسائل المتصفحات وNext.js حين تُطلب ملفات نسخة لم تعد موجودة */
const STALE_PATTERNS: readonly RegExp[] = [
  /ChunkLoadError/i,
  /Loading (CSS )?chunk \S+ failed/i,
  /Failed to load chunk/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
  /Failed to find Server Action/i
]

export function isStaleDeployError(err: { name?: string; message?: string } | null | undefined): boolean {
  if (!err) return false
  const text = `${err.name ?? ''} ${err.message ?? ''}`
  return STALE_PATTERNS.some((re) => re.test(text))
}

/** مفتاح sessionStorage لآخر إعادة تحميل تلقائية، ومهلة تمنع الدوران إن بقي الخطأ بعدها */
export const STALE_RELOAD_KEY = 'madrasa:stale-reload-at'
export const STALE_RELOAD_COOLDOWN_MS = 30_000

/** نعيد التحميل إن لم نفعل ذلك خلال المهلة (قيمة تالفة = لم نفعل) */
export function shouldAutoReload(lastReloadAt: number | null, now: number): boolean {
  if (lastReloadAt === null || !Number.isFinite(lastReloadAt)) return true
  return now - lastReloadAt > STALE_RELOAD_COOLDOWN_MS || lastReloadAt > now
}

/**
 * في المتصفح فقط: يعيد التحميل مرة واحدة إن سمحت المهلة، ويعيد true إن فعل.
 * إن تعذّر sessionStorage (وضع خاص، تخزين محجوب) فلا إعادة تلقائية، حتى لا تدور الصفحة بلا نهاية؛
 * يبقى زر «أعد المحاولة» يعيد التحميل يدويًا.
 */
export function reloadOnceForStaleDeploy(now: number = Date.now()): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = window.sessionStorage.getItem(STALE_RELOAD_KEY)
    if (!shouldAutoReload(raw === null ? null : Number(raw), now)) return false
    window.sessionStorage.setItem(STALE_RELOAD_KEY, String(now))
  } catch {
    return false
  }
  window.location.reload()
  return true
}
