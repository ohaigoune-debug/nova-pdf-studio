/**
 * مفتاح ثابت لهذا المتصفح أو التطبيق (localStorage). يعرّف «الجهاز» في حدّ المشاهدة
 * على جهاز واحد (قرار المالك 2026-10-28)، فلا يُحجب التلميذ إذا تغيّرت شبكته أو فتح
 * تبويبًا آخر. لا يحمل أي بيانات شخصية، والخادم يكتفي بمقارنته.
 */
const STORAGE_KEY = 'madrasa_device_key'
const VALID = /^[A-Za-z0-9]{8,64}$/

function fresh(): string {
  try {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 24)
  } catch {
    return (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).replace(/[^a-z0-9]/gi, '').slice(0, 24).padEnd(12, '0')
  }
}

export function deviceViewerKey(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && VALID.test(stored)) return stored
    const key = fresh()
    localStorage.setItem(STORAGE_KEY, key)
    return key
  } catch {
    // تخزين محجوب (تصفّح خاص صارم): مفتاح لهذه الصفحة فقط
    return fresh()
  }
}
