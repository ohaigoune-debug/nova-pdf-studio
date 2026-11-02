import type { OrderStatus, PaymentMethod } from '@/server/db/schema/enums'
import type { Actor } from '@/server/lib/actor'
import { ORDER_STATUS_AR } from '@/server/services/order-status.service'
import { PAYMENT_AR, type PhoneHistory } from '@/server/services/store.service'
import type { WorkerOrder } from '@/components/worker/worker-orders'

interface Row {
  id: string
  number: string
  status: string
  paymentMethod: string
  needsShipping: boolean
  totalDzd: number
  customerName: string
  phone: string
  wilayaName: string | null
  commune: string | null
  note: string | null
  itemsText: string
  streamName: string | null
  hasCourse: boolean
  deliveryTrackingId: string | null
  confirmAttempts: number
  lastCallAt: Date | null
  reservedById: string | null
  history: PhoneHistory
}

/** صفّ الطلب كما تعرضه بطاقة تطبيق العامل (بيانات قابلة للتسلسل، بلا تواريخ خام) */
export function toWorkerOrder(r: Row, actor: Actor): WorkerOrder {
  return {
    id: r.id,
    number: r.number,
    status: r.status,
    statusLabel: ORDER_STATUS_AR[r.status as OrderStatus] ?? r.status,
    customerName: r.customerName,
    phone: r.phone,
    place: [r.wilayaName, r.commune].filter(Boolean).join(' · ') || '—',
    itemsText: r.itemsText,
    note: r.note,
    streamName: r.streamName,
    totalDzd: r.totalDzd,
    paymentLabel: PAYMENT_AR[r.paymentMethod as PaymentMethod] ?? r.paymentMethod,
    needsShipping: r.needsShipping,
    hasCourse: Boolean(r.hasCourse),
    shipped: Boolean(r.deliveryTrackingId),
    confirmAttempts: r.confirmAttempts,
    lastCallAt: r.lastCallAt ? new Date(r.lastCallAt).toISOString() : null,
    history: r.history,
    reservedByMe: r.reservedById === actor.userId
  }
}
