import { describe, expect, it } from 'vitest'
import { buildCourseSections, COURSE_SECTION_IDS } from '@/server/lib/course-sections'
import { COURSE_DOOR_IDS, COURSE_DOOR_LABELS_AR, DOOR_OF_SECTION, groupIntoDoors } from '@/server/lib/course-doors'

const at = (day: number) => new Date(Date.UTC(2026, 10, day))
const item = (title: string, type = 'PDF', day = 1, id = title) => ({ id, title, type, publishedAt: at(day) })

describe('أبواب صفحة الدورة الخمسة', () => {
  it('خمسة أبواب بالترتيب الذي قرّره المالك', () => {
    expect(COURSE_DOOR_IDS).toEqual(['live', 'recorded', 'files', 'practice', 'classroom'])
    expect(COURSE_DOOR_IDS.map((id) => COURSE_DOOR_LABELS_AR[id])).toEqual(['الحصص المباشرة', 'الحصص المسجلة', 'الملفات', 'تماريني ونتائجي', 'القسم الافتراضي'])
  })

  it('كل قسم محتوى له باب واحد، ولا يضيع قسم', () => {
    for (const id of COURSE_SECTION_IDS) expect(DOOR_OF_SECTION[id]).toBeDefined()
  })

  it('الدروس والفيديوهات في «الحصص المسجلة»، والفروض والاختبارات في «تماريني ونتائجي»', () => {
    const sections = buildCourseSections([
      item('الحصة 2 — الشعر الحر', 'LESSON', 2),
      item('الحصة 1 — مدخل', 'LESSON', 1),
      item('شرح بالفيديو', 'VIDEO', 3),
      item('الفرض الأول', 'PDF', 4),
      item('اختبار الفصل الأول', 'PDF', 5),
      item('ملخص الوحدة', 'PDF', 6)
    ])
    const doors = groupIntoDoors(sections)
    expect(doors.map((d) => d.id)).toEqual(['recorded', 'files', 'practice'])

    const recorded = doors.find((d) => d.id === 'recorded')!
    expect(recorded.groups.map((g) => g.id)).toEqual(['lessons', 'videos'])
    expect(recorded.count).toBe(3)
    // الترتيب داخل القسم لا يتغيّر: الحصة 1 ثم 2
    expect(recorded.groups[0]!.items.map((i) => i.session)).toEqual([1, 2])

    const practice = doors.find((d) => d.id === 'practice')!
    expect(practice.groups.map((g) => g.id)).toEqual(['homework', 'tests'])
    expect(practice.count).toBe(2)

    expect(doors.find((d) => d.id === 'files')!.count).toBe(1)
  })

  it('الأبواب تُعاد كلها حتى الفارغة، فلا تتبدّل أماكن البلاطات', () => {
    const doors = groupIntoDoors(buildCourseSections([]))
    expect(doors.map((d) => [d.id, d.count, d.groups.length])).toEqual([
      ['recorded', 0, 0],
      ['files', 0, 0],
      ['practice', 0, 0]
    ])
  })

  it('لا يُضاف عنصر ولا يُحذف: مجموع الأبواب = مجموع الأقسام', () => {
    const sections = buildCourseSections([item('الحصة 1', 'LESSON'), item('فيديو', 'VIDEO'), item('فرض', 'PDF'), item('ملف', 'PDF'), item('امتحان تجريبي', 'PDF')])
    const total = sections.reduce((n, s) => n + s.items.length, 0)
    expect(groupIntoDoors(sections).reduce((n, d) => n + d.count, 0)).toBe(total)
  })
})
