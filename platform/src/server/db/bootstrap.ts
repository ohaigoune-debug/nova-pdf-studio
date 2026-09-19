/**
 * إقلاع منصة إنتاجية: بيانات مرجعية + أول مشرف عام، بلا أي بيانات تجريبية.
 * يُشغَّل مرة واحدة بعد الهجرات:  ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run db:bootstrap
 * آمن للتكرار: لا يلمس المرجعيات إن وُجدت ولا يعيد إنشاء المشرف.
 */
import { eq } from 'drizzle-orm'
import { createDatabase, type Db } from './connect'
import { users, wilayas } from './schema'
import { ensureSuperAdmin, seedReferenceData } from './seed'

/** هذا الحساب يملك المنصة كلها، فحدّه أعلى من حدّ الطلاب (8) */
const MIN_ADMIN_PASSWORD = 12

export interface BootstrapInput {
  email: string
  password: string
  fullName?: string
}

export interface BootstrapResult {
  userId: string
  seededReferenceData: boolean
  createdAdmin: boolean
}

export async function bootstrapPlatform(db: Db, input: BootstrapInput): Promise<BootstrapResult> {
  const email = input.email.trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('ADMIN_EMAIL غير صالح')
  if (input.password.length < MIN_ADMIN_PASSWORD) throw new Error(`ADMIN_PASSWORD قصيرة — ${MIN_ADMIN_PASSWORD} حرفاً على الأقل لحساب المشرف`)

  const hadReferenceData = (await db.select({ id: wilayas.id }).from(wilayas).limit(1)).length > 0
  await seedReferenceData(db)

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  const userId = await ensureSuperAdmin(db, email, input.password, input.fullName?.trim() || 'مالك المنصة')

  return { userId, seededReferenceData: !hadReferenceData, createdAdmin: existing.length === 0 }
}

async function main() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password) {
    console.error('✖ لا بد من ADMIN_EMAIL و ADMIN_PASSWORD')
    console.error('  مثال: ADMIN_EMAIL=you@madrasadz.com ADMIN_PASSWORD=… npm run db:bootstrap')
    process.exit(1)
  }
  process.env.AUTO_MIGRATE = '1'
  const handle = await createDatabase(process.env.DATABASE_URL ?? 'pglite://./data/pglite')
  try {
    const r = await bootstrapPlatform(handle.db, { email, password, fullName: process.env.ADMIN_NAME })
    console.log(r.seededReferenceData ? '✔ البيانات المرجعية (ولايات، مستويات، شعب، مهارات) أُدرجت' : '• البيانات المرجعية موجودة — تُركت كما هي')
    console.log(r.createdAdmin ? `✔ أُنشئ المشرف العام: ${email}` : `• المشرف موجود مسبقاً: ${email} (كلمة سره لم تُغيَّر)`)
    console.log('  بلا أي بيانات تجريبية — المنصة فارغة وجاهزة لأول أستاذ.')
  } finally {
    await handle.close()
  }
}

if (process.argv[1] && process.argv[1].endsWith('bootstrap.ts')) {
  main().catch((err) => {
    console.error('✖', err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
