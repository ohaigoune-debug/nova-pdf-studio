import Link from 'next/link'
import { redirect } from 'next/navigation'
import { TestsByTerm } from '@/components/play/exams/exam-list'
import { PlaySectionShell } from '@/components/play/exams/page-shell'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isIosStudyOnly } from '@/server/lib/ios-study'
import { subjectName } from '@/server/play/constants'
import { getPlayAccess } from '@/server/services/play-access.service'
import { listExamSets } from '@/server/services/play-exams.service'
import { getPlayProfile, listSubjectsFor } from '@/server/services/play.service'

export const dynamic = 'force-dynamic'

/** القسم الثاني: الفروض والاختبارات حسب الفصل (03_PRODUCT_BLUEPRINT) */
export default async function PlayExamsPage({ searchParams }: { searchParams: Promise<{ subject?: string | string[] }> }) {
  const actor = await requirePageActor('STUDENT')
  const db = await getDb()
  const profile = await getPlayProfile(db, actor)
  if (!profile.gradeCode) redirect('/student/play/setup')
  const subjects = await listSubjectsFor(db, profile.gradeCode, profile.streamCode)
  const { subject } = await searchParams
  const wanted = typeof subject === 'string' ? subject.toUpperCase() : null
  const subjectCode = (wanted && subjects.some((s) => s.code === wanted) ? wanted : null) ?? subjects.find((s) => s.code === 'AR')?.code ?? subjects[0]?.code ?? 'AR'
  const [list, access, ios] = await Promise.all([
    listExamSets(db, actor, { subjectCode, kind: 'TESTS' }),
    getPlayAccess(db, actor, { gradeCode: profile.gradeCode, streamCode: profile.streamCode, subjectCode }),
    isIosStudyOnly()
  ])
  return (
    <PlaySectionShell section="tests" subjectCode={subjectCode} access={access} iosStudyOnly={ios}>
      <h1 className="text-[1.5rem] font-extrabold text-[#1B4DB1]">الفروض والاختبارات</h1>
      <p className="mt-1 text-sm font-medium text-[#3B4C6B]">مواضيع حقيقية بتصحيحها النموذجي وسلّم تنقيطها، مفكّكة إلى أسئلة تفاعلية.</p>
      <nav className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="المادة">
        {subjects.map((s) => (
          <Link key={s.code} href={`/student/play/exams?subject=${s.code}`} aria-current={s.code === subjectCode ? 'page' : undefined} className={s.code === subjectCode ? 'shrink-0 rounded-full bg-[#1457C5] px-4 py-2 text-sm font-extrabold text-white' : 'shrink-0 rounded-full border border-[#C9D7EE] bg-white px-4 py-2 text-sm font-bold text-[#172B50]'}>
            {s.nameAr}
          </Link>
        ))}
      </nav>
      <div className="mt-5">
        {list.items.length ? (
          <TestsByTerm items={list.items} canPlay={access.canPlay} />
        ) : (
          <p className="rounded-2xl border border-dashed border-[#C9D7EE] bg-white/70 p-4 text-sm font-medium text-[#5B6B88]">
            لا توجد بعد فروض أو اختبارات معتمدة في {subjectName(subjectCode)} لمستواك. تُضاف المواضيع بعد مراجعة الأستاذ لها.
          </p>
        )}
      </div>
    </PlaySectionShell>
  )
}
