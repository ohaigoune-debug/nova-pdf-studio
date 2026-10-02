import { BookTemplate, Clock, FileText, Library, Shapes, Star } from 'lucide-react'
import Link from 'next/link'
import { LibraryBlocks } from '@/components/studio/library-blocks'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader, StatCard } from '@/components/ui/misc'
import { formatDate } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listLibraryItems } from '@/server/services/exam-studio.service'
import { listExams, workspaceStats } from '@/server/services/exams.service'
import { bankStats } from '@/server/services/question-bank.service'

export const dynamic = 'force-dynamic'

/** مكتبتي: أسئلتي، امتحاناتي، قوالبي، كتلي المحفوظة، المفضّلة، الأخيرة — محور واحد يربط ما هو موجود */
export default async function TeacherLibraryPage() {
  const actor = await requirePageActor('TEACHER')
  const db = await getDb()
  const [stats, bank, blocks, favorites, recent] = await Promise.all([workspaceStats(db, actor), bankStats(db, actor), listLibraryItems(db, actor, {}, 200), listExams(db, actor, { scope: 'favorites' }), listExams(db, actor, { scope: 'all' })])
  return (
    <>
      <PageHeader title="مكتبتي" description="كل ما أنشأته في مكان واحد: أسئلة البنك، الامتحانات، القوالب، الكتل المحفوظة، المفضّلة، وآخر ما عملت عليه." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link href="/teacher/bank" className="contents">
          <StatCard label="أسئلتي في البنك" value={bank.mine} hint={`${bank.favorites} في المفضّلة`} icon={Library} />
        </Link>
        <Link href="/teacher/exams" className="contents">
          <StatCard label="امتحاناتي" value={stats.exams.total} hint={`${stats.exams.ready} جاهزة · ${stats.exams.draft} مسودة`} icon={FileText} />
        </Link>
        <Link href="/teacher/exams/templates" className="contents">
          <StatCard label="قوالبي" value={stats.exams.templates} hint="+ قوالب Madrasadz" icon={BookTemplate} />
        </Link>
        <StatCard label="كتل محفوظة" value={blocks.filter((b) => b.kind === 'BLOCK').length} hint={`${blocks.filter((b) => b.kind === 'HEADER').length} ترويسة`} icon={Shapes} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-5 text-primary" /> الأخيرة
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? <p className="text-sm text-muted-foreground">لا امتحانات بعد.</p> : null}
            <ul className="divide-y text-sm">
              {recent.slice(0, 8).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/teacher/exams/${e.id}`} className="truncate font-semibold hover:underline">
                    {e.title}
                  </Link>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {e.isFavorite ? <Star className="me-1 inline size-3 fill-current text-accent" /> : null}
                    {formatDate(e.updatedAt)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="size-5 text-accent" /> المفضّلة
            </CardTitle>
          </CardHeader>
          <CardContent>
            {favorites.length === 0 ? <p className="text-sm text-muted-foreground">علّم امتحاناً أو قالباً بالنجمة من الاستوديو.</p> : null}
            <ul className="divide-y text-sm">
              {favorites.slice(0, 10).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/teacher/exams/${e.id}`} className="truncate font-semibold hover:underline">
                    {e.title}
                  </Link>
                  <span className="flex shrink-0 gap-1">
                    {e.isTemplate ? <Badge variant="secondary">قالب</Badge> : null}
                    <Badge variant="muted">{e.items} عنصر</Badge>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shapes className="size-5 text-primary" /> الكتل والترويسات المحفوظة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LibraryBlocks items={blocks} />
        </CardContent>
      </Card>
    </>
  )
}
