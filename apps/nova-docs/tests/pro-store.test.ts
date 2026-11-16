/** منطق الاستحقاق حول StoreKit (بإضافة أصلية وهمية تحاكي سلوك StoreKit 2). */
import { describe, expect, it, vi } from 'vitest'
import { createProStore } from '../src/stores/pro'
import { FREE_FEATURES, PRO_FEATURES, isFeatureAllowed } from '../src/lib/features'
import type { EntitlementsPayload, NovaStorePlugin } from '../src/platform/native'

function fakeStore(initialPro = false) {
  let pro = initialPro
  let listener: ((p: EntitlementsPayload) => void) | null = null
  const payload = (): EntitlementsPayload => ({ isPro: pro, entitlements: pro ? [{ productId: 'nova.docs.pro.lifetime', transactionId: '1', originalTransactionId: '1', purchaseDate: null, revocationDate: null, ownershipType: 'purchased' }] : [], checkedAt: null })
  const plugin = {
    canMakePayments: vi.fn(async () => ({ canMakePayments: true })),
    getProducts: vi.fn(async () => ({ products: [{ id: 'nova.docs.pro.lifetime', displayName: 'NOVA Pro', description: '', displayPrice: '600,00 DA', price: 600, currencyCode: 'DZD', type: 'nonConsumable' }] })),
    getEntitlements: vi.fn(async () => payload()),
    purchase: vi.fn(async (): Promise<{ status: 'purchased' | 'pending' | 'cancelled' | 'unverified'; isPro: boolean }> => ({ status: 'purchased', isPro: (pro = true) })),
    restore: vi.fn(async () => payload()),
    requestRefund: vi.fn(async () => ({ status: 'submitted' as const })),
    addListener: vi.fn(async (_e: string, cb: (p: EntitlementsPayload) => void) => {
      listener = cb
      return { remove: async () => undefined }
    })
  }
  return {
    plugin: plugin as unknown as NovaStorePlugin & typeof plugin,
    emit: (isPro: boolean) => { pro = isPro; listener?.(payload()) },
    setPro: (v: boolean) => { pro = v }
  }
}

describe('feature gating', () => {
  it('free tier: reading, signing and basic tools only', () => {
    for (const f of ['view', 'search', 'signature', 'merge', 'rotate', 'imagesToPdf', 'scan'] as const) expect(isFeatureAllowed(f, false)).toBe(true)
    for (const f of ['editText', 'ink', 'ocr', 'invoices', 'spreadsheets', 'watermark', 'split'] as const) expect(isFeatureAllowed(f, false)).toBe(false)
  })
  it('pro unlocks everything and the lists do not overlap', () => {
    for (const f of PRO_FEATURES) {
      expect(isFeatureAllowed(f, true)).toBe(true)
      expect(FREE_FEATURES.has(f)).toBe(false)
    }
  })
})

describe('Pro entitlement store (StoreKit 2 contract)', () => {
  it('starts locked and shows the localized App Store price', async () => {
    const { plugin } = fakeStore(false)
    const store = createProStore(plugin)
    await store.getState().init()
    await store.getState().refreshProduct()
    expect(store.getState().ready).toBe(true)
    expect(store.getState().isPro).toBe(false)
    expect(store.getState().product?.displayPrice).toBe('600,00 DA')
  })

  it('product not returned by the App Store → "unavailable" with retry, never an endless spinner', async () => {
    const { plugin } = fakeStore(false)
    const ok = await plugin.getProducts({ productIds: [] })
    plugin.getProducts.mockResolvedValueOnce({ products: [] }) // كما حدث فعلًا على محاكي iOS بلا ملف StoreKit
    const store = createProStore(plugin)
    await store.getState().refreshProduct()
    expect(store.getState().productState).toBe('unavailable')
    expect(store.getState().product).toBeNull()
    plugin.getProducts.mockRejectedValueOnce(new Error('network'))
    await store.getState().refreshProduct()
    expect(store.getState().productState).toBe('unavailable')
    // فتح شاشة الترقية يعيد المحاولة تلقائيًا
    plugin.getProducts.mockResolvedValueOnce(ok)
    store.getState().openPaywall('ocr')
    await vi.waitFor(() => expect(store.getState().productState).toBe('ready'))
    expect(store.getState().product?.displayPrice).toBe('600,00 DA')
    expect(store.getState().isPro).toBe(false)
  })

  it('require() blocks a pro feature and opens the paywall', async () => {
    const { plugin } = fakeStore(false)
    const store = createProStore(plugin)
    await store.getState().init()
    expect(store.getState().require('ocr')).toBe(false)
    expect(store.getState().paywallFor).toBe('ocr')
    expect(store.getState().require('view')).toBe(true)
  })

  it('a verified purchase unlocks Pro and closes the paywall', async () => {
    const { plugin } = fakeStore(false)
    const store = createProStore(plugin)
    await store.getState().init()
    store.getState().openPaywall('invoices')
    expect(await store.getState().purchase()).toBe('purchased')
    expect(store.getState().isPro).toBe(true)
    expect(store.getState().paywallFor).toBeNull()
  })

  it('pending (Ask to Buy) and cancelled purchases do NOT unlock', async () => {
    for (const status of ['pending', 'cancelled', 'unverified'] as const) {
      const { plugin } = fakeStore(false)
      plugin.purchase.mockResolvedValueOnce({ status, isPro: false })
      const store = createProStore(plugin)
      await store.getState().init()
      expect(await store.getState().purchase()).toBe(status)
      expect(store.getState().isPro).toBe(false)
    }
  })

  it('a pending purchase approved later unlocks via Transaction.updates', async () => {
    const f = fakeStore(false)
    f.plugin.purchase.mockResolvedValueOnce({ status: 'pending', isPro: false })
    const store = createProStore(f.plugin)
    await store.getState().init()
    await store.getState().purchase()
    expect(store.getState().isPro).toBe(false)
    f.emit(true)
    expect(store.getState().isPro).toBe(true)
  })

  it('refund / revocation removes the entitlement immediately', async () => {
    const f = fakeStore(true)
    const store = createProStore(f.plugin)
    await store.getState().init()
    expect(store.getState().isPro).toBe(true)
    f.emit(false)
    expect(store.getState().isPro).toBe(false)
    expect(store.getState().require('editText')).toBe(false)
  })

  it('restore purchases: restored vs nothing to restore', async () => {
    const f = fakeStore(false)
    const store = createProStore(f.plugin)
    await store.getState().init()
    expect(await store.getState().restore()).toBe(false)
    expect(store.getState().lastStatus).toBe('nothing_to_restore')
    f.setPro(true)
    expect(await store.getState().restore()).toBe(true)
    expect(store.getState().lastStatus).toBe('restored')
    expect(store.getState().isPro).toBe(true)
  })

  it('a thrown StoreKit error never unlocks', async () => {
    const f = fakeStore(false)
    f.plugin.purchase.mockRejectedValueOnce(new Error('network'))
    const store = createProStore(f.plugin)
    await store.getState().init()
    expect(await store.getState().purchase()).toBe('error')
    expect(store.getState().isPro).toBe(false)
    expect(store.getState().error).toContain('network')
  })

  it('ignores a second purchase while one is in flight', async () => {
    const f = fakeStore(false)
    let resolve!: (v: { status: 'purchased'; isPro: boolean }) => void
    f.plugin.purchase.mockImplementationOnce(() => new Promise((r) => (resolve = r)))
    const store = createProStore(f.plugin)
    await store.getState().init()
    const first = store.getState().purchase()
    expect(await store.getState().purchase()).toBe('unknown')
    resolve({ status: 'purchased', isPro: true })
    expect(await first).toBe('purchased')
    expect(f.plugin.purchase).toHaveBeenCalledTimes(1)
  })
})
