import { BookOpen, Library } from 'lucide-react'
import Link from 'next/link'
import { ContentGrid } from '@/components/domain/content-cards'
import { LevelSubjectBar, ResourceCards } from '@/components/domain/resource-cards'
import { Button } from '@/components/ui/button'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { cn } from '@/lib/utils'
import { getT } from '@/i18n/server'
import { getCurrentActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { currentLevel, subjectsForLevel } from '@/server/queries/level-scope'
import { listPublicContent, listTopics } from '@/server/queries/content.queries'
import { LESSON_RESOURCE_TYPES, listResourceCards } from '@/server/services/library.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'الدروس والموارد' }

type Q = { level?: string; subject?: string; q?: string; topic?: string; cursor?: string }

/**
 * /lessons — «الدروس والموارد» (دُمجت فيها «الموارد»): دروس المنصة المصوّرة والمكتوبة وملفاتها،
 * ثم ملخّصات ودروس المكتبة من كل المصادر — كلها بحسب مستوى الزائر والمادة.
 */
export default async function LessonsPage({ searchParams }: { searchParams: Promise<Q> }) {
  const sp = await searchParams
  const db = await getDb()
  const { locale } = await getT()
  const [level, actor] = await Promise.all([currentLevel(db, sp.level), getCurrentActor()])
  const studentId = actor?.studentId ?? null
  const subjectId = sp.subject && /^[0-9a-f-]{36}$/i.test(sp.subject) ? sp.subject : null
  const [academy, topics, library, subjectOpts] = await Promise.all([
    // دروس المنصة لا تحمل مادة: تُرشَّح بالمستوى والبحث، وتُخفى حين يختار الزائر مادة بعينها من المكتبة
    subjectId ? Promise.resolve([]) : listPublicContent(db, { types: ['LESSON', 'ARTICLE', 'VIDEO', 'PDF', 'AUDIO', 'IMAGE', 'LINK'], search: sp.q, topic: sp.topic, levelId: level?.id ?? null }),
    listTopics(db),
    listResourceCards(db, { levelId: level?.id ?? null, subjectId, types: LESSON_RESOURCE_TYPES, q: sp.q ?? null, studentId }, { cursor: sp.cursor ?? null, limit: 24 }),
    subjectsForLevel(db, level?.id ?? null)
  ])
  const link = (patch: Partial<Q>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, cursor: undefined, ...patch }).filter((e): e is [string, string] => Boolean(e[1])))
    const s = p.toString()
    return `/lessons${s ? `?${s}` : ''}`
  }
  const chip = (on: boolean) => cn('rounded-full border px-3 py-1 text-xs font-semibold', on ? 'bg-primary text-primary-foreground' : 'bg-card hover:border-primary/50')
  return (
    <div className="container py-10">
      <PageHeader title="الدروس والموارد" description={`دروس مصوّرة ومكتوبة وملخّصات ووثائق${level ? ` — ${level.label}` : ' لكل المستويات'}، والمصدر مذكور تحت كل مورد.`} />
      <LevelSubjectBar action="/lessons" levelLabel={level?.label ?? null} subjects={subjectOpts} subjectId={subjectId} q={sp.q} hidden={{ topic: sp.topic, level: sp.level }} placeholder="ابحث: الدوال، إعراب البدل، الصور البيانية…" />

      {!subjectId ? (
        <section className="mb-10">
          <h2 className="mb-3 flex items-center gap-2 text-xl font-extrabold">
            <BookOpen className="size-5 text-primary" /> دروس المنصة
          </h2>
          {topics.length > 0 ? (
            <div className="mb-4 flex flex-wrap gap-2">
              <Link href={link({ topic: undefined })} className={chip(!sp.topic)}>
                الكل
              </Link>
              {topics.map((tp) => (
                <Link key={tp} href={link({ topic: tp })} className={chip(sp.topic === tp)}>
                  {tp}
                </Link>
              ))}
            </div>
          ) : null}
          <ContentGrid items={academy} locale={locale} />
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-xl font-extrabold">
          <Library className="size-5 text-primary" /> ملخّصات ودروس من المكتبة <span className="text-sm font-normal text-muted-foreground">({library.total})</span>
        </h2>
        {library.items.length === 0 ? (
          <EmptyState icon={Library} title="لا ملخّصات بهذه المرشّحات بعد" description="يضيفها المشرف من المكتبة تباعاً؛ جرّب مادة أخرى أو كل المستويات." />
        ) : (
          <ResourceCards items={library.items} />
        )}
        {library.nextCursor ? (
          <div className="mt-6 text-center">
            <Button asChild variant="outline">
              <Link href={`${link({})}${link({}).includes('?') ? '&' : '?'}cursor=${library.nextCursor}`}>المزيد</Link>
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  )
}
