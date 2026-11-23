/**
 * إخفاء تبويبات الواجهة العامة (ترويسة الموقع وتذييله) من الإدارة بلا برمجة — طلب المالك 22 نوفمبر 2026.
 * المخزَّن: قائمة مفاتيح مخفية (مسار القسم، أو LEVEL_PICKER_KEY لاختيار المستوى).
 * الإخفاء من التنقّل فقط: الصفحات تبقى تعمل بروابطها (رموز QR المطبوعة في الكتب تشير إليها).
 */
import { FOOTER_EXTRA, MAIN_SECTIONS } from './sections'

/** مفتاح اختيار المستوى («3 ثانوي (بكالوريا)…») في الترويسة */
export const LEVEL_PICKER_KEY = 'level-picker'

/** مفتاح قسم «أحدث الدروس» (ملفّات مجّانيّة) في الصّفحة الرّئيسيّة */
export const HOME_LATEST_KEY = 'home-latest-lessons'

export interface HideablePublicEntry {
  key: string
  label: string
}

export const HIDEABLE_PUBLIC_ENTRIES: HideablePublicEntry[] = [
  { key: LEVEL_PICKER_KEY, label: 'اختيار المستوى («3 ثانوي (بكالوريا)»…)' },
  ...MAIN_SECTIONS.map((s) => ({ key: s.href, label: s.label })),
  ...FOOTER_EXTRA.map((s) => ({ key: s.href, label: `${s.label} (في التّذييل)` })),
  { key: HOME_LATEST_KEY, label: 'قسم «أحدث الدروس» المجّانيّ في الصّفحة الرّئيسيّة' }
]

/**
 * ما يُخفى ما لم يحفظ المشرف اختيارًا بعد. قرار المالك 23 نوفمبر 2026: «منصّتنا أصبحت مدفوعة بالكامل،
 * لا داعي لأشياء مجّانيّة أبدًا» ⇒ كلّ الأقسام المجّانيّة مخفيّة افتراضيًّا (كان 22 نوفمبر: المستوى والدروس والفروض فقط).
 * بعد أوّل حفظ من الإدارة يُعتمد اختيار المشرف وحده، ولو كان «لا شيء مخفيّ».
 * الخصوصيّة وحذف الحساب ليسا هنا أبدًا: تشترطهما آبل وجوجل.
 */
export const DEFAULT_HIDDEN_PUBLIC: readonly string[] = HIDEABLE_PUBLIC_ENTRIES.map((e) => e.key)

const ALLOWED = new Set(HIDEABLE_PUBLIC_ENTRIES.map((e) => e.key))

/** ينظّف الإدخال: مفاتيح معروفة فقط، بلا تكرار */
export function cleanHiddenPublic(input: readonly unknown[]): string[] {
  return [...new Set(input.filter((h): h is string => typeof h === 'string' && ALLOWED.has(h)))]
}

/** القيمة المخزّنة ← القائمة الفعليّة: لا قيمة محفوظة ⇒ الافتراضيّ؛ قيمة محفوظة (ولو فارغة) ⇒ هي */
export function resolveHiddenPublic(stored: unknown): string[] {
  return Array.isArray(stored) ? cleanHiddenPublic(stored) : [...DEFAULT_HIDDEN_PUBLIC]
}
