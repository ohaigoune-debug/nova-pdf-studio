import Foundation
import StoreKit

/// منطق الاستحقاق الخالص (بلا Capacitor): يستعمله NovaStorePlugin، وتختبره AppTests مع بيئة StoreKit Testing المحلية.
///
/// القاعدة الوحيدة: يُمنح Pro فقط من معاملة **موثّقة** للمنتج nova.docs.pro.lifetime **غير مسترجعة**.
enum NovaEntitlements {
    static let proProductId = "nova.docs.pro.lifetime"

    enum Outcome: String {
        case purchased, pending, cancelled, unverified, unknown
    }

    /// المعاملات الحالية الموثّقة وغير المسترجعة (تُقرأ من ذاكرة StoreKit المحلية؛ تعمل دون إنترنت).
    static func currentVerified() async -> [Transaction] {
        var out: [Transaction] = []
        for await result in Transaction.currentEntitlements {
            guard case .verified(let t) = result, t.revocationDate == nil else { continue }
            out.append(t)
        }
        return out
    }

    static func isProActive() async -> Bool {
        await currentVerified().contains { $0.productID == proProductId }
    }

    /// يحوّل نتيجة الشراء إلى حالة، ويُنهي المعاملة الموثّقة. غير الموثّقة لا تمنح شيئًا.
    static func settle(_ result: Product.PurchaseResult) async -> (outcome: Outcome, transaction: Transaction?, message: String?) {
        switch result {
        case .success(let verification):
            switch verification {
            case .verified(let transaction):
                await transaction.finish()
                return (.purchased, transaction, nil)
            case .unverified(_, let error):
                return (.unverified, nil, error.localizedDescription)
            }
        case .pending:
            // Ask to Buy أو تحقق إضافي من البنك: لا شيء حتى تصل المعاملة عبر Transaction.updates
            return (.pending, nil, nil)
        case .userCancelled:
            return (.cancelled, nil, nil)
        @unknown default:
            return (.unknown, nil, nil)
        }
    }
}
