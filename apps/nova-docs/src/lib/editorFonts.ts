/**
 * خطوط المحرّر العربية (كلها SIL Open Font License 1.1، مضمّنة في التطبيق وتعمل دون إنترنت).
 * تُختار لكل كائن نص (الحقل الإضافي fontName، خاص بنسخة iOS ولا يمس نموذج Windows).
 * النص بخط مختار يُرسم صورة دقيقة عند الحفظ (مثل النص العربي)، مع طبقة بحث خفية للعربية.
 */
import '@fontsource/amiri/arabic-400.css'
import '@fontsource/amiri/arabic-700.css'
import '@fontsource/amiri/latin-400.css'
import '@fontsource/amiri/latin-700.css'
import '@fontsource/scheherazade-new/arabic-400.css'
import '@fontsource/scheherazade-new/arabic-700.css'
import '@fontsource/scheherazade-new/latin-400.css'
import '@fontsource/scheherazade-new/latin-700.css'
import '@fontsource/lateef/arabic-400.css'
import '@fontsource/lateef/arabic-700.css'
import '@fontsource/lateef/latin-400.css'
import '@fontsource/lateef/latin-700.css'
import '@fontsource/markazi-text/arabic-400.css'
import '@fontsource/markazi-text/arabic-700.css'
import '@fontsource/markazi-text/latin-400.css'
import '@fontsource/markazi-text/latin-700.css'
import '@fontsource/noto-kufi-arabic/arabic-400.css'
import '@fontsource/noto-kufi-arabic/arabic-700.css'
import '@fontsource/noto-kufi-arabic/latin-400.css'
import '@fontsource/noto-kufi-arabic/latin-700.css'
import '@fontsource/reem-kufi/arabic-400.css'
import '@fontsource/reem-kufi/arabic-700.css'
import '@fontsource/reem-kufi/latin-400.css'
import '@fontsource/reem-kufi/latin-700.css'
import '@fontsource/cairo/arabic-400.css'
import '@fontsource/cairo/arabic-700.css'
import '@fontsource/cairo/latin-400.css'
import '@fontsource/cairo/latin-700.css'
import '@fontsource/tajawal/arabic-400.css'
import '@fontsource/tajawal/arabic-700.css'
import '@fontsource/tajawal/latin-400.css'
import '@fontsource/tajawal/latin-700.css'
import '@fontsource/almarai/arabic-400.css'
import '@fontsource/almarai/arabic-700.css'
import '@fontsource/almarai/latin-400.css'
import '@fontsource/almarai/latin-700.css'
import '@fontsource/changa/arabic-400.css'
import '@fontsource/changa/arabic-700.css'
import '@fontsource/changa/latin-400.css'
import '@fontsource/changa/latin-700.css'
import '@fontsource/el-messiri/arabic-400.css'
import '@fontsource/el-messiri/arabic-700.css'
import '@fontsource/el-messiri/latin-400.css'
import '@fontsource/el-messiri/latin-700.css'
import '@fontsource/aref-ruqaa/arabic-400.css'
import '@fontsource/aref-ruqaa/arabic-700.css'
import '@fontsource/aref-ruqaa/latin-400.css'
import '@fontsource/aref-ruqaa/latin-700.css'
import { cssFont } from '@modules/pdf/renderer/rasterizeText'
import type { EditObject, TextObject } from '@modules/pdf/shared/editModel'

export interface EditorFont { family: string; label: string; style: 'naskh' | 'kufi' | 'ruqaa' | 'modern' }

export const NASKH_FAMILY = 'Noto Naskh Arabic'

export const EDITOR_FONTS: EditorFont[] = [
  { family: NASKH_FAMILY, label: 'Noto Naskh — نسخ', style: 'naskh' },
  { family: 'Amiri', label: 'Amiri — أميري', style: 'naskh' },
  { family: 'Scheherazade New', label: 'Scheherazade — شهرزاد', style: 'naskh' },
  { family: 'Lateef', label: 'Lateef — لطيف', style: 'naskh' },
  { family: 'Markazi Text', label: 'Markazi — مركزي', style: 'naskh' },
  { family: 'Noto Kufi Arabic', label: 'Noto Kufi — كوفي', style: 'kufi' },
  { family: 'Reem Kufi', label: 'Reem Kufi — ريم كوفي', style: 'kufi' },
  { family: 'Cairo', label: 'Cairo — القاهرة', style: 'modern' },
  { family: 'Tajawal', label: 'Tajawal — تجوّل', style: 'modern' },
  { family: 'Almarai', label: 'Almarai — المراعي', style: 'modern' },
  { family: 'Changa', label: 'Changa — تشانغا', style: 'modern' },
  { family: 'El Messiri', label: 'El Messiri — المسيري', style: 'modern' },
  { family: 'Aref Ruqaa', label: 'Aref Ruqaa — رقعة', style: 'ruqaa' }
]

/** كائن نص في نسخة iOS: نفس نموذج Windows + خط مسمّى اختياري. */
export type IosTextObject = TextObject & { fontName?: string }

export function fontNameOf(o: EditObject): string | undefined {
  return o.kind === 'text' ? (o as IosTextObject).fontName : undefined
}

/** وصف CSS للخط: الخط المختار أولًا ثم سلسلة الاحتياط الأصلية (فلا يختفي أي حرف). */
export function editorCssFont(o: TextObject, scale = 1): string {
  const base = cssFont(o, scale)
  const name = (o as IosTextObject).fontName
  if (!name) return base
  const at = base.indexOf('px ') + 3
  return `${base.slice(0, at)}"${name}", ${base.slice(at)}`
}

let naskhRegistered: Promise<void> | null = null
function registerNaskh(): Promise<void> {
  if (typeof FontFace === 'undefined' || typeof document === 'undefined') return Promise.resolve()
  naskhRegistered ??= (async () => {
    try {
      const face = new FontFace(NASKH_FAMILY, 'url(./fonts/NotoNaskhArabic-Regular.ttf)')
      document.fonts.add(await face.load())
    } catch {
      /* يبقى خط النظام احتياطًا */
    }
  })()
  return naskhRegistered
}

/** ينتظر تحميل الخط فعليًا قبل الرسم على Canvas (وإلا رُسم بخط الاحتياط). */
export async function ensureFontLoaded(o: TextObject): Promise<void> {
  const name = (o as IosTextObject).fontName
  if (!name || typeof document === 'undefined' || !document.fonts) return
  if (name === NASKH_FAMILY) await registerNaskh()
  try {
    await document.fonts.load(editorCssFont(o, 1), o.text || 'أبجد Aa')
  } catch {
    /* احتياط النظام */
  }
}

export function preloadEditorFonts(): void {
  void registerNaskh()
}
