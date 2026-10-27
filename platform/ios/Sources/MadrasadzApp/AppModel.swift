import SwiftUI
import WebKit
import UserNotifications
import MadrasadzCore

private struct SessionEnvelope: Decodable {
    struct Payload: Decodable {
        struct User: Decodable { let id: String; let role: String }
        let authenticated: Bool
        let user: User
        let requiresPhoneVerification: Bool
    }
    let ok: Bool
    let data: Payload
}

private struct LogoutEnvelope: Decodable {
    struct Payload: Decodable { let loggedOut: Bool }
    let ok: Bool
    let data: Payload
}

private final class NoAPIRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest,
                    completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}

@MainActor
final class AppModel: ObservableObject {
    enum Identity { case checking, signedOut, phoneRequired, unavailable, unsupportedRole, ready }
    let browser = BrowserController()
    /// Teacher-allowed PDFs kept inside the app for one account (owner decision).
    let downloads = OfflineLibrary()
    private let store: StudyStore
    private let notifications = UNUserNotificationCenter.current()
    private var studySession: StudySession?
    // This ID comes only from a validated server response, never JavaScript or a URL.
    // Keep it while locked so an explicit sign-out can also remove locked metadata.
    private var lastVerifiedAccountID: String?
    private var generation = 0
    private var reminderGeneration = 0
    private var reminderTail: Task<Void, Never>?
    private var studyWriteBusy = false
    private var started = false
    private var identityRefresh: Task<Void, Never>?
    private var identityRefreshRevision: Int?
    private var identityTimeout: Task<Void, Never>?
    @Published var identity: Identity = .checking
    @Published var snapshot = StudySnapshot.empty
    @Published var selectedTab = 0
    @Published var notice: String?
    @Published var busy = false

    init() {
        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("PersonalStudy", isDirectory: true)
        store = StudyStore(directoryURL: directory, policy: browser.policy)
        browser.onPageFinished = { [weak self] in Task { await self?.refreshIdentity() } }
        browser.onAuthenticationPage = { [weak self] in Task { await self?.lockIdentity() } }
        // A cookie event may replace an account while a request is in flight.
        // Supersede that request, but coalesce ordinary page-finished/retry events.
        browser.onCookiesChanged = { [weak self] in Task { await self?.refreshIdentity(superseding: true) } }
    }

    var personalSpaceReady: Bool { if case .ready = identity { return !busy }; return false }
    var verifiedAccountID: String? { personalSpaceReady ? studySession?.accountID : nil }

    private func isCurrent(_ session: StudySession, revision: Int) -> Bool {
        revision == generation && session == studySession && personalSpaceReady && !busy
    }

    private func cancelReminders(_ identifiers: [String]) {
        notifications.removePendingNotificationRequests(withIdentifiers: identifiers)
        notifications.removeDeliveredNotifications(withIdentifiers: identifiers)
    }

    func start() async {
        guard !started else { return }
        started = true
        notifications.removeAllPendingNotificationRequests()
        notifications.removeAllDeliveredNotifications()
        browser.open()
        await refreshIdentity()
    }

    func lockIdentity() async {
        guard !busy else { return }
        identityRefresh?.cancel()
        identityRefresh = nil
        identityRefreshRevision = nil
        let revision = beginIdentityCheck()
        let ids = await store.lock()
        guard revision == generation, !busy else { return }
        cancelReminders(ids)
    }

    /// Hide the previous account before suspending. Repeated events share the
    /// same overall deadline rather than extending an endless checking screen.
    private func beginIdentityCheck() -> Int {
        generation += 1
        reminderGeneration += 1
        studySession = nil
        snapshot = .empty
        identity = .checking
        notifications.removeAllPendingNotificationRequests()
        notifications.removeAllDeliveredNotifications()
        if identityTimeout == nil {
            identityTimeout = Task { @MainActor [weak self] in
                do { try await Task.sleep(nanoseconds: 25_000_000_000) }
                catch { return }
                guard !Task.isCancelled, let self, !self.busy,
                      case .checking = self.identity else { return }
                // Invalidate late cookie/network/store completions as well as
                // cancelling URLSession; cancellation alone is not an identity guard.
                self.generation += 1
                let revision = self.generation
                self.identityRefresh?.cancel()
                self.identityRefresh = nil
                self.identityRefreshRevision = nil
                await self.invalidate(to: .unavailable, revision: revision)
            }
        }
        return generation
    }

    private func stopIdentityTimeout() {
        identityTimeout?.cancel()
        identityTimeout = nil
    }

    func refreshIdentity(superseding: Bool = false) async {
        guard !busy else { return }
        if OfflineShellValidation.enabled {
            await lockIdentity()
            stopIdentityTimeout()
            identity = .signedOut
            return
        }
        if !superseding, let pending = identityRefresh {
            await pending.value
            return
        }
        identityRefresh?.cancel()
        let revision = beginIdentityCheck()
        let operation = Task { @MainActor [weak self] in
            if superseding {
                // WebKit can report several cookie writes for one navigation.
                do { try await Task.sleep(nanoseconds: 150_000_000) }
                catch { return }
            }
            guard !Task.isCancelled else { return }
            await self?.loadIdentity(revision: revision)
        }
        identityRefreshRevision = revision
        identityRefresh = operation
        await operation.value
        if identityRefreshRevision == revision {
            identityRefresh = nil
            identityRefreshRevision = nil
        }
    }

    private func loadIdentity(revision: Int) async {
        let oldIDs = await store.lock()
        guard revision == generation, !busy, !Task.isCancelled else { return }
        cancelReminders(oldIDs)
        do {
            guard let request = try await authenticatedRequest(path: "/api/v1/ios/session", revision: revision) else {
                await invalidate(to: .signedOut, revision: revision)
                return
            }
            guard revision == generation, !busy else { return }
            let (data, response) = try await perform(request)
            guard revision == generation, !busy else { return }
            if response.statusCode == 401 { await invalidate(to: .signedOut, revision: revision); return }
            if response.statusCode == 403 { await invalidate(to: .unsupportedRole, revision: revision); return }
            guard response.statusCode == 200, data.count < 65_536,
                  response.url?.path == "/api/v1/ios/session" else { throw URLError(.badServerResponse) }
            let envelope = try JSONDecoder().decode(SessionEnvelope.self, from: data)
            guard envelope.ok, envelope.data.authenticated, envelope.data.user.role == "STUDENT",
                  let account = UUID(uuidString: envelope.data.user.id) else { throw URLError(.badServerResponse) }
            lastVerifiedAccountID = account.uuidString.lowercased()
            if envelope.data.requiresPhoneVerification {
                await invalidate(to: .phoneRequired, revision: revision)
                return
            }
            guard revision == generation, !busy else { return }
            let session = try await store.activate(accountID: account.uuidString)
            guard revision == generation, !busy else { return }
            studySession = session
            let state = try await store.snapshot(using: session)
            guard revision == generation, session == studySession, !busy else { return }
            stopIdentityTimeout()
            identity = .ready
            // Reconcile notification permission/limits before showing reminder flags.
            guard await synchronizeReminders(state: state, session: session, revision: revision),
                  isCurrent(session, revision: revision) else { return }
            let confirmed = try await store.snapshot(using: session)
            guard isCurrent(session, revision: revision) else { return }
            snapshot = confirmed
        } catch {
            await invalidate(to: .unavailable, revision: revision)
        }
    }

    private func invalidate(to state: Identity, revision: Int) async {
        guard revision == generation, !busy else { return }
        stopIdentityTimeout()
        reminderGeneration += 1
        studySession = nil
        snapshot = .empty
        identity = state
        notifications.removeAllPendingNotificationRequests()
        notifications.removeAllDeliveredNotifications()
        let ids = await store.lock()
        guard revision == generation, !busy else { return }
        cancelReminders(ids)
        // The server says there is no session (sign-out elsewhere, expiry, or a
        // signed-out device): offline copies must not outlive the account session.
        if case .signedOut = state, !downloads.purgeAll() { notice = L10n.text("localCleanupFailed") }
        if case .signedOut = state, let accountID = lastVerifiedAccountID {
            do {
                _ = try await store.purgeAccount(accountID: accountID)
                guard revision == generation, !busy else { return }
                lastVerifiedAccountID = nil
            } catch {
                if revision == generation, !busy { notice = L10n.text("localCleanupFailed") }
            }
        }
    }

    private func authenticatedRequest(path: String, method: String = "GET", revision: Int) async throws -> URLRequest? {
        guard revision == generation,
              case .internalPage = browser.policy.decision(for: browser.baseURL.appendingPathComponent("ios")),
              let host = browser.baseURL.host else { throw URLError(.cancelled) }
        let cookies: [HTTPCookie] = try await withCheckedThrowingContinuation { continuation in
            let read = CallbackDeadline(continuation)
            read.armTimeout(nanoseconds: 5_000_000_000)
            browser.webView.configuration.websiteDataStore.httpCookieStore.getAllCookies { cookies in
                Task { @MainActor in read.finish(.success(cookies)) }
            }
        }
        guard revision == generation else { throw URLError(.cancelled) }
        let matching = cookies.filter {
            $0.name == "madrasa_session"
            && $0.domain.trimmingCharacters(in: CharacterSet(charactersIn: ".")).lowercased() == host.lowercased()
            && ($0.expiresDate == nil || $0.expiresDate! > Date())
        }
        guard !matching.isEmpty else { return nil }
        // Fail closed for shadow cookies or weaker cookies instead of accidentally
        // sending another path's token to an account API.
        guard matching.count == 1, let cookie = matching.first, cookie.path == "/",
              cookie.isSecure, cookie.isHTTPOnly,
              let target = URL(string: path, relativeTo: browser.baseURL)?.absoluteURL else {
            throw URLError(.userAuthenticationRequired)
        }
        var request = URLRequest(url: target, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 20)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("no-store", forHTTPHeaderField: "Cache-Control")
        for (name, value) in HTTPCookie.requestHeaderFields(with: [cookie]) { request.setValue(value, forHTTPHeaderField: name) }
        if method == "POST" { request.setValue("https://" + host.lowercased(), forHTTPHeaderField: "Origin") }
        return request
    }

    private func perform(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpShouldSetCookies = false
        configuration.httpCookieStorage = nil
        configuration.urlCache = nil
        let session = URLSession(configuration: configuration, delegate: NoAPIRedirects(), delegateQueue: nil)
        defer { session.invalidateAndCancel() }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, http.url?.scheme == "https",
              http.url?.host?.lowercased() == browser.baseURL.host?.lowercased() else { throw URLError(.badServerResponse) }
        return (data, http)
    }

    func saveCurrentPage() async {
        guard let session = studySession, personalSpaceReady, !studyWriteBusy,
              let url = browser.currentURL else { return }
        let revision = generation
        let title = String(browser.currentTitle.prefix(200))
        studyWriteBusy = true
        defer { studyWriteBusy = false }
        do {
            guard isCurrent(session, revision: revision) else { return }
            _ = try await store.addBookmark(title: title, url: url, session: session)
            guard isCurrent(session, revision: revision) else { return }
            let state = try await store.snapshot(using: session)
            guard isCurrent(session, revision: revision) else { return }
            snapshot = state
            notice = L10n.text("savedNotice")
        } catch { if isCurrent(session, revision: revision) { notice = L10n.text("error") } }
    }

    func deleteBookmark(_ bookmark: Bookmark) async {
        guard let session = studySession, personalSpaceReady, !studyWriteBusy,
              snapshot.bookmarks.contains(where: { $0.id == bookmark.id }) else { return }
        let revision = generation
        studyWriteBusy = true
        defer { studyWriteBusy = false }
        do {
            try await store.removeBookmark(id: bookmark.id, session: session)
            guard isCurrent(session, revision: revision) else { return }
            let state = try await store.snapshot(using: session)
            guard isCurrent(session, revision: revision) else { return }
            snapshot = state
        } catch { if isCurrent(session, revision: revision) { notice = L10n.text("error") } }
    }

    func openBookmark(_ bookmark: Bookmark) {
        guard personalSpaceReady, snapshot.bookmarks.contains(where: { $0.id == bookmark.id && $0.relativeURL == bookmark.relativeURL }),
              let url = browser.policy.url(forBookmarkPath: bookmark.relativeURL) else { return }
        selectedTab = 0
        browser.open(url)
    }

    private func reminderMinute(_ date: Date) -> Date? {
        Calendar.current.dateInterval(of: .minute, for: date)?.start
    }

    @discardableResult
    func saveTask(_ task: RevisionTask) async -> Bool {
        guard let session = studySession, personalSpaceReady, !studyWriteBusy else { return false }
        let revision = generation
        studyWriteBusy = true
        defer { studyWriteBusy = false }
        do {
            var adjusted = task
            if adjusted.reminderEnabled && !adjusted.completed {
                guard let minute = reminderMinute(adjusted.date), minute > Date() else {
                    notice = L10n.text("reminderUnavailable")
                    return false
                }
                let activeCount = snapshot.tasks.filter {
                    $0.id != adjusted.id && $0.reminderEnabled && !$0.completed && (reminderMinute($0.date) ?? .distantPast) > Date()
                }.count
                guard activeCount < 50 else { notice = L10n.text("reminderLimit"); return false }
                let accepted = try await notifications.requestAuthorization(options: [.alert, .sound])
                guard isCurrent(session, revision: revision) else { return false }
                if !accepted { adjusted.reminderEnabled = false; notice = L10n.text("reminderDenied") }
            }
            guard isCurrent(session, revision: revision) else { return false }
            _ = try await store.upsertTask(adjusted, session: session)
            guard isCurrent(session, revision: revision) else { return false }
            let state = try await store.snapshot(using: session)
            guard isCurrent(session, revision: revision) else { return false }
            guard await synchronizeReminders(state: state, session: session, revision: revision),
                  isCurrent(session, revision: revision) else { return false }
            let confirmed = try await store.snapshot(using: session)
            guard isCurrent(session, revision: revision) else { return false }
            snapshot = confirmed
            return true
        } catch {
            if isCurrent(session, revision: revision) { notice = L10n.text("error") }
            return false
        }
    }

    func deleteTask(_ task: RevisionTask) async {
        guard let session = studySession, personalSpaceReady, !studyWriteBusy,
              snapshot.tasks.contains(where: { $0.id == task.id }) else { return }
        let revision = generation
        studyWriteBusy = true
        defer { studyWriteBusy = false }
        do {
            try await store.removeTask(id: task.id, session: session)
            guard isCurrent(session, revision: revision) else { return }
            let state = try await store.snapshot(using: session)
            guard isCurrent(session, revision: revision) else { return }
            guard await synchronizeReminders(state: state, session: session, revision: revision),
                  isCurrent(session, revision: revision) else { return }
            let confirmed = try await store.snapshot(using: session)
            guard isCurrent(session, revision: revision) else { return }
            snapshot = confirmed
            if let id = StudyReminders.identifier(accountID: session.accountID, taskID: task.id) { cancelReminders([id]) }
        } catch { if isCurrent(session, revision: revision) { notice = L10n.text("error") } }
    }

    private func synchronizeReminders(state: StudySnapshot, session: StudySession, revision: Int) async -> Bool {
        guard isCurrent(session, revision: revision) else { return false }
        reminderGeneration += 1
        let reminderRevision = reminderGeneration
        let previous = reminderTail
        // Serialize UN callbacks too: an old account's late add/remove must finish
        // before the next context schedules the same account/task identifier.
        let operation = Task { @MainActor [weak self] in
            if let previous { await previous.value }
            guard let self, self.isCurrent(session, revision: revision), self.reminderGeneration == reminderRevision else { return }
            await self.applyReminders(state: state, session: session, revision: revision, reminderRevision: reminderRevision)
        }
        reminderTail = operation
        await operation.value
        return isCurrent(session, revision: revision) && reminderGeneration == reminderRevision
    }

    private func applyReminders(state: StudySnapshot, session: StudySession, revision: Int, reminderRevision: Int) async {
        func current() -> Bool { isCurrent(session, revision: revision) && reminderGeneration == reminderRevision }
        guard current() else { return }
        let pending = await notifications.pendingNotificationRequests()
        guard current() else { return }
        cancelReminders(pending.filter { $0.identifier.hasPrefix("madrasadz.revision.") }.map(\.identifier))
        let settings = await notifications.notificationSettings()
        guard current() else { return }
        let allowed = settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional
        var count = 0
        for task in state.tasks.filter({ $0.reminderEnabled && !$0.completed }) {
            guard current() else { return }
            var canSchedule = allowed && count < 50 && (reminderMinute(task.date) ?? .distantPast) > Date()
            let id = StudyReminders.identifier(accountID: session.accountID, taskID: task.id)
            if canSchedule, let id {
                let content = UNMutableNotificationContent()
                content.title = "Madrasadz — مدرسة"
                content.body = L10n.text("reminderBody")
                content.sound = .default
                let components = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: task.date)
                let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
                if let fireDate = trigger.nextTriggerDate(), fireDate > Date() {
                    do {
                        try await notifications.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
                        guard current() else { cancelReminders([id]); return }
                        count += 1
                    } catch { canSchedule = false }
                } else { canSchedule = false }
            } else { canSchedule = false }
            guard current() else { return }
            if !canSchedule {
                if let id { cancelReminders([id]) }
                var disabled = task
                disabled.reminderEnabled = false
                do {
                    guard current() else { return }
                    _ = try await store.upsertTask(disabled, session: session)
                    guard current() else { return }
                    notice = L10n.text(allowed ? "reminderUnavailable" : "reminderDenied")
                } catch {
                    guard current() else { return }
                    notice = L10n.text("error")
                    await invalidate(to: .unavailable, revision: revision)
                    return
                }
            }
        }
    }

    func logout() async {
        guard !busy else { return }
        identityRefresh?.cancel()
        identityRefresh = nil
        identityRefreshRevision = nil
        stopIdentityTimeout()
        busy = true
        generation += 1
        reminderGeneration += 1
        let revision = generation
        let accountToPurge = lastVerifiedAccountID
        studySession = nil
        snapshot = .empty
        identity = .checking
        browser.webView.stopLoading()
        browser.webView.isUserInteractionEnabled = false
        notifications.removeAllPendingNotificationRequests()
        notifications.removeAllDeliveredNotifications()
        defer { busy = false; browser.webView.isUserInteractionEnabled = true }
        _ = await store.lock()
        guard revision == generation else { return }
        // Retain WebKit's cookie on a network/server failure so revocation can be
        // retried. Personal data stays locked while that result is unknown.
        do {
            if let request = try await authenticatedRequest(path: "/api/v1/ios/logout", method: "POST", revision: revision) {
                guard revision == generation else { return }
                let (data, response) = try await perform(request)
                guard revision == generation else { return }
                guard response.statusCode == 200, data.count < 65_536,
                      response.url?.path == "/api/v1/ios/logout" else { throw URLError(.badServerResponse) }
                let result = try JSONDecoder().decode(LogoutEnvelope.self, from: data)
                guard result.ok, result.data.loggedOut else { throw URLError(.badServerResponse) }
                // A pending browser action must not replace the cookie and then
                // have its new credential discarded without server revocation.
                let current = try await authenticatedRequest(path: "/api/v1/ios/session", revision: revision)
                guard revision == generation else { return }
                guard current == nil || current?.value(forHTTPHeaderField: "Cookie") == request.value(forHTTPHeaderField: "Cookie") else {
                    throw URLError(.userAuthenticationRequired)
                }
            }
        } catch {
            guard revision == generation else { return }
            identity = .unavailable
            notice = L10n.text("logoutPending")
            return
        }
        guard revision == generation else { return }
        if let tail = reminderTail { await tail.value }
        guard revision == generation else { return }
        notifications.removeAllPendingNotificationRequests()
        notifications.removeAllDeliveredNotifications()
        var cleanupFailed = !downloads.purgeAll()
        if let accountToPurge {
            do { _ = try await store.purgeAccount(accountID: accountToPurge) }
            catch { cleanupFailed = true }
            guard revision == generation else { return }
        }
        let dataStore = browser.webView.configuration.websiteDataStore
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            dataStore.removeData(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), modifiedSince: .distantPast) { continuation.resume() }
        }
        guard revision == generation else { return }
        lastVerifiedAccountID = cleanupFailed ? accountToPurge : nil
        snapshot = .empty
        identity = .signedOut
        browser.open()
        notice = L10n.text(cleanupFailed ? "localCleanupFailed" : "logoutSuccess")
    }
}
