import { notFound } from 'next/navigation'
import { PrintButton } from '@/components/domain/print-button'
import { Progress } from '@/components/ui/misc'
import { t, tEnum } from '@/i18n'
import { formatDate, formatDateTime, percent } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { studentGradesForTeacher } from '@/server/queries/teacher-extras.queries'
import { skillMap } from '@/server/services/skills.service'
import { getStudentProfile } from '@/server/services/students.service'

/** بطاقة متابعة قابلة للطباعة (PDF من المتصفح) — بلا شريط جانبي في الطباعة */
export default async function StudentReportPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('TEACHER')
  const { id } = await params
  const db = await getDb()
  let p
  try {
    p = await getStudentProfile(db, actor, id)
  } catch (e) {
    if (isAppError(e)) notFound()
    throw e
  }
  const [skills, grades] = await Promise.all([skillMap(db, p.studentId), studentGradesForTeacher(db, actor, p.studentId)])
  const avg = grades.length ? Math.round((grades.reduce((s, g) => s + (Number(g.score) / Number(g.maxScore)) * 20, 0) / grades.length) * 10) / 10 : null
  const absences = p.recentAttendance.filter((a) => a.status === 'UNEXCUSED' || a.status === 'ABSENT' || a.status === 'EXCUSED').slice(0, 12)
  return (
    <article className="mx-auto max-w-3xl space-y-6 bg-white p-6 text-black print:p-0" dir="rtl">
      <header className="flex items-start justify-between border-b-2 border-black pb-3">
        <div>
          <h1 className="text-2xl font-extrabold">{t('printReport.studentTitle')}</h1>
          <p className="text-sm">
            {t('printReport.teacher')}: {actor.fullName} · {t('printReport.generatedAt')} {formatDateTime(new Date())}
          </p>
        </div>
        <PrintButton />
      </header>

      <section className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <p>
          <b>{t('common.name')}:</b> {p.fullName}
        </p>
        <p>
          <b>{t('common.level')}:</b> {[p.levelName, p.streamName].filter(Boolean).join(' · ') || '—'}
        </p>
        <p>
          <b>{t('common.phone')}:</b> {p.phone ?? '—'}
        </p>
        <p>
          <b>هاتف الولي:</b> {p.guardianPhone ?? '—'}
        </p>
        <p>
          <b>{t('common.groups')}:</b> {p.enrollments.map((e) => `${e.groupName} (${tEnum('enrollmentStatus', e.status)})`).join('، ') || '—'}
        </p>
        <p>
          <b>{t('common.school')}:</b> {p.schoolName ?? '—'}
        </p>
      </section>

      <section>
        <h2 className="mb-2 border-b font-extrabold">{t('teacherPages.attendanceSummary')}</h2>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b">
              <td className="py-1">{t('dashboard.attendanceRate')}</td>
              <td className="py-1 font-bold tabular">{percent(p.attendance.rate)}</td>
              <td className="py-1">{t('common.sessions')}</td>
              <td className="py-1 font-bold tabular">{p.attendance.total}</td>
            </tr>
            <tr className="border-b">
              <td className="py-1">{t('attendanceStatus.PRESENT')}</td>
              <td className="py-1 tabular">{p.attendance.present}</td>
              <td className="py-1">{t('attendanceStatus.LATE')}</td>
              <td className="py-1 tabular">{p.attendance.late}</td>
            </tr>
            <tr>
              <td className="py-1">{t('attendanceStatus.EXCUSED')}</td>
              <td className="py-1 tabular">{p.attendance.excused}</td>
              <td className="py-1">{t('attendanceStatus.UNEXCUSED')}</td>
              <td className="py-1 font-bold tabular">{p.attendance.unexcused}</td>
            </tr>
          </tbody>
        </table>
        {absences.length ? (
          <p className="mt-2 text-xs">
            <b>آخر الغيابات:</b> {absences.map((a) => `${formatDate(a.scheduledAt)} (${tEnum('attendanceStatus', a.status)})`).join('، ')}
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="mb-2 border-b font-extrabold">
          {t('nav.grades')} {avg !== null ? <span className="text-sm font-normal">— المتوسط {avg}/20 من {grades.length} تقييم</span> : null}
        </h2>
        {grades.length === 0 ? (
          <p className="text-sm">{t('common.empty')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-start">
                <th className="py-1 text-start">التقييم</th>
                <th className="py-1 text-start">النوع</th>
                <th className="py-1 text-start">العلامة</th>
                <th className="py-1 text-start">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {grades.map((g, i) => (
                <tr key={i} className="border-b border-dashed">
                  <td className="py-1">{g.title}</td>
                  <td className="py-1">{g.kind === 'QUIZ' ? 'اختبار' : 'واجب'}</td>
                  <td className="py-1 tabular">
                    {Number(g.score)}/{Number(g.maxScore)}
                  </td>
                  <td className="py-1 tabular">{formatDate(g.approvedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="mb-2 border-b font-extrabold">{t('skills.title')}</h2>
        {skills.length === 0 ? (
          <p className="text-sm">{t('skills.empty')}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {skills.map((s) => (
              <li key={s.skillId}>
                <div className="flex justify-between">
                  <span>{s.name}</span>
                  <span className="tabular">{Math.round(s.score)}%</span>
                </div>
                <Progress value={s.score} tone={s.score < 60 ? 'warning' : 'success'} className="h-1.5" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="grid grid-cols-2 gap-6 pt-8 text-sm">
        <div className="border-t border-black pt-1">{t('printReport.signature')}</div>
        <div className="border-t border-black pt-1">{t('printReport.guardianSignature')}</div>
      </footer>
    </article>
  )
}
