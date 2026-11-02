import Foundation

/// Offline PLAY for one account: downloaded packages (the server's JSON as is),
/// local results, and finished attempts waiting to be synced. Everything lives
/// under `<root>/<account>/`; another account never sees it and sign-out
/// removes it. Files are written atomically and excluded from backups.
public actor PlayStore {
    public struct Downloaded: Codable, Equatable, Identifiable, Sendable {
        public let id: String
        public let title: String
        public let subjectCode: String
        public let kind: String
        public let year: Int?
        public let checksum: String
        public let downloadedAt: Date
    }

    public struct Attempt: Codable, Equatable, Identifiable, Sendable {
        public let id: UUID
        public let setId: String
        public let title: String
        public let answers: [String: Play.Answer]
        public let score: Double
        public let max: Double
        public let scoreTotal: Double
        public let finishedAt: Date
        /// nil until the server re-graded it; the server's own score afterwards.
        public var serverScore: Play.Score?
        /// The server refused it for good (set removed, access ended).
        public var rejected: Bool

        public var pending: Bool { serverScore == nil && !rejected }

        public init(id: UUID, setId: String, title: String, answers: [String: Play.Answer], score: Double, max: Double,
                    scoreTotal: Double, finishedAt: Date, serverScore: Play.Score? = nil, rejected: Bool = false) {
            self.id = id
            self.setId = setId
            self.title = title
            self.answers = answers
            self.score = score
            self.max = max
            self.scoreTotal = scoreTotal
            self.finishedAt = finishedAt
            self.serverScore = serverScore
            self.rejected = rejected
        }
    }

    private struct Index: Codable {
        var downloaded: [Downloaded] = []
        var attempts: [Attempt] = []
    }

    public static let maximumPackages = 300
    public static let maximumAttempts = 500
    public static let maximumPackageBytes = 8 * 1024 * 1024

    private let root: URL
    private var account: String?
    private var index = Index()

    public init(root: URL) {
        self.root = root
    }

    private func directory(for account: String) -> URL {
        root.appendingPathComponent(account.lowercased(), isDirectory: true)
    }

    private func packageURL(_ id: String, account: String) -> URL {
        directory(for: account).appendingPathComponent("set-" + Self.safe(id) + ".json")
    }

    private static func safe(_ id: String) -> String {
        String(id.lowercased().unicodeScalars.filter { CharacterSet.alphanumerics.contains($0) || $0 == "-" }.prefix(64).map(Character.init))
    }

    /// Opens (or switches to) an account's space. Returns its current state.
    @discardableResult
    public func activate(account: String) throws -> (downloaded: [Downloaded], attempts: [Attempt]) {
        let key = account.lowercased()
        guard !key.isEmpty, UUID(uuidString: key) != nil else { throw CocoaError(.fileReadInvalidFileName) }
        if self.account != key {
            self.account = key
            index = Index()
            let url = directory(for: key).appendingPathComponent("index.json")
            if let data = try? Data(contentsOf: url), let decoded = try? Self.decoder.decode(Index.self, from: data) {
                index = decoded
            }
        }
        return (index.downloaded, index.attempts)
    }

    public func deactivate() {
        account = nil
        index = Index()
    }

    private func requireAccount() throws -> String {
        guard let account else { throw CocoaError(.fileNoSuchFile) }
        return account
    }

    private func prepare(_ account: String) throws {
        var dir = directory(for: account)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try? dir.setResourceValues(values)
    }

    private func save(_ account: String) throws {
        try prepare(account)
        let data = try Self.encoder.encode(index)
        try data.write(to: directory(for: account).appendingPathComponent("index.json"), options: [.atomic, .completeFileProtection])
    }

    /// Validates and keeps a package exactly as the server sent it.
    @discardableResult
    public func savePackage(_ data: Data) throws -> Play.Package {
        let account = try requireAccount()
        guard data.count <= Self.maximumPackageBytes else { throw CocoaError(.fileReadTooLarge) }
        let package = try JSONDecoder().decode(Play.Package.self, from: data)
        guard !package.steps.isEmpty else { throw CocoaError(.fileReadCorruptFile) }
        if !index.downloaded.contains(where: { $0.id == package.id }), index.downloaded.count >= Self.maximumPackages {
            throw CocoaError(.fileWriteOutOfSpace)
        }
        try prepare(account)
        try data.write(to: packageURL(package.id, account: account), options: [.atomic, .completeFileProtection])
        index.downloaded.removeAll { $0.id == package.id }
        index.downloaded.insert(Downloaded(id: package.id, title: package.title, subjectCode: package.subjectCode, kind: package.kind.rawValue,
                                           year: package.year, checksum: package.checksum, downloadedAt: Date()), at: 0)
        try save(account)
        return package
    }

    public func package(id: String) throws -> Play.Package? {
        let account = try requireAccount()
        guard index.downloaded.contains(where: { $0.id == id }),
              let data = try? Data(contentsOf: packageURL(id, account: account)) else { return nil }
        return try? JSONDecoder().decode(Play.Package.self, from: data)
    }

    public func downloaded() -> [Downloaded] { index.downloaded }

    public func removePackage(id: String) throws {
        let account = try requireAccount()
        try? FileManager.default.removeItem(at: packageURL(id, account: account))
        index.downloaded.removeAll { $0.id == id }
        try save(account)
    }

    /// Records a finished attempt; it stays pending until `markSynced`.
    @discardableResult
    public func addAttempt(package: Play.Package, answers: [String: Play.Answer], finishedAt: Date = Date()) throws -> Attempt {
        let account = try requireAccount()
        let local = Play.score(package, answers: answers)
        let attempt = Attempt(id: UUID(), setId: package.id, title: package.title, answers: answers, score: local.score, max: local.max,
                              scoreTotal: package.scoreTotal, finishedAt: finishedAt, serverScore: nil, rejected: false)
        index.attempts.insert(attempt, at: 0)
        if index.attempts.count > Self.maximumAttempts {
            // Drop the oldest already-synced results first; pending ones are kept.
            while index.attempts.count > Self.maximumAttempts, let last = index.attempts.lastIndex(where: { !$0.pending }) {
                index.attempts.remove(at: last)
            }
        }
        try save(account)
        return attempt
    }

    public func pendingAttempts() -> [Attempt] { index.attempts.filter(\.pending).reversed() }

    public func attempts(setId: String? = nil) -> [Attempt] {
        guard let setId else { return index.attempts }
        return index.attempts.filter { $0.setId == setId }
    }

    public func markSynced(_ id: UUID, server: Play.Score) throws {
        let account = try requireAccount()
        guard let i = index.attempts.firstIndex(where: { $0.id == id }) else { return }
        index.attempts[i].serverScore = server
        try save(account)
    }

    public func markRejected(_ id: UUID) throws {
        let account = try requireAccount()
        guard let i = index.attempts.firstIndex(where: { $0.id == id }) else { return }
        index.attempts[i].rejected = true
        try save(account)
    }

    /// Removes one account's PLAY data (sign-out, account deletion).
    public func purge(account: String) throws {
        let key = account.lowercased()
        if self.account == key { deactivate() }
        let dir = directory(for: key)
        if FileManager.default.fileExists(atPath: dir.path) { try FileManager.default.removeItem(at: dir) }
    }

    public func purgeAll() throws {
        deactivate()
        if FileManager.default.fileExists(atPath: root.path) { try FileManager.default.removeItem(at: root) }
    }

    private static let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        return e
    }()
    private static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }()
}
