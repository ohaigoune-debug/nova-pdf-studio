import { BookOpen, FileText, Library, ListChecks, PlayCircle, Search, Video } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/misc'
import { getDb } from '@/server/db/client'
import { librarySections, subjectsOverview, type LibrarySectionKey } from '@/server/services/library.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'المكتبة' }

const SECTION_ICON: Record<LibrarySectionKey, typeof BookOpen> = { lessons: BookOpen, exercises: ListChecks, exams: FileText, videos: Video, other: Library }

/** واجهة المكتبة (المرحلة 9): بحث موحّد، أقسام بالأعداد، ومراكز المواد */
export default async function LibraryPage() {
  const db = await getDb()
  const [secs, subjects] = await Promise.all([librarySections(db), subjectsOverview(db)])
  const live = subjects.filter((s) => s.resources + s.questions > 0)
  return (
    <div className="container py-10">
      <PageHeader title="المكتبة" description="دروس وملخّصات وتمارين وفروض وامتحانات رسمية وفيديوهات وأسئلة — من كل المصادر، مصنّفة بالمادة والصف، والمصدر مذكور دائماً." />

      <form action="/library/search" className="mb-8 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" placeholder="ابحث: الاستعارة، الاحتمالات، بكالوريا 2023 فيزياء…" className="ps-9" autoFocus dir="auto" />
        </div>
        <Button type="submit">بحث</Button>
      </form>

      <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {secs.sections.map((s) => {
          const Icon = SECTION_ICON[s.key]
          return (
            <Link key={s.key} href={`/library/search?section=${s.key}`} className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/50">
              <Icon className="mb-2 size-5 text-primary" />
              <p className="text-sm font-semibold">{s.label}</p>
              <p className="tabular text-2xl font-extrabold">{s.count}</p>
            </Link>
          )
        })}
        <Link href="/past-bac" className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/50">
          <FileText className="mb-2 size-5 text-success" />
          <p className="text-sm font-semibold">بكالوريات رسمية</p>
          <p className="tabular text-2xl font-extrabold">{secs.officialExams}</p>
        </Link>
      </div>

      <h2 className="mb-3 text-xl font-extrabold">المواد</h2>
      {live.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">المكتبة تُملأ تدريجياً: يستورد المشرف المواضيع والفيديوهات من «المنهاج والمكتبة»، وينشر الأساتذة أسئلتهم العامة.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {live.map((s) => (
            <Link key={s.id} href={`/library/${s.slug}`} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/50">
              <span>
                <span className="block font-bold">{s.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {s.resources} مورد{s.videos ? ` · ${s.videos} فيديو` : ''}
                  {s.questions ? ` · ${s.questions} سؤال` : ''}
                </span>
              </span>
              <PlayCircle className="size-5 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
      <p className="mt-6 text-xs text-muted-foreground">
        {secs.questions} سؤالاً عاماً في بنك الأسئلة. التلاميذ المسجّلون يتدرّبون عليها من «تدريب ذاتي».
      </p>
    </div>
  )
}
