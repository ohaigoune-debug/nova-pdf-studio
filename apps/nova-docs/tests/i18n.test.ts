/** اللغات الأربع عشرة: كل ملف ترجمة للتطبيق يحتوي نفس المفاتيح والعناصر النائبة الموجودة في الإنجليزية. */
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LANGUAGES } from '@shared/settings'

const DIR = resolve(__dirname, '../src/i18n/locales')
type Tree = { [k: string]: string | Tree }
const flat = (o: Tree, p = ''): Record<string, string> => Object.entries(o).reduce((acc, [k, v]) => ({ ...acc, ...(typeof v === 'string' ? { [p + k]: v } : flat(v, `${p}${k}.`)) }), {} as Record<string, string>)
const load = (code: string) => flat(JSON.parse(readFileSync(resolve(DIR, `${code}.json`), 'utf8')))
const en = load('en')
const vars = (s: string) => (s.match(/\{\{\w+\}\}/g) ?? []).sort().join(',')

describe('app translations (14 languages)', () => {
  it('has one file per supported language', () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', '')).sort()
    expect(files).toEqual(LANGUAGES.map((l) => l.code).sort())
  })
  for (const { code } of LANGUAGES) {
    it(`${code}: same keys and placeholders as English`, () => {
      const t = load(code)
      expect(Object.keys(t).sort()).toEqual(Object.keys(en).sort())
      for (const [k, v] of Object.entries(en)) {
        expect(t[k].trim().length, `${code}.${k} empty`).toBeGreaterThan(0)
        expect(vars(t[k]), `${code}.${k} placeholders`).toBe(vars(v))
      }
    })
  }
})
