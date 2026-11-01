import { GraduationCap } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listEditableCourses } from '@/server/services/course-staff.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'دوراتي' }

export default async function StudioHomePage() {
  const actor = await requirePageActor('CONTENT_UPLOADER')
  const courses = await listEditableCourses(await getDb(), actor)
  return (
    <div className="space-y-6">
      <PageHeader title="دوراتي" description="اختر الدورة ثم «أضف درسًا»: ملف PDF وفيديو في شاشة واحدة." />
      {courses.length === 0 ? (
        <EmptyState icon={GraduationCap} title="لا دورات مسندة إليك بعد" description="تسند الإدارة إليك الدورات التي ترفع دروسها." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <Link key={c.id} href={`/studio/courses/${c.id}`} className="rounded-lg border bg-card p-5 shadow-soft transition-colors hover:border-primary/50">
              <span className="block text-lg font-bold">{c.title}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{c.teacherName ?? ''} · {c.season}</span>
              <Badge className="mt-3" variant={c.status === 'PUBLISHED' ? 'success' : 'secondary'}>{c.status === 'PUBLISHED' ? 'منشورة' : 'مسودة'}</Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
