import { ClipboardList, FileText } from 'lucide-react'
import Link from 'next/link'
import { ScopePicker } from '@/components/academy/scope-picker'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { cn } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { levels } from '@/server/db/schema'
import { eq } from 'drizzle-orm'
import { assessmentCards, browseOptions, browseScope } from '@/server/services/academy-catalog.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'الفروض والاختبارات' }

type Q = { level?: string; stream?: string; subject?: string }

/**
 * /student/exams — ست بطاقات ثابتة (فرض/اختبار × الفصول الثلاثة) بأعداد الموارد المجانية المنشورة
 * بحسب المستوى والشعبة والمادة، كل بطاقة تقود إلى /exams بالمرشّحات نفسها. واجبات الأفواج تبقى في «الواجبات».
 */
export default async function StudentExamsPage({ searchParams }: { searchParams: Promise<Q> }) {
  const actor = await requirePageActor('STUDENT')
  const sp = await searchParams
  const db = await getDb()
  const scope = await browseScope(db, actor, sp)
  const [levelRow] = scope.levelId ? await db.select({ code: levels.code }).from(levels).where(eq(levels.id, scope.levelId)).limit(1) : []
  const [cards, options] = await Promise.all([assessmentCards(db, scope, { studentId: actor.studentId, levelCode: levelRow?.code ?? null }), browseOptions(db, scope)])
  return (
    <>
      <PageHeader
        title="الفروض والاختبارات"
        description="فروض واختبارات الفصول الثلاثة المنشورة مجاناً بحسب مستواك وشعبتك ومادتك. واجبات أستاذك الموجّهة لفوجك في صفحة «الواجبات»."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/student/assignments">
              <ClipboardList className="size-4" /> واجباتي
            </Link>
          </Button>
        }
      />
      <ScopePicker base="/student/exams" value={scope} options={options} fromProfile={scope.fromProfile} />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.key} href={c.href} className="group">
            <Card className={cn('h-full transition-colors group-hover:border-primary/50', c.count === 0 && 'opacity-70')}>
              <CardContent className="flex items-center gap-3 p-4">
                <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-lg', c.kind === 'HOMEWORK' ? 'bg-primary/10 text-primary' : 'bg-accent/15 text-amber-800 dark:text-amber-200')}>
                  <FileText className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{c.label}</span>
                  <span className="block text-xs text-muted-foreground">{c.count === 0 ? 'لا مواضيع منشورة بعد' : `${c.count} موضوع`}</span>
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">التصنيف بالفصل من بيانات المورد نفسه عند نشره، لا من عنوانه. مواضيع البكالوريا الرسمية في «بنك البكالوريات».</p>
    </>
  )
}
