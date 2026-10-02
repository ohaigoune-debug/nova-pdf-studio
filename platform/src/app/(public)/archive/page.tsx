import { ArrowLeft, Eye, FileCheck2, FileText, ListChecks, Search } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { cn } from '@/lib/utils'
import { getDb } from '@/server/db/client'
import { archiveFacets, listArchive, type ArchiveFilter } from '@/server/services/exam-engine.service'
import { RESOURCE_TYPE_AR } from '@/server/services/library.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'بنك البكالوريا والاختبارات' }

type Q = { level?: string; stream?: string; subject?: string; year?: string; type?: string; session?: string; q?: string; cursor?: string }
const SESSION_AR: Record<string, string> = { NORMAL: 'الدورة الرئيسية', MAKEUP: 'الدورة الاستدراكية', MOCK: 'تجريبية' }

/**
 * «بنك البكالوريا والاختبارات» (محرّك الامتحانات — المرحلة 1): أرشيف المواضيع الرسمية
 * بالصف والشعبة والمادة والسنة والنوع، مع الحلّ والمعاينة داخل الموقع والتمارين المستخرجة.
 */
export default async function ArchivePage({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams
  const db = await getDb()
  const uuid = (v?: string) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : null)
  const f: ArchiveFilter = { levelId: uuid(q.level), streamId: uuid(q.stream), subjectId: uuid(q.subject), year: q.year ? Number(q.year) || null : null, type: q.type === 'TEST' || q.type === 'HOMEWORK' || q.type === 'EXAM' ? q.type : null, session: q.session && /^[A-Z]+$/.test(q.session) ? q.session : null, q: q.q?.slice(0, 100) ?? null }
  const [facets, list] = await Promise.all([archiveFacets(db, f), listArchive(db, f, { cursor: q.cursor ?? null, limit: 24 })])
  const link = (patch: Partial<Q>) => {
    const p = new URLSearchParams(Object.entries({ ...q, cursor: undefined, ...patch }).filter((e): e is [string, string] => Boolean(e[1])))
    const s = p.toString()
    return `/archive${s ? `?${s}` : ''}`
  }
  const chip = (on: boolean) => cn('rounded-full border px-3 py-1 text-sm transition-colors', on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/50')
  const Row = ({ label, items, param: k, current }: { label: string; items: { id: string; name: string; count: number }[]; param: keyof Q; current: string | null | undefined }) =>
    items.length ? (
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-14 text-xs font-bold text-muted-foreground">{label}</span>
        <Link href={link({ [k]: undefined })} className={chip(!current)}>
          الكل
        </Link>
        {items.map((it) => (
          <Link key={it.id} href={link({ [k]: it.id })} className={chip(current === it.id)}>
            {it.name} <span className="text-xs opacity-70">({it.count})</span>
          </Link>
        ))}
      </div>
    ) : null

  return (
    <div className="container py-10">
      <PageHeader
        title="بنك البكالوريا والاختبارات"
        description="مواضيع البكالوريا الرسمية مع تصحيحاتها، مصنّفة بالصف والشعبة والمادة والسنة — تُعاين داخل الموقع، وتُقسَّم تمارينها المستخرجة إلى بنك قابل للبناء منه. المصدر مذكور تحت كل موضوع."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/library">المكتبة</Link>
          </Button>
        }
      />
      <form action="/archive" className="mb-5 flex gap-2">
        {Object.entries(q)
          .filter(([k, v]) => k !== 'q' && k !== 'cursor' && v)
          .map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q.q ?? ''} placeholder="ابحث في عناوين المواضيع: 2023، علوم تجريبية…" className="ps-9" dir="auto" />
        </div>
        <Button type="submit">بحث</Button>
      </form>
      <Card className="mb-6">
        <CardContent className="space-y-2 p-4">
          <Row label="الصف" items={facets.levels} param="level" current={f.levelId} />
          <Row label="الشعبة" items={facets.streams} param="stream" current={f.streamId} />
          <Row label="المادة" items={facets.subjects} param="subject" current={f.subjectId} />
          {facets.years.length ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-14 text-xs font-bold text-muted-foreground">السنة</span>
              <Link href={link({ year: undefined })} className={chip(!f.year)}>
                الكل
              </Link>
              {facets.years.map((y) => (
                <Link key={y.year} href={link({ year: String(y.year) })} className={chip(f.year === y.year)}>
                  {y.year} <span className="text-xs opacity-70">({y.count})</span>
                </Link>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-14 text-xs font-bold text-muted-foreground">النوع</span>
            {[
              ['', 'الكل'],
              ['EXAM', 'بكالوريا / امتحان رسمي'],
              ['TEST', 'اختبارات'],
              ['HOMEWORK', 'فروض']
            ].map(([v, l]) => (
              <Link key={v} href={link({ type: v || undefined })} className={chip((f.type ?? '') === v)}>
                {l}
              </Link>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{facets.total} موضوعاً مطابقاً.</p>
        </CardContent>
      </Card>

      {list.items.length === 0 ? (
        <EmptyState icon={FileText} title="لا مواضيع بهذه المرشّحات بعد" description="يملأ المشرف الأرشيف من «المنهاج والمكتبة» (جلب DzExams) ثم يعالجه من «محرّك الامتحانات»." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.items.map((it) => (
            <Card key={it.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  {it.official ? (
                    <Badge variant="success">
                      <FileCheck2 className="size-3" /> رسمي
                    </Badge>
                  ) : null}
                  <Badge variant="secondary">{RESOURCE_TYPE_AR[it.type as keyof typeof RESOURCE_TYPE_AR] ?? it.type}</Badge>
                  {it.year ? <Badge variant="muted">{it.year}</Badge> : null}
                  {it.session && it.session !== 'NORMAL' ? <Badge variant="outline">{SESSION_AR[it.session] ?? it.session}</Badge> : null}
                </div>
                <Link href={`/archive/${it.id}`} className="font-bold leading-snug hover:underline">
                  {it.title}
                </Link>
                <p className="text-xs text-muted-foreground">{[it.subjectName, it.levelName, it.streamName].filter(Boolean).join(' · ')}</p>
                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2 text-xs">
                  {it.hasSolution ? <Badge variant="success">مع التصحيح</Badge> : <Badge variant="muted">بلا تصحيح</Badge>}
                  {it.exercises ? (
                    <Badge variant="default">
                      <ListChecks className="size-3" /> {it.exercises} تمريناً مستخرجاً
                    </Badge>
                  ) : null}
                  {it.localPreview ? (
                    <Badge variant="outline">
                      <Eye className="size-3" /> معاينة داخل الموقع
                    </Badge>
                  ) : null}
                </div>
                <p className="text-[11px] text-muted-foreground">المصدر: {it.source}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {list.nextCursor ? (
        <div className="mt-6 flex justify-center">
          <Button asChild variant="outline">
            <Link href={link({ cursor: list.nextCursor })}>
              المزيد <ArrowLeft className="size-4" />
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  )
}
