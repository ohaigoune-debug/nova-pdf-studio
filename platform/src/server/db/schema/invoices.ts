import { sql } from 'drizzle-orm'
import { check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { id, inList, timestamps } from './_common'
import { users } from './auth'
import { students } from './students'
import { orders } from './store'

/**
 * الفواتير (قرار المالك 16 نوفمبر 2026): فاتورة لكل تلميذ بالاسم والهاتف ورمز الحساب ورقم الفاتورة.
 * تُنشأ تلقائيًا عند تسليم الطلب (نقدًا أو بالبطاقة)، ويدويًا من الإدارة للحالات الخاصة.
 * لا تُحذف فاتورة أبدًا: الإلغاء (إرجاع الطلب مثلًا) يُبقي رقمها في التسلسل.
 * ما يُطبع مجمَّد وقت الإصدار (الأسطر، المبالغ، بيانات البائع): تغيير السعر أو الإعدادات لاحقًا لا يغيّر فاتورة صادرة.
 */
export const INVOICE_STATUSES = ['ISSUED', 'CANCELLED'] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]
export const INVOICE_SOURCES = ['ORDER', 'MANUAL'] as const
export type InvoiceSource = (typeof INVOICE_SOURCES)[number]
/** طرق الدفع على الفاتورة: طرق الطلب (COD/TRANSFER/FREE/ONLINE) + اليدوية (CASH نقدًا مباشرة، POS نقطة بيع، OTHER) */
export const INVOICE_PAYMENT_METHODS = ['COD', 'TRANSFER', 'FREE', 'ONLINE', 'CASH', 'POS', 'OTHER'] as const
export type InvoicePaymentMethod = (typeof INVOICE_PAYMENT_METHODS)[number]

export interface InvoiceLine {
  title: string
  qty: number
  unitDzd: number
  totalDzd: number
}

/** بيانات البائع كما كانت في الإعدادات لحظة الإصدار (قرار المالك 16 نوفمبر 2026: الاسم وNIF والحساب البنكي فقط) */
export interface InvoiceSeller {
  name: string
  nif: string
  bankAccount: string
  footer: string
}

export const invoices = pgTable(
  'invoices',
  {
    id: id(),
    /** الرقم المطبوع: F-2026-000001 (البادئة من الإعدادات، والتسلسل سنوي) */
    number: text('number').notNull().unique(),
    year: integer('year').notNull(),
    seq: integer('seq').notNull(),
    source: text('source').notNull(),
    /** طلب واحد ⇒ فاتورة واحدة على الأكثر */
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    /** حساب المشتري (التلميذ أو وليّه) — يرى فاتورته من «حسابي» */
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    /** التلميذ المعنيّ (المستفيد) */
    studentId: uuid('student_id').references(() => students.id, { onDelete: 'set null' }),
    customerName: text('customer_name').notNull(),
    customerPhone: text('customer_phone'),
    /** رمز الحساب (أول 8 خانات، كالعلامة المائية) */
    studentCode: text('student_code'),
    lines: jsonb('lines').$type<InvoiceLine[]>().notNull(),
    subtotalDzd: integer('subtotal_dzd').notNull(),
    shippingDzd: integer('shipping_dzd').notNull().default(0),
    /** المخصوم برصيد التلميذ أو تخفيض */
    discountDzd: integer('discount_dzd').notNull().default(0),
    totalDzd: integer('total_dzd').notNull(),
    paymentMethod: text('payment_method').notNull(),
    /** الدفع بالبطاقة عبر eFawtara (Guiddini): رقم المعاملة عند البوابة (order_number) ورابط إيصالها الموقَّع */
    paymentRef: text('payment_ref'),
    paymentReceiptUrl: text('payment_receipt_url'),
    seller: jsonb('seller').$type<InvoiceSeller>().notNull(),
    note: text('note'),
    status: text('status').notNull().default('ISSUED'),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelReason: text('cancel_reason'),
    /** null = أصدرها النظام تلقائيًا */
    createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps
  },
  (t) => [
    check('invoices_status_check', inList(t.status, INVOICE_STATUSES)),
    check('invoices_source_check', inList(t.source, INVOICE_SOURCES)),
    check('invoices_payment_check', inList(t.paymentMethod, INVOICE_PAYMENT_METHODS)),
    check('invoices_amounts_check', sql`${t.subtotalDzd} >= 0 AND ${t.shippingDzd} >= 0 AND ${t.discountDzd} >= 0 AND ${t.totalDzd} >= 0`),
    uniqueIndex('invoices_year_seq_unique').on(t.year, t.seq),
    uniqueIndex('invoices_order_unique').on(t.orderId),
    index('invoices_user_idx').on(t.userId, t.issuedAt),
    index('invoices_student_idx').on(t.studentId),
    index('invoices_issued_idx').on(t.issuedAt)
  ]
)

/** آخر رقم في كل سنة: زيادة ذرّية (لا رقمان متطابقان ولا فجوة بالسباق) */
export const invoiceCounters = pgTable('invoice_counters', {
  year: integer('year').primaryKey(),
  last: integer('last').notNull().default(0)
})

export type InvoiceRow = typeof invoices.$inferSelect
