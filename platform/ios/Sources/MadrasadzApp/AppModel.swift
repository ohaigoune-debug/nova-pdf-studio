import SwiftUI
import Network
import UserNotifications
import MadrasadzCore

enum AppTab: Hashable { case home, play, library, planner, account }

/// The whole app state: the native session (Keychain), the read-only content
/// cache, offline PDFs, offline PLAY and the personal revision plan.
/// Every screen is native; the website is only an API.
@MainActor
final class AppModel: ObservableObject {
    enum Phase: Equatable { case launching, signedOut, ready }

    struct SessionInfo: Decodable {
        struct User: Decodable { let id: String; let role: String }
        let authenticated: Bool
        let user: User?
        let requiresPhoneVerification: Bool?
    }

    private struct Me: Decodable {
        let userId: String
        let role: String
        let fullName: String?
        let email: String?
    }

    private struct LoginReply: Decodable {
        let token: String
        let expiresAt: Date?
        let role: String
    }

    enum HeartbeatResult: Equatable { case accepted, blocked(String), failed }

    @Published private(set) var phase: Phase = .launching
    @Published private(set) var session: SavedSession?
    @Published private(set) var phoneVerificationRequired = false
    @Published private(set) var online = true
    @Published private(set) var busy = false
    @Published private(set) var snapshot = StudySnapshot.empty
    @Published var selectedTab: AppTab = .home
    @Published var notice: String?

    let api = APIClient()
    let downloads = OfflineLibrary()
    let play: PlayModel
    private let cache: ResponseCache
    private let store: StudyStore
    private let notifications = UNUserNotificationCenter.current()
    private let monitor = NWPathMonitor()
    private var studySession: StudySession?
    private var studyWriteBusy = false
    private var reminderTail: Task<Void, Never>?
    private var generation = 0
    private var started = false

    init() {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        store = StudyStore(directoryURL: support.appendingPathComponent("PersonalStudy", isDirectory: true))
        cache = ResponseCache(root: support.appendingPathComponent("NativeCache", isDirectory: true))
        play = PlayModel(store: PlayStore(root: support.appendingPathComponent("PlayOffline", isDirectory: true)))
        play.attach(self)
        monitor.pathUpdateHandler = { [weak self] path in
            let reachable = path.status == .satisfied
            Task { @MainActor [weak self] in self?.connectivityChanged(reachable) }
        }
        monitor.start(queue: DispatchQueue(label: "com.madrasadz.path"))
    }

    var accountID: String? { session?.accountID }
    var displayName: String? { session?.name?.isEmpty == false ? session?.name : nil }
    var personalSpaceReady: Bool { phase == .ready && studySession != nil && !busy }
    var verifiedAccountID: String? { personalSpaceReady ? session?.accountID : nil }

    // MARK: Session

    func start() async {
        guard !started else { return }
        started = true
        #if DEBUG
        if Fixtures.enabled {
            if Fixtures.signedIn {
                await activate(SavedSession(token: "fixture", expiresAt: nil, accountID: Fixtures.accountID, role: "STUDENT", name: "تلميذ تجريبي", email: "student@example.com"))
            } else {
                phase = .signedOut
            }
            return
        }
        #endif
        guard let saved = Keychain.session, saved.role == "STUDENT", UUID(uuidString: saved.accountID) != nil else {
            Keychain.session = nil
            phase = .signedOut
            return
        }
        if let expires = saved.expiresAt, expires < Date() {
            await signOutLocally(notice: L10n.text("sessionExpired"))
            return
        }
        // Offline first: the saved account opens at once; the server confirms it next.
        await activate(saved)
        Task { await validate() }
    }

    private func activate(_ saved: SavedSession) async {
        generation += 1
        session = saved
        api.use(token: saved.token, account: saved.accountID)
        downloads.accountVerified(saved.accountID.lowercased())
        do {
            let study = try await store.activate(accountID: saved.accountID.lowercased())
            studySession = study
            snapshot = try await store.snapshot(using: study)
        } catch {
            studySession = nil
            snapshot = .empty
        }
        await play.activate(account: saved.accountID)
        phase = .ready
        if let study = studySession { _ = await synchronizeReminders(state: snapshot, session: study, revision: generation) }
    }

    /// Confirms the saved session with the server; refreshes the name and phone gate.
    func validate() async {
        guard phase == .ready, let current = session else { return }
        do {
            let info = try await api.get(SessionInfo.self, "/api/v1/ios/session").value
            guard info.authenticated, let user = info.user, user.id.lowercased() == current.accountID.lowercased() else {
                await signOutLocally(notice: L10n.text("sessionExpired"))
                return
            }
            phoneVerificationRequired = info.requiresPhoneVerification ?? false
            if let me = try? await api.get(Me.self, "/api/v1/auth/me").value, me.userId.lowercased() == current.accountID.lowercased() {
                var updated = current
                updated.name = me.fullName
                updated.email = me.email
                if updated != current, session?.accountID == current.accountID {
                    session = updated
                    Keychain.session = updated
                }
            }
            await play.sync()
            await downloads.recheck(api: api, currentAccount: { [weak self] in self?.verifiedAccountID })
        } catch APIFailure.unauthorized {
            await signOutLocally(notice: L10n.text("sessionExpired"))
        } catch {
            // Offline or server trouble: keep the saved account and its offline data.
        }
    }

    /// Phone number or e-mail, as on the website. Returns an error message, or nil on success.
    func login(identifier: String, password: String) async -> String? {
        let ident = identifier.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !ident.isEmpty, !password.isEmpty else { return L10n.text("loginMissing") }
        guard !busy else { return nil }
        busy = true
        defer { busy = false }
        struct Body: Encodable { let email: String; let password: String; let deviceName: String }
        do {
            api.use(token: nil, account: nil)
            let reply = try await api.post(LoginReply.self, "/api/v1/auth/login",
                                           body: Body(email: Self.normalizedIdentifier(ident), password: password, deviceName: "تطبيق مدرسة — iPhone"),
                                           requireSession: false)
            api.use(token: reply.token, account: nil)
            guard reply.role == "STUDENT" else {
                await revokeCurrentToken()
                api.use(token: nil, account: nil)
                return L10n.text("studentOnly")
            }
            let me = try await api.get(Me.self, "/api/v1/auth/me").value
            let saved = SavedSession(token: reply.token, expiresAt: reply.expiresAt, accountID: me.userId.lowercased(), role: me.role,
                                     name: me.fullName, email: me.email)
            Keychain.session = saved
            busy = false
            await activate(saved)
            selectedTab = .home
            Task { await validate() }
            return nil
        } catch let failure as APIFailure {
            api.use(token: nil, account: nil)
            if case .server(let code, let message, _, _) = failure {
                if code == "INVALID_CREDENTIALS" { return L10n.text("loginInvalid") }
                return message ?? L10n.text("error")
            }
            return failure == .unauthorized ? L10n.text("loginInvalid") : failure.message
        } catch {
            api.use(token: nil, account: nil)
            return L10n.text("error")
        }
    }

    /// Arabic-Indic digits and spaces in a phone number become plain digits.
    nonisolated static func normalizedIdentifier(_ value: String) -> String {
        guard !value.contains("@") else { return value }
        let mapped = value.unicodeScalars.map { scalar -> String in
            switch scalar.value {
            case 0x0660...0x0669: return String(scalar.value - 0x0660)
            case 0x06F0...0x06F9: return String(scalar.value - 0x06F0)
            default: return String(scalar)
            }
        }.joined()
        return mapped.filter { !$0.isWhitespace && $0 != "-" }
    }

    private func revokeCurrentToken() async {
        guard let request = api.request(path: "/api/v1/ios/logout", method: "POST", body: Data("{}".utf8)) else { return }
        _ = try? await api.send(request)
    }

    func logout() async {
        guard !busy, phase == .ready else { return }
        busy = true
        await revokeCurrentToken()
        busy = false
        await signOutLocally(notice: L10n.text("logoutSuccess"))
    }

    /// Permanently deletes the student's account (Apple 5.1.1(v)). Returns an error message or nil.
    func deleteAccount(password: String) async -> String? {
        guard !password.isEmpty else { return L10n.text("loginMissing") }
        guard !busy else { return nil }
        busy = true
        defer { busy = false }
        struct Body: Encodable { let password: String; let confirm: Bool }
        struct Reply: Decodable { let deleted: Bool }
        do {
            let reply = try await api.post(Reply.self, "/api/v1/ios/account/delete", body: Body(password: password, confirm: true))
            guard reply.deleted else { return L10n.text("error") }
            busy = false
            await signOutLocally(notice: L10n.text("accountDeleted"))
            return nil
        } catch let failure as APIFailure {
            if case .server(let code, _, _, _) = failure, code == "INVALID_CREDENTIALS" { return L10n.text("passwordWrong") }
            return failure.message
        } catch {
            return L10n.text("error")
        }
    }

    /// Removes every local trace of the account: token, cache, PDFs, PLAY, plan, reminders.
    func signOutLocally(notice message: String?) async {
        generation += 1
        let account = session?.accountID.lowercased()
        Keychain.session = nil
        api.use(token: nil, account: nil)
        session = nil
        studySession = nil
        snapshot = .empty
        phoneVerificationRequired = false
        notifications.removeAllPendingNotificationRequests()
        notifications.removeAllDeliveredNotifications()
        downloads.purgeAll()
        if let account {
            _ = try? await store.purgeAccount(accountID: account)
            await cache.purge(account: account)
            await play.purge(account: account)
        }
        selectedTab = .home
        phase = .signedOut
        notice = message
    }

    /// Any screen that receives `.unauthorized` calls this.
    func handle(_ failure: APIFailure) {
        if failure == .unauthorized, phase == .ready {
            Task { await signOutLocally(notice: L10n.text("sessionExpired")) }
        }
    }

    // MARK: Connectivity

    private func connectivityChanged(_ reachable: Bool) {
        let cameBack = reachable && !online
        online = reachable
        if cameBack, phase == .ready { Task { await play.sync() } }
    }

    func becameActive() {
        guard phase == .ready, online else { return }
        Task { await play.sync() }
    }

    // MARK: Content (cache first, then the server)

    func cached<T: Decodable>(_ type: T.Type, _ path: String) async -> (value: T, savedAt: Date)? {
        guard let account = session?.accountID else { return nil }
        #if DEBUG
        if Fixtures.enabled { return nil }
        #endif
        guard let entry = await cache.load(path: path, account: account),
              let envelope = try? JSONDecoder.api.decode(IOSAPI.Envelope<T>.self, from: entry.data),
              envelope.ok, let value = envelope.data else { return nil }
        return (value, entry.savedAt)
    }

    func fetch<T: Decodable>(_ type: T.Type, _ path: String) async throws -> T {
        let account = session?.accountID
        do {
            let (value, raw) = try await api.get(type, path)
            if let account, account == session?.accountID { await cache.store(raw, path: path, account: account) }
            return value
        } catch let failure as APIFailure {
            handle(failure)
            throw failure
        }
    }

    /// The viewing heartbeat of the website players: counts views and enforces one device.
    func heartbeat(contentID: UUID, position: Int, delta: Int) async -> HeartbeatResult {
        struct Body: Encodable { let contentId: String; let viewerKey: String; let position: Int; let delta: Int; let completed: Bool }
        do {
            _ = try await api.post(Empty.self, "/api/v1/media/heartbeat",
                                   body: Body(contentId: contentID.uuidString.lowercased(), viewerKey: Keychain.deviceKey,
                                              position: max(0, min(position, 24 * 3600)), delta: max(0, min(delta, 120)), completed: false))
            return .accepted
        } catch APIFailure.server(let code, let message, _, _) where code == "MEDIA_TOO_MANY_DEVICES" {
            return .blocked(message ?? L10n.text("deviceBlocked"))
        } catch {
            return .failed
        }
    }

    // MARK: Personal revision plan (unchanged rules from the previous app)

    private func isCurrent(_ session: StudySession, revision: Int) -> Bool {
        revision == generation && session == studySession && personalSpaceReady
    }

    private func reminderMinute(_ date: Date) -> Date? {
        Calendar.current.dateInterval(of: .minute, for: date)?.start
    }

    private func cancelReminders(_ identifiers: [String]) {
        notifications.removePendingNotificationRequests(withIdentifiers: identifiers)
        notifications.removeDeliveredNotifications(withIdentifiers: identifiers)
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
            _ = try await store.upsertTask(adjusted, session: session)
            guard isCurrent(session, revision: revision) else { return false }
            let state = try await store.snapshot(using: session)
            guard await synchronizeReminders(state: state, session: session, revision: revision) else { return false }
            snapshot = try await store.snapshot(using: session)
            return true
        } catch {
            if isCurrent(session, revision: revision) { notice = L10n.text("error") }
            return false
        }
    }

    @discardableResult
    func addPlan(_ tasks: [RevisionTask]) async -> Bool {
        guard let session = studySession, personalSpaceReady, !studyWriteBusy, !tasks.isEmpty else { return false }
        let revision = generation
        studyWriteBusy = true
        defer { studyWriteBusy = false }
        do {
            let now = Date()
            var planned = tasks.map { task -> RevisionTask in
                var copy = task
                if copy.reminderEnabled, (reminderMinute(copy.date) ?? .distantPast) <= now { copy.reminderEnabled = false }
                return copy
            }
            let wanted = planned.filter(\.reminderEnabled).count
            if wanted > 0 {
                let activeCount = snapshot.tasks.filter {
                    $0.reminderEnabled && !$0.completed && (reminderMinute($0.date) ?? .distantPast) > now
                }.count
                guard activeCount + wanted <= 50 else { notice = L10n.text("reminderLimitPlan"); return false }
                let accepted = try await notifications.requestAuthorization(options: [.alert, .sound])
                guard isCurrent(session, revision: revision) else { return false }
                if !accepted {
                    planned = planned.map { task in var copy = task; copy.reminderEnabled = false; return copy }
                    notice = L10n.text("reminderDenied")
                }
            }
            _ = try await store.addTasks(planned, session: session)
            guard isCurrent(session, revision: revision) else { return false }
            let state = try await store.snapshot(using: session)
            guard await synchronizeReminders(state: state, session: session, revision: revision) else { return false }
            snapshot = try await store.snapshot(using: session)
            return true
        } catch StudyStoreError.limitReached {
            if isCurrent(session, revision: revision) { notice = L10n.text("planLimit") }
            return false
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
            guard await synchronizeReminders(state: state, session: session, revision: revision) else { return }
            snapshot = try await store.snapshot(using: session)
            if let id = StudyReminders.identifier(accountID: session.accountID, taskID: task.id) { cancelReminders([id]) }
        } catch {
            if isCurrent(session, revision: revision) { notice = L10n.text("error") }
        }
    }

    /// Re-creates the account's reminders from its plan (serialised).
    private func synchronizeReminders(state: StudySnapshot, session: StudySession, revision: Int) async -> Bool {
        let previous = reminderTail
        let operation = Task { @MainActor [weak self] in
            if let previous { await previous.value }
            guard let self, revision == self.generation, session == self.studySession else { return }
            await self.applyReminders(state: state, session: session, revision: revision)
        }
        reminderTail = operation
        await operation.value
        return revision == generation && session == studySession
    }

    private func applyReminders(state: StudySnapshot, session: StudySession, revision: Int) async {
        func current() -> Bool { revision == generation && session == studySession }
        let pending = await notifications.pendingNotificationRequests()
        guard current() else { return }
        cancelReminders(pending.filter { $0.identifier.hasPrefix("madrasadz.revision.") }.map(\.identifier))
        let settings = await notifications.notificationSettings()
        guard current() else { return }
        let allowed = settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional
        var count = 0
        for task in state.tasks where task.reminderEnabled && !task.completed {
            guard current() else { return }
            guard allowed, count < 50, (reminderMinute(task.date) ?? .distantPast) > Date(),
                  let id = StudyReminders.identifier(accountID: session.accountID, taskID: task.id) else { continue }
            let content = UNMutableNotificationContent()
            content.title = "Madrasadz — مدرسة"
            content.body = L10n.text("reminderBody")
            content.sound = .default
            let components = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: task.date)
            let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
            guard let fire = trigger.nextTriggerDate(), fire > Date() else { continue }
            do {
                try await notifications.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
                count += 1
            } catch {
                continue
            }
        }
    }
}
