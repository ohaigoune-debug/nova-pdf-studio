/**
 * سجلّ الأيقونات: كل اسم أيقونة يُحلّ بالنص (iconKey في القوائم، icon في مواد وشارات PLAY) يجب أن يكون
 * مسجَّلًا، ولا يعود أحد إلى استيراد مكتبة lucide كلها (132 كيلوبايت مضغوطة في كل صفحة).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ICON_REGISTRY, iconByName } from '@/components/icon-registry'
import { PLAY_BADGES, PLAY_SUBJECTS } from '@/server/play/constants'

const SRC = join(process.cwd(), 'src')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return sourceFiles(p)
    return /\.tsx?$/.test(name) ? [p] : []
  })
}

const files = sourceFiles(SRC).map((p) => ({ p, text: readFileSync(p, 'utf8') }))

describe('icon registry', () => {
  it('knows every iconKey used in navigation and tiles', () => {
    const used = new Set<string>()
    for (const f of files) for (const m of f.text.matchAll(/iconKey: '([A-Za-z0-9]+)'/g)) used.add(m[1]!)
    expect(used.size).toBeGreaterThan(20)
    const missing = [...used].filter((name) => !iconByName(name))
    expect(missing, `أضفها إلى src/components/icon-registry.ts: ${missing.join(', ')}`).toEqual([])
  })

  it('knows every PLAY subject and badge icon', () => {
    const used = [...PLAY_SUBJECTS.map((s) => s.icon), ...PLAY_BADGES.map((b) => b.icon)]
    expect(used.length).toBeGreaterThan(10)
    const missing = [...new Set(used)].filter((name) => !iconByName(name))
    expect(missing, `أضفها إلى src/components/icon-registry.ts: ${missing.join(', ')}`).toEqual([])
  })

  it('returns undefined for unknown or inherited names instead of a non-component', () => {
    expect(iconByName('NoSuchIcon')).toBeUndefined()
    expect(iconByName('constructor')).toBeUndefined()
    expect(iconByName('toString')).toBeUndefined()
  })

  it('registers real components only', () => {
    for (const [name, Cmp] of Object.entries(ICON_REGISTRY)) expect(Cmp, name).toBeTruthy()
  })

  it('no source file imports the whole lucide library', () => {
    const offenders = files.filter((f) => /^import\s+\*\s+as\s+\w+\s+from\s+'lucide-react'/m.test(f.text)).map((f) => f.p.replace(SRC, 'src'))
    expect(offenders).toEqual([])
  })
})
