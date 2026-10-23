import { RulesForm } from '@/components/play-admin/rules-form'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { getPlayRules } from '@/server/services/play.service'

export const dynamic = 'force-dynamic'

/** Admin → PLAY → قواعد اللعبة (XP، المستويات، الإتقان، الحالات المقدَّمة، لوحة الترتيب) */
export default async function PlaySettingsPage() {
  await requirePageActor('SUPER_ADMIN')
  const rules = await getPlayRules(await getDb())
  return (
    <>
      <PageHeader title="قواعد MADRASADZ PLAY" description="تُطبَّق فوراً على الجلسات الجديدة. القيم السالبة مرفوضة؛ المستويات تُرتَّب تلقائياً." />
      <Card>
        <CardContent className="p-5 sm:p-6">
          <RulesForm initial={rules} />
        </CardContent>
      </Card>
    </>
  )
}
