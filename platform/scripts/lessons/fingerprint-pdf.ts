/**
 * يجهّز درس PDF لـ«أرقام التهميش» (البصمة الخاصة بكل تلميذ):
 *   npm run lessons:fingerprint -- in.pdf out.pdf
 * يقرأ وسوم mdzfn… التي تركها HTML الدرس في أماكن أرقام التهميش، ويكتب مواضعها في بيانات الملف.
 * الطريقة كاملة في src/server/lib/pdf-footnotes.ts. الملف الناتج هو الذي يُرفع إلى المنصة.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { PDFDocument } from 'pdf-lib'
import { findFootnoteTokens, readFootnoteSlots, writeFootnoteSlots } from '@/server/lib/pdf-footnotes'

async function main() {
  const [input, output] = process.argv.slice(2).filter((a) => a !== '--')
  if (!input || !output) throw new Error('الاستعمال: npm run lessons:fingerprint -- in.pdf out.pdf')
  const bytes = readFileSync(input)
  const slots = await findFootnoteTokens(bytes)
  if (!slots.length) throw new Error('لا وسوم mdzfn في الملف: تأكّد من عناصر .mdz-fn في HTML الدرس قبل الطباعة')
  const ks = [...new Set(slots.map((s) => s.k))].sort((a, b) => a - b)
  if (ks.some((k, i) => k !== i)) throw new Error(`ترتيب الأرقام ناقص: ${ks.join(', ')} (يجب أن يبدأ من 0 بلا فجوات)`)
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  writeFootnoteSlots(doc, slots)
  const out = await doc.save({ useObjectStreams: true })
  if (readFootnoteSlots(await PDFDocument.load(out, { updateMetadata: false }))?.length !== slots.length) throw new Error('تعذّر التحقق من الأماكن بعد الحفظ')
  writeFileSync(output, out)
  console.log(`✔ ${slots.length} مكانًا لـ${ks.length} أرقام تهميش → ${output}`)
}

main().catch((e) => {
  console.error(`✖ ${(e as Error).message}`)
  process.exit(1)
})
