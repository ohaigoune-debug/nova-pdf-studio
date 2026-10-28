import { NextResponse, type NextRequest } from 'next/server'
import { errorMessage } from '@/i18n'
import { resolveActor, SESSION_COOKIE } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import type { Db } from '@/server/db/connect'
import type { Actor } from '@/server/lib/actor'
import { isAppError, toAppError } from '@/server/lib/errors'
import { iosNoStore } from '@/server/services/ios-session.service'

/** خطأ JSON بنفس صيغة الواجهة، مع سبب المنع إن وُجد (ROLE / PHONE_VERIFICATION_REQUIRED) دون أي تفاصيل داخلية */
export function iosApiError(err: unknown) {
  const e = isAppError(err) ? err : toAppError(err)
  const reason = e.code === 'FORBIDDEN' && typeof e.details?.reason === 'string' ? e.details.reason : undefined
  // كل «غير موجود» في هذه الواجهة 404 (بعض الرموز القديمة مضبوطة على 400 لصفحات الويب)
  const status = e.code.endsWith('_NOT_FOUND') ? 404 : e.status
  return NextResponse.json({ ok: false, error: { code: e.code, message: errorMessage(e.code), ...(reason ? { reason } : {}) } }, { status })
}

/**
 * GET للقراءة فقط بكوكي جلسة الموقع نفسها. الرد خاص وغير مخزَّن، ولا ترويسات CORS.
 * الرد المصادَق عليه يحمل X-Madrasadz-Account ليرفض التطبيق ردًّا يخص حسابًا آخر (نفس عقد تصدير PDF).
 */
export async function iosApiGet<T>(req: NextRequest, run: (db: Db, actor: Actor | null) => Promise<T>): Promise<Response> {
  try {
    const db = await getDb()
    const actor = await resolveActor(db, req.cookies.get(SESSION_COOKIE)?.value)
    const data = await run(db, actor)
    const response = NextResponse.json({ ok: true, data })
    if (actor) response.headers.set('X-Madrasadz-Account', actor.userId)
    return iosNoStore(response)
  } catch (err) {
    return iosNoStore(iosApiError(err))
  }
}
