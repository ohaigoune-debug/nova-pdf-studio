/**
 * إخفاء تبويبات الواجهة العامة (ترويسة الموقع وتذييله) من الإدارة بلا برمجة — طلب المالك 22 نوفمبر 2026.
 * المخزَّن: قائمة مفاتيح مخفية (مسار القسم، أو LEVEL_PICKER_KEY لاختيار المستوى).
 * الإخفاء من التنقّل فقط: الصفحات تبقى تعمل بروابطها (رموز QR المطبوعة في الكتب تشير إليها).
 */
import { MAIN_SECTIONS } from './sections'

/** مفتاح اختيار المستوى («3 ثانوي (بكالوريا)…») في الترويسة */
export const LEVEL_PICKER_KEY = 'level-picker'

export interface HideablePublicEntry {
  key: string
  label: string
}

export const HIDEABLE_PUBLIC_ENTRIES: HideablePublicEntry[] = [
  { key: LEVEL_PICKER_KEY, label: 'اختيار المستوى («3 ثانوي (بكالوريا)»…)' },
  ...MAIN_SECTIONS.map((s) => ({ key: s.href, label: s.label }))
]

/**
 * ما يُخفى ما لم يحفظ المشرف اختيارًا بعد (قرار المالك 22 نوفمبر 2026: «لا قيمة لها الآن»).
 * بعد أوّل حفظ من الإدارة يُعتمد اختيار المشرف وحده، ولو كان «لا شيء مخفيّ».
 */
export const DEFAULT_HIDDEN_PUBLIC: readonly string[] = [LEVEL_PICKER_KEY, '/lessons', '/exams']

const ALLOWED = new Set(HIDEABLE_PUBLIC_ENTRIES.map((e) => e.key))

/** ينظّف الإدخال: مفاتيح معروفة فقط، بلا تكرار */
export function cleanHiddenPublic(input: readonly unknown[]): string[] {
  return [...new Set(input.filter((h): h is string => typeof h === 'string' && ALLOWED.has(h)))]
}

/** القيمة المخزّنة ← القائمة الفعليّة: لا قيمة محفوظة ⇒ الافتراضيّ؛ قيمة محفوظة (ولو فارغة) ⇒ هي */
export function resolveHiddenPublic(stored: unknown): string[] {
  return Array.isArray(stored) ? cleanHiddenPublic(stored) : [...DEFAULT_HIDDEN_PUBLIC]
}
