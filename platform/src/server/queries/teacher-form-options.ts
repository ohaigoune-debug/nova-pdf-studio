import type { Db } from '@/server/db/connect'
import type { Actor } from '@/server/lib/actor'
import { listWorkspaceFiles } from '@/server/queries/teacher-extras.queries'
import { listGroups } from '@/server/services/groups.service'
import { listLevels, listSkills, listStreams } from '@/server/services/reference.service'
import { listRubrics } from '@/server/services/rubrics.service'
import { listTeacherStudents } from '@/server/services/students.service'

/** خيارات النماذج (أفواج، طلاب، مهارات، ملفات، شبكات تقييم…) لمساحة الأستاذ */
export async function teacherFormOptions(db: Db, actor: Actor) {
  const [groups, students, skills, files, levels, streams, rubrics] = await Promise.all([
    listGroups(db, actor),
    listTeacherStudents(db, actor),
    listSkills(db),
    listWorkspaceFiles(db, actor),
    listLevels(db),
    listStreams(db),
    listRubrics(db, actor)
  ])
  return {
    groups: groups.filter((g) => g.status === 'ACTIVE').map((g) => ({ id: g.id, name: g.name })),
    students: students.map((s) => ({ id: s.studentId, name: `${s.fullName} — ${s.groups.map((g) => g.groupName).join('، ')}` })),
    skills: skills.map((s) => ({ id: s.id, name: s.nameAr })),
    files: files.filter((f) => f.status === 'READY').map((f) => ({ id: f.id, name: f.originalName, mimeType: f.mimeType })),
    levels: levels.map((l) => ({ id: l.id, name: l.nameAr })),
    streams: streams.map((s) => ({ id: s.id, name: s.nameAr })),
    rubrics: rubrics.map((r) => ({ id: r.id, name: `${r.name} (${Number(r.maxScore)})${r.isGlobal ? ' — عام' : ''}` }))
  }
}
