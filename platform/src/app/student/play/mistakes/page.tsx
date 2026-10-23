import { RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { StartButton } from '@/components/play/challenge-launcher'
import { EmptyState, PageHeader, Progress } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { getMistakesOverview } from '@/server/services/play.service'

export const dynamic = 'force-dynamic'

export default async function PlayMistakesPage() {
  const actor = await requirePageActor('STUDENT')
  const rows = await getMistakesOverview(await getDb(), actor)
  const due = rows.reduce((a, r) => a + r.due, 0)
  return (
    <>
      <PageHeader
        title="عالج أخطاءك"
        description="نسجّل المفاهيم التي أخطأت فيها ونعيد اختبارك فيها بمراجعة متباعدة: بعد يوم، ثم 3 أيام، ثم أسبوع… حتى تتقنها."
        actions={
          due > 0 ? (
            <StartButton target={{ challengeType: 'MISTAKES' }} variant="destructive">
              <RotateCcw className="size-4" /> ابدأ مراجعة {due} سؤال
            </StartButton>
          ) : null
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={RotateCcw} title="لا أخطاء مسجلة بعد" description="العب بعض التحديات؛ أي سؤال تخطئ فيه يظهر هنا مع درسه." action={<Link href="/student/play" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">العودة إلى PLAY</Link>} />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.lessonId} className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{r.lessonName}</p>
                <p className="text-xs text-muted-foreground">
                  {r.subjectName} · {r.unitName}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Progress value={r.masteryPct} className="w-40" tone={r.masteryPct >= 80 ? 'success' : r.masteryPct >= 50 ? 'warning' : 'destructive'} />
                  <span className="text-xs text-muted-foreground">إتقان {r.masteryPct}%</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="rounded-full bg-destructive/10 px-2.5 py-1 font-bold text-destructive">{r.wrong} خطأ</span>
                <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">{r.due} مستحق</span>
                <StartButton target={{ challengeType: 'LESSON_MASTERY', subjectCode: r.subjectCode, lessonId: r.lessonId }} size="sm" variant="outline">
                  تدرّب على الدرس
                </StartButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
