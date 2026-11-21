/**
 * تفعيل دورة بكود — مدخل واحد بسيط (قرار المالك 21 نوفمبر 2026 بعد معاناة التلاميذ):
 * خانة واحدة تقبل كود الدورة (11 رقمًا) أو كود الطلب (6 أرقام، وصل بالـSMS بعد تسليم الكتاب)،
 * مكتوبًا بأي أرقام وبأي فواصل. كود الطلب يُطابَق بهاتف الحساب ثم هاتف الوليّ تلقائيًّا،
 * ولا يُسأل التلميذ عن هاتف إلا إن وصل الكود إلى رقم ثالث.
 *
 * الفحص المسبق بالبصمة يمنع احتساب «محاولة فاشلة» على هاتف لا يخصّ هذا الكود.
 */
import { and, eq, gt, inArray, isNull } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { courseClaims, profiles, students } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { codeDigits, codeKind } from '@/lib/code-input'
import { claimCourse, hashClaimCode, normalizePhone } from './claims.service'
import { redeemCourseCode } from './course-codes.service'

export interface RedeemResult {
  courseTitle: string
  href: string
}

async function accountPhones(db: Db, actor: Actor): Promise<string[]> {
  const [row] = await db
    .select({ phone: profiles.phone, guardian: students.guardianPhone })
    .from(students)
    .leftJoin(profiles, eq(profiles.userId, students.userId))
    .where(eq(students.id, actor.studentId!))
    .limit(1)
  return [row?.phone, row?.guardian].filter((p): p is string => Boolean(p)).map(normalizePhone)
}

export async function redeemTypedCode(db: Db, actor: Actor, input: { code: string; phone?: string | null }): Promise<RedeemResult> {
  if (actor.role !== 'STUDENT' || !actor.studentId) throw new AppError('FORBIDDEN')
  const digits = codeDigits(input.code)
  const kind = codeKind(digits)
  if (!kind) throw new AppError('CODE_LENGTH')

  if (kind === 'COURSE') {
    const r = await redeemCourseCode(db, actor, digits)
    return { courseTitle: r.courseTitle, href: `/student/courses/${encodeURIComponent(r.slug)}` }
  }

  const typed = input.phone ? normalizePhone(codeDigits(input.phone)) : null
  const candidates = [...new Set([...(typed ? [typed] : []), ...(await accountPhones(db, actor))])].filter((p) => p.length >= 9)
  if (candidates.length) {
    const hash = hashClaimCode(digits)
    // هاتف فيه رمز مفتوح بهذه البصمة، أو رمز فعّله هذا التلميذ نفسه سابقًا (إعادة إدخال)
    const hit = await db
      .select({ phone: courseClaims.phone })
      .from(courseClaims)
      .where(and(inArray(courseClaims.phone, candidates), eq(courseClaims.codeHash, hash)))
    const open = await db
      .select({ phone: courseClaims.phone })
      .from(courseClaims)
      .where(and(inArray(courseClaims.phone, candidates), eq(courseClaims.codeHash, hash), isNull(courseClaims.claimedAt), gt(courseClaims.expiresAt, new Date())))
    const phone = open[0]?.phone ?? hit[0]?.phone
    if (phone) {
      const r = await claimCourse(db, actor, { phone, code: digits })
      return { courseTitle: r.courseTitle, href: '/student/courses' }
    }
  }
  // لا تطابق: الهاتف المكتوب يمرّ بالمسار العادي (عدّاد المحاولات)، ودونه نطلبه
  if (typed) {
    const r = await claimCourse(db, actor, { phone: typed, code: digits })
    return { courseTitle: r.courseTitle, href: '/student/courses' }
  }
  throw new AppError('CLAIM_NEEDS_PHONE')
}
