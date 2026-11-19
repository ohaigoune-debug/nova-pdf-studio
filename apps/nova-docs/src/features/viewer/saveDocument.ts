/** حفظ التعديلات في ملف PDF حقيقي: الكائنات (نص/صور/أشكال) ← الكتابة اليدوية ← التعليقات. */
import { applyEdits } from '@modules/pdf/shared/applyEdits'
import { isStandardFontSafe, type EditObject, type TextObject } from '@modules/pdf/shared/editModel'
import { bytesToBase64 } from '../../platform/bytes'
import { fontNameOf } from '../../lib/editorFonts'
import { rasterizeEditorText } from '../../lib/rasterizeEditorText'
import { applyInk } from '../../lib/ink'
import { addNoteAnnotations } from '../../lib/annotations'
import { addSearchableTextForObjects } from '../../lib/textLayer'
import { loadArabicFont } from '../../lib/ocrDocument'
import type { Snapshot } from './editorState'

export async function bakeEdits(bytes: Uint8Array, snap: Snapshot): Promise<Uint8Array> {
  let out = bytes
  if (snap.objects.length) {
    out = await applyEdits(out, { objects: await namedFontsAsImages(snap.objects) }, { rasterizeText: rasterizeEditorText, rasterScale: 3, coordinateSpace: 'display' })
    // النص العربي المرسوم صورةً يصبح قابلًا للبحث والنسخ (طبقة خفية)
    try {
      out = await addSearchableTextForObjects(out, snap.objects, await loadArabicFont())
    } catch {
      /* الطبقة الخفية تحسين فقط: لا تمنع الحفظ أبدًا */
    }
  }
  if (snap.ink.length) out = await applyInk(out, snap.ink)
  if (snap.notes.length) out = await addNoteAnnotations(out, snap.notes)
  return out
}

/**
 * نص لاتيني بخط مسمّى: محرك Windows يرسمه بخطوط PDF القياسية (Helvetica…) فيضيع الخط المختار.
 * نرسمه هنا صورة بالخط المختار (النص العربي يُرسم صورة أصلًا داخل applyEdits).
 */
async function namedFontsAsImages(objects: EditObject[]): Promise<EditObject[]> {
  const out: EditObject[] = []
  for (const o of objects) {
    if (o.kind === 'text' && fontNameOf(o) && o.text.trim() && isStandardFontSafe(o.text)) {
      const t = o as TextObject
      const r = await rasterizeEditorText(t, 3)
      out.push({ id: t.id, kind: 'image', page: t.page, x: t.x, y: t.y, width: r.widthPt, height: r.heightPt, rotation: t.rotation, mime: 'image/png', dataBase64: bytesToBase64(r.png), role: 'image', opacity: 1 } as EditObject)
    } else out.push(o)
  }
  return out
}
