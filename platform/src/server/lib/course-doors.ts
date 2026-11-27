/**
 * أبواب صفحة الدورة الستّة (قرار المالك 2026-11-13، وتسميات 21 نوفمبر، و«الفروض والاختبارات» 27 نوفمبر):
 * الحصص المباشرة، الحصص المسجلة، الملفات، الفروض والاختبارات، تمارين QCM، المنتدى. عرض فقط: يعيد تجميع أقسام buildCourseSections كما هي،
 * فلا يضيف عنصرًا ولا يخفيه ولا يغيّر ترتيبه داخل القسم. دوال نقية تُختبر وحدها.
 */
import type { CourseSection, CourseSectionId } from './course-sections'

export const COURSE_DOOR_IDS = ['live', 'recorded', 'files', 'exams', 'practice', 'classroom'] as const
export type CourseDoorId = (typeof COURSE_DOOR_IDS)[number]

/** الأبواب التي تحمل محتوى الدورة (المباشرة والمنتدى لهما مصدر آخر) */
export type ContentDoorId = Exclude<CourseDoorId, 'live' | 'classroom'>

export const COURSE_DOOR_LABELS_AR: Record<CourseDoorId, string> = {
  live: 'الحصص المباشرة',
  recorded: 'الحصص المسجلة',
  files: 'الملفات',
  exams: 'الفروض والاختبارات',
  practice: 'تمارين QCM',
  classroom: 'المنتدى'
}

/** كل قسم محتوى في باب واحد بالضبط */
export const DOOR_OF_SECTION: Record<CourseSectionId, ContentDoorId> = {
  lessons: 'recorded',
  videos: 'recorded',
  homework: 'exams',
  tests: 'exams',
  files: 'files'
}

const CONTENT_DOORS: readonly ContentDoorId[] = ['recorded', 'files', 'exams', 'practice']

export interface ContentDoor<T> {
  id: ContentDoorId
  label: string
  /** الأقسام الأصلية داخل الباب، بترتيبها الثابت (الدروس قبل الفيديوهات، الفروض قبل الاختبارات) */
  groups: CourseSection<T>[]
  count: number
}

/**
 * الأبواب الثلاثة ذات المحتوى بترتيب ثابت، وتُعاد دائمًا حتى الفارغة منها
 * (حتى لا تتبدّل أماكن البلاطات من دورة إلى أخرى).
 */
export function groupIntoDoors<T>(sections: readonly CourseSection<T>[]): ContentDoor<T>[] {
  return CONTENT_DOORS.map((id) => {
    const groups = sections.filter((s) => DOOR_OF_SECTION[s.id] === id)
    return { id, label: COURSE_DOOR_LABELS_AR[id], groups, count: groups.reduce((n, g) => n + g.items.length, 0) }
  })
}
