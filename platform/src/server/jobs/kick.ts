/**
 * إيقاظ العامل الداخلي بعد أي عملية قد تُدرج مهاماً (إشعارات ⇒ دفع، تقارير، AI).
 * استيراد ديناميكي حتى لا تُسحب الخدمات إلى مسارات لا تحتاجها.
 */
export function kickJobsSoon(): void {
  if (process.env.NODE_ENV === 'test' || process.env.JOBS_INLINE_WORKER === '0') return
  void Promise.all([import('./runner'), import('@/server/db/client')])
    .then(([{ kickWorker }, { getDb }]) => kickWorker(getDb))
    .catch((err) => console.error('[jobs] kick failed', err))
}
