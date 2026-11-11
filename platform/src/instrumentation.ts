/**
 * نقطة المراقبة الوحيدة لأخطاء الخادم (Next.js instrumentation):
 * كل خطأ غير متوقع في صفحة أو معالج أو إجراء خادم يمرّ من `onRequestError`، فيُعدّ ويُنبَّه المشرف على
 * تيليغرام عند التكرار (التفاصيل في src/server/lib/error-alerts.ts).
 * كل استيراد ديناميكي ومحصور داخل شرط وقت تشغيل Node: هذا الملف يُبنى أيضاً لوقت تشغيل Edge (الـ middleware)
 * حيث لا قاعدة بيانات.
 */
import type { Instrumentation } from 'next'

export async function register() {
  // الشرط بهذه الصيغة يُسقط الاستيراد من حزمة Edge عند البناء. ولا اتصال بالقاعدة أثناء البناء.
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NEXT_PHASE !== 'phase-production-build') {
    try {
      const { warmErrorAlerts } = await import('@/server/lib/error-alerts')
      warmErrorAlerts(async () => (await import('@/server/db/client')).getDb())
    } catch {
      /* المراقبة لا تمنع الإقلاع */
    }
  }
}

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // بلا await: الطلب لا ينتظر مسار التنبيه، ولا شيء هنا يرمي
    void import('@/server/lib/error-alerts')
      .then(({ reportRequestError }) => reportRequestError(error, request, context, { getDb: async () => (await import('@/server/db/client')).getDb() }))
      .catch(() => {})
  }
}
