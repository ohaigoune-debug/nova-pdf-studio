/**
 * Presentation-only grouping for the iPhone learning home. Long series titles
 * such as «سلسلة الفروض والاختبارات — السنة الثالثة ثانوي — لغات أجنبية — الفصل الأول»
 * repeat the same words on every card; showing the shared part once as a
 * heading and only the differing part per item makes the list calmer.
 * It never filters, reorders permissions or changes which lessons are listed.
 */
export type LessonEntry<T> =
  | { kind: 'group'; key: string; heading: string; detail: string | null; items: Array<{ lesson: T; label: string }> }
  | { kind: 'single'; lesson: T; label: string }

const SEPARATOR = /\s*\|\s*|\s+[—–-]\s+/

function tidy(segment: string): string {
  return segment.replace(/^#+/, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
}

export function splitTitle(title: string): string[] {
  return title.split(SEPARATOR).map(tidy).filter(Boolean)
}

interface Parsed<T> { index: number; lesson: T; head: string | null; tail: string[]; label: string }

export function groupLessons<T extends { title: string }>(lessons: readonly T[]): LessonEntry<T>[] {
  const parsed: Parsed<T>[] = lessons.map((lesson, index) => {
    const segments = splitTitle(lesson.title)
    const [first, ...rest] = segments
    // «#بكالوريا_2024 | البناء الفكري 7» reads as «بكالوريا 2024 · البناء الفكري 7».
    const label = segments.join(' · ') || lesson.title
    return { index, lesson, head: first !== undefined && rest.length > 0 ? first : null, tail: rest, label }
  })
  const byHead = new Map<string, Parsed<T>[]>()
  for (const item of parsed) {
    if (item.head === null) continue
    byHead.set(item.head, [...(byHead.get(item.head) ?? []), item])
  }

  const placed = new Set<number>()
  const entries: LessonEntry<T>[] = []
  for (const item of parsed) {
    if (placed.has(item.index)) continue
    const members = item.head === null ? [item] : byHead.get(item.head) ?? [item]
    if (item.head === null || members.length < 2) {
      placed.add(item.index)
      entries.push({ kind: 'single', lesson: item.lesson, label: item.label })
      continue
    }
    const common = item.tail.filter((segment) => members.every((member) => member.tail.includes(segment)))
    entries.push({
      kind: 'group',
      key: `group-${item.index}`,
      heading: item.head,
      detail: common.length ? common.join(' · ') : null,
      items: members.map((member) => {
        placed.add(member.index)
        const label = member.tail.filter((segment) => !common.includes(segment)).join(' · ')
        return { lesson: member.lesson, label: label || tidy(member.lesson.title) }
      })
    })
  }
  return entries
}
