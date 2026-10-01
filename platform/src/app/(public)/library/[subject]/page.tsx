import { ArrowRight, FileText, Library, Search } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LibraryHits } from '@/components/domain/library-hits'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/misc'
import { cn } from '@/lib/utils'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { subjectHub } from '@/server/services/library.service'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ subject: string }> }) {
  const { subject } = await params
  return { title: `مكتبة ${decodeURIComponent(subject)}` }
}

/** مركز المادة (المرحلة 9): الصفوف، الأقسام، الدروس بالأعداد، وأحدث الموارد */
export default async function SubjectHubPage({ params, searchParams }: { params: Promise<{ subject: string }>; searchParams: Promise<{ level?: string }> }) {
  const { subject } = await params
  const sp = await searchParams
  let hub
  try {
    hub = await subjectHub(await getDb(), decodeURIComponent(subject), { levelId: sp.level || null })
  } catch (e) {
    if (e instanceof AppError) notFound()
    throw e
  }
  const chip = (on: boolean) => cn('rounded-full border px-3 py-1.5 text-sm', on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/50')
  const levelName = hub.levels.find((l) => l.id === sp.level)?.name
  const lessonsWithItems = hub.lessons.filter((l) => l.count > 0)
  return (
    <div className="container py-10">
      <PageHeader
        title={`مكتبة ${hub.subject.name}`}
        description={`${hub.sections.reduce((a, s) => a + s.count, 0)} مورد · ${hub.questions} سؤال عام · ${hub.officialExams} امتحان رسمي${levelName ? ` — ${levelName}` : ''}`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/library">
              <ArrowRight className="size-4" /> المكتبة
            </Link>
          </Button>
        }
      />
      <form action="/library/search" className="mb-4 flex gap-2">
        <input type="hidden" name="subject" value={hub.subject.id} />
        {sp.level ? <input type="hidden" name="level" value={sp.level} /> : null}
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" placeholder={`ابحث في ${hub.subject.name}…`} className="ps-9" dir="auto" />
        </div>
        <Button type="submit" variant="outline">
          بحث
        </Button>
      </form>
      {hub.levels.length ? (
        <nav className="mb-6 flex flex-wrap gap-2" aria-label="الصف">
          <Link href={`/library/${hub.subject.slug}`} className={chip(!sp.level)}>
            كل الصفوف
          </Link>
          {hub.levels.map((l) => (
            <Link key={l.id} href={`/library/${hub.subject.slug}?level=${l.id}`} className={chip(sp.level === l.id)}>
              {l.name} <span className="opacity-60">({l.count})</span>
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {hub.sections.map((s) => (
          <Link key={s.key} href={`/library/search?section=${s.key}&subject=${hub.subject.id}${sp.level ? `&level=${sp.level}` : ''}&q=${encodeURIComponent(hub.subject.name)}`} className="rounded-xl border bg-card p-3">
            <p className="text-xs font-semibold">{s.label}</p>
            <p className="tabular text-xl font-extrabold">{s.count}</p>
          </Link>
        ))}
        {hub.officialExams ? (
          <Link href={`/past-bac?subject=${hub.subject.slug}`} className="rounded-xl border bg-card p-3">
            <p className="text-xs font-semibold">بكالوريات رسمية</p>
            <p className="tabular text-xl font-extrabold">{hub.officialExams}</p>
            {hub.examYears.length ? <p className="text-[11px] text-muted-foreground">{hub.examYears.slice(0, 4).join(' · ')}</p> : null}
          </Link>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {hub.sections
            .filter((s) => hub.latest[s.key].length)
            .map((s) => (
              <Card key={s.key}>
                <CardHeader>
                  <CardTitle className="text-base">{s.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <LibraryHits hits={hub.latest[s.key]} />
                </CardContent>
              </Card>
            ))}
          {hub.sections.every((s) => hub.latest[s.key].length === 0) ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">لا موارد منشورة في هذه المادة بعد{levelName ? ` لهذا الصف` : ''}.</CardContent>
            </Card>
          ) : null}
        </div>
        <div className="space-y-6">
          {sp.level ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="size-4" /> الدروس
                </CardTitle>
              </CardHeader>
              <CardContent>
                {lessonsWithItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{hub.lessons.length ? 'لم تُربط موارد بالدروس بعد.' : 'لا منهاج مفصّل لهذا الصف بعد.'}</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {lessonsWithItems.map((l) => (
                      <li key={l.id} className={cn('flex items-center justify-between gap-2 py-1', l.parentId ? 'ps-4' : 'font-semibold')}>
                        <span className="truncate">{l.title}</span>
                        <span className="tabular text-xs text-muted-foreground">{l.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Library className="size-4" /> بنك الأسئلة
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p>{hub.questions} سؤالاً عاماً في هذه المادة.</p>
              <p className="mt-1 text-xs text-muted-foreground">سجّل كتلميذ وتدرّب عليها بتصحيح فوري من «تدريب ذاتي»، أو ابحث عنها أعلاه.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
