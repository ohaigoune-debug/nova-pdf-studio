import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { HIDEABLE_STUDENT_ENTRIES } from '@/lib/student-menu'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { getHiddenStudentEntries } from '@/server/services/student-menu.service'
import { StudentMenuForm } from './form'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'أقسام حساب التلميذ' }

export default async function StudentMenuSettingsPage() {
  await requirePageActor('SUPER_ADMIN')
  const hidden = await getHiddenStudentEntries(await getDb())
  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader title="أقسام حساب التلميذ" description="أشّر على ما تريد إخفاءه عن التلاميذ: يختفي من القائمة ومن التبويبات، وتُحوَّل صفحته إلى الرئيسية. لا يُحذف أي محتوى، وإلغاء التأشير يعيده." />
      <Card><CardContent className="pt-6"><StudentMenuForm entries={HIDEABLE_STUDENT_ENTRIES} hidden={hidden} /></CardContent></Card>
    </div>
  )
}
