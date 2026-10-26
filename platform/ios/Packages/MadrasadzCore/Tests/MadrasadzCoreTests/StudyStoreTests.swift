import Foundation
import XCTest
@testable import MadrasadzCore

final class StudyStoreTests: XCTestCase {
    private let accountA = "31e95cad-e92a-41c2-bfe8-fda706883d24"
    private let accountB = "6258c6a8-367f-4e0b-a5a7-ea4051b92201"
    private var directories: [URL] = []

    override func tearDown() {
        for url in directories { try? FileManager.default.removeItem(at: url) }
        super.tearDown()
    }

    private func makeStore() -> (StudyStore, URL) {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("madrasadz-tests-" + UUID().uuidString)
        directories.append(directory)
        return (StudyStore(directoryURL: directory), directory)
    }

    private func expect(_ error: StudyStoreError, _ operation: () async throws -> Void, file: StaticString = #filePath, line: UInt = #line) async {
        do {
            try await operation()
            XCTFail("Expected \(error)", file: file, line: line)
        } catch let received as StudyStoreError {
            XCTAssertEqual(received, error, file: file, line: line)
        } catch {
            XCTFail("Unexpected error \(error)", file: file, line: line)
        }
    }

    func testStoreIsLockedUntilActivationWithServerAccount() async throws {
        let (store, _) = makeStore()
        let session = try await store.activate(accountID: accountA)
        _ = await store.lock()
        await expect(.locked) { _ = try await store.snapshot(using: session) }
        await expect(.locked) { _ = try await store.addBookmark(title: "درس", url: URL(string: "https://madrasadz.com/ios/lesson/a")!, session: session) }
    }

    func testAccountIdentifierCannotBecomeAPath() async {
        let (store, _) = makeStore()
        for input in ["../other", "../../private", "student@example.org", "", "/tmp/account", accountA + "/../" + accountB] {
            await expect(.invalidAccount) { _ = try await store.activate(accountID: input) }
        }
    }

    func testUUIDCaseIsCanonicalizedAndStatePersistsForSameAccount() async throws {
        let (store, directory) = makeStore()
        let session = try await store.activate(accountID: accountA.uppercased())
        XCTAssertEqual(session.accountID, accountA)
        let saved = try await store.addBookmark(title: "  الجبر  ", url: URL(string: "https://madrasadz.com/ios/lesson/a?token=never-save#x")!, session: session)
        XCTAssertEqual(saved.title, "الجبر")
        XCTAssertEqual(saved.relativeURL, "/ios/lesson/a")
        let file = directory.appendingPathComponent(accountA + ".json")
        let serialized = String(data: try Data(contentsOf: file), encoding: .utf8)!
        XCTAssertFalse(serialized.contains("never-save"))
        let restored = StudyStore(directoryURL: directory)
        let restoredSession = try await restored.activate(accountID: accountA)
        let snapshot = try await restored.snapshot(using: restoredSession)
        XCTAssertEqual(snapshot.bookmarks, [saved])
    }

    func testAccountsNeverSeeEachOthersBookmarksOrTasks() async throws {
        let (store, _) = makeStore()
        let first = try await store.activate(accountID: accountA)
        _ = try await store.addBookmark(title: "درس أ", url: URL(string: "https://madrasadz.com/ios/lesson/a")!, session: first)
        _ = try await store.upsertTask(RevisionTask(title: "مراجعة أ", date: Date()), session: first)
        let second = try await store.activate(accountID: accountB)
        let empty = try await store.snapshot(using: second)
        XCTAssertEqual(empty, .empty)
        _ = try await store.addBookmark(title: "درس ب", url: URL(string: "https://madrasadz.com/ios/lesson/b")!, session: second)
        let again = try await store.activate(accountID: accountA)
        let state = try await store.snapshot(using: again)
        XCTAssertEqual(state.bookmarks.map(\.title), ["درس أ"])
        XCTAssertEqual(state.tasks.map(\.title), ["مراجعة أ"])
    }

    func testStaleCallbacksCannotReadOrWriteAfterAccountSwitch() async throws {
        let (store, _) = makeStore()
        let first = try await store.activate(accountID: accountA)
        _ = try await store.activate(accountID: accountB)
        await expect(.staleSession) { _ = try await store.snapshot(using: first) }
        await expect(.staleSession) { _ = try await store.upsertTask(RevisionTask(title: "متأخر", date: Date()), session: first) }
        await expect(.staleSession) { _ = try await store.addBookmark(title: "متأخر", url: URL(string: "https://madrasadz.com/ios/lesson/a")!, session: first) }
    }

    func testSameAccountReverificationInvalidatesOldCallbackToken() async throws {
        let (store, _) = makeStore()
        let old = try await store.activate(accountID: accountA)
        let fresh = try await store.activate(accountID: accountA)
        XCTAssertNotEqual(old, fresh)
        await expect(.staleSession) { _ = try await store.snapshot(using: old) }
        let snapshot = try await store.snapshot(using: fresh)
        XCTAssertEqual(snapshot, .empty)
    }

    func testLogoutPurgesOnlyCurrentAccountAndCancelsItsReminders() async throws {
        let (store, directory) = makeStore()
        let a = try await store.activate(accountID: accountA)
        _ = try await store.addBookmark(title: "درس أ", url: URL(string: "https://madrasadz.com/ios/lesson/a")!, session: a)
        let b = try await store.activate(accountID: accountB)
        let task = try await store.upsertTask(RevisionTask(title: "مراجعة ب", date: Date().addingTimeInterval(3600), reminderEnabled: true), session: b)
        let cancellations = try await store.logout()
        XCTAssertEqual(cancellations, [StudyReminders.identifier(accountID: accountB, taskID: task.id)!])
        XCTAssertFalse(FileManager.default.fileExists(atPath: directory.appendingPathComponent(accountB + ".json").path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: directory.appendingPathComponent(accountA + ".json").path))
        await expect(.locked) { _ = try await store.snapshot(using: b) }
        let fresh = try await store.activate(accountID: accountB)
        let snapshot = try await store.snapshot(using: fresh)
        XCTAssertEqual(snapshot, .empty)
    }

    func testLockCancelsReminderIdentifiersWithoutDeletingPersistedPreferences() async throws {
        let (store, _) = makeStore()
        let session = try await store.activate(accountID: accountA)
        let task = try await store.upsertTask(RevisionTask(title: "مراجعة", date: Date().addingTimeInterval(3600), reminderEnabled: true), session: session)
        let cancellations = await store.lock()
        XCTAssertEqual(cancellations, [StudyReminders.identifier(accountID: accountA, taskID: task.id)!])
        let fresh = try await store.activate(accountID: accountA)
        let snapshot = try await store.snapshot(using: fresh)
        XCTAssertEqual(snapshot.tasks, [task])
    }

    func testConcurrentBookmarkTapsAreIdempotent() async throws {
        let (store, _) = makeStore()
        let session = try await store.activate(accountID: accountA)
        let values = try await withThrowingTaskGroup(of: Bookmark.self, returning: [Bookmark].self) { group in
            for _ in 0..<20 {
                group.addTask { try await store.addBookmark(title: "درس", url: URL(string: "https://madrasadz.com/ios/lesson/a")!, session: session) }
            }
            var bookmarks: [Bookmark] = []
            for try await value in group { bookmarks.append(value) }
            return bookmarks
        }
        XCTAssertEqual(Set(values.map(\.id)).count, 1)
        let snapshot = try await store.snapshot(using: session)
        XCTAssertEqual(snapshot.bookmarks.count, 1)
    }

    func testUnsafeBookmarksAndInvalidTitlesDoNotPersist() async throws {
        let (store, directory) = makeStore()
        let session = try await store.activate(accountID: accountA)
        await expect(.invalidURL) { _ = try await store.addBookmark(title: "خطأ", url: URL(string: "https://evil.example/a")!, session: session) }
        await expect(.invalidURL) { _ = try await store.addBookmark(title: "شراء", url: URL(string: "https://madrasadz.com/store")!, session: session) }
        for title in ["  ", "عنوان\nآخر", String(repeating: "أ", count: 201)] {
            await expect(.invalidTitle) { _ = try await store.addBookmark(title: title, url: URL(string: "https://madrasadz.com/ios/lesson/a")!, session: session) }
        }
        XCTAssertFalse(FileManager.default.fileExists(atPath: directory.path))
    }

    func testTaskUpdatesSortAndCompletedTaskCannotKeepReminder() async throws {
        let (store, _) = makeStore()
        let session = try await store.activate(accountID: accountA)
        let later = try await store.upsertTask(RevisionTask(title: "لاحقًا", date: Date().addingTimeInterval(7200)), session: session)
        let sooner = try await store.upsertTask(RevisionTask(title: "أولًا", date: Date().addingTimeInterval(3600), reminderEnabled: true), session: session)
        let sorted = try await store.snapshot(using: session)
        XCTAssertEqual(sorted.tasks.map(\.id), [sooner.id, later.id])
        var completed = sooner
        completed.completed = true
        let result = try await store.upsertTask(completed, session: session)
        XCTAssertFalse(result.reminderEnabled)
        let updated = try await store.snapshot(using: session)
        XCTAssertEqual(updated.tasks.count, 2)
        try await store.removeTask(id: later.id, session: session)
        let removed = try await store.snapshot(using: session)
        XCTAssertEqual(removed.tasks.count, 1)
    }

    func testInvalidDatesAndBookmarkLimitAreEnforced() async throws {
        let (store, _) = makeStore()
        let session = try await store.activate(accountID: accountA)
        await expect(.invalidDate) { _ = try await store.upsertTask(RevisionTask(title: "قديم", date: Date(timeIntervalSince1970: -1)), session: session) }
        for index in 0..<StudyStore.maximumBookmarks {
            _ = try await store.addBookmark(title: "درس \(index)", url: URL(string: "https://madrasadz.com/ios/lesson/\(index)")!, session: session)
        }
        await expect(.limitReached) { _ = try await store.addBookmark(title: "فوق الحد", url: URL(string: "https://madrasadz.com/ios/lesson/extra")!, session: session) }
        let snapshot = try await store.snapshot(using: session)
        XCTAssertEqual(snapshot.bookmarks.count, StudyStore.maximumBookmarks)
    }

    func testCorruptedFileFailsClosedAndClearsOldAccountMemory() async throws {
        let (store, directory) = makeStore()
        let session = try await store.activate(accountID: accountA)
        _ = try await store.addBookmark(title: "سليم", url: URL(string: "https://madrasadz.com/ios/lesson/a")!, session: session)
        try Data("not-json".utf8).write(to: directory.appendingPathComponent(accountB + ".json"))
        await expect(.invalidStoredState) { _ = try await store.activate(accountID: accountB) }
        await expect(.locked) { _ = try await store.snapshot(using: session) }
    }

    func testStoredAccountMismatchAndExternalURLAreRejected() async throws {
        let (store, directory) = makeStore()
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let poison = StudyEnvelope(version: 1, accountID: accountB, snapshot: .empty)
        let file = directory.appendingPathComponent(accountA + ".json")
        try JSONEncoder().encode(poison).write(to: file)
        await expect(.invalidStoredState) { _ = try await store.activate(accountID: accountA) }
        let external = Bookmark(title: "مزيف", relativeURL: "https://evil.example/a")
        try JSONEncoder().encode(StudyEnvelope(version: 1, accountID: accountA, snapshot: StudySnapshot(bookmarks: [external]))).write(to: file)
        await expect(.invalidStoredState) { _ = try await store.activate(accountID: accountA) }
    }

    func testOversizedAndSymlinkStateFilesAreRejected() async throws {
        let (store, directory) = makeStore()
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let file = directory.appendingPathComponent(accountA + ".json")
        try Data(repeating: 32, count: 1_048_577).write(to: file)
        await expect(.invalidStoredState) { _ = try await store.activate(accountID: accountA) }
        try FileManager.default.removeItem(at: file)
        let destination = directory.appendingPathComponent("outside.json")
        try JSONEncoder().encode(StudyEnvelope(version: 1, accountID: accountA, snapshot: .empty)).write(to: destination)
        try FileManager.default.createSymbolicLink(at: file, withDestinationURL: destination)
        await expect(.invalidStoredState) { _ = try await store.activate(accountID: accountA) }
    }

    func testReminderIdentifiersAreAccountScopedAndContainNoTaskText() {
        let id = UUID()
        let a = StudyReminders.identifier(accountID: accountA, taskID: id)!
        let b = StudyReminders.identifier(accountID: accountB, taskID: id)!
        XCTAssertNotEqual(a, b)
        XCTAssertTrue(a.hasPrefix("madrasadz.revision."))
        XCTAssertNil(StudyReminders.identifier(accountID: "../../escape", taskID: id))
    }

    func testFailedAtomicPersistenceDoesNotPublishUnwrittenChanges() async throws {
        let (store, directory) = makeStore()
        // A regular file where the directory belongs makes persistence fail.
        try Data("occupied".utf8).write(to: directory)
        let session = try await store.activate(accountID: accountA)
        do {
            _ = try await store.upsertTask(RevisionTask(title: "لم يُحفظ", date: Date()), session: session)
            XCTFail("Expected an I/O error")
        } catch {
            let snapshot = try await store.snapshot(using: session)
            XCTAssertEqual(snapshot, .empty)
        }
    }

    func testOverLimitStoredPlannerDoesNotLoad() async throws {
        let (store, directory) = makeStore()
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let tasks = (0...StudyStore.maximumTasks).map { RevisionTask(title: "مراجعة \($0)", date: Date()) }
        let envelope = StudyEnvelope(version: 1, accountID: accountA, snapshot: StudySnapshot(tasks: tasks))
        try JSONEncoder().encode(envelope).write(to: directory.appendingPathComponent(accountA + ".json"))
        await expect(.invalidStoredState) { _ = try await store.activate(accountID: accountA) }
    }

    func testLastVerifiedAccountCanBePurgedAfterSessionIsLocked() async throws {
        let (store, directory) = makeStore()
        let session = try await store.activate(accountID: accountA)
        _ = try await store.addBookmark(title: "درس", url: URL(string: "https://madrasadz.com/ios/lesson/a")!, session: session)
        _ = await store.lock()
        _ = try await store.purgeAccount(accountID: accountA)
        XCTAssertFalse(FileManager.default.fileExists(atPath: directory.appendingPathComponent(accountA + ".json").path))
        let next = try await store.activate(accountID: accountA)
        let snapshot = try await store.snapshot(using: next)
        XCTAssertEqual(snapshot, .empty)
    }

    func testPurgeRejectsTraversalWithoutRemovingAnAccount() async throws {
        let (store, directory) = makeStore()
        let session = try await store.activate(accountID: accountA)
        _ = try await store.addBookmark(title: "درس", url: URL(string: "https://madrasadz.com/ios/lesson/a")!, session: session)
        await expect(.invalidAccount) { _ = try await store.purgeAccount(accountID: "../" + self.accountA) }
        XCTAssertTrue(FileManager.default.fileExists(atPath: directory.appendingPathComponent(accountA + ".json").path))
        let snapshot = try await store.snapshot(using: session)
        XCTAssertEqual(snapshot.bookmarks.count, 1)
    }

    func testStaleAccountPurgeCannotAffectEitherAccountAfterSwitch() async throws {
        let (store, directory) = makeStore()
        let a = try await store.activate(accountID: accountA)
        _ = try await store.addBookmark(title: "درس أ", url: URL(string: "https://madrasadz.com/ios/lesson/a")!, session: a)
        let b = try await store.activate(accountID: accountB)
        _ = try await store.addBookmark(title: "درس ب", url: URL(string: "https://madrasadz.com/ios/lesson/b")!, session: b)
        await expect(.staleSession) { _ = try await store.purgeAccount(accountID: self.accountA) }
        XCTAssertTrue(FileManager.default.fileExists(atPath: directory.appendingPathComponent(accountA + ".json").path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: directory.appendingPathComponent(accountB + ".json").path))
        let snapshot = try await store.snapshot(using: b)
        XCTAssertEqual(snapshot.bookmarks.map(\.title), ["درس ب"])
    }
}
