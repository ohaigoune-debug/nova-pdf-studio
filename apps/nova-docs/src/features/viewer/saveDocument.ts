/** حفظ التعديلات في ملف PDF حقيقي: الكائنات (نص/صور/أشكال) ← الكتابة اليدوية ← التعليقات. */
import { applyEdits } from '@modules/pdf/shared/applyEdits'
import { rasterizeText } from '@modules/pdf/renderer/rasterizeText'
import { applyInk } from '../../lib/ink'
import { addNoteAnnotations } from '../../lib/annotations'
import type { Snapshot } from './editorState'

export async function bakeEdits(bytes: Uint8Array, snap: Snapshot): Promise<Uint8Array> {
  let out = bytes
  if (snap.objects.length) out = await applyEdits(out, { objects: snap.objects }, { rasterizeText, rasterScale: 3 })
  if (snap.ink.length) out = await applyInk(out, snap.ink)
  if (snap.notes.length) out = await addNoteAnnotations(out, snap.notes)
  return out
}
