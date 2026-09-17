import { getTableName, sql, type AnyColumn } from 'drizzle-orm'

/**
 * مرجع عمود مؤهَّل دائماً ("table"."column") للاستعمال داخل الاستعلامات الفرعية الخام.
 * Drizzle يُخرج الأعمدة غير مؤهَّلة عندما لا يوجد join، فيصبح المرجع داخل subquery ملتبساً.
 */
export function qcol(column: AnyColumn) {
  return sql.raw(`"${getTableName(column.table)}"."${column.name}"`)
}
