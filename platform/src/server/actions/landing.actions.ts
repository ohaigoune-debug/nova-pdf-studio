'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { runAction, type ActionResult } from '@/server/lib/action-result'
import { errorMessage } from '@/i18n'
import { isAppError } from '@/server/lib/errors'
import { createLandingForCourse, updateLanding } from '@/server/services/landing.service'

/** زر «إنشاء صفحة هبوط» في صفحة الدورة: تُنشأ متوقفة ثم يُفتح محرّرها */
export async function createLandingAction(fd: FormData): Promise<void> {
  const courseId = String(fd.get('courseId') ?? '')
  const row = await createLandingForCourse(await getDb(), await requireRole('SUPER_ADMIN'), courseId)
  revalidatePath(`/admin/courses/${courseId}`)
  revalidatePath('/admin/landing')
  redirect(`/admin/landing/${row.id}`)
}

const FIELD_ERRORS: Record<string, string> = {
  slug: 'الرابط: حروف لاتينية صغيرة وأرقام وشرطة فقط (من 2 إلى 40)، مثل bac2027',
  headline: 'العنوان قصير جدًا',
  videoUrl: 'الصق رابط فيديو من يوتيوب أو Bunny كما هو'
}

/** حفظ محرّر صفحة الهبوط */
export async function saveLandingAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const id = String(fd.get('id') ?? '')
  const faq = Array.from({ length: 8 }, (_, i) => ({ q: String(fd.get(`faq_q_${i}`) ?? ''), a: String(fd.get(`faq_a_${i}`) ?? '') }))
  const input = {
    slug: String(fd.get('slug') ?? ''),
    headline: String(fd.get('headline') ?? ''),
    subheadline: String(fd.get('subheadline') ?? ''),
    videoUrl: String(fd.get('videoUrl') ?? ''),
    bullets: String(fd.get('bullets') ?? '').split('\n'),
    about: String(fd.get('about') ?? ''),
    faq,
    active: fd.get('active') === 'on'
  }
  try {
    await updateLanding(await getDb(), await requireRole('SUPER_ADMIN'), id, input)
  } catch (err) {
    if (isAppError(err) && err.code === 'VALIDATION') {
      const field = String(err.details?.field ?? '')
      const taken = err.details?.reason === 'taken'
      return { ok: false, error: { code: 'VALIDATION', message: errorMessage('VALIDATION'), fieldErrors: { [field]: taken ? 'هذا الرابط مستعمل لصفحة أخرى' : (FIELD_ERRORS[field] ?? 'قيمة غير صالحة') } } }
    }
    return runAction(async () => {
      throw err
    })
  }
  revalidatePath('/admin/landing')
  revalidatePath(`/admin/landing/${id}`)
  revalidatePath('/go/[slug]', 'page')
  return { ok: true, data: undefined }
}
