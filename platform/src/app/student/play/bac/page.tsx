import { Archive } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ExamCard } from '@/components/play/exams/exam-list'
import { PlaySectionShell } from '@/components/play/exams/page-shell'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isIosStudyOnly } from '@/server/lib/ios-study'
import { streamName, subjectName } from '@/server/play/constants'
import { getPlayAccess } from '@/server/services/play-access.service'
import { listExamSets } from '@/server/services/play-exams.service'
import { getPlayProfile, listSubjectsFor } from '@/server/services/play.service'

export const dynamic = 'force-dynamic'

/** القسم الثالث: البكالوريا — السنة ← (شعبة التلميذ) ← المادة ← الموضوع الأول/الثاني */
export default async function PlayBacPage({ searchParams }: { searchParams: Promise<{ subject?: string | string[] }> }) {
  const actor = await requirePageActor('STUDENT')
  const db = await getDb()
  const profile = await getPlayProfile(db, actor)
  if (!profile.gradeCode) redirect('/student/play/setup')
  const subjects = await listSubjectsFor(db, profile.gradeCode, profile.streamCode)
  const { subject } = await searchParams
  const wanted = typeof subject === 'string' ? subject.toUpperCase() : null
  const subjectCode = (wanted && subjects.some((s) => s.code === wanted) ? wanted : null) ?? subjects.find((s) => s.code === 'AR')?.code ?? subjects[0]?.code ?? 'AR'
  const is3AS = profile.gradeCode === '3AS'
  const [list, access, ios] = await Promise.all([
    is3AS ? listExamSets(db, actor, { subjectCode, kind: 'BAC' }) : Promise.resolve({ items: [] }),
    getPlayAccess(db, actor, { gradeCode: profile.gradeCode, streamCode: profile.streamCode, subjectCode }),
    isIosStudyOnly()
  ])
  const years = [...new Set(list.items.map((i) => i.year ?? 0))].sort((a, b) => b - a)
  return (
    <PlaySectionShell section="bac" subjectCode={subjectCode} access={access} iosStudyOnly={ios}>
      <h1 className="text-[1.5rem] font-extrabold text-[#1B4DB1]">البكالوريا</h1>
      <p className="mt-1 text-sm font-medium text-[#3B4C6B]">
        {is3AS ? `مواضيع ${subjectName(subjectCode)} لشعبة ${streamName(profile.streamCode)}: تدريب خطوة بخطوة أو محاكاة بنتيجة من 20.` : 'قسم البكالوريا مخصّص لتلاميذ السنة الثالثة ثانوي.'}
      </p>
      {is3AS ? (
        <nav className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="المادة">
          {subjects.map((s) => (
            <Link key={s.code} href={`/student/play/bac?subject=${s.code}`} aria-current={s.code === subjectCode ? 'page' : undefined} className={s.code === subjectCode ? 'shrink-0 rounded-full bg-[#1457C5] px-4 py-2 text-sm font-extrabold text-white' : 'shrink-0 rounded-full border border-[#C9D7EE] bg-white px-4 py-2 text-sm font-bold text-[#172B50]'}>
              {s.nameAr}
            </Link>
          ))}
        </nav>
      ) : null}
      <div className="mt-5 space-y-6">
        {years.map((y) => (
          <section key={y} aria-labelledby={`bac-${y}`}>
            <h2 id={`bac-${y}`} className="mb-3 text-[1.1rem] font-extrabold text-[#1B4DB1]">
              بكالوريا {y || '—'}
            </h2>
            <div className="space-y-3">
              {list.items
                .filter((i) => (i.year ?? 0) === y)
                .map((i) => (
                  <div key={i.id}>
                    <p className="mb-1.5 text-sm font-bold text-[#5B6B88]">{i.paper === 2 ? 'الموضوع الثاني' : 'الموضوع الأول'}</p>
                    <ExamCard item={i} canPlay={access.canPlay} />
                  </div>
                ))}
            </div>
          </section>
        ))}
        {is3AS && !list.items.length ? (
          <p className="rounded-2xl border border-dashed border-[#C9D7EE] bg-white/70 p-4 text-sm font-medium text-[#5B6B88]">
            لا توجد بعد مواضيع بكالوريا معتمدة في {subjectName(subjectCode)} لشعبتك. تُضاف المواضيع بعد تحويلها ومراجعة تصحيحها.
          </p>
        ) : null}
        <Link href="/student/past-bac" className="flex min-h-12 items-center gap-3 rounded-2xl border border-[#D3E0F5] bg-white px-4 py-3 text-sm font-extrabold text-[#1457C5]">
          <Archive className="size-5" aria-hidden /> أرشيف مواضيع البكالوريا الأصلية (PDF)
        </Link>
      </div>
    </PlaySectionShell>
  )
}
