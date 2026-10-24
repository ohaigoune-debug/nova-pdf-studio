import { redirect } from 'next/navigation'
import { requirePageActor } from '@/server/auth/current-user'

/** الحضور (الماسح والحصص) مخفي بقرار المالك (2026-10-24)؛ عمل المساعد المتبقّي: قائمة التلاميذ */
export default async function AssistantHomePage() {
  await requirePageActor('ASSISTANT')
  redirect('/assistant/students')
}
