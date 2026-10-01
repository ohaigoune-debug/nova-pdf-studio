import { FileUp, Plus, Search } from 'lucide-react'
import Link from 'next/link'
import { BankList } from '@/components/domain/bank-list'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { PageHeader, StatCard } from '@/components/ui/misc'
import { cn } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import type { BankExamKind, BankQuestionType } from '@/server/db/schema/enums'
import { bankFormOptions } from '@/server/queries/bank-options'
import { bankStats, listBankQuestions, type BankFilter } from '@/server/services/question-bank.service'

export const dynamic = 'force-dynamic'

type Q = { scope?: string; q?: string; subject?: string; level?: string; stream?: string; term?: string; type?: string; difficulty?: string; examKind?: string; year?: string; solution?: string; cursor?: string }

const SCOPES: { key: NonNullable<BankFilter['scope']>; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'mine', label: 'بنكي' },
  { key: 'central', label: 'بنك Madrasadz' },
  { key: 'public', label: 'المشترك' },
  { key: 'favorites', label: 'المفضّلة' },
  { key: 'review', label: 'للمراجعة' }
]

/** بنك الأسئلة: فلاتر كاملة في الرابط (قابلة للمشاركة والعودة)، قائمة بترقيم بالمؤشّر */
export default async function BankPage({ searchParams }: { searchParams: Promise<Q> }) {
  const actor = await requirePageActor('TEACHER')
  const db = await getDb()
  const q = await searchParams
  const scope = (SCOPES.find((s) => s.key === q.scope)?.key ?? 'all') as BankFilter['scope']
  const filter: BankFilter = {
    scope,
    q: q.q,
    subjectId: q.subject,
    levelId: q.level,
    streamId: q.stream,
    schoolTerm: q.term ? Number(q.term) : null,
    types: q.type ? [q.type as BankQuestionType] : undefined,
    difficulties: q.difficulty ? [Number(q.difficulty)] : undefined,
    examKind: (q.examKind as BankExamKind) || null,
    sourceYear: q.year ? Number(q.year) : null,
    hasSolution: q.solution === 'yes' ? true : q.solution === 'no' ? false : null
  }
  const [stats, opts, page] = await Promise.all([bankStats(db, actor), bankFormOptions(db, actor), listBankQuestions(db, actor, filter, { cursor: q.cursor })])
  const link = (patch: Partial<Q>) => {
    const p = new URLSearchParams(Object.entries({ ...q, cursor: undefined, ...patch }).filter((e): e is [string, string] => !!e[1]))
    const s = p.toString()
    return s ? `/teacher/bank?${s}` : '/teacher/bank'
  }
  const chip = (on: boolean) => cn('rounded-full border px-3 py-1 text-sm', on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/50')

  return (
    <>
      <PageHeader
        title="بنك الأسئلة"
        description="أسئلتك وتمارينك مصنّفة بالمادة والصف والوحدة والصعوبة — منها يُبنى الامتحان في دقائق."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/teacher/bank/import">
                <FileUp className="size-4" /> استيراد
              </Link>
            </Button>
            <Button asChild>
              <Link href="/teacher/bank/new">
                <Plus className="size-4" /> سؤال جديد
              </Link>
            </Button>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="في بنكي" value={stats.mine} />
        <StatCard label="بانتظار المراجعة" value={stats.review} tone={stats.review ? 'warning' : 'default'} />
        <StatCard label="بنك Madrasadz" value={stats.central} />
        <StatCard label="المفضّلة" value={stats.favorites} />
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {SCOPES.map((s) => (
          <Link key={s.key} href={link({ scope: s.key })} className={chip(scope === s.key)}>
            {s.label}
            {s.key === 'review' && stats.review ? ` (${stats.review})` : ''}
          </Link>
        ))}
      </div>
      <form method="get" action="/teacher/bank" className="mb-4 grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-3 lg:grid-cols-6">
        <input type="hidden" name="scope" value={scope} />
        <div className="relative sm:col-span-3 lg:col-span-2">
          <Search className="absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q.q ?? ''} placeholder="ابحث: تمارين الدوال صعبة، الشعر التعليمي…" className="pe-9" />
        </div>
        <Select name="subject" defaultValue={q.subject ?? ''}>
          <option value="">كل المواد</option>
          {opts.subjects.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
        <Select name="level" defaultValue={q.level ?? ''}>
          <option value="">كل الصفوف</option>
          {opts.levels.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
        <Select name="stream" defaultValue={q.stream ?? ''}>
          <option value="">كل الشعب</option>
          {opts.streams.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
        <Select name="term" defaultValue={q.term ?? ''}>
          <option value="">كل الفصول</option>
          <option value="1">الفصل الأول</option>
          <option value="2">الفصل الثاني</option>
          <option value="3">الفصل الثالث</option>
        </Select>
        <Select name="type" defaultValue={q.type ?? ''}>
          <option value="">كل الأنواع</option>
          <option value="MCQ">اختيار متعدد</option>
          <option value="TRUE_FALSE">صح/خطأ</option>
          <option value="SHORT_ANSWER">إجابة قصيرة</option>
          <option value="FILL_BLANK">ملء فراغات</option>
          <option value="MATCHING">مطابقة</option>
          <option value="LONG_ANSWER">إجابة مطوّلة</option>
          <option value="OPEN">سؤال مفتوح</option>
        </Select>
        <Select name="difficulty" defaultValue={q.difficulty ?? ''}>
          <option value="">كل الصعوبات</option>
          <option value="1">سهل</option>
          <option value="2">متوسط</option>
          <option value="3">صعب</option>
          <option value="4">صعب جداً</option>
        </Select>
        <Select name="examKind" defaultValue={q.examKind ?? ''}>
          <option value="">كل المصادر</option>
          <option value="BAC">بكالوريا</option>
          <option value="BEM">شهادة التعليم المتوسط</option>
          <option value="TEST">اختبار</option>
          <option value="HOMEWORK">فرض</option>
          <option value="QUIZ">اختبار إلكتروني</option>
          <option value="PRACTICE">تدريب</option>
        </Select>
        <Input name="year" type="number" min="1990" max="2100" defaultValue={q.year ?? ''} placeholder="السنة" dir="ltr" />
        <Select name="solution" defaultValue={q.solution ?? ''}>
          <option value="">مع حلّ أو بدونه</option>
          <option value="yes">مع حلّ</option>
          <option value="no">بدون حلّ</option>
        </Select>
        <div className="flex gap-2">
          <Button type="submit" size="sm">
            تصفية
          </Button>
          <Button asChild type="button" size="sm" variant="ghost">
            <Link href={link({ q: undefined, subject: undefined, level: undefined, stream: undefined, term: undefined, type: undefined, difficulty: undefined, examKind: undefined, year: undefined, solution: undefined })}>مسح</Link>
          </Button>
        </div>
      </form>
      <BankList items={page.items} ownWorkspaceId={actor.workspaceId} review={scope === 'review'} nextHref={page.nextCursor ? link({ cursor: page.nextCursor }) : null} />
    </>
  )
}
