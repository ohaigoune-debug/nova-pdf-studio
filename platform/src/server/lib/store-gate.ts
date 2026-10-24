import { redirect } from 'next/navigation'
import { getCurrentActor } from '@/server/auth/current-user'

/**
 * قرار المالك 2026-10-24: لا متجر مستقل في واجهات التصفح — الكتاب يُشترى مع دورته.
 * التلاميذ والزوار يُوجَّهون إلى كتالوج الدورات؛ الأساتذة والإدارة يبقى لهم /store (سوق الأساتذة وملفات PDF).
 * روابط الطلبات القديمة /store/orders/* لا تمرّ بهذه البوابة وتحتفظ بقواعد ملكيتها.
 */
export async function gateStoreBrowsing() {
  const actor = await getCurrentActor()
  if (!actor || (actor.role !== 'TEACHER' && actor.role !== 'SUPER_ADMIN' && actor.role !== 'ASSISTANT')) redirect('/student/courses/catalog')
  return actor
}
