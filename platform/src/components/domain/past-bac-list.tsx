import { Download, ExternalLink, FileCheck2, FileText } from 'lucide-react'
import Link from 'next/link'
import { EmptyState } from '@/components/ui/misc'
import { cn } from '@/lib/utils'
import type { listBacExams } from '@/server/services/bac.service'

type Data = Awaited<ReturnType<typeof listBacExams>>

/**
 * قائمة البكالوريات السابقة: روابط مباشرة إلى المصدر (DzExams) — لا ملفات مخزّنة عندنا.
 * رابط الموضوع يفتح ملف PDF مباشرة إن وُجد، وإلا صفحته في المصدر.
 */
export function PastBacList({ data, basePath, current }: { data: Data; basePath: string; current: { subject?: string; stream?: string; year?: string } }) {
  const href = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams(Object.entries({ ...current, ...patch }).filter((e): e is [string, string] => !!e[1]))
    const s = q.toString()
    return s ? `${basePath}?${s}` : basePath
  }
  const chip = (active: boolean) =>
    cn('rounded-full border px-3 py-1.5 text-sm transition-colors', active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/50')

  if (data.subjects.length === 0) {
    return <EmptyState icon={FileText} title="لم تُجلب المواضيع بعد" description="يحدّثها المشرف من الخادم، فتظهر هنا مواضيع البكالوريا لكل المواد بروابط تنزيل مباشرة." />
  }
  const byYear = new Map<string, Data['exams']>()
  for (const e of data.exams) {
    const k = e.year ? String(e.year) : 'سنوات أخرى'
    byYear.set(k, [...(byYear.get(k) ?? []), e])
  }
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Link href={href({ subject: undefined, stream: undefined, year: undefined })} className={chip(!current.subject)}>
            كل المواد
          </Link>
          {data.subjects.map((s) => (
            <Link key={s.slug} href={href({ subject: s.slug, stream: undefined, year: undefined })} className={chip(current.subject === s.slug)}>
              {s.name} <span className="opacity-60">({s.count})</span>
            </Link>
          ))}
        </div>
        {current.subject && data.streams.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            <Link href={href({ stream: undefined })} className={chip(!current.stream)}>
              كل الشعب
            </Link>
            {data.streams.map((s) => (
              <Link key={s} href={href({ stream: s })} className={chip(current.stream === s)}>
                {s}
              </Link>
            ))}
          </div>
        ) : null}
        {data.years.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            <Link href={href({ year: undefined })} className={chip(!current.year)}>
              كل السنوات
            </Link>
            {data.years.map((y) => (
              <Link key={y} href={href({ year: String(y) })} className={cn(chip(current.year === String(y)), 'tabular')}>
                {y}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {data.exams.length === 0 ? <EmptyState icon={FileText} title="لا مواضيع بهذا الاختيار" /> : null}
      {[...byYear.entries()].map(([year, exams]) => (
        <section key={year} className="space-y-2">
          <h2 className="font-display text-2xl font-bold tabular">بكالوريا {year}</h2>
          <div className="grid gap-2 md:grid-cols-2">
            {exams.map((e) => (
              <div key={e.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-soft">
                <div>
                  <p className="font-bold leading-snug">{e.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {e.subjectName}
                    {e.streamName ? ` · ${e.streamName}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href={e.examUrl ?? e.pageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90">
                    {e.examUrl ? <Download className="size-4" /> : <ExternalLink className="size-4" />} الموضوع
                  </a>
                  {e.correctionUrl ? (
                    <a href={e.correctionUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-bold hover:bg-muted">
                      <FileCheck2 className="size-4 text-success" /> التصحيح
                    </a>
                  ) : e.examUrl ? (
                    <a href={e.pageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-muted">
                      <ExternalLink className="size-4" /> صفحة الموضوع
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      <p className="text-xs text-muted-foreground">
        المصدر:{' '}
        <a href="https://www.dzexams.com/ar/bac" target="_blank" rel="noopener noreferrer" className="font-bold text-primary">
          DzExams
        </a>{' '}
        — الملفات تُنزَّل من موقعهم مباشرة.
      </p>
    </div>
  )
}
