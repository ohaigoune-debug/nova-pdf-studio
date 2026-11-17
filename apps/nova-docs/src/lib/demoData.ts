/**
 * بيانات العرض في نسخة iOS: نفس بيانات Windows التجريبية، مع استبدال اسم «ليلى مراد» (اسم فنانة معروفة)
 * باسم وهمي محايد قبل ظهوره في لقطات المتجر — بقرار المالك (17 نوفمبر). نسخة Windows لا تتغير.
 */
import { clearDemoData, demoStatus, loadDemoData } from '@modules/database/main/demo-data'
import { getDatabase } from '@modules/database/main'

const FROM = { first: 'ليلى', last: 'مراد', email: 'leila.mourad@example.com' }
const TO = { first: 'سلمى', last: 'بن عيسى', email: 'salma.benaissa@example.com' }

/** يطبّق الاستبدال على بيانات العرض فقط (is_demo = 1)، بما فيها نسخ اسم العميل المحفوظة داخل الفواتير. */
export function neutralizeDemoNames(): void {
  const db = getDatabase()
  db.run(`UPDATE customers SET first_name = ?, last_name = ?, email = ? WHERE is_demo = 1 AND first_name = ? AND last_name = ?`, [TO.first, TO.last, TO.email, FROM.first, FROM.last])
  db.run(
    `UPDATE invoices SET customer_snapshot = replace(replace(replace(customer_snapshot, ?, ?), ?, ?), ?, ?) WHERE is_demo = 1`,
    [FROM.first, TO.first, FROM.last, TO.last, FROM.email, TO.email]
  )
}

export function loadIosDemoData(): ReturnType<typeof loadDemoData> {
  const res = loadDemoData()
  neutralizeDemoNames()
  return res
}

export { clearDemoData, demoStatus }
