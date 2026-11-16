/**
 * حالة NOVA Pro في الواجهة. لا تحفظ الواجهة "isPro" كمصدر للحقيقة: تُقرأ دائمًا من StoreKit
 * (Transaction.currentEntitlements — موثّقة على الجهاز وتعمل دون إنترنت) وتُحدَّث بحدث entitlementsChanged
 * (شراء، شراء معلّق اكتمل، استرداد، إلغاء Family Sharing...).
 */
import { create } from 'zustand'
import type { EntitlementsPayload, NovaStorePlugin, PurchaseStatus, StoreProduct } from '../platform/native'
import { PRO_PRODUCT_ID, isFeatureAllowed, type Feature } from '../lib/features'

export interface ProState {
  ready: boolean
  isPro: boolean
  product: StoreProduct | null
  canMakePayments: boolean
  busy: 'purchase' | 'restore' | null
  lastStatus: PurchaseStatus | 'restored' | 'nothing_to_restore' | null
  error: string | null
  paywallFor: Feature | null
  init(): Promise<void>
  refreshProduct(): Promise<void>
  purchase(): Promise<PurchaseStatus | 'error'>
  restore(): Promise<boolean>
  openPaywall(feature: Feature | null): void
  closePaywall(): void
  /** يعيد true إن كانت الميزة متاحة، وإلا يفتح شاشة الترقية ويعيد false. */
  require(feature: Feature): boolean
}

export function createProStore(plugin: NovaStorePlugin) {
  let listening = false
  return create<ProState>((set, get) => {
    const apply = (p: EntitlementsPayload) => set({ isPro: !!p.isPro, ready: true })
    return {
      ready: false,
      isPro: false,
      product: null,
      canMakePayments: true,
      busy: null,
      lastStatus: null,
      error: null,
      paywallFor: null,
      async init() {
        if (!listening) {
          listening = true
          await plugin.addListener('entitlementsChanged', (p) => {
            apply(p)
            if (p.isPro && get().paywallFor) set({ paywallFor: null })
          })
        }
        try {
          apply(await plugin.getEntitlements())
        } catch (e) {
          set({ ready: true, error: String((e as Error)?.message ?? e) })
        }
        try {
          set({ canMakePayments: (await plugin.canMakePayments()).canMakePayments })
        } catch {
          /* ignore */
        }
        void get().refreshProduct()
      },
      async refreshProduct() {
        try {
          const { products } = await plugin.getProducts({ productIds: [PRO_PRODUCT_ID] })
          set({ product: products.find((p) => p.id === PRO_PRODUCT_ID) ?? null })
        } catch (e) {
          set({ product: null, error: String((e as Error)?.message ?? e) })
        }
      },
      async purchase() {
        if (get().busy) return 'unknown'
        set({ busy: 'purchase', error: null, lastStatus: null })
        try {
          const res = await plugin.purchase({ productId: PRO_PRODUCT_ID })
          // لا نثق بأي شيء سوى isPro الذي يحسبه StoreKit من المعاملات الموثّقة
          set({ lastStatus: res.status, isPro: res.status === 'purchased' ? !!res.isPro : get().isPro })
          if (res.status === 'purchased' && res.isPro) set({ paywallFor: null })
          return res.status
        } catch (e) {
          set({ error: String((e as Error)?.message ?? e) })
          return 'error'
        } finally {
          set({ busy: null })
        }
      },
      async restore() {
        if (get().busy) return false
        set({ busy: 'restore', error: null, lastStatus: null })
        try {
          const p = await plugin.restore()
          apply(p)
          set({ lastStatus: p.isPro ? 'restored' : 'nothing_to_restore', error: p.syncError ?? null })
          if (p.isPro) set({ paywallFor: null })
          return p.isPro
        } catch (e) {
          set({ error: String((e as Error)?.message ?? e) })
          return false
        } finally {
          set({ busy: null })
        }
      },
      openPaywall(feature) {
        set({ paywallFor: feature ?? 'editText', lastStatus: null, error: null })
      },
      closePaywall() {
        set({ paywallFor: null })
      },
      require(feature) {
        if (isFeatureAllowed(feature, get().isPro)) return true
        get().openPaywall(feature)
        return false
      }
    }
  })
}
