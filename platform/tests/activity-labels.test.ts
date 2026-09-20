import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import ar from '@/i18n/ar'

/** كل أحداث السجلّ التي يكتبها الخادم فعلاً */
function auditActions(dir = 'src/server'): string[] {
  const found = new Set<string>()
  const walk = (p: string) => {
    for (const name of readdirSync(p)) {
      const full = join(p, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (full.endsWith('.ts')) {
        for (const m of readFileSync(full, 'utf8').matchAll(/action: '([a-z_]+\.[a-z_.]+)'/g)) found.add(m[1]!)
      }
    }
  }
  walk(dir)
  return [...found].sort()
}

describe('أسماء أحداث النشاط', () => {
  it('كل حدث يكتبه الخادم له اسم عربي — وإلا ظهر بالإنجليزية للأستاذ', () => {
    const actions = auditActions()
    expect(actions.length).toBeGreaterThan(30)
    const labels = ar.activity as Record<string, string | undefined>
    const missing = actions.filter((a) => !labels[a.replace(/\./g, '_')])
    expect(missing, `أحداث بلا ترجمة: ${missing.join(', ')}`).toEqual([])
  })

  it('لا ترجمة لحدث لا يُكتب أصلاً (قاموس بلا بقايا)', () => {
    const actual = new Set(auditActions().map((a) => a.replace(/\./g, '_')))
    const stale = Object.keys(ar.activity).filter((k) => !actual.has(k))
    expect(stale, `ترجمات لأحداث غير موجودة: ${stale.join(', ')}`).toEqual([])
  })
})
