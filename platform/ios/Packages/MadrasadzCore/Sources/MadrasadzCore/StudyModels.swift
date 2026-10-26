import Foundation

public struct Bookmark: Codable, Equatable, Identifiable, Sendable {
    public let id: UUID
    public var title: String
    public let relativeURL: String
    public let createdAt: Date

    public init(id: UUID = UUID(), title: String, relativeURL: String, createdAt: Date = Date()) {
        self.id = id
        self.title = title
        self.relativeURL = relativeURL
        self.createdAt = createdAt
    }
}

public struct RevisionTask: Codable, Equatable, Identifiable, Sendable {
    public let id: UUID
    public var title: String
    public var date: Date
    public var completed: Bool
    public var reminderEnabled: Bool

    public init(id: UUID = UUID(), title: String, date: Date, completed: Bool = false, reminderEnabled: Bool = false) {
        self.id = id
        self.title = title
        self.date = date
        self.completed = completed
        self.reminderEnabled = reminderEnabled
    }
}

public struct StudySnapshot: Codable, Equatable, Sendable {
    public var bookmarks: [Bookmark]
    public var tasks: [RevisionTask]

    public init(bookmarks: [Bookmark] = [], tasks: [RevisionTask] = []) {
        self.bookmarks = bookmarks
        self.tasks = tasks
    }

    public static let empty = StudySnapshot()
}

/// Created only by StudyStore after its caller has verified the server session.
/// Never create an account context from a page title, URL, JavaScript, or user-agent.
public struct StudySession: Equatable, Sendable {
    public let accountID: String
    fileprivate let token: UUID

    init(accountID: String, token: UUID) {
        self.accountID = accountID
        self.token = token
    }
}

public enum StudyStoreError: Error, Equatable, Sendable {
    case locked
    case staleSession
    case invalidAccount
    case invalidTitle
    case invalidURL
    case invalidDate
    case limitReached
    case invalidStoredState
}

struct StudyEnvelope: Codable {
    let version: Int
    let accountID: String
    let snapshot: StudySnapshot
}

public enum StudyReminders {
    /// No name, phone, token, or task title appears in identifiers.
    public static func identifier(accountID: String, taskID: UUID) -> String? {
        guard let account = UUID(uuidString: accountID) else { return nil }
        return "madrasadz.revision.\(account.uuidString.lowercased()).\(taskID.uuidString.lowercased())"
    }

    public static func identifiers(in snapshot: StudySnapshot, accountID: String) -> [String] {
        snapshot.tasks.filter { $0.reminderEnabled && !$0.completed }.compactMap {
            identifier(accountID: accountID, taskID: $0.id)
        }
    }
}
