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

    /// A card lesson kept on the phone.
    public struct CardLesson: Codable, Equatable, Identifiable, Sendable {
        public let id: String
        public let lessonName: String
        public let subjectCode: String
        public let checksum: String
        public let downloadedAt: Date
    }

    /// One answered card of a round.
    public struct CardAnswer: Codable, Equatable, Sendable {
        public let questionId: String
        public let answer: Cards.Answer
        public let timeMs: Int?
        public let correct: Bool
        public init(questionId: String, answer: Cards.Answer, timeMs: Int?, correct: Bool) {
            self.questionId = questionId
            self.answer = answer
            self.timeMs = timeMs
            self.correct = correct
        }
    }

    /// What the server said about a synced round.
    public struct CardResult: Codable, Equatable, Sendable {
        public let correctCount: Int
        public let total: Int
        public let xpEarned: Int
        public let xpTotal: Int
        public let levelTitle: String?
        public let lessonMastered: Bool
        public init(correctCount: Int, total: Int, xpEarned: Int, xpTotal: Int, levelTitle: String?, lessonMastered: Bool) {
            self.correctCount = correctCount
            self.total = total
            self.xpEarned = xpEarned
            self.xpTotal = xpTotal
            self.levelTitle = levelTitle
            self.lessonMastered = lessonMastered
        }
    }

    /// A finished card round; pending until the server re-grades it.
    public struct CardRound: Codable, Equatable, Identifiable, Sendable {
        public let id: UUID
        public let lessonId: String
        public let lessonName: String
        public let answers: [CardAnswer]
        public let estimatedXP: Int
        public let finishedAt: Date
        public var server: CardResult?
        public var rejected: Bool

        public var pending: Bool { server == nil && !rejected }
        public var localCorrect: Int { answers.filter(\.correct).count }
    }

    private struct Index: Codable {
        var downloaded: [Downloaded] = []
        var attempts: [Attempt] = []
        var cardLessons: [CardLesson] = []
        var cardRounds: [CardRound] = []
        /// Last local result of each card question (true = right): picks the next rounds.
        var cardMemory: [String: Bool] = [:]

        init() {}

        // An index written by an older build has no card fields: keep what it has.
        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            downloaded = (try? c.decodeIfPresent([Downloaded].self, forKey: .downloaded)) ?? []
            attempts = (try? c.decodeIfPresent([Attempt].self, forKey: .attempts)) ?? []
            cardLessons = (try? c.decodeIfPresent([CardLesson].self, forKey: .cardLessons)) ?? []
            cardRounds = (try? c.decodeIfPresent([CardRound].self, forKey: .cardRounds)) ?? []
            cardMemory = (try? c.decodeIfPresent([String: Bool].self, forKey: .cardMemory)) ?? [:]
        }
    }

    public static let maximumCardRounds = 300

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

    // MARK: Cards

    private func cardURL(_ id: String, account: String) -> URL {
        directory(for: account).appendingPathComponent("lesson-" + Self.safe(id) + ".json")
    }

    /// Validates and keeps a lesson pack exactly as the server sent it.
    @discardableResult
    public func saveCardPack(_ data: Data) throws -> Cards.Pack {
        let account = try requireAccount()
        guard data.count <= Self.maximumPackageBytes else { throw CocoaError(.fileReadTooLarge) }
        let pack = try JSONDecoder().decode(Cards.Pack.self, from: data)
        guard !pack.questions.isEmpty else { throw CocoaError(.fileReadCorruptFile) }
        if !index.cardLessons.contains(where: { $0.id == pack.id }), index.cardLessons.count >= Self.maximumPackages {
            throw CocoaError(.fileWriteOutOfSpace)
        }
        try prepare(account)
        try data.write(to: cardURL(pack.id, account: account), options: [.atomic, .completeFileProtection])
        index.cardLessons.removeAll { $0.id == pack.id }
        index.cardLessons.insert(CardLesson(id: pack.id, lessonName: pack.lesson.lessonName, subjectCode: pack.lesson.subjectCode,
                                            checksum: pack.checksum, downloadedAt: Date()), at: 0)
        try save(account)
        return pack
    }

    public func cardPack(id: String) throws -> Cards.Pack? {
        let account = try requireAccount()
        guard index.cardLessons.contains(where: { $0.id == id }),
              let data = try? Data(contentsOf: cardURL(id, account: account)) else { return nil }
        return try? JSONDecoder().decode(Cards.Pack.self, from: data)
    }

    public func cardLessons() -> [CardLesson] { index.cardLessons }
    public func cardMemory() -> [String: Bool] { index.cardMemory }
    public func cardRounds() -> [CardRound] { index.cardRounds }
    public func pendingCardRounds() -> [CardRound] { index.cardRounds.filter(\.pending).reversed() }

    @discardableResult
    public func addCardRound(lessonId: String, lessonName: String, answers: [CardAnswer], estimatedXP: Int, finishedAt: Date = Date()) throws -> CardRound {
        let account = try requireAccount()
        let round = CardRound(id: UUID(), lessonId: lessonId, lessonName: lessonName, answers: answers, estimatedXP: estimatedXP,
                              finishedAt: finishedAt, server: nil, rejected: false)
        index.cardRounds.insert(round, at: 0)
        for a in answers { index.cardMemory[a.questionId] = a.correct }
        while index.cardRounds.count > Self.maximumCardRounds, let last = index.cardRounds.lastIndex(where: { !$0.pending }) {
            index.cardRounds.remove(at: last)
        }
        try save(account)
        return round
    }

    public func markCardSynced(_ id: UUID, result: CardResult) throws {
        let account = try requireAccount()
        guard let i = index.cardRounds.firstIndex(where: { $0.id == id }) else { return }
        index.cardRounds[i].server = result
        try save(account)
    }

    public func markCardRejected(_ id: UUID) throws {
        let account = try requireAccount()
        guard let i = index.cardRounds.firstIndex(where: { $0.id == id }) else { return }
        index.cardRounds[i].rejected = true
        try save(account)
    }

    public func removeCardPack(id: String) throws {
        let account = try requireAccount()
        try? FileManager.default.removeItem(at: cardURL(id, account: account))
        index.cardLessons.removeAll { $0.id == id }
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
