/**
 * يتحقق أن كل معادلة $…$ في مواضيع المواد العلمية تُعرض بلا خطأ في KaTeX.
 *   node scripts/play/check_katex.mjs [content/play-exams/sets/3AS/MATH …]
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const katex = createRequire(import.meta.url)('katex')
const dirs = process.argv.slice(2).length ? process.argv.slice(2) : ['MATH', 'PHYS', 'SVT', 'TECH'].map((s) => `content/play-exams/sets/3AS/${s}`)
const RE = /\$\$([^$]+)\$\$|\$([^$\n]+)\$/g
let n = 0
let bad = 0
const walk = (v, where) => {
  if (typeof v === 'string') {
    for (const m of v.matchAll(RE)) {
      n++
      try {
        katex.renderToString(m[1] ?? m[2], { throwOnError: true, strict: 'ignore' })
      } catch (e) {
        bad++
        console.log(`✗ ${where}: ${String(e.message).slice(0, 140)}`)
      }
    }
  } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${where}[${i}]`))
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${where}.${k}`)
}
for (const d of dirs) {
  if (!fs.existsSync(d)) continue
  for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.json'))) walk(JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')), f)
}
console.log(`${n} معادلة، ${bad} خطأ`)
process.exitCode = bad ? 1 : 0
