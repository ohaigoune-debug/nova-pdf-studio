import { notFound, redirect } from 'next/navigation'
import { SubjectView } from '@/components/play/subject-view'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { getPlayProfile, listLessonsFor, listSubjectsFor } from '@/server/services/play.service'

export const dynamic = 'force-dynamic'

export default async function PlaySubjectPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const actor = await requirePageActor('STUDENT')
  const db = await getDb()
  const profile = await getPlayProfile(db, actor)
  if (!profile.gradeCode) redirect('/student/play/setup')
  const subjects = await listSubjectsFor(db, profile.gradeCode, profile.streamCode)
  const subject = subjects.find((s) => s.code === code.toUpperCase())
  if (!subject) notFound()
  const units = await listLessonsFor(db, profile.gradeCode, profile.streamCode, subject.code, actor.studentId ?? undefined)
  return <SubjectView subject={subject} units={units} />
}
