import Foundation

/// Dates from the API (`toISOString()`: with or without milliseconds).
public enum APIDate {
    public static func parse(_ text: String?) -> Date? {
        guard let text, !text.isEmpty else { return nil }
        let precise = ISO8601DateFormatter()
        precise.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = precise.date(from: text) { return date }
        return ISO8601DateFormatter().date(from: text)
    }
}

/// «طلباتي» (`/api/v1/ios/orders`): where an order is, for tracking only. The server
/// sends no price, payment, receipt or cancel action, and the app shows none.
public enum Orders {
    public enum Tone: String, Sendable { case done, info, bad }

    public struct Step: Decodable, Equatable, Hashable, Sendable {
        public let label: String
        public let at: Date?
        public let tone: Tone

        private enum CodingKeys: String, CodingKey { case label, at, tone }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            label = try c.decode(String.self, forKey: .label)
            at = APIDate.parse(try c.decodeIfPresent(String.self, forKey: .at))
            tone = Tone(rawValue: (try? c.decode(String.self, forKey: .tone)) ?? "") ?? .info
        }
    }

    /// The four stages a student follows; a returned or cancelled order stops early.
    public enum Stage: Int, CaseIterable, Sendable { case received, confirmed, onTheWay, arrived }

    public struct Order: Decodable, Equatable, Identifiable, Hashable, Sendable {
        public let id: String
        public let number: String
        public let status: String
        public let statusText: String
        public let createdAt: Date?
        public let items: String
        public let deliveryProvider: String?
        public let trackingId: String?
        public let timeline: [Step]

        private enum CodingKeys: String, CodingKey { case id, number, status, statusText, createdAt, items, deliveryProvider, trackingId, timeline }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id = try c.decode(String.self, forKey: .id)
            if let text = try? c.decode(String.self, forKey: .number) { number = text } else { number = String((try? c.decode(Int.self, forKey: .number)) ?? 0) }
            status = (try? c.decode(String.self, forKey: .status)) ?? ""
            statusText = (try? c.decode(String.self, forKey: .statusText)) ?? status
            createdAt = APIDate.parse(try c.decodeIfPresent(String.self, forKey: .createdAt))
            items = (try? c.decode(String.self, forKey: .items)) ?? ""
            deliveryProvider = try c.decodeIfPresent(String.self, forKey: .deliveryProvider)
            trackingId = try c.decodeIfPresent(String.self, forKey: .trackingId)
            timeline = c.lossyArray(Step.self, forKey: .timeline)
        }

        /// The last stage reached (nil once the order stopped: returned or cancelled).
        public var stage: Stage? {
            switch status {
            case "PENDING", "NO_ANSWER", "CALL_LATER": return .received
            case "CONFIRMED": return .confirmed
            case "SHIPPED": return .onTheWay
            case "DELIVERED": return .arrived
            default: return nil
            }
        }

        public var stopped: Bool { status == "RETURNED" || status == "CANCELLED" }
        public var finished: Bool { status == "DELIVERED" || stopped }
        /// A digital order (no shipping step: no provider and no tracking number ever).
        public var shipped: Bool { deliveryProvider != nil || trackingId != nil || status == "SHIPPED" }
    }

    public struct Page: Decodable, Equatable, Sendable {
        public let orders: [Order]
        private enum CodingKeys: String, CodingKey { case orders }
        public init(from decoder: Decoder) throws {
            orders = try decoder.container(keyedBy: CodingKeys.self).lossyArray(Order.self, forKey: .orders)
        }

        /// Orders still on their way first, then the finished ones (each newest first, as sent).
        public var current: [Order] { orders.filter { !$0.finished } }
        public var past: [Order] { orders.filter(\.finished) }
    }
}

/// «الدعم والشكاوى» (`/api/v1/ios/support`): the same tickets as the website, without
/// the team's internal notes. Staff replies show as the team, never a person's name.
public enum Support {
    public enum Kind: String, CaseIterable, Sendable, Identifiable {
        case delivery = "DELIVERY", access = "ACCESS", content = "CONTENT", technical = "TECHNICAL", teacher = "TEACHER", other = "OTHER"
        /// Opened on the website only; listed with a neutral name.
        case order = "ORDER"
        public var id: String { rawValue }
        /// What a student can open from the app, in this order.
        public static let openable: [Kind] = [.technical, .access, .content, .delivery, .teacher, .other]
    }

    public enum Status: String, Sendable {
        case open = "OPEN", inProgress = "IN_PROGRESS", waitingUser = "WAITING_USER", resolved = "RESOLVED", closed = "CLOSED"
        public var canReply: Bool { self != .closed }
        public var canClose: Bool { self != .closed }
    }

    public struct Ticket: Decodable, Equatable, Identifiable, Hashable, Sendable {
        public let id: String
        public let number: Int
        public let kind: Kind
        public let subject: String
        public let status: Status
        public let lastMessageAt: Date?
        public let messages: Int

        private enum CodingKeys: String, CodingKey { case id, number, kind, subject, status, lastMessageAt, messages }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id = try c.decode(String.self, forKey: .id)
            number = (try? c.decode(Int.self, forKey: .number)) ?? 0
            kind = Kind(rawValue: (try? c.decode(String.self, forKey: .kind)) ?? "") ?? .other
            subject = try c.decode(String.self, forKey: .subject)
            status = Status(rawValue: (try? c.decode(String.self, forKey: .status)) ?? "") ?? .open
            lastMessageAt = APIDate.parse(try c.decodeIfPresent(String.self, forKey: .lastMessageAt))
            messages = (try? c.decode(Int.self, forKey: .messages)) ?? 0
        }
    }

    public struct List: Decodable, Equatable, Sendable {
        public let tickets: [Ticket]
        private enum CodingKeys: String, CodingKey { case tickets }
        public init(from decoder: Decoder) throws {
            tickets = try decoder.container(keyedBy: CodingKeys.self).lossyArray(Ticket.self, forKey: .tickets)
        }
        /// Tickets waiting for the student's answer.
        public var waiting: Int { tickets.filter { $0.status == .waitingUser }.count }
    }

    public struct Message: Decodable, Equatable, Identifiable, Hashable, Sendable {
        public let id: String
        public let mine: Bool
        public let staff: Bool
        public let author: String?
        public let body: String
        public let createdAt: Date?

        private enum CodingKeys: String, CodingKey { case id, mine, staff, author, body, createdAt }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id = try c.decode(String.self, forKey: .id)
            mine = (try? c.decode(Bool.self, forKey: .mine)) ?? false
            staff = (try? c.decode(Bool.self, forKey: .staff)) ?? false
            author = try c.decodeIfPresent(String.self, forKey: .author)
            body = try c.decode(String.self, forKey: .body)
            createdAt = APIDate.parse(try c.decodeIfPresent(String.self, forKey: .createdAt))
        }
    }

    public struct Thread: Decodable, Equatable, Sendable {
        public let id: String
        public let number: Int
        public let kind: Kind
        public let subject: String
        public let status: Status
        public let orderNumber: String?
        public let courseTitle: String?
        public let messages: [Message]

        private enum CodingKeys: String, CodingKey { case id, number, kind, subject, status, orderNumber, courseTitle, messages }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id = try c.decode(String.self, forKey: .id)
            number = (try? c.decode(Int.self, forKey: .number)) ?? 0
            kind = Kind(rawValue: (try? c.decode(String.self, forKey: .kind)) ?? "") ?? .other
            subject = try c.decode(String.self, forKey: .subject)
            status = Status(rawValue: (try? c.decode(String.self, forKey: .status)) ?? "") ?? .open
            orderNumber = try c.decodeIfPresent(String.self, forKey: .orderNumber)
            courseTitle = try c.decodeIfPresent(String.self, forKey: .courseTitle)
            messages = c.lossyArray(Message.self, forKey: .messages)
        }
    }

    /// A new ticket, checked with the website's limits before it is sent.
    public struct NewTicket: Encodable, Equatable, Sendable {
        public enum Problem: String, Sendable { case subject, body }
        public var kind: Kind
        public var subject: String
        public var body: String
        public var orderId: String?

        public init(kind: Kind = .technical, subject: String = "", body: String = "", orderId: String? = nil) {
            self.kind = kind
            self.subject = subject
            self.body = body
            self.orderId = orderId
        }

        public var problem: Problem? {
            let s = subject.trimmingCharacters(in: .whitespacesAndNewlines).count
            if s < 3 || s > 200 { return .subject }
            let b = body.trimmingCharacters(in: .whitespacesAndNewlines).count
            if b < 2 || b > 5000 { return .body }
            return nil
        }

        private enum CodingKeys: String, CodingKey { case kind, subject, body, orderId }
        public func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: CodingKeys.self)
            // «طلب شراء» is never sent from the app
            try c.encode(kind == .order ? Kind.delivery.rawValue : kind.rawValue, forKey: .kind)
            try c.encode(subject.trimmingCharacters(in: .whitespacesAndNewlines), forKey: .subject)
            try c.encode(body.trimmingCharacters(in: .whitespacesAndNewlines), forKey: .body)
            try c.encodeIfPresent(orderId, forKey: .orderId)
        }
    }

    public static func replyIsValid(_ text: String) -> Bool {
        let n = text.trimmingCharacters(in: .whitespacesAndNewlines).count
        return n >= 2 && n <= 5000
    }
}

/// Where a platform notification opens in the app (its `link` is the website path).
public enum NotificationLink: Equatable, Sendable {
    case ticket(String)
    case orders
    /// A post in a course classroom (`/student/classroom?group=…`), or the general one without a group.
    case classroom(group: String?)
    case home

    public init(link: String?) {
        let beforeFragment = (link ?? "").split(separator: "#").first.map(String.init) ?? ""
        let path = beforeFragment.split(separator: "?").first.map(String.init) ?? ""
        let group = URLComponents(string: beforeFragment)?.queryItems?.first(where: { $0.name == "group" })?.value.flatMap { UUID(uuidString: $0) != nil ? $0.lowercased() : nil }
        var parts = path.split(separator: "/").map(String.init)
        if parts.first == "student" { parts.removeFirst() }
        if parts.count == 2, parts[0] == "support", UUID(uuidString: parts[1]) != nil {
            self = .ticket(parts[1].lowercased())
        } else if parts.first == "orders" || (parts.first == "store" && parts.dropFirst().first == "orders") {
            self = .orders
        } else if parts.first == "classroom" {
            self = .classroom(group: group)
        } else {
            self = .home
        }
    }
}
