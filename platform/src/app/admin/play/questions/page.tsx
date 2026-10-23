import { Download, Plus, Search } from 'lucide-react'
import Link from 'next/link'
import { filterToQuery, parseFilter, parsePage, type RawQuery } from '@/components/play-admin/filter-params'
import { DIFFICULTY_AR, STATUS_AR, TYPE_AR } from '@/components/play-admin/labels'
import { QuestionsTable } from '@/components/play-admin/questions-table'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { PLAY_DIFFICULTIES, PLAY_GRADES, PLAY_QUESTION_TYPES, PLAY_REVIEW_STATUSES, PLAY_STREAMS, PLAY_SUBJECTS, gradeByCode, subjectName } from '@/server/play/constants'
import { listQuestionsAdmin } from '@/server/services/play-admin.service'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

/** Admin → PLAY → بنك الأسئلة: تصفية من العنوان، ترقيم 50، إجراءات جماعية، تصدير JSON */
export default async function PlayQuestionsPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const actor = await requirePageActor('SUPER_ADMIN')
  const q = await searchParams
  const filter = parseFilter(q)
  const page = parsePage(q)
  const db = await getDb()
  const res = await listQuestionsAdmin(db, actor, { ...filter, page, pageSize: PAGE_SIZE })
  const pages = Math.max(1, Math.ceil(res.total / PAGE_SIZE))
  const rows = res.items.map((r) => ({
    id: r.id,
    key: r.key,
    type: r.type,
    gradeCode: r.gradeCode,
    gradeName: gradeByCode(r.gradeCode)?.shortAr ?? r.gradeCode,
    streamCodes: r.streamCodes,
    subjectName: subjectName(r.subjectCode),
    lessonName: r.lessonName,
    difficulty: r.difficulty,
    questionText: r.questionText,
    reviewStatus: r.reviewStatus,
    isSuspended: r.isSuspended,
    reportsCount: r.reportsCount,
    qualityFlags: r.qualityFlags,
    timesCorrect: r.timesCorrect,
    timesWrong: r.timesWrong
  }))
  const exportHref = `/admin/play/questions/export${filterToQuery(filter)}`
  const pageHref = (p: number) => `/admin/play/questions${filterToQuery(filter, p)}`

  return (
    <>
      <PageHeader
        title="بنك أسئلة PLAY"
        description={`${res.total} سؤالاً يطابق المرشّح. رتِّب بالمبلَّغ عنها أولاً ثم بالمفتاح.`}
        actions={
          <>
            <Button asChild variant="outline">
              <a href={exportHref} download>
                <Download className="size-4" /> تصدير JSON
              </a>
            </Button>
            <Button asChild>
              <Link href="/admin/play/questions/new">
                <Plus className="size-4" /> سؤال جديد
              </Link>
            </Button>
          </>
        }
      />

      <form method="get" action="/admin/play/questions" className="mb-4 grid grid-cols-2 gap-2 rounded-lg border bg-card p-3 sm:grid-cols-3 lg:grid-cols-6">
        <Select name="grade" defaultValue={filter.grade ?? ''} aria-label="السنة">
          <option value="">كل السنوات</option>
          {PLAY_GRADES.map((g) => (
            <option key={g.code} value={g.code}>
              {g.nameAr}
            </option>
          ))}
        </Select>
        <Select name="stream" defaultValue={filter.stream ?? ''} aria-label="الشعبة">
          <option value="">كل الشعب</option>
          {PLAY_STREAMS.map((s) => (
            <option key={s.code} value={s.code}>
              {s.nameAr}
            </option>
          ))}
        </Select>
        <Select name="subject" defaultValue={filter.subject ?? ''} aria-label="المادة">
          <option value="">كل المواد</option>
          {PLAY_SUBJECTS.map((s) => (
            <option key={s.code} value={s.code}>
              {s.nameAr}
            </option>
          ))}
        </Select>
        <Input name="unit" defaultValue={filter.unit ?? ''} placeholder="رمز الوحدة (U1)" dir="ltr" />
        <Select name="type" defaultValue={filter.type ?? ''} aria-label="النوع">
          <option value="">كل الأنواع</option>
          {PLAY_QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_AR[t]}
            </option>
          ))}
        </Select>
        <Select name="difficulty" defaultValue={filter.difficulty ?? ''} aria-label="الصعوبة">
          <option value="">كل الصعوبات</option>
          {PLAY_DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {DIFFICULTY_AR[d]}
            </option>
          ))}
        </Select>
        <Select name="status" defaultValue={filter.status ?? ''} aria-label="الحالة">
          <option value="">كل الحالات</option>
          {PLAY_REVIEW_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_AR[s]}
            </option>
          ))}
        </Select>
        <Input name="search" defaultValue={filter.search ?? ''} placeholder="بحث في النص أو المفتاح أو التفسير" className="col-span-2 sm:col-span-2 lg:col-span-3" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="suspended" value="1" defaultChecked={!!filter.suspended} className="size-4 accent-primary" /> معلَّقة فقط
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="reported" value="1" defaultChecked={!!filter.reported} className="size-4 accent-primary" /> مبلَّغ عنها فقط
        </label>
        <div className="col-span-2 flex gap-2 sm:col-span-3 lg:col-span-6">
          <Button type="submit">
            <Search className="size-4" /> تصفية
          </Button>
          <Button asChild variant="ghost">
            <Link href="/admin/play/questions">مسح المرشّح</Link>
          </Button>
        </div>
      </form>

      <QuestionsTable rows={rows} filter={filter} total={res.total} />

      {pages > 1 ? (
        <nav className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm" aria-label="ترقيم الصفحات">
          <span className="text-muted-foreground">
            صفحة {page} من {pages} · {res.total} سؤالاً
          </span>
          <div className="flex gap-1">
            {page > 1 ? (
              <Button asChild size="sm" variant="outline">
                <Link href={pageHref(page - 1)}>السابقة</Link>
              </Button>
            ) : null}
            {page < pages ? (
              <Button asChild size="sm" variant="outline">
                <Link href={pageHref(page + 1)}>التالية</Link>
              </Button>
            ) : null}
          </div>
        </nav>
      ) : null}
    </>
  )
}
