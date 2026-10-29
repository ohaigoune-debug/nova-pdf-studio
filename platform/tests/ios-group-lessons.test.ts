import { describe, expect, it } from 'vitest'
import { groupLessons, splitTitle, type LessonEntry } from '@/server/lib/group-lessons'

const series = (stream: string) => ({ id: stream, title: `سلسلة الفروض والاختبارات — السنة الثالثة ثانوي — ${stream} — الفصل الأول (نسخة مجانية)` })

function asGroup<T>(entry: LessonEntry<T> | undefined) {
  if (!entry || entry.kind !== 'group') throw new Error('expected a group')
  return entry
}

describe('iPhone learning home grouping', () => {
  it('shows a repeated series heading once and only the differing part per item', () => {
    const lessons = [series('لغات أجنبية'), series('تسيير واقتصاد'), { id: 'x', title: 'درس منفرد' }, series('علوم تجريبية')]
    const entries = groupLessons(lessons)
    expect(entries).toHaveLength(2)
    const group = asGroup(entries[0])
    expect(group.heading).toBe('سلسلة الفروض والاختبارات')
    expect(group.detail).toBe('السنة الثالثة ثانوي · الفصل الأول (نسخة مجانية)')
    expect(group.items.map((item) => item.label)).toEqual(['لغات أجنبية', 'تسيير واقتصاد', 'علوم تجريبية'])
    expect(group.items.map((item) => item.lesson.id)).toEqual(['لغات أجنبية', 'تسيير واقتصاد', 'علوم تجريبية'])
    expect(entries[1]).toEqual({ kind: 'single', lesson: lessons[2], label: 'درس منفرد' })
  })

  it('keeps every lesson exactly once and preserves first-appearance order', () => {
    const lessons = [
      { id: 'a', title: 'درس أ' },
      { id: 'b', title: '#بكالوريا_2024 | البناء الفكري 7 | الرمز في الشعر | جميع الشعب' },
      { id: 'c', title: 'مقدمة — وحدة' },
      { id: 'd', title: '#بكالوريا_2024 | البناء اللغوي 3 | الإعراب | جميع الشعب' }
    ]
    const entries = groupLessons(lessons)
    const ids = entries.flatMap((entry) => (entry.kind === 'group' ? entry.items.map((item) => item.lesson.id) : [entry.lesson.id]))
    expect(ids.sort()).toEqual(['a', 'b', 'c', 'd'])
    expect(entries.map((entry) => entry.kind)).toEqual(['single', 'group', 'single'])
    const group = asGroup(entries[1])
    expect(group.heading).toBe('بكالوريا 2024')
    expect(group.detail).toBe('جميع الشعب')
    expect(group.items[0]?.label).toBe('البناء الفكري 7 · الرمز في الشعر')
  })

  it('falls back to the whole title when nothing differs and splits only on spaced separators', () => {
    const twins = asGroup(groupLessons([{ title: 'أ — ب' }, { title: 'أ — ب' }])[0])
    expect(twins.detail).toBe('ب')
    expect(twins.items.map((item) => item.label)).toEqual(['أ — ب', 'أ — ب'])
    expect(splitTitle('علوم-تجريبية 2024-2025')).toEqual(['علوم-تجريبية 2024-2025'])
    expect(groupLessons([])).toEqual([])
    expect(groupLessons([{ title: '#بكالوريا_2024 | الرمز في الشعر' }])[0]).toMatchObject({ kind: 'single', label: 'بكالوريا 2024 · الرمز في الشعر' })
  })
})
