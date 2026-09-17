import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { t } from '@/i18n'
import { requirePageActor } from '@/server/auth/current-user'
import { TeacherForm } from './teacher-form'

export default async function NewTeacherPage() {
  await requirePageActor('SUPER_ADMIN')
  return (
    <>
      <PageHeader title={t('admin.newTeacher')} description="يُنشأ للأستاذ حساب ومساحة عمل مستقلة (Tenant) لا يرى غيرها." />
      <Card className="max-w-2xl">
        <CardContent className="p-6">
          <TeacherForm />
        </CardContent>
      </Card>
    </>
  )
}
