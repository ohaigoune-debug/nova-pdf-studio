import { BarChart3, BookTemplate, FileText, Library, Plus, Printer, Wand2 } from 'lucide-react'
import Link from 'next/link'
import { ExamListActions } from '@/components/domain/exam-list-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { EmptyState, PageHeader, StatCard } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn, formatDate } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { EXAM_KINDS, type ExamKind } from '@/server/db/schema/enums'
import { bankFormOptions } from '@/server/queries/bank-options'
import { EXAM_KIND_AR, listExams, workspaceStats, type ExamScope } from '@/server/services/exams.service'
import { listGroups } from '@/server/services/groups.service'
import { bankStats } from '@/server/services/question-bank.service'

export const dynamic = 'force-dynamic'

const TABS: { key: ExamScope; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'draft', label: 'المسودات' },
  { key: 'ready', label: 'الجاهزة' },
  { key: 'templates', label: 'قوالبي' },
  { key: 'favorites', label: 'المفضّلة' },
  { key: 'archived', label: 'الأرشيف' }
]

type Q = { tab?: string; subject?: string; level?: string; kind?: string; group?: string; q?: string }

/** ورشة الأستاذ (المرحلة 6): امتحاناتي، قوالبي، الأرشيف، مع فلاتر وإحصاءات سريعة */
export default async function ExamsPage({ searchParams }: { searchParams: Promise<Q> }) {
  const actor = await requirePageActor('TEACHER')
  const sp = await searchParams
  const scope = (TABS.some((t) => t.key === sp.tab) ? sp.tab : 'all') as ExamScope
  const kind = EXAM_KINDS.includes(sp.kind as ExamKind) ? (sp.kind as ExamKind) : null
  const db = await getDb()
  const [rows, stats, bank, opts, groups] = await Promise.all([
    listExams(db, actor, { scope, subjectId: sp.subject || null, levelId: sp.level || null, kind, groupId: sp.group || null, q: sp.q || null }),
    workspaceStats(db, actor),
    bankStats(db, actor),
    bankFormOptions(db, actor),
    listGroups(db, actor)
  ])
  const href = (patch: Partial<Q>) => {
    const p = new URLSearchParams()
    const next = { ...sp, ...patch }
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v)
    const s = p.toString()
    return `/teacher/exams${s ? `?${s}` : ''}`
  }
  const filtered = Boolean(sp.subject || sp.level || sp.kind || sp.group || sp.q)
  return (
    <>
      <PageHeader
        title="ورشة الامتحانات"
        description="امتحاناتك وقوالبك وطباعاتك في مكان واحد — تُبنى من بنك الأسئلة في دقائق."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/teacher/exams/stats">
                <BarChart3 className="size-4" /> الإحصاءات
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/teacher/exams/templates">
                <BookTemplate className="size-4" /> القوالب
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/teacher/exams/generate">
                <Wand2 className="size-4" /> ابنِ لي الامتحان
              </Link>
            </Button>
            <Button asChild>
              <Link href="/teacher/exams/new">
                <Plus className="size-4" /> امتحان جديد
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatCard label="الامتحانات" value={stats.exams.total} hint={`${stats.exams.ready} جاهز · ${stats.exams.draft} مسودة`} icon={FileText} />
        <StatCard label="القوالب" value={stats.exams.templates} icon={BookTemplate} />
        <StatCard label="طباعات هذا الشهر" value={stats.prints.month} hint={`الإجمالي ${stats.prints.total}`} icon={Printer} tone="success" />
        <Link href="/teacher/bank" className="contents">
          <StatCard label="أسئلتي في البنك" value={bank.mine} hint={`${bank.favorites} في المفضّلة`} icon={Library} />
        </Link>
        <Link href="/teacher/bank?scope=review" className="contents">
          <StatCard label="بانتظار المراجعة" value={bank.review} icon={Library} tone={bank.review ? 'warning' : 'default'} />
        </Link>
      </div>

      <nav className="mb-4 flex flex-wrap gap-1 rounded-lg bg-muted p-1" aria-label="نطاق القائمة">
        {TABS.map((t) => (
          <Link key={t.key} href={href({ tab: t.key })} className={cn('rounded-md px-3 py-1.5 text-sm font-semibold', scope === t.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')} aria-current={scope === t.key ? 'page' : undefined}>
            {t.label}
            {t.key === 'templates' && stats.exams.templates ? ` (${stats.exams.templates})` : t.key === 'archived' && stats.exams.archived ? ` (${stats.exams.archived})` : ''}
          </Link>
        ))}
      </nav>

      <form method="get" action="/teacher/exams" className="mb-4 grid gap-2 rounded-lg border bg-card p-3 text-sm sm:grid-cols-2 lg:grid-cols-6">
        <input type="hidden" name="tab" value={scope} />
        <Input name="q" defaultValue={sp.q ?? ''} placeholder="بحث في العناوين…" aria-label="بحث" />
        <Select name="subject" defaultValue={sp.subject ?? ''} aria-label="المادة">
          <option value="">كل المواد</option>
          {opts.subjects.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
        <Select name="level" defaultValue={sp.level ?? ''} aria-label="الصف">
          <option value="">كل الصفوف</option>
          {opts.levels.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
        <Select name="kind" defaultValue={sp.kind ?? ''} aria-label="النوع">
          <option value="">كل الأنواع</option>
          {Object.entries(EXAM_KIND_AR).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Select name="group" defaultValue={sp.group ?? ''} aria-label="الفوج">
          <option value="">كل الأفواج</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
        <div className="flex gap-2">
          <Button type="submit" variant="outline" className="flex-1">
            تصفية
          </Button>
          {filtered ? (
            <Button asChild variant="ghost">
              <Link href={href({ subject: '', level: '', kind: '', group: '', q: '' })}>مسح</Link>
            </Button>
          ) : null}
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={scope === 'templates' ? BookTemplate : FileText}
          title={scope === 'templates' ? 'لا قوالب بعد' : scope === 'archived' ? 'الأرشيف فارغ' : filtered ? 'لا نتائج بهذه التصفية' : 'لا امتحانات بعد'}
          description={scope === 'templates' ? 'افتح امتحاناً واختر «قالب» في إعداداته، أو اضغط أيقونة القالب في القائمة؛ ثم أنشئ منه امتحانات جديدة بضغطة.' : 'أنشئ امتحاناً، ثم اسحب الأسئلة من البنك إلى الورقة، أو دع المنصّة تبنيه لك.'}
          action={
            scope === 'templates' || scope === 'archived' ? undefined : (
              <Button asChild>
                <Link href="/teacher/exams/generate">ابنِ لي الامتحان</Link>
              </Button>
            )
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>العنوان</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>التصنيف</TableHead>
              <TableHead>الفوج</TableHead>
              <TableHead>العناصر</TableHead>
              <TableHead>النقاط</TableHead>
              <TableHead>طُبع</TableHead>
              <TableHead>آخر تعديل</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link href={`/teacher/exams/${r.id}`} className="font-semibold hover:underline">
                    {r.title}
                  </Link>{' '}
                  {r.isTemplate ? <Badge variant="secondary">قالب</Badge> : r.status === 'ARCHIVED' ? <Badge variant="muted">مؤرشف</Badge> : r.status === 'READY' ? <Badge variant="success">جاهز</Badge> : <Badge variant="secondary">مسودة</Badge>}
                </TableCell>
                <TableCell>
                  {EXAM_KIND_AR[r.kind as ExamKind] ?? r.kind}
                  {r.schoolTerm ? ` · الفصل ${r.schoolTerm}` : ''}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{[r.subjectName, r.levelName, r.streamName].filter(Boolean).join(' · ') || '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.groupName ?? '—'}</TableCell>
                <TableCell className="tabular">{r.items}</TableCell>
                <TableCell className="tabular">
                  {Number(r.totalPoints)} / {Number(r.targetPoints)}
                </TableCell>
                <TableCell className="tabular text-xs text-muted-foreground" title={r.lastPrintedAt ? `آخر طباعة ${formatDate(r.lastPrintedAt)}` : undefined}>
                  {r.printCount || '—'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(r.updatedAt)}</TableCell>
                <TableCell>
                  <ExamListActions id={r.id} isTemplate={r.isTemplate} archived={r.status === 'ARCHIVED'} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
