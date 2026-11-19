/**
 * بيانات العرض في نسخة iOS: نفس بيانات Windows التجريبية، مع استبدال اسم «ليلى مراد» (اسم فنانة معروفة)
 * باسم وهمي محايد، وبيانات اتصال وهمية واضحة، قبل ظهورها في لقطات المتجر — بقرار المالك (17 نوفمبر). نسخة Windows لا تتغير.
 */
import { clearDemoData, demoStatus, loadDemoData } from '@modules/database/main/demo-data'
import { getDatabase } from '@modules/database/main'

const FROM = { first: 'ليلى', last: 'مراد', email: 'leila.mourad@example.com' }
const TO = { first: 'سلمى', last: 'بن عيسى', email: 'salma.benaissa@example.com' }

/**
 * عناوين بريد وأرقام هاتف قد تكون حقيقية في بيانات Windows التجريبية — تُستبدل في iOS بنطاقات example
 * وأرقام مخصّصة للأعمال الخيالية (فرنسا: 06 39 98 xx xx حسب ARCEP؛ بريطانيا 07700 900xxx حسب Ofcom) أو أرقام أصفار.
 */
const CONTACTS: [string, string][] = [
  ['ahmed@alnour.dz', 'ahmed@alnour.example'],
  ['0550 12 34 56', '021 00 00 01'],
  ['sarah@lumiere.fr', 'sarah@lumiere.example'],
  ['+33 6 12 34 56 78', '+33 6 39 98 12 34'],
  ['karim@haddad-ie.com', 'karim@haddad.example'],
  ['0661 98 76 54', '041 00 00 02'],
  ['0770 11 22 33', '031 00 00 03'],
  ['john@walkersons.co.uk', 'john@walkersons.example']
]

/** يطبّق الاستبدال على بيانات العرض فقط (is_demo = 1)، بما فيها نسخ اسم العميل المحفوظة داخل الفواتير. */
export function neutralizeDemoNames(): void {
  const db = getDatabase()
  db.run(`UPDATE customers SET first_name = ?, last_name = ?, email = ? WHERE is_demo = 1 AND first_name = ? AND last_name = ?`, [TO.first, TO.last, TO.email, FROM.first, FROM.last])
  db.run(
    `UPDATE invoices SET customer_snapshot = replace(replace(replace(customer_snapshot, ?, ?), ?, ?), ?, ?) WHERE is_demo = 1`,
    [FROM.first, TO.first, FROM.last, TO.last, FROM.email, TO.email]
  )
  for (const [from, to] of CONTACTS) {
    db.run(`UPDATE customers SET email = ? WHERE is_demo = 1 AND email = ?`, [to, from])
    db.run(`UPDATE customers SET phone = ? WHERE is_demo = 1 AND phone = ?`, [to, from])
    db.run(`UPDATE invoices SET customer_snapshot = replace(customer_snapshot, ?, ?) WHERE is_demo = 1`, [from, to])
  }
}

export function loadIosDemoData(): ReturnType<typeof loadDemoData> {
  const res = loadDemoData()
  neutralizeDemoNames()
  return res
}

export { clearDemoData, demoStatus }
