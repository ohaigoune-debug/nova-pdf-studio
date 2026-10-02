import { ArrowLeft, Download, Eye, FileCheck2, FileText, ListChecks, Search, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { SESSION_AR, TOPIC_AR } from '@/lib/bac-bank'
import { getDb } from '@/server/db/client'
import { searchBacExercises } from '@/server/services/bac-bank.service'
import { archiveFacets, listArchive, type ArchiveFilter } from '@/server/services/exam-engine.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'بنك البكالوريا' }

type Q = { level?: string; stream?: string; subject?: string; year?: string; topic?: string; session?: string; q?: string; cursor?: string }

/**
 * /bac — بنك البكالوريا الجزائري: مرشّحات السنة/الشعبة/المادة/الموضوع، بحث ذكي في التمارين («الدالة الأسية» ← BAC 2024 علوم — تمرين 2)،
 * وبطاقة لكل موضوع: عرض، تحميل PDF، الحلّ، الحلّ المفصّل، حلّ تفاعلي. يُقرأ كله من القاعدة بلا ذكاء اصطناعي.
 */
export default async function BacBankPage({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams
  const db = await getDb()
  const uuid = (v?: string) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : null)
  const f: ArchiveFilter = { levelId: uuid(q.level), streamId: uuid(q.stream), subjectId: uuid(q.subject), year: q.year ? Number(q.year) || null : null, type: 'EXAM', session: q.session && /^[A-Z]+$/.test(q.session) ? q.session : null, topic: q.topic === '1' || q.topic === '2' ? Number(q.topic) : null }
  const query = q.q?.trim().slice(0, 100) ?? ''
  const [facets, list, hits] = await Promise.all([archiveFacets(db, f), listArchive(db, { ...f, q: null }, { cursor: q.cursor ?? null, limit: 24 }), query.length >= 2 ? searchBacExercises(db, query, { subjectId: f.subjectId, streamId: f.streamId, year: f.year }) : Promise.resolve([])])
  const link = (patch: Partial<Q>) => {
    const p = new URLSearchParams(Object.entries({ ...q, cursor: undefined, ...patch }).filter((e): e is [string, string] => Boolean(e[1])))
    const s = p.toString()
    return `/bac${s ? `?${s}` : ''}`
  }
  const items = query ? list.items.filter((it) => it.title.includes(query)) : list.items
  return (
    <div className="container py-10">
      <PageHeader title="بنك البكالوريا" description="مواضيع البكالوريا الجزائرية الرسمية بكل السنوات والشعب والمواد، مع الحلول النموذجية والحلول المفصّلة لمنصة مدرسة، وتمارينها مصنّفة بالدرس لتجدها بكلمة واحدة." actions={<Button asChild variant="outline" size="sm"><Link href="/library">المكتبة</Link></Button>} />

      <form action="/bac" className="mb-5 grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-2 lg:grid-cols-6">
        <Select name="year" defaultValue={q.year ?? ''} aria-label="السنة">
          <option value="">السنة ▼ الكل</option>
          {facets.years.map((y) => (
            <option key={y.year} value={y.year}>
              {y.year} ({y.count})
            </option>
          ))}
        </Select>
        <Select name="stream" defaultValue={q.stream ?? ''} aria-label="الشعبة">
          <option value="">الشعبة ▼ الكل</option>
          {facets.streams.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.count})
            </option>
          ))}
        </Select>
        <Select name="subject" defaultValue={q.subject ?? ''} aria-label="المادة">
          <option value="">المادة ▼ الكل</option>
          {facets.subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.count})
            </option>
          ))}
        </Select>
        <Select name="topic" defaultValue={q.topic ?? ''} aria-label="الموضوع">
          <option value="">الموضوع ▼ الكل</option>
          <option value="1">الموضوع الأول</option>
          <option value="2">الموضوع الثاني</option>
        </Select>
        <div className="relative lg:col-span-2">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q.q ?? ''} placeholder="بحث ذكي: الدالة الأسية، الاحتمالات، الاستعارة…" className="ps-9" dir="auto" />
        </div>
        <div className="flex gap-2 lg:col-span-6">
          <Button type="submit">تصفية / بحث</Button>
          {q.year || q.stream || q.subject || q.topic || q.q ? (
            <Button asChild variant="ghost">
              <Link href="/bac">مسح</Link>
            </Button>
          ) : null}
          <span className="ms-auto self-center text-xs text-muted-foreground">{facets.total} موضوعاً</span>
        </div>
      </form>

      {query ? (
        <Card className="mb-6">
          <CardContent className="p-4">
            <p className="mb-2 flex items-center gap-2 font-bold">
              <ListChecks className="size-5 text-primary" /> تمارين تطابق «{query}» <Badge variant="muted">{hits.length}</Badge>
            </p>
            {hits.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا تمارين مطابقة بعد (تظهر بعد معالجة المواضيع واعتمادها). جرّب اسم الدرس كما في المنهاج.</p>
            ) : (
              <ul className="divide-y text-sm">
                {hits.map((h) => (
                  <li key={h.id} className="flex items-start justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="font-semibold">{h.label}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground" dir="auto">
                        {h.title ? `${h.title} — ` : ''}
                        {h.body}
                      </p>
                      <p className="mt-0.5 flex flex-wrap gap-1 text-[11px]">
                        {h.nodeTitle ? <Badge variant="default">{h.nodeTitle}</Badge> : null}
                        {h.hasDetail ? (
                          <Badge variant="gold">
                            <Sparkles className="size-3" /> حلّ مفصّل
                          </Badge>
                        ) : null}
                      </p>
                    </div>
                    <span className="flex shrink-0 gap-1">
                      {h.resourceId ? (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/bac/${h.resourceId}#ex-${h.id}`}>الموضوع</Link>
                        </Button>
                      ) : null}
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/library/q/${h.id}`}>التمرين</Link>
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      {items.length === 0 ? (
        <EmptyState icon={FileText} title="لا مواضيع بهذه المرشّحات بعد" description="يملأ المشرف البنك من «المنهاج والمكتبة» (جلب DzExams) ثم يعالجه من «بنك البكالوريا»." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <Card key={it.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="default">BAC {it.year ?? '—'}</Badge>
                  {it.streamName ? <Badge variant="secondary">{it.streamName}</Badge> : null}
                  {it.subjectName ? <Badge variant="outline">{it.subjectName}</Badge> : null}
                  {it.topic ? <Badge variant="muted">{TOPIC_AR(it.topic)}</Badge> : null}
                  {it.session && it.session !== 'NORMAL' ? <Badge variant="outline">{SESSION_AR[it.session] ?? it.session}</Badge> : null}
                </div>
                <Link href={`/bac/${it.id}`} className="font-bold leading-snug hover:underline">
                  {it.title}
                </Link>
                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                  {it.official ? (
                    <Badge variant="success">
                      <FileCheck2 className="size-3" /> رسمي
                    </Badge>
                  ) : null}
                  {it.hasSolution ? <Badge variant="success">مع الحلّ</Badge> : <Badge variant="muted">بلا حلّ</Badge>}
                  {it.exercises ? <Badge variant="default">{it.exercises} تمريناً</Badge> : null}
                  {it.detailed ? (
                    <Badge variant="gold">
                      <Sparkles className="size-3" /> {it.detailed} حلّ مفصّل
                    </Badge>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <Button asChild size="sm">
                    <Link href={`/bac/${it.id}`}>
                      <Eye className="size-4" /> عرض الموضوع
                    </Link>
                  </Button>
                  {it.fileUrl ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={it.fileUrl} target="_blank" rel="noopener noreferrer">
                        <Download className="size-4" /> تحميل PDF
                      </a>
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled>
                      <Download className="size-4" /> بلا ملف
                    </Button>
                  )}
                  {it.solutionUrl ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={it.solutionUrl} target="_blank" rel="noopener noreferrer">
                        الحلّ
                      </a>
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled>
                      الحلّ
                    </Button>
                  )}
                  {it.exercises ? (
                    <Button asChild size="sm" variant={it.detailed ? 'gold' : 'outline'}>
                      <Link href={`/bac/${it.id}?mode=interactive`}>{it.detailed ? 'الحلّ المفصّل' : 'حلّ تفاعلي'}</Link>
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled title="بعد معالجة الموضوع واعتماده">
                      حلّ تفاعلي
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">المصدر: {it.source}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {list.nextCursor && !query ? (
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
