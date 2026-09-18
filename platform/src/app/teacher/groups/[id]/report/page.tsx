import { notFound } from 'next/navigation'
import { PrintButton } from '@/components/domain/print-button'
import { t, tEnum } from '@/i18n'
import { formatDateTime, percent } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { groupGradeAverages } from '@/server/queries/teacher-extras.queries'
import { getGroupDetail, listGroupMembers } from '@/server/services/groups.service'
import { groupWeakSkills } from '@/server/services/skills.service'

/** تقرير فوج قابل للطباعة: حضور كل طالب، متوسط علاماته، والمهارات الضعيفة المشتركة */
export default async function GroupReportPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('TEACHER')
  const { id } = await params
  const db = await getDb()
  let g
  try {
    g = await getGroupDetail(db, actor, id)
  } catch (e) {
    if (isAppError(e)) notFound()
    throw e
  }
  const [members, averages, weak] = await Promise.all([listGroupMembers(db, actor, g.id), groupGradeAverages(db, actor, g.id), groupWeakSkills(db, g.id)])
  const active = members.filter((m) => m.status !== 'LEFT_GROUP' && m.status !== 'INACTIVE')
  const rates = active.map((m) => m.attendanceRate).filter((r): r is number => r !== null)
  const groupRate = rates.length ? Math.round(rates.reduce((s, r) => s + r, 0) / rates.length) : null
  return (
    <article className="mx-auto max-w-4xl space-y-6 bg-white p-6 text-black print:p-0" dir="rtl">
      <header className="flex items-start justify-between border-b-2 border-black pb-3">
        <div>
          <h1 className="text-2xl font-extrabold">
            {t('printReport.groupTitle')}: {g.name}
          </h1>
          <p className="text-sm">
            {[g.levelName, g.streamName, g.schoolName].filter(Boolean).join(' · ')} · {t('printReport.teacher')}: {actor.fullName} · {t('printReport.generatedAt')} {formatDateTime(new Date())}
          </p>
          <p className="text-sm">
            {t('groups.active')}: {active.length} · {t('groups.attendanceRate')}: {percent(groupRate)}
          </p>
        </div>
        <PrintButton />
      </header>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="py-1 text-start">#</th>
            <th className="py-1 text-start">{t('common.name')}</th>
            <th className="py-1 text-start">{t('common.status')}</th>
            <th className="py-1 text-start">{t('attendanceStatus.PRESENT')}</th>
            <th className="py-1 text-start">{t('attendanceStatus.LATE')}</th>
            <th className="py-1 text-start">{t('attendanceStatus.UNEXCUSED')}</th>
            <th className="py-1 text-start">{t('groups.attendanceRate')}</th>
            <th className="py-1 text-start">{t('groups.averageScore')}</th>
          </tr>
        </thead>
        <tbody>
          {active.map((m, i) => {
            const a = averages.get(m.studentId)
            return (
              <tr key={m.studentId} className="border-b border-dashed">
                <td className="py-1 tabular">{i + 1}</td>
                <td className="py-1 font-semibold">{m.fullName}</td>
                <td className="py-1">{tEnum('enrollmentStatus', m.status)}</td>
                <td className="py-1 tabular">{m.presentCount}</td>
                <td className="py-1 tabular">{m.lateCount}</td>
                <td className="py-1 tabular">{m.unexcusedAbsences}</td>
                <td className="py-1 tabular">{percent(m.attendanceRate)}</td>
                <td className="py-1 tabular">{a ? `${a.avg}/20 (${a.count})` : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {weak.length ? (
        <section>
          <h2 className="mb-2 border-b font-extrabold">{t('skills.groupWeak')}</h2>
          <ul className="space-y-1 text-sm">
            {weak.map((w) => (
              <li key={w.skillId}>
                <b>{w.name}</b>: {w.weakCount} من {w.assessed} طلاب (متوسط {w.average}%) — {w.students.join('، ')}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="pt-8 text-sm">
        <div className="w-64 border-t border-black pt-1">{t('printReport.signature')}</div>
      </footer>
    </article>
  )
}
