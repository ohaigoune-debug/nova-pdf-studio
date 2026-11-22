import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { ZoomRoom } from '@/components/live/zoom-room'
import { ZOOM_IMPORT_MAP } from '@/lib/zoom-web'
import { requirePageActor } from '@/server/auth/current-user'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'بدء الحصة', robots: { index: false } }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** بدء الحصة كمضيف من المنصة (المشرف، بحساب Zoom المربوط): نفس غرفة التلميذ بتوقيع المضيف ومفتاحه */
export default async function LiveHostPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageActor('SUPER_ADMIN')
  const { id } = await params
  if (!UUID.test(id)) notFound()
  const nonce = (await headers()).get('x-nonce') ?? undefined
  return (
    <>
      <script type="importmap" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(ZOOM_IMPORT_MAP) }} />
      <ZoomRoom sessionId={id} mode="host" />
    </>
  )
}
