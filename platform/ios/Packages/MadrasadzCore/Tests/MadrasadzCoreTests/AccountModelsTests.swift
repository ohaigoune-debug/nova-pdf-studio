import Foundation
import XCTest
@testable import MadrasadzCore

final class AccountModelsTests: XCTestCase {
    private func decode<T: Decodable>(_ type: T.Type, _ json: String) throws -> T {
        try XCTUnwrap(JSONDecoder().decode(IOSAPI.Envelope<T>.self, from: Data(json.utf8)).data)
    }

    // MARK: Orders

    func testOrdersDecodeForTrackingOnly() throws {
        let page = try decode(Orders.Page.self, #"""
        {"ok":true,"data":{"orders":[
          {"id":"o1","number":"MD-1042","status":"SHIPPED","statusText":"في الطريق","createdAt":"2026-11-01T09:15:00.123Z","items":"كتاب الرياضيات ×2","deliveryProvider":"Yalidine","trackingId":"YAL-778","timeline":[{"label":"استُلم الطلب","at":"2026-11-01T09:15:00.123Z","tone":"done"},{"label":"سُلّم لشركة التوصيل","at":"2026-11-02T10:00:00Z","tone":"done"},{"label":"غريب","at":"2026-11-02T11:00:00Z","tone":"new"}]},
          {"id":"o2","number":"MD-1001","status":"DELIVERED","statusText":"مكتمل","createdAt":"2026-10-01T09:15:00Z","items":"دورة الفلسفة","deliveryProvider":null,"trackingId":null,"timeline":[]},
          {"id":"o3","number":"MD-0999","status":"CANCELLED","statusText":"أُلغي","createdAt":"2026-09-01T09:15:00Z","items":"كتاب","timeline":[]},
          {"broken":true}
        ]}}
        """#)
        XCTAssertEqual(page.orders.map(\.id), ["o1", "o2", "o3"], "a broken entry is skipped")
        let o = page.orders[0]
        XCTAssertEqual(o.stage, .onTheWay)
        XCTAssertTrue(o.shipped)
        XCTAssertFalse(o.finished)
        XCTAssertNotNil(o.createdAt, "milliseconds are parsed")
        XCTAssertEqual(o.timeline.count, 3)
        XCTAssertEqual(o.timeline[2].tone, .info, "an unknown tone falls back")
        XCTAssertNotNil(o.timeline[1].at, "dates without milliseconds too")
        XCTAssertEqual(page.orders[1].stage, .arrived)
        XCTAssertFalse(page.orders[1].shipped, "a digital order has no delivery step")
        XCTAssertNil(page.orders[2].stage)
        XCTAssertTrue(page.orders[2].stopped)
        XCTAssertEqual(page.current.map(\.id), ["o1"])
        XCTAssertEqual(page.past.map(\.id), ["o2", "o3"])
    }

    func testWaitingOrdersAreAtTheFirstStage() throws {
        let page = try decode(Orders.Page.self, #"{"ok":true,"data":{"orders":[{"id":"a","number":12,"status":"NO_ANSWER","statusText":"بانتظار التأكيد","items":"x","timeline":[]}]}}"#)
        XCTAssertEqual(page.orders[0].number, "12", "a numeric order number is accepted")
        XCTAssertEqual(page.orders[0].stage, .received)
    }

    // MARK: Support

    func testTicketsAndThread() throws {
        let list = try decode(Support.List.self, #"""
        {"ok":true,"data":{"tickets":[
          {"id":"t1","number":7,"kind":"DELIVERY","subject":"تأخّر كتابي","status":"WAITING_USER","lastMessageAt":"2026-11-03T10:00:00.000Z","messages":2},
          {"id":"t2","number":3,"kind":"ORDER","subject":"قديمة من الموقع","status":"CLOSED","lastMessageAt":"2026-10-03T10:00:00Z","messages":4},
          {"id":"t3","number":2,"kind":"NEW_KIND","subject":"نوع جديد","status":"SOMETHING","messages":1}
        ]}}
        """#)
        XCTAssertEqual(list.tickets.count, 3)
        XCTAssertEqual(list.waiting, 1)
        XCTAssertEqual(list.tickets[1].kind, .order)
        XCTAssertEqual(list.tickets[2].kind, .other)
        XCTAssertEqual(list.tickets[2].status, .open)
        XCTAssertFalse(Support.Kind.openable.contains(.order), "«طلب شراء» is never offered in the app")

        let thread = try decode(Support.Thread.self, #"""
        {"ok":true,"data":{"id":"t1","number":7,"kind":"DELIVERY","subject":"تأخّر كتابي","status":"CLOSED","createdAt":"2026-11-02T10:00:00.000Z","orderNumber":"MD-1042","courseTitle":null,
         "messages":[{"id":"m1","mine":true,"staff":false,"author":"أمينة","body":"لم يصلني","createdAt":"2026-11-02T10:00:00.000Z"},{"id":"m2","mine":false,"staff":true,"author":null,"body":"يصلك غدًا","createdAt":"2026-11-03T10:00:00.000Z"}]}}
        """#)
        XCTAssertEqual(thread.orderNumber, "MD-1042")
        XCTAssertEqual(thread.messages.map(\.staff), [false, true])
        XCTAssertNil(thread.messages[1].author)
        XCTAssertFalse(thread.status.canReply)
    }

    func testNewTicketLimitsAndPayload() throws {
        var t = Support.NewTicket(kind: .technical, subject: " ا ", body: "تفاصيل")
        XCTAssertEqual(t.problem, .subject)
        t.subject = "الفيديو لا يعمل"
        t.body = " "
        XCTAssertEqual(t.problem, .body)
        t.body = "  يتوقف بعد دقيقة  "
        XCTAssertNil(t.problem)
        let json = try XCTUnwrap(String(data: JSONEncoder().encode(t), encoding: .utf8))
        XCTAssertTrue(json.contains(#""kind":"TECHNICAL""#))
        XCTAssertTrue(json.contains(#""body":"يتوقف بعد دقيقة""#), "trimmed")
        XCTAssertFalse(json.contains("orderId"))
        let order = try XCTUnwrap(String(data: JSONEncoder().encode(Support.NewTicket(kind: .order, subject: "abc", body: "de", orderId: "o1")), encoding: .utf8))
        XCTAssertTrue(order.contains(#""kind":"DELIVERY""#))
        XCTAssertTrue(order.contains(#""orderId":"o1""#))
        XCTAssertTrue(Support.replyIsValid("شكرًا"))
        XCTAssertFalse(Support.replyIsValid(" ا "))
    }

    // MARK: Notifications

    func testNotificationLinks() {
        let id = "8F2C7A10-1234-4ABC-8DEF-0123456789AB"
        XCTAssertEqual(NotificationLink(link: "/student/support/\(id)"), .ticket(id.lowercased()))
        XCTAssertEqual(NotificationLink(link: "/support/\(id)?x=1"), .ticket(id.lowercased()))
        XCTAssertEqual(NotificationLink(link: "/store/orders/abc"), .orders)
        XCTAssertEqual(NotificationLink(link: "/student/orders"), .orders)
        XCTAssertEqual(NotificationLink(link: "/student/support/not-an-id"), .home)
        XCTAssertEqual(NotificationLink(link: "/admin/support/\(id)"), .home)
        XCTAssertEqual(NotificationLink(link: nil), .home)
    }
}
