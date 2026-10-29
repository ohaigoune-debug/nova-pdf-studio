/**
 * ذاكرة قصيرة العمر داخل العملية لنتائج مشتركة بين كل التلاميذ (عدد أسئلة كل مادة ودرس، قواعد اللعبة…).
 * اختبار الضغط (29 أكتوبر 2026): كانت تُحسب من جديد في كل فتح لصفحة PLAY.
 *
 * - الطلبات المتزامنة على المفتاح نفسه تنتظر الحساب نفسه (لا يُرسل الاستعلام مرّتين).
 * - الخطأ لا يُخبَّأ.
 * - معطَّلة في الاختبارات (NODE_ENV=test) حتى تبقى النتائج فوريّة؛ ttlDelete لإبطال مفتاح بعد تعديل.
 * - لكلّ عملية ذاكرتها: تعديل من الإدارة يظهر في العمليات الأخرى بعد انقضاء العمر (ثوانٍ).
 */
const store = new Map<string, { at: number; value: Promise<unknown> }>()
const MAX_KEYS = 2000

export function ttlMemo<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
  if (process.env.NODE_ENV === 'test' && process.env.TTL_CACHE_IN_TESTS !== '1') return compute()
  const now = Date.now()
  const hit = store.get(key)
  if (hit && now - hit.at < ttlMs) return hit.value as Promise<T>
  const value = compute()
  store.set(key, { at: now, value })
  value.catch(() => {
    if (store.get(key)?.value === value) store.delete(key)
  })
  if (store.size > MAX_KEYS) store.delete(store.keys().next().value as string)
  return value
}

export function ttlDelete(prefix: string): void {
  for (const k of [...store.keys()]) if (k.startsWith(prefix)) store.delete(k)
}
