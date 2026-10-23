import { AlertTriangle, BookOpenCheck, CheckCircle2, Copy, Flag, Gamepad2, Layers, ListChecks, MessageSquareWarning, PauseCircle, Settings2, Users } from 'lucide-react'
import Link from 'next/link'
import { DIFFICULTY_AR, STATUS_AR, STATUS_VARIANT, TYPE_AR } from '@/components/play-admin/labels'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader, Progress, StatCard } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { PLAY_REVIEW_STATUSES, gradeByCode, subjectName } from '@/server/play/constants'
import { coverageMatrix, duplicateGroups, hardestQuestions, lessonsLackingQuestions, playAdminOverview } from '@/server/services/play-admin.service'

export const dynamic = 'force-dynamic'

/** Admin → MADRASADZ PLAY: نظرة عامة على بنك الأسئلة والبلاغات والتغطية والنشاط */
export default async function PlayAdminPage() {
  const actor = await requirePageActor('SUPER_ADMIN')
  const db = await getDb()
  const [ov, coverage, lacking, hardest, dups] = await Promise.all([playAdminOverview(db, actor), coverageMatrix(db, actor), lessonsLackingQuestions(db, actor, 3, 40), hardestQuestions(db, actor, 10), duplicateGroups(db, actor, 50)])
  const lessons = coverage.reduce((a, c) => a + c.lessons, 0)
  const covered = coverage.reduce((a, c) => a + c.lessonsWithQuestions, 0)
  const coveragePct = lessons ? Math.round((100 * covered) / lessons) : 0
  const needsReview = (ov.byStatus.NEEDS_REVIEW ?? 0) + (ov.byStatus.DRAFT ?? 0)
  const servable = (ov.byStatus.AUTO_VALIDATED ?? 0) + (ov.byStatus.APPROVED ?? 0) + (ov.byStatus.PUBLISHED ?? 0)
  const links = [
    { href: '/admin/play/questions', label: 'بنك الأسئلة', hint: 'تصفية، مراجعة جماعية، تصدير', icon: ListChecks },
    { href: '/admin/play/reports', label: 'البلاغات', hint: `${ov.openReports} بلاغاً مفتوحاً`, icon: Flag },
    { href: '/admin/play/coverage', label: 'تغطية المنهاج', hint: `${coveragePct}% من الدروس لها أسئلة`, icon: Layers },
    { href: '/admin/play/settings', label: 'قواعد اللعبة', hint: 'XP، المستويات، الإتقان، الحالات المقدَّمة', icon: Settings2 }
  ]
  return (
    <>
      <PageHeader
        title="MADRASADZ PLAY"
        description="لوحة إدارة بنك الألعاب التعليمية: مراجعة الأسئلة واعتمادها، معالجة بلاغات التلاميذ، مراقبة تغطية المنهاج، وضبط قواعد النقاط."
        actions={
          <Link href="/admin/play/questions/new" className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">
            <Gamepad2 className="size-4" /> سؤال جديد
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="إجمالي الأسئلة" value={ov.total} hint={`${servable} قابلة للعرض على التلاميذ`} icon={ListChecks} />
        <StatCard label="بانتظار المراجعة" value={needsReview} hint={`${ov.byStatus.NEEDS_REVIEW ?? 0} تحتاج مراجعة · ${ov.byStatus.DRAFT ?? 0} مسودة`} icon={AlertTriangle} tone={needsReview ? 'warning' : 'default'} />
        <StatCard label="بلاغات مفتوحة" value={ov.openReports} icon={MessageSquareWarning} tone={ov.openReports ? 'destructive' : 'default'} />
        <StatCard label="أسئلة معلَّقة" value={ov.suspended} hint="لا تُعرض للتلاميذ مؤقتاً" icon={PauseCircle} tone={ov.suspended ? 'warning' : 'default'} />
        <StatCard label="اللاعبون" value={ov.players} icon={Users} tone="success" />
        <StatCard label="الجلسات" value={ov.sessions} icon={Gamepad2} />
        <StatCard label="الإجابات" value={ov.answers} icon={CheckCircle2} />
        <StatCard label="مجموعات مكرّرة" value={dups.length} hint={dups.length ? `${dups.reduce((a, d) => a + d.count, 0)} سؤالاً بنفس البصمة` : 'لا تكرار'} icon={Copy} tone={dups.length ? 'warning' : 'default'} />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="group rounded-lg border border-border/80 bg-card p-4 shadow-soft transition-colors hover:border-primary/50">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <l.icon className="size-5" />
              </span>
              <div>
                <p className="font-bold group-hover:text-primary">{l.label}</p>
                <p className="text-xs text-muted-foreground">{l.hint}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>حسب حالة المراجعة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {PLAY_REVIEW_STATUSES.map((s) => (
              <Link key={s} href={`/admin/play/questions?status=${s}`} className="flex items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-muted">
                <Badge variant={STATUS_VARIANT[s]}>{STATUS_AR[s]}</Badge>
                <span className="tabular font-bold">{ov.byStatus[s] ?? 0}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>حسب السنة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.keys(ov.byGrade).length === 0 ? <p className="text-sm text-muted-foreground">لا أسئلة بعد.</p> : null}
            {Object.entries(ov.byGrade)
              .sort((a, b) => (gradeByCode(a[0])?.sortOrder ?? 99) - (gradeByCode(b[0])?.sortOrder ?? 99))
              .map(([g, n]) => (
                <Link key={g} href={`/admin/play/questions?grade=${g}`} className="flex items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-muted">
                  <span>{gradeByCode(g)?.nameAr ?? g}</span>
                  <span className="tabular font-bold">{n}</span>
                </Link>
              ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>حسب النوع والصعوبة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {Object.entries(ov.byType).map(([t, n]) => (
                <Link key={t} href={`/admin/play/questions?type=${t}`}>
                  <Badge variant="secondary">
                    {(TYPE_AR as Record<string, string>)[t] ?? t}: {n}
                  </Badge>
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(ov.byDifficulty).map(([d, n]) => (
                <Link key={d} href={`/admin/play/questions?difficulty=${d}`}>
                  <Badge variant={d === 'HARD' ? 'destructive' : d === 'MEDIUM' ? 'warning' : 'success'}>
                    {(DIFFICULTY_AR as Record<string, string>)[d] ?? d}: {n}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <BookOpenCheck className="size-5 text-primary" /> تغطية المنهاج
            </span>
            <span className="tabular text-2xl font-extrabold">{coveragePct}%</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={coveragePct} tone={coveragePct >= 80 ? 'success' : coveragePct >= 40 ? 'primary' : 'warning'} className="h-3" />
          <p className="text-xs text-muted-foreground">
            {covered} درساً من {lessons} له سؤال واحد على الأقل · {coverage.length} خلية (سنة × مادة) ·{' '}
            <Link href="/admin/play/coverage" className="underline">
              المصفوفة الكاملة
            </Link>
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="p-1.5 text-start">السنة</th>
                  <th className="p-1.5 text-start">المادة</th>
                  <th className="p-1.5 tabular">الدروس</th>
                  <th className="p-1.5 tabular">بلا أسئلة</th>
                  <th className="p-1.5 tabular">الأسئلة</th>
                  <th className="p-1.5 w-40">التغطية</th>
                </tr>
              </thead>
              <tbody>
                {coverage.slice(0, 12).map((c) => {
                  const pct = c.lessons ? Math.round((100 * c.lessonsWithQuestions) / c.lessons) : 0
                  return (
                    <tr key={`${c.gradeCode}-${c.subjectCode}`} className="border-b">
                      <td className="p-1.5">{gradeByCode(c.gradeCode)?.shortAr ?? c.gradeCode}</td>
                      <td className="p-1.5">
                        <Link href={`/admin/play/questions?grade=${c.gradeCode}&subject=${c.subjectCode}`} className="hover:underline">
                          {c.subjectName}
                        </Link>
                      </td>
                      <td className="p-1.5 text-center tabular">{c.lessons}</td>
                      <td className="p-1.5 text-center tabular">{c.lessons - c.lessonsWithQuestions ? <span className="font-bold text-destructive">{c.lessons - c.lessonsWithQuestions}</span> : <span className="text-success">0</span>}</td>
                      <td className="p-1.5 text-center tabular">{c.questions}</td>
                      <td className="p-1.5">
                        <div className="flex items-center gap-2">
                          <Progress value={pct} tone={pct >= 80 ? 'success' : pct >= 40 ? 'primary' : 'warning'} />
                          <span className="w-9 tabular text-end">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              دروس تفتقر إلى أسئلة <Badge variant="muted">أقل من 3</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {lacking.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">كل الدروس النشطة لها 3 أسئلة على الأقل.</p>
            ) : (
              <ul className="max-h-96 divide-y overflow-auto text-sm">
                {lacking.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2 px-4 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{l.lessonName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {gradeByCode(l.gradeCode)?.shortAr ?? l.gradeCode} · {subjectName(l.subjectCode)} · {l.unitName}
                        {l.streamCodes.length ? ` · ${l.streamCodes.join('، ')}` : ''}
                      </p>
                    </div>
                    <Badge variant={l.questions === 0 ? 'destructive' : 'warning'}>{l.questions}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              الأسئلة الأكثر خطأً <Badge variant="muted">بعد 10 عرضات</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {hardest.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">لا توجد بيانات كافية بعد (يلزم 10 إجابات على السؤال).</p>
            ) : (
              <ul className="max-h-96 divide-y overflow-auto text-sm">
                {hardest.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-2 px-4 py-2">
                    <div className="min-w-0">
                      <Link href={`/admin/play/questions/${h.id}`} className="block truncate font-semibold hover:underline">
                        {h.questionText}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {h.key} · {h.timesCorrect} صحيحة / {h.timesWrong} خاطئة
                      </p>
                    </div>
                    <Badge variant="destructive">{h.wrongRate}% خطأ</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
