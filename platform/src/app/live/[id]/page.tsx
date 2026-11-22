import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { ZoomRoom } from '@/components/live/zoom-room'
import { ZOOM_IMPORT_MAP } from '@/lib/zoom-web'
import { requirePageActor } from '@/server/auth/current-user'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'الحصة المباشرة', robots: { index: false } }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * الحصة المباشرة داخل المنصة (Zoom Meeting SDK، 22 نوفمبر 2026): خارج إطار حساب التلميذ لأن Zoom
 * يرسم صفحة الاجتماع كاملة. الصلاحية (الاشتراك، الشروط، نافذة الانضمام) يتحقق منها الخادم حين تطلب
 * الصفحة توقيع الدخول؛ وإن تعذّر شيء ظهر زرّ «افتح في تطبيق Zoom».
 */
export default async function LiveRoomPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageActor('STUDENT')
  const { id } = await params
  if (!UUID.test(id)) notFound()
  const nonce = (await headers()).get('x-nonce') ?? undefined
  return (
    <>
      {/* React 18 لواجهة Zoom (مثالها الرسمي)، قبل أي استيراد لها */}
      <script type="importmap" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(ZOOM_IMPORT_MAP) }} />
      <ZoomRoom sessionId={id} />
    </>
  )
}
