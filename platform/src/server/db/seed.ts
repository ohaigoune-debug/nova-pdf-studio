 
/**
 * بيانات تجريبية عربية واقعية (Demo) — يمكن حذفها عبر `npm run db:reset`.
 * تُنشأ عبر الخدمات الحقيقية (أكواد، حصص، مسح QR، إغلاق) لتكون الحالة متسقة.
 */
import { eq } from 'drizzle-orm'
import { hashPassword } from '@/server/auth/password'
import { createSession, resolveActor } from '@/server/auth/session'
import { createDatabase, type Db } from '@/server/db/connect'
import { LEVELS, SKILLS, STREAMS, WILAYAS } from '@/server/db/reference-data'
import {
  academicYears,
  appSettings,
  content,
  levels,
  profiles,
  schools,
  skills,
  streams,
  users,
  wilayas
} from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { createTeacher } from '@/server/services/admin.service'
import { addThreadMessage, createAssignment, reviewSubmission, saveDraft, submitAnswer } from '@/server/services/assignments.service'
import { createContent } from '@/server/services/content.service'
import { issueAttendanceToken, scanAttendanceToken } from '@/server/services/attendance.service'
import { registerStudent } from '@/server/services/auth.service'
import { closeSession, startSession } from '@/server/services/class-sessions.service'
import { generateCodes } from '@/server/services/enrollment-codes.service'
import { redeemEnrollmentCode } from '@/server/services/enrollment.service'
import { createGroup } from '@/server/services/groups.service'

export const DEMO_ACCOUNTS = {
  admin: { email: 'admin@madrasa.dz', password: 'Admin@12345' },
  teacher: { email: 'osama@madrasa.dz', password: 'Teacher@12345' },
  teacher2: { email: 'nadia@madrasa.dz', password: 'Teacher@12345' },
  student: { email: 'mohamed@madrasa.dz', password: 'Student@12345' }
}

async function actorOf(db: Db, userId: string): Promise<Actor> {
  const s = await createSession(db, { userId, deviceName: 'seed' })
  const a = await resolveActor(db, s.token)
  if (!a) throw new Error('actor')
  return a
}

export async function seedReferenceData(db: Db) {
  const existing = await db.select({ id: wilayas.id }).from(wilayas).limit(1)
  if (existing.length === 0) {
    await db.insert(wilayas).values(WILAYAS.map((w) => ({ code: w.code, nameAr: w.ar, nameFr: w.fr })))
    await db.insert(levels).values(LEVELS.map((l) => ({ code: l.code, nameAr: l.ar, sortOrder: l.order })))
    await db.insert(streams).values(STREAMS.map((s) => ({ code: s.code, nameAr: s.ar, sortOrder: s.order })))
    await db.insert(skills).values(SKILLS.map((s) => ({ code: s.code, nameAr: s.ar, category: s.category })))
    await db.insert(academicYears).values([
      { label: '2025/2026', startsOn: '2025-09-01', endsOn: '2026-06-30', isCurrent: false },
      { label: '2026/2027', startsOn: '2026-09-01', endsOn: '2027-06-30', isCurrent: true }
    ])
  }
}

export async function ensureSuperAdmin(db: Db, email: string, password: string, fullName = 'مالك المنصة') {
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (u) return u.id
  const [row] = await db.insert(users).values({ email, passwordHash: hashPassword(password), role: 'SUPER_ADMIN' }).returning({ id: users.id })
  if (!row) throw new Error('admin')
  await db.insert(profiles).values({ userId: row.id, fullName })
  return row.id
}

const STUDENT_NAMES = [
  'محمد أحمد',
  'سارة بن علي',
  'ياسين بوزيد',
  'أمين بلقاسم',
  'نور الهدى مرابط',
  'عبد الرحمن قاسمي',
  'خديجة بوعلام',
  'إلياس زروقي',
  'ريان حمداني',
  'مريم شريف',
  'أيوب بن عمر',
  'هبة الله سعيدي',
  'إسلام بوخالفة',
  'لينا عثماني',
  'يوسف طالبي',
  'آية بن ناصر',
  'أنس بوشارب',
  'سلسبيل عمراني',
  'عماد الدين لعرابي',
  'رحمة بوقرة'
]

export async function seedDemo(db: Db) {
  const [flag] = await db.select().from(appSettings).where(eq(appSettings.key, 'demo_seeded')).limit(1)
  if (flag) {
    console.log('• demo data already seeded — skip')
    return
  }
  await seedReferenceData(db)

  const adminId = await ensureSuperAdmin(db, DEMO_ACCOUNTS.admin.email, DEMO_ACCOUNTS.admin.password)
  const admin = await actorOf(db, adminId)

  const t1 = await createTeacher(db, admin, {
    email: DEMO_ACCOUNTS.teacher.email,
    password: DEMO_ACCOUNTS.teacher.password,
    fullName: 'حيقون أسامة',
    phone: '0550 00 00 01',
    workspaceName: 'الأستاذ حيقون أسامة — قالمة'
  })
  const t2 = await createTeacher(db, admin, {
    email: DEMO_ACCOUNTS.teacher2.email,
    password: DEMO_ACCOUNTS.teacher2.password,
    fullName: 'نادية بوعزيز',
    phone: '0550 00 00 02',
    workspaceName: 'الأستاذة نادية بوعزيز — قسنطينة'
  })
  const teacher = await actorOf(db, t1.userId)
  const teacher2 = await actorOf(db, t2.userId)

  const w = Object.fromEntries((await db.select().from(wilayas)).map((x) => [x.code, x.id]))
  const lv = Object.fromEntries((await db.select().from(levels)).map((x) => [x.code, x.id]))
  const st = Object.fromEntries((await db.select().from(streams)).map((x) => [x.code, x.id]))
  const [year] = await db.select().from(academicYears).where(eq(academicYears.isCurrent, true))

  const [schoolGuelma] = await db
    .insert(schools)
    .values({ wilayaId: w['24']!, name: 'ثانوية المهد', type: 'PRIVATE', workspaceId: t1.workspaceId })
    .returning()
  await db.insert(schools).values([
    { wilayaId: w['24']!, name: 'ثانوية محمود بن محمود', type: 'LYCEE' },
    { wilayaId: w['25']!, name: 'ثانوية رضا حوحو', type: 'LYCEE' },
    { wilayaId: w['05']!, name: 'ثانوية مصطفى بن بولعيد', type: 'LYCEE' },
    { wilayaId: w['16']!, name: 'ثانوية عمر راسم', type: 'LYCEE' }
  ])

  const g1 = await createGroup(db, teacher, {
    name: 'السبت 08:00 — 3 ثانوي علوم تجريبية',
    wilayaId: w['24'],
    schoolId: schoolGuelma?.id,
    levelId: lv['3AS'],
    streamId: st['SCI'],
    academicYearId: year?.id,
    dayOfWeek: 6,
    startTime: '08:00',
    room: 'القاعة 2',
    capacity: 30,
    startsOn: '2026-09-05'
  })
  const g2 = await createGroup(db, teacher, {
    name: 'الثلاثاء 16:00 — 3 ثانوي آداب وفلسفة',
    wilayaId: w['24'],
    schoolId: schoolGuelma?.id,
    levelId: lv['3AS'],
    streamId: st['LIT'],
    academicYearId: year?.id,
    dayOfWeek: 2,
    startTime: '16:00',
    room: 'القاعة 1',
    capacity: 25
  })
  await createGroup(db, teacher, {
    name: 'الخميس 14:00 — 2 ثانوي',
    wilayaId: w['24'],
    levelId: lv['2AS'],
    streamId: st['TC_LIT'],
    academicYearId: year?.id,
    dayOfWeek: 4,
    startTime: '14:00'
  })
  const g4 = await createGroup(db, teacher2, {
    name: 'الأحد 10:00 — 3 ثانوي رياضيات',
    wilayaId: w['25'],
    levelId: lv['3AS'],
    streamId: st['MATH'],
    academicYearId: year?.id,
    dayOfWeek: 0,
    startTime: '10:00'
  })

  // الطلاب: 12 في الفوج الأول، 6 في الثاني، 2 عند الأستاذة الثانية
  const students: Actor[] = []
  for (let i = 0; i < STUDENT_NAMES.length; i++) {
    const name = STUDENT_NAMES[i]!
    const email = i === 0 ? DEMO_ACCOUNTS.student.email : `student${i + 1}@madrasa.dz`
    const r = await registerStudent(db, {
      email,
      password: DEMO_ACCOUNTS.student.password,
      fullName: name,
      phone: `05${String(50000000 + i * 1234567).slice(0, 8)}`,
      wilayaId: i < 18 ? w['24'] : w['25'],
      levelId: lv['3AS'],
      streamId: i < 12 ? st['SCI'] : i < 18 ? st['LIT'] : st['MATH']
    })
    students.push(await actorOf(db, r.userId))
  }
  const assign = async (group: { id: string }, t: Actor, list: Actor[]) => {
    const codes = await generateCodes(db, t, { groupId: group.id, count: list.length + 5, label: 'دفعة الافتتاح' })
    for (let i = 0; i < list.length; i++) await redeemEnrollmentCode(db, list[i]!, codes.codes[i]!.code)
  }
  const g1Students = students.slice(0, 12)
  await assign(g1, teacher, g1Students)
  await assign(g2, teacher, students.slice(12, 18))
  await assign(g4, teacher2, students.slice(18))

  // 5 حصص سابقة للفوج الأول بأنماط حضور واقعية
  const topics = ['الصور البيانية', 'إعراب الجملة الاسمية', 'الحال والتمييز', 'الأساليب البلاغية: الاستفهام', 'البناء الفكري لنص شعري']
  let day = new Date('2026-09-05T08:00:00+01:00')
  for (let s = 0; s < topics.length; s++) {
    const session = await startSession(db, teacher, { groupId: g1.id, title: topics[s], now: day })
    for (let i = 0; i < g1Students.length; i++) {
      // الطالب 10 يغيب دائماً (سيُعلَّق بعد 4)، الطالب 8 يغيب مرتين، الطالب 3 يتأخر
      if (i === 9) continue
      if (i === 7 && (s === 1 || s === 3)) continue
      const late = i === 2 ? 14 : (i * 7 + s * 3) % 9
      const at = new Date(day.getTime() + late * 60_000)
      const tok = await issueAttendanceToken(db, g1Students[i]!, g1.id, at)
      await scanAttendanceToken(db, teacher, { classSessionId: session.id, token: tok.token, now: at })
    }
    await closeSession(db, teacher, session.id, new Date(day.getTime() + 90 * 60_000))
    day = new Date(day.getTime() + 7 * 24 * 3600_000)
  }

  // واجب تجريبي بإجابة نصية مُصحَّحة وأخرى بانتظار التصحيح
  const asg = await createAssignment(db, teacher, {
    title: 'تحليل نص شعري: البناء الفكري',
    description: 'اقرأ قصيدة "أنشودة المطر" ثم:\n- استخرج الفكرة العامة\n- حدّد صورتين بيانيتين واشرحهما\n- أعرب ما تحته خط',
    subject: 'اللغة العربية',
    topic: 'البناء الفكري',
    dueAt: new Date(Date.now() + 5 * 24 * 3600_000),
    maxScore: 20,
    groupIds: [g1.id],
    studentIds: []
  })
  const sub1 = await submitAnswer(db, g1Students[0]!, asg.id, 'الفكرة العامة: يعبّر الشاعر عن أمله في التغيير من خلال رمز المطر.\nالصورة الأولى: "عيناكِ غابتا نخيل" تشبيه بليغ…\nالصورة الثانية: استعارة في "يتثاءب المساء"…')
  await addThreadMessage(db, teacher, sub1.submissionId, 'أحسنت في الفكرة العامة. وضّح أكثر وجه الشبه في الصورة الأولى.')
  await addThreadMessage(db, g1Students[0]!, sub1.submissionId, 'وجه الشبه هو الاتساع والخصب، أستاذ.')
  await reviewSubmission(db, teacher, sub1.submissionId, { score: 14, strengths: ['استخراج الفكرة العامة', 'تحديد الصورة البيانية'], improvements: ['إعراب الجملة', 'شرح الصورة البيانية'], notes: 'راجع درس الاستعارة المكنية.' })
  await submitAnswer(db, g1Students[1]!, asg.id, 'الفكرة العامة للنص هي الحنين والأمل. الصورة البيانية: تشبيه في البيت الأول…')
  await saveDraft(db, g1Students[2]!, asg.id, 'مسودة: الفكرة العامة…')

  // محتوى خاص بالأستاذ موجّه للفوج الأول
  await createContent(db, teacher, {
    type: 'LESSON',
    title: 'ملخص الحصة: الصور البيانية (خاص بالفوج)',
    summary: 'ما تناولناه في حصة السبت مع أمثلة إضافية.',
    body: '## التشبيه البليغ\n- ما حُذفت منه الأداة ووجه الشبه\n\n## الاستعارة المكنية\n- حُذف فيها المشبه به وأُبقي على لازمة من لوازمه',
    topic: 'البلاغة',
    visibility: 'GROUP_ONLY',
    groupIds: [g1.id],
    publish: true
  })

  // محتوى عام
  await db.insert(content).values([
    {
      authorUserId: adminId,
      type: 'LESSON',
      title: 'الصور البيانية: التشبيه والاستعارة والكناية',
      slug: 'imagery-tashbih-istiara',
      summary: 'درس شامل في الصور البيانية مع أمثلة من نصوص البكالوريا.',
      body: '## التشبيه\nعقد مماثلة بين شيئين...\n\n## الاستعارة\nتشبيه حُذف أحد طرفيه...\n\n## الكناية\nلفظ أُريد به لازم معناه...',
      levelId: lv['3AS'],
      topic: 'البلاغة',
      visibility: 'PUBLIC',
      publishedAt: new Date()
    },
    {
      authorUserId: adminId,
      type: 'LESSON',
      title: 'الحال والتمييز: الفرق والإعراب',
      slug: 'hal-tamyiz',
      summary: 'ملخص قواعد الحال والتمييز مع نماذج إعراب.',
      body: '## الحال\nاسم نكرة منصوب يبيّن هيئة صاحبه...\n\n## التمييز\nاسم نكرة منصوب يزيل إبهام ما قبله...',
      levelId: lv['3AS'],
      topic: 'القواعد',
      visibility: 'PUBLIC',
      publishedAt: new Date()
    },
    {
      authorUserId: adminId,
      type: 'ARTICLE',
      title: 'منهجية الإجابة عن موضوع البكالوريا في اللغة العربية',
      slug: 'bac-methodology',
      summary: 'خطوات البناء الفكري والبناء اللغوي والتقويم النقدي.',
      body: '1. القراءة المتأنية للنص\n2. البناء الفكري\n3. البناء اللغوي\n4. التقويم النقدي',
      levelId: lv['3AS'],
      topic: 'البكالوريا',
      visibility: 'PUBLIC',
      publishedAt: new Date()
    },
    {
      authorUserId: adminId,
      type: 'EXERCISE',
      title: 'تمرين: إعراب جمل من نص "أنشودة المطر"',
      slug: 'exercise-irab-matar',
      summary: 'خمس جمل للإعراب مع التصحيح.',
      body: 'أعرب ما تحته خط: ...',
      levelId: lv['3AS'],
      topic: 'الإعراب',
      visibility: 'PUBLIC',
      publishedAt: new Date()
    },
    {
      authorUserId: adminId,
      type: 'PDF',
      title: 'ملخص الأساليب البلاغية (PDF)',
      slug: 'summary-rhetoric-pdf',
      summary: 'ملخص من 6 صفحات للأساليب الإنشائية والخبرية.',
      levelId: lv['3AS'],
      topic: 'البلاغة',
      visibility: 'PUBLIC',
      publishedAt: new Date()
    },
    {
      authorUserId: adminId,
      type: 'QUIZ',
      title: 'اختبار قصير: الصور البيانية',
      slug: 'quiz-imagery-1',
      summary: '10 أسئلة اختيار من متعدد.',
      levelId: lv['3AS'],
      topic: 'البلاغة',
      visibility: 'PUBLIC',
      publishedAt: new Date()
    }
  ])

  await db.insert(appSettings).values({ key: 'demo_seeded', value: { at: new Date().toISOString() } })
  console.log('✔ demo data seeded')
  console.log('  admin   :', DEMO_ACCOUNTS.admin.email, '/', DEMO_ACCOUNTS.admin.password)
  console.log('  teacher :', DEMO_ACCOUNTS.teacher.email, '/', DEMO_ACCOUNTS.teacher.password)
  console.log('  student :', DEMO_ACCOUNTS.student.email, '/', DEMO_ACCOUNTS.student.password)
}

async function main() {
  process.env.AUTO_MIGRATE = '1'
  const handle = await createDatabase(process.env.DATABASE_URL ?? 'pglite://./data/pglite')
  await seedDemo(handle.db)
  await handle.close()
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
