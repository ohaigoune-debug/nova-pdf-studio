import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PlaySectionShell } from '@/components/play/exams/page-shell'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isIosStudyOnly } from '@/server/lib/ios-study'
import { getPlayAccess } from '@/server/services/play-access.service'
import { getExamProgress } from '@/server/services/play-exams.service'
import { getPlayDashboard } from '@/server/services/play.service'

export const dynamic = 'force-dynamic'

const KIND = { TEST: 'الاختبارات', DEVOIR: 'الفروض', BAC: 'البكالوريا' } as const
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''))

/** القسم الرابع: نتائجي وتقدمي — مراجعة الدروس + الفروض والاختبارات والبكالوريا + المهارات */
export default async function PlayResultsPage() {
  const actor = await requirePageActor('STUDENT')
  const db = await getDb()
  const dash = await getPlayDashboard(db, actor)
  if (!dash.profile.gradeCode) redirect('/student/play/setup')
  const [progress, access, ios] = await Promise.all([getExamProgress(db, actor), getPlayAccess(db, actor, { gradeCode: dash.profile.gradeCode, streamCode: dash.profile.streamCode, subjectCode: null }), isIosStudyOnly()])
  const weakest = progress.skills.filter((s) => s.answered >= 1).slice(0, 5)
  const strongest = [...progress.skills].filter((s) => s.answered >= 2).sort((a, b) => b.pct - a.pct).slice(0, 3)
  return (
    <PlaySectionShell section="results" subjectCode={null} access={access} iosStudyOnly={ios}>
      <h1 className="text-[1.5rem] font-extrabold text-[#1B4DB1]">نتائجي وتقدمي</h1>

      <section className="mt-4 grid grid-cols-3 gap-3" aria-label="ملخص">
        {(['TEST', 'DEVOIR', 'BAC'] as const).map((k) => {
          const b = progress.byKind.find((x) => x.kind === k)
          return (
            <div key={k} className="rounded-2xl border border-[#D3E0F5] bg-white p-3 text-center" data-testid={`progress-${k}`}>
              <p className="text-xs font-bold text-[#5B6B88]">{KIND[k]}</p>
              <p className="mt-1 text-[1.4rem] font-black text-[#1457C5]">{b?.avgPct === null || b?.avgPct === undefined ? '—' : `${b.avgPct}%`}</p>
              <p className="text-[0.7rem] font-bold text-[#3B4C6B]">{b?.completed ?? 0} منتهية</p>
            </div>
          )
        })}
      </section>

      <section className="mt-5 rounded-2xl border border-[#D3E0F5] bg-white p-4" aria-labelledby="lessons-progress">
        <h2 id="lessons-progress" className="text-[1rem] font-extrabold text-[#1B4DB1]">مراجعة الدروس</h2>
        <p className="mt-1 text-sm font-bold text-[#3B4C6B]">
          {dash.stats.answeredTotal} سؤالًا مجابًا · دقّة {dash.stats.answeredTotal ? Math.round((dash.stats.correctTotal / dash.stats.answeredTotal) * 100) : 0}% · {dash.stats.lessonsMastered} درسًا متقنًا · <bdi dir="ltr">{dash.stats.xpTotal} XP</bdi>
        </p>
        <ul className="mt-3 space-y-2">
          {dash.subjects
            .filter((s) => s.answered > 0)
            .map((s) => (
              <li key={s.code} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-sm font-bold text-[#172B50]">{s.nameAr}</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#E3EBF8]">
                  <span className="block h-full rounded-full bg-[#1457C5]" style={{ width: `${Math.round((s.correct / Math.max(1, s.answered)) * 100)}%` }} />
                </span>
                <span className="w-16 text-end text-xs font-extrabold text-[#1457C5]">
                  {Math.round((s.correct / Math.max(1, s.answered)) * 100)}% <span className="font-medium text-[#5B6B88]">({s.answered})</span>
                </span>
              </li>
            ))}
        </ul>
        {!dash.subjects.some((s) => s.answered > 0) ? <p className="mt-2 text-sm text-[#5B6B88]">لم تراجع أي درس بعد.</p> : null}
      </section>

      {weakest.length ? (
        <section className="mt-5 rounded-2xl border border-[#D3E0F5] bg-white p-4" aria-labelledby="skills">
          <h2 id="skills" className="text-[1rem] font-extrabold text-[#1B4DB1]">مهارات تحتاج تدريبًا</h2>
          <ul className="mt-3 space-y-2" data-testid="skills-weak">
            {weakest.map((s) => (
              <li key={s.id} className="flex items-center gap-3">
                <span className="w-36 shrink-0 text-sm font-bold text-[#172B50]">{s.label}</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#F5E3E3]">
                  <span className="block h-full rounded-full bg-[#DC6B6B]" style={{ width: `${s.pct}%` }} />
                </span>
                <span className="w-12 text-end text-xs font-extrabold text-[#7C2D12]">{s.pct}%</span>
              </li>
            ))}
          </ul>
          {strongest.length ? <p className="mt-3 text-xs font-bold text-[#15803D]">نقاط قوتك: {strongest.map((s) => s.label).join('، ')}</p> : null}
        </section>
      ) : null}

      <section className="mt-5 rounded-2xl border border-[#D3E0F5] bg-white p-4" aria-labelledby="attempts">
        <h2 id="attempts" className="text-[1rem] font-extrabold text-[#1B4DB1]">محاولاتي في الفروض والاختبارات والبكالوريا</h2>
        {progress.attempts.length ? (
          <ul className="mt-3 divide-y divide-[#E3EBF8]">
            {progress.attempts.map((a) => (
              <li key={a.id} className="py-2.5">
                <Link href={a.status === 'COMPLETED' ? `/student/play/exam/${a.id}/result` : `/student/play/exam/${a.id}`} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-[#172B50]">{a.title}</span>
                    <span className="block text-[0.72rem] font-medium text-[#5B6B88]">
                      {a.mode === 'PRACTICE' ? 'تدريب' : 'محاكاة'} · {a.status === 'COMPLETED' ? 'منتهية' : a.status === 'ACTIVE' ? `جارية (${a.answered})` : 'متروكة'} · {new Date(a.startedAt).toLocaleDateString('ar-DZ')}
                    </span>
                  </span>
                  <span className="text-sm font-extrabold text-[#1457C5]">
                    <bdi dir="ltr">
                      {a.mode === 'EXAM' && a.status !== 'COMPLETED' ? '…' : fmt(a.score)} / {fmt(a.max)}
                    </bdi>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-[#5B6B88]">لا محاولات بعد. ابدأ من «الفروض والاختبارات» أو «البكالوريا».</p>
        )}
      </section>
    </PlaySectionShell>
  )
}
