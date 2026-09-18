import { ListChecks } from 'lucide-react'
import Link from 'next/link'
import { PublicContentPage } from '@/components/domain/public-content-page'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { getT } from '@/i18n/server'
import { getDb } from '@/server/db/client'
import { listPublicQuizzesCards } from '@/server/services/quizzes.service'

export const dynamic = 'force-dynamic'
export async function generateMetadata() {
  const { t: tt } = await getT()
  return { title: tt('public.quizzesTitle') }
}

export default async function QuizzesPage({ searchParams }: { searchParams: Promise<{ q?: string; topic?: string }> }) {
  const [quizzes, { t, locale }] = await Promise.all([listPublicQuizzesCards(await getDb()), getT()])
  return (
    <>
      {quizzes.length ? (
        <section className="container pt-10">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-extrabold">
            <ListChecks className="size-5 text-primary" /> اختبارات تفاعلية
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {quizzes.map((q) => (
              <Link key={q.id} href={`/student/quizzes/${q.id}`} className="group">
                <Card className="h-full transition-shadow group-hover:shadow-md">
                  <CardContent className="space-y-2 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold group-hover:text-primary">{q.title}</h3>
                      <Badge variant="muted">{q.questionsCount} سؤال</Badge>
                    </div>
                    {q.description ? <p className="line-clamp-2 text-sm text-muted-foreground">{q.description}</p> : null}
                    <p className="text-xs text-muted-foreground">
                      {[q.topic, q.skillName, q.timeLimitMinutes ? `${q.timeLimitMinutes} د` : null].filter(Boolean).join(' · ')}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">يتطلب إنجاز الاختبار حساب طالب.</p>
        </section>
      ) : null}
      <PublicContentPage locale={locale} title={t('public.quizzesTitle')} types={['QUIZ', 'EXERCISE']} basePath="/quizzes" searchParams={searchParams} />
    </>
  )
}
