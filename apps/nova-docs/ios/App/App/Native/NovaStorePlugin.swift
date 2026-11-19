import Foundation
@preconcurrency import Capacitor
import StoreKit

/// StoreKit 2 — المصدر الوحيد للمدفوعات داخل iOS.
/// المنتج: NOVA Pro (Non-Consumable) بالمعرف nova.docs.pro.lifetime.
///
/// قواعد الأمان:
/// - لا يُمنح Pro إلا من معاملة **موثّقة** (VerificationResult.verified) غير مسترجعة (revocationDate == nil).
/// - الحالة تُقرأ دائمًا من Transaction.currentEntitlements (تعمل دون إنترنت من ذاكرة StoreKit المحلية)،
///   ولا يُعتمد على أي قيمة محفوظة في الواجهة كمصدر للحقيقة.
/// - الاسترداد/الإلغاء يصل عبر Transaction.updates فيُسحب الاستحقاق ويُبلَّغ الواجهة فورًا.
@objc(NovaStorePlugin)
public class NovaStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NovaStorePlugin"
    public let jsName = "NovaStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getEntitlements", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestRefund", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "canMakePayments", returnType: CAPPluginReturnPromise)
    ]

    static let proProductId = NovaEntitlements.proProductId
    private var updatesTask: Task<Void, Never>?

    public override func load() {
        // يجب بدء الاستماع مبكرًا: المشتريات المعلقة (Ask to Buy / SCA) والاستردادات تصل من هنا
        updatesTask = Task.detached(priority: .background) { [weak self] in
            for await result in Transaction.updates {
                await self?.handle(transactionResult: result)
            }
        }
        // معاملات لم تُنهَ في جلسة سابقة (انقطاع التطبيق أثناء الشراء)
        Task { [weak self] in
            for await result in Transaction.unfinished {
                await self?.handle(transactionResult: result)
            }
        }
    }

    deinit { updatesTask?.cancel() }

    private func handle(transactionResult result: VerificationResult<Transaction>) async {
        switch result {
        case .verified(let transaction):
            await transaction.finish()
            await notifyEntitlements(reason: transaction.revocationDate == nil ? "transaction" : "revoked")
        case .unverified(let transaction, let error):
            // لا نمنح أي استحقاق لمعاملة غير موثّقة، لكن نُنهيها حتى لا تتكرر
            await transaction.finish()
            emit("storeWarning", ["message": "unverified transaction: \(error.localizedDescription)"])
        }
    }

    /// إرسال الأحداث إلى الواجهة دائمًا من الخيط الرئيسي.
    private func emit(_ event: String, _ data: [String: Any]) {
        DispatchQueue.main.async { [weak self] in self?.notifyListeners(event, data: data) }
    }

    private func notifyEntitlements(reason: String) async {
        let payload = await Self.entitlementsPayload()
        var data = payload
        data["reason"] = reason
        emit("entitlementsChanged", data)
    }

    static func iso(_ date: Date?) -> Any {
        guard let date else { return NSNull() }
        return ISO8601DateFormatter().string(from: date)
    }

    static func describe(_ t: Transaction) -> [String: Any] {
        var out: [String: Any] = [
            "productId": t.productID,
            "transactionId": String(t.id),
            "originalTransactionId": String(t.originalID),
            "purchaseDate": iso(t.purchaseDate),
            "revocationDate": iso(t.revocationDate),
            "ownershipType": t.ownershipType == .familyShared ? "familyShared" : "purchased",
            "isUpgraded": t.isUpgraded
        ]
        if #available(iOS 16.0, *) {
            out["environment"] = t.environment.rawValue
        }
        return out
    }

    /// الاستحقاقات الحالية الموثّقة فقط.
    static func entitlementsPayload() async -> [String: Any] {
        let active = await NovaEntitlements.currentVerified()
        let isPro = NovaEntitlements.testerUnlock || active.contains { $0.productID == proProductId }
        return ["isPro": isPro, "tester": NovaEntitlements.testerUnlock, "entitlements": active.map(describe), "checkedAt": iso(Date())]
    }

    static func isProActive() async -> Bool {
        await NovaEntitlements.isProActive()
    }

    @objc func canMakePayments(_ call: CAPPluginCall) {
        call.resolve(["canMakePayments": AppStore.canMakePayments])
    }

    @objc func getProducts(_ call: CAPPluginCall) {
        let ids = call.getArray("productIds", String.self) ?? [Self.proProductId]
        Task {
            do {
                let products = try await Product.products(for: ids)
                call.resolve(["products": products.map { p -> [String: Any] in
                    [
                        "id": p.id,
                        "displayName": p.displayName,
                        "description": p.description,
                        "displayPrice": p.displayPrice,          // السعر المحلي كما تعرضه Apple (مثلاً 4,99 $ أو 600 DA)
                        "price": NSDecimalNumber(decimal: p.price).doubleValue,
                        "currencyCode": p.priceFormatStyle.currencyCode,
                        "type": p.type == .nonConsumable ? "nonConsumable" : p.type.rawValue
                    ]
                }])
            } catch {
                call.reject("Unable to load products: \(error.localizedDescription)", "PRODUCTS_FAILED", error)
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        let productId = call.getString("productId") ?? Self.proProductId
        Task { @MainActor in
            do {
                guard let product = try await Product.products(for: [productId]).first else {
                    call.reject("Product not found: \(productId)", "PRODUCT_NOT_FOUND")
                    return
                }
                let result: Product.PurchaseResult
                if #available(iOS 17.0, *), let scene = self.bridge?.viewController?.view.window?.windowScene {
                    result = try await product.purchase(confirmIn: scene)
                } else {
                    result = try await product.purchase()
                }
                let settled = await NovaEntitlements.settle(result)
                switch settled.outcome {
                case .purchased:
                    let payload = await Self.entitlementsPayload()
                    var data: [String: Any] = ["status": "purchased", "isPro": payload["isPro"] ?? false]
                    if let transaction = settled.transaction { data["transaction"] = Self.describe(transaction) }
                    call.resolve(data)
                    self.emit("entitlementsChanged", payload)
                case .unverified:
                    call.resolve(["status": "unverified", "message": settled.message ?? "", "isPro": false])
                default:
                    // pending (Ask to Buy / SCA) · cancelled · unknown: لا يُمنح شيء
                    call.resolve(["status": settled.outcome.rawValue, "isPro": false])
                }
            } catch {
                call.reject("Purchase failed: \(error.localizedDescription)", "PURCHASE_FAILED", error)
            }
        }
    }

    @objc func restore(_ call: CAPPluginCall) {
        Task {
            do {
                // يطلب من App Store مزامنة المعاملات (قد يطلب تسجيل الدخول بحساب Apple)
                try await AppStore.sync()
            } catch {
                // حتى إن فشلت المزامنة (لا إنترنت/إلغاء) نعيد الحالة المحلية الموثّقة
                var payload = await Self.entitlementsPayload()
                payload["syncError"] = error.localizedDescription
                call.resolve(payload)
                return
            }
            let payload = await Self.entitlementsPayload()
            call.resolve(payload)
            self.emit("entitlementsChanged", payload)
        }
    }

    @objc func getEntitlements(_ call: CAPPluginCall) {
        Task {
            call.resolve(await Self.entitlementsPayload())
        }
    }

    /// يفتح ورقة طلب الاسترداد الرسمية من Apple (iOS 15+). لا يمنح أي شيء ولا يسحب شيئًا بنفسه.
    @objc func requestRefund(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let scene = self.bridge?.viewController?.view.window?.windowScene else {
                call.reject("No window scene", "NO_SCENE")
                return
            }
            var latest: Transaction?
            for await result in Transaction.currentEntitlements {
                if case .verified(let t) = result, t.productID == Self.proProductId { latest = t }
            }
            guard let transaction = latest else {
                call.reject("No purchase to refund", "NO_PURCHASE")
                return
            }
            do {
                let status = try await transaction.beginRefundRequest(in: scene)
                call.resolve(["status": status == .success ? "submitted" : "cancelled"])
            } catch {
                call.reject("Refund request failed: \(error.localizedDescription)", "REFUND_FAILED", error)
            }
        }
    }
}
