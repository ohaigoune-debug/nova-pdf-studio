/**
 * بديل ويب لـ StoreKit — للتطوير في المتصفح واللقطات فقط.
 * لا يمكنه منح Pro في نسخة iOS: على الجهاز تُستعمل الإضافة الأصلية دائمًا (registerPlugin يختار Swift).
 * السعر هنا ثابت لأغراض العرض، والسعر الحقيقي يأتي من StoreKit على الجهاز.
 */
import { WebPlugin } from '@capacitor/core'
import type { EntitlementsPayload, NovaStorePlugin, PurchaseStatus, StoreProduct } from '../native'

const KEY = 'nova.web-preview.pro'

export class WebStore extends WebPlugin implements Omit<NovaStorePlugin, 'addListener'> {
  private get pro(): boolean {
    try {
      return localStorage.getItem(KEY) === '1'
    } catch {
      return false
    }
  }

  async canMakePayments() {
    return { canMakePayments: true }
  }

  async getProducts(options: { productIds: string[] }): Promise<{ products: StoreProduct[] }> {
    return {
      products: options.productIds.map((id) => ({
        id, displayName: 'NOVA Pro', description: 'Web preview', displayPrice: '$4.99', price: 4.99, currencyCode: 'USD', type: 'nonConsumable'
      }))
    }
  }

  private payload(): EntitlementsPayload {
    return {
      isPro: this.pro,
      entitlements: this.pro ? [{ productId: 'nova.docs.pro.lifetime', transactionId: 'web', originalTransactionId: 'web', purchaseDate: null, revocationDate: null, ownershipType: 'purchased', environment: 'WebPreview' }] : [],
      checkedAt: new Date().toISOString()
    }
  }

  async purchase(): Promise<{ status: PurchaseStatus; isPro: boolean }> {
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      /* ignore */
    }
    this.notifyListeners('entitlementsChanged', this.payload())
    return { status: 'purchased', isPro: true }
  }

  async restore() {
    return this.payload()
  }

  async getEntitlements() {
    return this.payload()
  }

  async requestRefund(): Promise<{ status: 'submitted' | 'cancelled' }> {
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
    this.notifyListeners('entitlementsChanged', this.payload())
    return { status: 'submitted' }
  }
}
