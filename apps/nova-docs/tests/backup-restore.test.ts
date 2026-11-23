/** النسخ الاحتياطي والاستعادة: نسخة صالحة تُستعاد كاملة، وملف SQLite غريب يُرفض دون أن يمس البيانات الحالية. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import initSqlJs from 'sql.js'
import { closeDatabase, getDatabase, openDatabase, replaceDatabase } from '@modules/database/main'
import { listCustomers, saveCustomer } from '@modules/customers/main/repository'
import { listInvoices, saveInvoice } from '@modules/invoices/main/repository'
import type { DbStorage } from '../src/platform/shims/sqlite-browser'

class MemoryStorage implements DbStorage {
  bytes: Uint8Array | null = null
  async read() { return this.bytes }
  async write(b: Uint8Array) { this.bytes = b }
}

beforeAll(async () => {
  await openDatabase(new MemoryStorage())
})
afterAll(async () => {
  await closeDatabase()
})

describe('backup & restore', () => {
  it('a backup taken earlier restores invoices and customers exactly', async () => {
    const c = saveCustomer({ companyName: 'Librairie En-Nour', city: 'Bou Saada' })
    saveInvoice({ issueDate: '2026-11-16', currency: 'DZD', customerId: c.id, items: [{ name: 'Ramette A4', quantityMilli: 2000, unitPriceMinor: 75050, discountBps: 0, taxBps: 1900 }] })
    const backup = getDatabase().exportBytes()
    expect(new TextDecoder().decode(backup.slice(0, 15))).toBe('SQLite format 3')
    // تغييرات بعد النسخة
    saveCustomer({ companyName: 'Après sauvegarde' })
    saveInvoice({ issueDate: '2026-11-17', currency: 'DZD', items: [] })
    expect(listInvoices({}).total).toBe(2)
    replaceDatabase(backup)
    expect(listInvoices({}).total).toBe(1)
    expect(listCustomers().map((x) => x.companyName)).toEqual(['Librairie En-Nour'])
  })

  it('rejects a foreign SQLite file and keeps the current data untouched', async () => {
    const SQL = await initSqlJs()
    const foreign = new SQL.Database()
    foreign.run('CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT); INSERT INTO notes (body) VALUES (\'hello\');')
    const bytes = foreign.export()
    foreign.close()
    const before = listInvoices({}).total
    expect(() => replaceDatabase(bytes)).toThrow(/not a NOVA backup/)
    expect(listInvoices({}).total).toBe(before)
    expect(listCustomers().length).toBe(1)
  })

  it('rejects a corrupted file and keeps the current data', () => {
    const junk = new TextEncoder().encode('SQLite format 3\u0000' + 'x'.repeat(5000))
    const before = listInvoices({}).total
    expect(() => replaceDatabase(junk)).toThrow()
    expect(listInvoices({}).total).toBe(before)
  })
})
