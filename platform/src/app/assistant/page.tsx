import { redirect } from 'next/navigation'
import { requirePageActor } from '@/server/auth/current-user'
import { isClassroomAssistant } from '@/server/lib/actor'

/** الحضور (الماسح والحصص) مخفي بقرار المالك (2026-10-24)؛ عمل المساعد المتبقّي: قائمة التلاميذ */
export default async function AssistantHomePage() {
  const actor = await requirePageActor('ASSISTANT')
  // «الأستاذ المساعد» يدخل القسم الافتراضي مباشرة
  redirect(isClassroomAssistant(actor) ? '/assistant/classroom' : '/assistant/students')
}
