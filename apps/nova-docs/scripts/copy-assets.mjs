// ينسخ الأصول الثقيلة (WASM، حزم لغات OCR، الخط العربي) من node_modules ومن موارد المشروع الأصلي
// إلى public/ قبل البناء، حتى تعمل كلها دون إنترنت داخل التطبيق ولا تُكرَّر في Git.
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const app = resolve(here, '..')
const repo = resolve(app, '../..')
const pub = join(app, 'public')

function copy(from, to) {
  if (!existsSync(from)) throw new Error(`missing asset: ${from}`)
  mkdirSync(dirname(to), { recursive: true })
  cpSync(from, to, { recursive: true })
}

// OCR: حزم اللغات نفسها التي تستخدمها نسخة Windows (ara/fra/eng)
for (const f of readdirSync(join(repo, 'resources/tessdata'))) copy(join(repo, 'resources/tessdata', f), join(pub, 'tessdata', f))
// tesseract.js: العامل والنواة (WASM مضمّن في ملفات .wasm.js)
copy(join(app, 'node_modules/tesseract.js/dist/worker.min.js'), join(pub, 'tesseract/worker.min.js'))
for (const f of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js']) {
  copy(join(app, 'node_modules/tesseract.js-core', f), join(pub, 'tesseract', f))
}
// pdf.js: خرائط الأحرف CMaps والخطوط القياسية (ملفات PDF الآسيوية والخطوط غير المضمّنة)
copy(join(app, 'node_modules/pdfjs-dist/cmaps'), join(pub, 'pdfjs/cmaps'))
copy(join(app, 'node_modules/pdfjs-dist/standard_fonts'), join(pub, 'pdfjs/standard_fonts'))
// sql.js
copy(join(app, 'node_modules/sql.js/dist/sql-wasm.wasm'), join(pub, 'sqljs/sql-wasm.wasm'))
// الخط العربي المستعمل في طبقة النص الخفية وفي رسم النص العربي
copy(join(repo, 'resources/fonts/NotoNaskhArabic-Regular.ttf'), join(pub, 'fonts/NotoNaskhArabic-Regular.ttf'))
console.log('assets copied to public/')
