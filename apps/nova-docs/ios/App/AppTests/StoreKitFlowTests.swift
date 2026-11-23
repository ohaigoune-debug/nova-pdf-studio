import XCTest
import StoreKit
import StoreKitTest

/// اختبارات الشراء الحقيقية على StoreKit 2 في بيئة **StoreKit Testing** المحلية من Apple (SKTestSession + NovaDocs.storekit).
/// لا تحتاج حساب Apple ولا تتصل بأي خادم ولا تُجري أي دفع حقيقي.
/// تختبر الملف نفسه الذي يستعمله التطبيق: App/Native/NovaEntitlements.swift (مُضمَّن في الهدفين).
///
/// ملاحظة: هذه ليست «Sandbox» (تلك تحتاج App Store Connect وحساب اختبار). هي الطبقة المحلية الرسمية قبلها.
final class StoreKitFlowTests: XCTestCase {
    private var session: SKTestSession!
    private let productId = NovaEntitlements.proProductId

    override func setUpWithError() throws {
        session = try SKTestSession(configurationFileNamed: "NovaDocs")
        session.resetToDefaultState()
        session.disableDialogs = true
        session.clearTransactions()
    }

    override func tearDownWithError() throws {
        session?.clearTransactions()
    }

    private func proProduct() async throws -> Product {
        let products = try await Product.products(for: [productId])
        return try XCTUnwrap(products.first, "product \(productId) not returned by StoreKit")
    }

    /// ينتظر شرطًا غير متزامن (أحداث StoreKit تصل بعد لحظة).
    private func eventually(timeout: TimeInterval = 15, _ condition: () async -> Bool) async -> Bool {
        let end = Date().addingTimeInterval(timeout)
        while Date() < end {
            if await condition() { return true }
            try? await Task.sleep(nanoseconds: 250_000_000)
        }
        return await condition()
    }

    func test01_productIsLifetimeNonConsumableAt499() async throws {
        let product = try await proProduct()
        XCTAssertEqual(product.type, .nonConsumable)
        XCTAssertEqual(product.price, Decimal(string: "4.99"))
        XCTAssertFalse(product.displayPrice.isEmpty)
        XCTAssertNil(product.subscription, "must not be a subscription")
        let pro = await NovaEntitlements.isProActive()
        XCTAssertFalse(pro, "fresh install must start on the free tier")
    }

    func test02_verifiedPurchaseUnlocksPro() async throws {
        let result = try await proProduct().purchase()
        let settled = await NovaEntitlements.settle(result)
        XCTAssertEqual(settled.outcome, .purchased)
        XCTAssertEqual(settled.transaction?.productID, productId)
        let pro = await eventually { await NovaEntitlements.isProActive() }
        XCTAssertTrue(pro)
    }

    func test03_askToBuyIsPendingThenApprovalUnlocks() async throws {
        session.askToBuyEnabled = true
        let result = try await proProduct().purchase()
        let settled = await NovaEntitlements.settle(result)
        XCTAssertEqual(settled.outcome, .pending)
        let proWhilePending = await NovaEntitlements.isProActive()
        XCTAssertFalse(proWhilePending, "pending purchase must not unlock")

        let pending = try XCTUnwrap(session.allTransactions().first)
        try session.approveAskToBuyTransaction(identifier: pending.identifier)
        let pro = await eventually { await NovaEntitlements.isProActive() }
        XCTAssertTrue(pro, "approved Ask to Buy must unlock")
    }

    func test04_declinedAskToBuyNeverUnlocks() async throws {
        session.askToBuyEnabled = true
        let result = try await proProduct().purchase()
        let settled = await NovaEntitlements.settle(result)
        XCTAssertEqual(settled.outcome, .pending)
        let pending = try XCTUnwrap(session.allTransactions().first)
        try session.declineAskToBuyTransaction(identifier: pending.identifier)
        let pro = await eventually(timeout: 4) { await NovaEntitlements.isProActive() }
        XCTAssertFalse(pro)
    }

    func test05_refundRevokesPro() async throws {
        let result = try await proProduct().purchase()
        let settled = await NovaEntitlements.settle(result)
        let transaction = try XCTUnwrap(settled.transaction)
        let before = await eventually { await NovaEntitlements.isProActive() }
        XCTAssertTrue(before)
        try session.refundTransaction(identifier: UInt(transaction.id))
        let revoked = await eventually { !(await NovaEntitlements.isProActive()) }
        XCTAssertTrue(revoked, "a refunded purchase must remove Pro")
    }

    func test06_failedPurchaseDoesNotUnlock() async throws {
        session.failTransactionsEnabled = true
        var outcome: NovaEntitlements.Outcome?
        do {
            let result = try await proProduct().purchase()
            outcome = await NovaEntitlements.settle(result).outcome
        } catch {
            outcome = nil // StoreKit رمى خطأ: هذا هو المتوقع
        }
        XCTAssertNotEqual(outcome, .purchased)
        let pro = await NovaEntitlements.isProActive()
        XCTAssertFalse(pro)
    }

    /// شراء تم على جهاز آخر بالحساب نفسه (أو قبل حذف التطبيق) يظهر في currentEntitlements —
    /// وهو ما يعتمد عليه زر «استعادة المشتريات» بعد AppStore.sync().
    func test07_purchaseFromAnotherDeviceIsRecognized() async throws {
        try session.buyProduct(productIdentifier: productId)
        let pro = await eventually { await NovaEntitlements.isProActive() }
        XCTAssertTrue(pro)
    }
}
