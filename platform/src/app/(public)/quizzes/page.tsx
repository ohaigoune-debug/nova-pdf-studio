import { ListChecks } from 'lucide-react'
import Link from 'next/link'
import { ContentGrid } from '@/components/domain/content-cards'
import { LevelSubjectBar } from '@/components/domain/resource-cards'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { levelLabel } from '@/lib/levels'
import { getT } from '@/i18n/server'
import { getDb } from '@/server/db/client'
import { listPublicContent } from '@/server/queries/content.queries'
import { currentLevel, subjectsForLevel } from '@/server/queries/level-scope'
import { listPublicQuizzesCards } from '@/server/services/quizzes.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'اختبارات المستوى QCM' }

type Q = { level?: string; subject?: string; q?: string }

/** /quizzes — «اختبارات المستوى QCM»: اختبارات تفاعلية تُصحَّح فوراً، بحسب مستوى التلميذ ومادته */
export default async function QuizzesPage({ searchParams }: { searchParams: Promise<Q> }) {
  const sp = await searchParams
  const db = await getDb()
  const { locale } = await getT()
  const level = await currentLevel(db, sp.level)
  const subjectId = sp.subject && /^[0-9a-f-]{36}$/i.test(sp.subject) ? sp.subject : null
  const [all, subjectOpts, practice] = await Promise.all([
    listPublicQuizzesCards(db, { levelId: level?.id ?? null, subjectId }),
    subjectsForLevel(db, level?.id ?? null),
    subjectId ? Promise.resolve([]) : listPublicContent(db, { types: ['QUIZ', 'EXERCISE'], search: sp.q, levelId: level?.id ?? null })
  ])
  const q = sp.q?.trim() ?? ''
  const quizzes = q.length >= 2 ? all.filter((x) => x.title.includes(q) || (x.topic ?? '').includes(q) || (x.description ?? '').includes(q)) : all
  return (
    <>
      <section className="container pt-10">
        <PageHeader title="اختبارات المستوى QCM" description={`اختبارات اختيار من متعدّد تُصحَّح فوراً لتقيس مستواك${level ? ` — ${level.label}` : ''}. يتطلب إنجاز الاختبار حساب تلميذ.`} />
        <LevelSubjectBar action="/quizzes" levelLabel={level?.label ?? null} subjects={subjectOpts} subjectId={subjectId} q={sp.q} hidden={{ level: sp.level }} placeholder="ابحث في الاختبارات…" />
        {quizzes.length === 0 ? (
          <EmptyState icon={ListChecks} title="لا اختبارات تفاعلية بهذه المرشّحات بعد" description="ينشر الأساتذة اختبارات QCM عامة تباعاً." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {quizzes.map((x) => (
              <Link key={x.id} href={`/student/quizzes/${x.id}`} className="group">
                <Card className="h-full transition-shadow group-hover:shadow-md">
                  <CardContent className="space-y-2 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold group-hover:text-primary">{x.title}</h3>
                      <Badge variant="muted">{x.questionsCount} سؤال</Badge>
                    </div>
                    {x.description ? <p className="line-clamp-2 text-sm text-muted-foreground">{x.description}</p> : null}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {x.levelCode ? <Badge variant="default">{levelLabel(x.levelCode) ?? x.levelName}</Badge> : <Badge variant="outline">كل المستويات</Badge>}
                      <span>{[x.topic, x.skillName, x.timeLimitMinutes ? `${x.timeLimitMinutes} د` : null].filter(Boolean).join(' · ')}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
      {/* تمارين منشورة من دروس المنصة (محتوى بنوع اختبار/تمرين) — تظهر فقط إن وُجدت */}
      {practice.length ? (
        <section className="container py-10">
          <h2 className="mb-4 text-xl font-extrabold">تمارين من دروس المنصة</h2>
          <ContentGrid items={practice} locale={locale} />
        </section>
      ) : (
        <div className="pb-10" />
      )}
    </>
  )
}
