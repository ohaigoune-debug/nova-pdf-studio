import { LiveSessionForm } from '@/components/live/live-form'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { coursesForLiveForm } from '@/server/services/live.service'

export const dynamic = 'force-dynamic'

export default async function NewLivePage({ searchParams }: { searchParams: Promise<{ course?: string }> }) {
  const actor = await requirePageActor('SUPER_ADMIN')
  const sp = await searchParams
  const courses = await coursesForLiveForm(await getDb(), actor)
  return (
    <div className="space-y-6">
      <PageHeader title="حصة مباشرة جديدة" />
      <Card>
        <CardContent className="pt-6">
          <LiveSessionForm defaults={{ courseId: sp.course }} courses={courses} />
        </CardContent>
      </Card>
    </div>
  )
}
