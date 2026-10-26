import Foundation

/// Contains only personal bookmarks and a revision planner: never lesson/media files,
/// cookies, passwords, access tokens, entitlement decisions, or an account database.
/// Call activate only with the account UUID verified by an authenticated server API.
public actor StudyStore {
    public static let maximumBookmarks = 200
    public static let maximumTasks = 300
    private static let maximumFileBytes = 1_048_576
    private let directoryURL: URL
    private let policy: NavigationPolicy
    private var activeSession: StudySession?
    private var state = StudySnapshot.empty

    public init(directoryURL: URL, policy: NavigationPolicy = .production) {
        self.directoryURL = directoryURL
        self.policy = policy
    }

    /// Invalidates every prior session, including callbacks for the same account.
    @discardableResult
    public func activate(accountID: String) throws -> StudySession {
        _ = lock()
        guard let uuid = UUID(uuidString: accountID) else { throw StudyStoreError.invalidAccount }
        let canonical = uuid.uuidString.lowercased()
        let loaded = try read(accountID: canonical)
        let session = StudySession(accountID: canonical, token: UUID())
        state = loaded
        activeSession = session
        return session
    }

    public func snapshot(using session: StudySession) throws -> StudySnapshot {
        try require(session)
        return state
    }

    @discardableResult
    public func addBookmark(title: String, url: URL, session: StudySession) throws -> Bookmark {
        try require(session)
        let clean = try normalizedTitle(title)
        guard let path = policy.bookmarkPath(for: url) else { throw StudyStoreError.invalidURL }
        // Repeated taps do not create duplicates or silently overwrite the saved title.
        if let previous = state.bookmarks.first(where: { $0.relativeURL == path }) { return previous }
        guard state.bookmarks.count < Self.maximumBookmarks else { throw StudyStoreError.limitReached }
        let bookmark = Bookmark(title: clean, relativeURL: path)
        var next = state
        next.bookmarks.insert(bookmark, at: 0)
        try persist(next, accountID: session.accountID)
        state = next
        return bookmark
    }

    public func removeBookmark(id: UUID, session: StudySession) throws {
        try require(session)
        var next = state
        next.bookmarks.removeAll { $0.id == id }
        try persist(next, accountID: session.accountID)
        state = next
    }

    @discardableResult
    public func upsertTask(_ task: RevisionTask, session: StudySession) throws -> RevisionTask {
        try require(session)
        var clean = task
        clean.title = try normalizedTitle(task.title)
        guard valid(date: clean.date) else { throw StudyStoreError.invalidDate }
        if clean.completed { clean.reminderEnabled = false }
        var next = state
        if let index = next.tasks.firstIndex(where: { $0.id == clean.id }) {
            next.tasks[index] = clean
        } else {
            guard next.tasks.count < Self.maximumTasks else { throw StudyStoreError.limitReached }
            next.tasks.append(clean)
        }
        next.tasks.sort { $0.date < $1.date }
        try persist(next, accountID: session.accountID)
        state = next
        return clean
    }

    public func removeTask(id: UUID, session: StudySession) throws {
        try require(session)
        var next = state
        next.tasks.removeAll { $0.id == id }
        try persist(next, accountID: session.accountID)
        state = next
    }

    /// Clears memory immediately. Disk metadata is unreadable through this actor until
    /// the server authenticates an account again. Caller must cancel the returned IDs.
    @discardableResult
    public func lock() -> [String] {
        let cancellations = activeSession.map { StudyReminders.identifiers(in: state, accountID: $0.accountID) } ?? []
        activeSession = nil
        state = .empty
        return cancellations
    }

    /// Locks even if removal fails. Callers should cancel reminders on every sign-out
    /// path and surface a removal failure instead of claiming a successful disk purge.
    @discardableResult
    public func logout() throws -> [String] {
        let accountID = activeSession?.accountID
        let cancellations = lock()
        if let accountID {
            let file = fileURL(accountID: accountID)
            if FileManager.default.fileExists(atPath: file.path) { try FileManager.default.removeItem(at: file) }
        }
        return cancellations
    }

    /// Erase the last server-verified account even after lock/session expiry. The
    /// caller must retain that UUID natively; never accept it from page JavaScript.
    /// A callback for A cannot purge A while B is currently active.
    @discardableResult
    public func purgeAccount(accountID: String) throws -> [String] {
        guard let uuid = UUID(uuidString: accountID) else { throw StudyStoreError.invalidAccount }
        let canonical = uuid.uuidString.lowercased()
        if let activeSession, activeSession.accountID != canonical { throw StudyStoreError.staleSession }
        let cancellations = activeSession == nil ? [] : lock()
        let file = fileURL(accountID: canonical)
        if FileManager.default.fileExists(atPath: file.path) { try FileManager.default.removeItem(at: file) }
        return cancellations
    }

    private func require(_ session: StudySession) throws {
        guard let activeSession else { throw StudyStoreError.locked }
        guard activeSession == session else { throw StudyStoreError.staleSession }
    }

    private func fileURL(accountID: String) -> URL {
        directoryURL.appendingPathComponent(accountID + ".json", isDirectory: false)
    }

    private func read(accountID: String) throws -> StudySnapshot {
        let file = fileURL(accountID: accountID)
        guard FileManager.default.fileExists(atPath: file.path) else { return .empty }
        let values = try file.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey, .isSymbolicLinkKey])
        guard values.isRegularFile == true, values.isSymbolicLink != true,
              let size = values.fileSize, size <= Self.maximumFileBytes else { throw StudyStoreError.invalidStoredState }
        do {
            let envelope = try JSONDecoder().decode(StudyEnvelope.self, from: Data(contentsOf: file))
            guard envelope.version == 1, envelope.accountID == accountID else { throw StudyStoreError.invalidStoredState }
            try validate(envelope.snapshot)
            return envelope.snapshot
        } catch {
            throw StudyStoreError.invalidStoredState
        }
    }

    private func persist(_ next: StudySnapshot, accountID: String) throws {
        try validate(next)
        try FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true)
        #if os(iOS)
        var directory = directoryURL
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try directory.setResourceValues(values)
        try FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: directory.path)
        #endif
        let data = try JSONEncoder().encode(StudyEnvelope(version: 1, accountID: accountID, snapshot: next))
        guard data.count <= Self.maximumFileBytes else { throw StudyStoreError.invalidStoredState }
        #if os(iOS)
        try data.write(to: fileURL(accountID: accountID), options: [.atomic, .completeFileProtection])
        #else
        try data.write(to: fileURL(accountID: accountID), options: [.atomic])
        #endif
    }

    private func validate(_ snapshot: StudySnapshot) throws {
        guard snapshot.bookmarks.count <= Self.maximumBookmarks, snapshot.tasks.count <= Self.maximumTasks,
              Set(snapshot.bookmarks.map(\.id)).count == snapshot.bookmarks.count,
              Set(snapshot.tasks.map(\.id)).count == snapshot.tasks.count,
              Set(snapshot.bookmarks.map(\.relativeURL)).count == snapshot.bookmarks.count else { throw StudyStoreError.invalidStoredState }
        for bookmark in snapshot.bookmarks {
            guard (try? normalizedTitle(bookmark.title)) == bookmark.title,
                  valid(date: bookmark.createdAt), policy.url(forBookmarkPath: bookmark.relativeURL) != nil else {
                throw StudyStoreError.invalidStoredState
            }
        }
        for task in snapshot.tasks {
            guard (try? normalizedTitle(task.title)) == task.title, valid(date: task.date),
                  !(task.completed && task.reminderEnabled) else { throw StudyStoreError.invalidStoredState }
        }
    }

    private func normalizedTitle(_ value: String) throws -> String {
        let clean = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty, clean.count <= 200,
              !clean.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) }) else { throw StudyStoreError.invalidTitle }
        return clean
    }

    private func valid(date: Date) -> Bool {
        let seconds = date.timeIntervalSince1970
        return seconds.isFinite && seconds >= 0 && seconds < 4_102_444_800
    }
}
