import { sql } from 'drizzle-orm'
import { timestamp, uuid } from 'drizzle-orm/pg-core'

export const id = () => uuid('id').primaryKey().defaultRandom()

export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())
}

export const softDelete = {
  deletedAt: timestamp('deleted_at', { withTimezone: true })
}

/** SQL fragment: column IN ('A','B',...) for CHECK constraints */
export function inList(column: unknown, values: readonly string[]) {
  return sql`${column} IN (${sql.join(
    values.map((v) => sql.raw(`'${v}'`)),
    sql.raw(', ')
  )})`
}
