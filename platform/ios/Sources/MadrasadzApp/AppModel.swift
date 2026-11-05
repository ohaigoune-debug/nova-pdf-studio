import SwiftUI
import UIKit
import AuthenticationServices
import CryptoKit
import Network
import UserNotifications
import MadrasadzCore

enum AppTab: Hashable { case home, play, planner, account }

/// A refusal shown as is (SMS code request, phone confirmation).
struct PhoneError: Error, Equatable {
    let message: String
    init(_ message: String) { self.message = message }
}

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
        /// false: an account made with Google or Apple; deleting it asks for the word «حذف».
        let hasPassword: Bool?
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
    /// false for an account made with Google or Apple (no password to type).
    @Published private(set) var hasPassword = true
    /// The sign-in buttons the server has turned on.
    @Published private(set) var signInOptions = SocialSignIn.Options.none
    /// A Google or Apple account that is new to Madrasa: its details are completed in a sheet.
    @Published var pendingSocialSignup: SocialSignIn.PendingSignup?
    @Published private(set) var online = true
    @Published private(set) var busy = false
    @Published private(set) var snapshot = StudySnapshot.empty
    @Published var selectedTab: AppTab = .home
    @Published var notice: String?
    /// «حسابي» navigation (orders, support, one ticket), opened by platform notifications too.
    @Published var accountPath: [AccountRoute] = []
    /// Support tickets waiting for the student's answer (badge on «حسابي»).
    @Published var supportWaiting = 0
    /// Classmates whose classroom comments this student hid on this phone (Build 16).
    @Published private(set) var hiddenClassmateKeys: Set<String> = []
    /// A classroom notification was tapped: the classroom opens over the tabs.
    @Published var classroomOpen = false
    /// The course group of that notification (nil: the general classroom).
    @Published var classroomGroup: String?

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
    /// The APNs device token of this iPhone, and the account it was last sent for.
    private var pushToken: String?
    private var pushSentFor: String?
    private var pendingLink: String??

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
                if Fixtures.needsPhone { Task { await validate() } }
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
        hiddenClassmateKeys = Set(UserDefaults.standard.stringArray(forKey: Self.hiddenKey(saved.accountID)) ?? [])
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
        if let link = pendingLink {
            pendingLink = nil
            openNotification(link: link)
        }
        Task { await enablePlatformPush(ask: false) }
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
            hasPassword = info.hasPassword ?? true
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
            await refreshSupportBadge()
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
            return try await completeSignIn(reply)
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

    /// The token of a fresh login or a new account opens the app: the server says who it
    /// belongs to, the session is kept in the Keychain and the personal space opens.
    private func completeSignIn(_ reply: LoginReply) async throws -> String? {
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
    }

    /// Set by a new account: Home opens the phone confirmation once, by itself.
    private var phonePromptPending = false

    func takePhonePrompt() -> Bool {
        defer { phonePromptPending = false }
        return phonePromptPending
    }

    struct SignupFailure: Equatable {
        let field: Signup.Field?
        let message: String
    }

    /// Creates a student account inside the app, then signs in with it. nil on success.
    func register(_ form: Signup.Form, levels: [Signup.Level]) async -> SignupFailure? {
        if let field = form.firstInvalidField(levels: levels) {
            return SignupFailure(field: field, message: L10n.text("signupField.\(field.rawValue)"))
        }
        guard !busy else { return nil }
        busy = true
        defer { busy = false }
        do {
            api.use(token: nil, account: nil)
            let reply = try await api.post(LoginReply.self, "/api/v1/ios/register", body: form.payload(levels: levels), requireSession: false)
            phonePromptPending = true
            if let message = try await completeSignIn(reply) {
                phonePromptPending = false
                return SignupFailure(field: nil, message: message)
            }
            return nil
        } catch let failure as APIFailure {
            api.use(token: nil, account: nil)
            if case .server(let code, let message, _, _) = failure {
                if code == "EMAIL_TAKEN" { return SignupFailure(field: .email, message: L10n.text("signupEmailTaken")) }
                if code == "WEAK_PASSWORD" { return SignupFailure(field: .password, message: message ?? L10n.text("signupField.password")) }
                if code == "RATE_LIMITED" { return SignupFailure(field: nil, message: L10n.text("signupLater")) }
                return SignupFailure(field: nil, message: message ?? L10n.text("error"))
            }
            return SignupFailure(field: nil, message: failure.message)
        } catch {
            api.use(token: nil, account: nil)
            return SignupFailure(field: nil, message: L10n.text("error"))
        }
    }

    // MARK: Google and Apple (owner, 5 Nov 2026)

    /// Which of the two buttons to show. Offline or an older server: none.
    func loadSignInOptions() async {
        do {
            let caps = try await api.get(SocialSignIn.Capabilities.self, "/api/v1/ios/capabilities", requireSession: false).value
            signInOptions = caps.signIn ?? .none
        } catch {
            signInOptions = .none
        }
    }

    /// A fresh random value for one Apple request; Apple receives its SHA-256, the server the value itself.
    nonisolated static func newNonce() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return Data(bytes).base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }

    nonisolated static func sha256(_ value: String) -> String {
        SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    /// After the native Apple button. Returns an error message, or nil (signed in, or a new account to complete).
    func signInWithApple(_ credential: ASAuthorizationAppleIDCredential, rawNonce: String) async -> String? {
        guard let tokenData = credential.identityToken, let identityToken = String(data: tokenData, encoding: .utf8) else { return L10n.text("socialFailed") }
        guard !busy else { return nil }
        busy = true
        defer { busy = false }
        struct Body: Encodable { let identityToken: String; let authorizationCode: String?; let nonce: String; let fullName: String? }
        let code = credential.authorizationCode.flatMap { String(data: $0, encoding: .utf8) }
        // Apple gives the name to the app on the first sign-in only.
        let name = credential.fullName.map { PersonNameComponentsFormatter.localizedString(from: $0, style: .default) }?.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            api.use(token: nil, account: nil)
            let reply = try await api.post(SocialSignIn.Reply.self, "/api/v1/ios/auth/apple",
                                           body: Body(identityToken: identityToken, authorizationCode: code, nonce: rawNonce, fullName: name?.isEmpty == false ? name : nil),
                                           requireSession: false)
            return try await finishSocial(reply)
        } catch {
            api.use(token: nil, account: nil)
            return socialMessage(error)
        }
    }

    /// After the Google sheet came back to `madrasadz-auth://oauth?…`.
    func finishGoogle(callback url: URL) async -> String? {
        guard let callback = SocialSignIn.parse(callback: url) else { return L10n.text("socialFailed") }
        switch callback {
        case .failure(let code):
            return socialMessage(code: code)
        case .signup(let pending):
            pendingSocialSignup = pending
            return nil
        case .ticket(let ticket):
            guard !busy else { return nil }
            busy = true
            defer { busy = false }
            struct Body: Encodable { let ticket: String }
            do {
                api.use(token: nil, account: nil)
                let reply = try await api.post(SocialSignIn.Reply.self, "/api/v1/ios/auth/ticket", body: Body(ticket: ticket), requireSession: false)
                return try await finishSocial(reply)
            } catch {
                api.use(token: nil, account: nil)
                return socialMessage(error)
            }
        }
    }

    /// The details of a new Google or Apple account, then the session; the phone code follows as after sign-up.
    func completeSocialSignup(_ form: Signup.Form, levels: [Signup.Level], pending: SocialSignIn.PendingSignup) async -> SignupFailure? {
        if let field = form.firstInvalidProfileField(levels: levels) {
            return SignupFailure(field: field, message: L10n.text("signupField.\(field.rawValue)"))
        }
        guard !busy else { return nil }
        busy = true
        defer { busy = false }
        do {
            api.use(token: nil, account: nil)
            let reply = try await api.post(SocialSignIn.Reply.self, "/api/v1/ios/auth/complete", body: form.profilePayload(levels: levels, signupToken: pending.token), requireSession: false)
            guard let token = reply.token, let role = reply.role else { return SignupFailure(field: nil, message: L10n.text("error")) }
            phonePromptPending = true
            if let message = try await completeSignIn(LoginReply(token: token, expiresAt: reply.expiresAt, role: role)) {
                phonePromptPending = false
                return SignupFailure(field: nil, message: message)
            }
            pendingSocialSignup = nil
            return nil
        } catch let failure as APIFailure {
            api.use(token: nil, account: nil)
            if case .server(let code, let message, _, _) = failure {
                if code == "OAUTH_TICKET_EXPIRED" {
                    pendingSocialSignup = nil
                    return SignupFailure(field: nil, message: L10n.text("socialExpired"))
                }
                if code == "EMAIL_TAKEN" { return SignupFailure(field: nil, message: L10n.text("socialEmailTaken")) }
                if code == "RATE_LIMITED" { return SignupFailure(field: nil, message: L10n.text("signupLater")) }
                return SignupFailure(field: nil, message: message ?? L10n.text("error"))
            }
            return SignupFailure(field: nil, message: failure.message)
        } catch {
            api.use(token: nil, account: nil)
            return SignupFailure(field: nil, message: L10n.text("error"))
        }
    }

    private func finishSocial(_ reply: SocialSignIn.Reply) async throws -> String? {
        if let pending = reply.pending {
            pendingSocialSignup = pending
            return nil
        }
        guard let token = reply.token, let role = reply.role else { return L10n.text("socialFailed") }
        busy = false
        return try await completeSignIn(LoginReply(token: token, expiresAt: reply.expiresAt, role: role))
    }

    private func socialMessage(_ error: Error) -> String {
        if let failure = error as? APIFailure {
            if case .server(let code, let message, _, _) = failure { return socialMessage(code: code, fallback: message) }
            return failure.message
        }
        return L10n.text("error")
    }

    private func socialMessage(code: String, fallback: String? = nil) -> String {
        switch code {
        case "OAUTH_PASSWORD_ONLY": return L10n.text("socialPasswordOnly")
        case "ACCOUNT_DISABLED": return L10n.text("socialDisabled")
        case "OAUTH_NOT_CONFIGURED": return L10n.text("socialUnavailable")
        case "OAUTH_TICKET_EXPIRED": return L10n.text("socialExpired")
        case "RATE_LIMITED": return L10n.text("signupLater")
        default: return fallback ?? L10n.text("socialFailed")
        }
    }

    // MARK: Phone confirmation (as on the website: an SMS code, or a call to the platform's number)

    struct PhoneStatus: Decodable, Equatable {
        let required: Bool
        let phone: String?
        let sms: Bool
        let callNumber: String?
    }

    func phoneStatus() async throws -> PhoneStatus {
        do {
            return try await api.get(PhoneStatus.self, "/api/v1/ios/phone").value
        } catch let failure as APIFailure {
            handle(failure)
            throw failure
        }
    }

    /// Sends a code by SMS. Returns the seconds to wait before another code, or an error message.
    func requestPhoneCode(phone: String) async -> Result<Int, PhoneError> {
        guard let normalized = Signup.normalizedPhone(phone) else { return .failure(PhoneError(L10n.text("signupField.phone"))) }
        struct Body: Encodable { let phone: String }
        struct Reply: Decodable { let cooldown: Int }
        do {
            let reply = try await api.post(Reply.self, "/api/v1/ios/phone/request", body: Body(phone: normalized))
            return .success(reply.cooldown)
        } catch let failure as APIFailure {
            handle(failure)
            return .failure(PhoneError(failure.message))
        } catch {
            return .failure(PhoneError(L10n.text("error")))
        }
    }

    /// Checks the code; on success the phone gate opens at once. nil on success.
    func verifyPhone(phone: String, code: String) async -> String? {
        guard let normalized = Signup.normalizedPhone(phone) else { return L10n.text("signupField.phone") }
        let digits = Self.normalizedIdentifier(code)
        guard (4...8).contains(digits.count) else { return L10n.text("phoneCodeInvalid") }
        struct Body: Encodable { let phone: String; let code: String }
        struct Reply: Decodable { let verified: Bool }
        do {
            let reply = try await api.post(Reply.self, "/api/v1/ios/phone/verify", body: Body(phone: normalized, code: digits))
            guard reply.verified else { return L10n.text("phoneCodeInvalid") }
            phoneVerificationRequired = false
            Task { await validate() }
            return nil
        } catch let failure as APIFailure {
            handle(failure)
            return failure.message
        } catch {
            return L10n.text("error")
        }
    }

    /// After a call to the platform's number: asks the server whether the phone is now confirmed.
    func refreshPhoneGate() async -> Bool {
        guard let status = try? await phoneStatus() else { return !phoneVerificationRequired }
        phoneVerificationRequired = status.required
        return !status.required
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
        // This iPhone stops receiving the account's notifications before the session ends.
        await forgetPushToken()
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
            if case .server(let code, _, _, _) = failure, code == "INVALID_CREDENTIALS" { return L10n.text(hasPassword ? "passwordWrong" : "deleteWordWrong") }
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
        hasPassword = true
        pendingSocialSignup = nil
        accountPath = []
        supportWaiting = 0
        hiddenClassmateKeys = []
        classroomOpen = false
        pushSentFor = nil
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

    /// The suggested week of the planner: replaces the earlier suggested week still to come
    /// (done sessions and the student's own tasks stay), then adds the new one.
    @discardableResult
    func addWeeklyTimetable(_ tasks: [RevisionTask]) async -> Bool {
        guard let session = studySession, personalSpaceReady, !studyWriteBusy, !tasks.isEmpty else { return false }
        let revision = generation
        let now = Date()
        let old = snapshot.tasks.filter { ($0.planID ?? "").hasPrefix("weekly-") && !$0.completed && $0.date > now }
        if !old.isEmpty {
            studyWriteBusy = true
            do {
                for task in old { try await store.removeTask(id: task.id, session: session) }
                guard isCurrent(session, revision: revision) else { studyWriteBusy = false; return false }
                snapshot = try await store.snapshot(using: session)
            } catch {
                studyWriteBusy = false
                if isCurrent(session, revision: revision) { notice = L10n.text("error") }
                return false
            }
            studyWriteBusy = false
        }
        return await addPlan(tasks)
    }

    /// Re-creates the reminders after a reminder setting changed (the morning summary).
    func refreshReminders() async {
        guard let session = studySession, personalSpaceReady else { return }
        if UserDefaults.standard.object(forKey: "dailySummary") as? Bool ?? true {
            _ = try? await notifications.requestAuthorization(options: [.alert, .sound])
        }
        _ = await synchronizeReminders(state: snapshot, session: session, revision: generation)
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
            // Sessions of the suggested week ring ten minutes before they start.
            let early = (task.planID ?? "").hasPrefix("weekly-")
            let ring = early ? task.date.addingTimeInterval(-600) : task.date
            guard allowed, count < 50, (reminderMinute(ring) ?? .distantPast) > Date(),
                  let id = StudyReminders.identifier(accountID: session.accountID, taskID: task.id) else { continue }
            let content = UNMutableNotificationContent()
            content.title = "Madrasadz — مدرسة"
            content.body = L10n.text(early ? "reminderSoon" : "reminderBody")
            content.sound = .default
            let components = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: ring)
            let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
            guard let fire = trigger.nextTriggerDate(), fire > Date() else { continue }
            do {
                try await notifications.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
                count += 1
            } catch {
                continue
            }
        }
        // The morning summary (07:00) of each of the next seven days that has sessions.
        guard allowed, UserDefaults.standard.object(forKey: "dailySummary") as? Bool ?? true else { return }
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        for offset in 0..<7 {
            guard current(), let day = calendar.date(byAdding: .day, value: offset, to: today),
                  let morning = calendar.date(bySettingHour: 7, minute: 0, second: 0, of: day), morning > Date() else { continue }
            let sessions = state.tasks.filter { !$0.completed && calendar.isDate($0.date, inSameDayAs: day) && $0.date > morning }.count
            guard sessions > 0 else { continue }
            let content = UNMutableNotificationContent()
            content.title = "Madrasadz — مدرسة"
            content.body = String(format: L10n.text("dailySummaryBody"), sessions)
            content.sound = .default
            let parts = calendar.dateComponents([.year, .month, .day], from: day)
            let key = String(format: "%04d%02d%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
            let trigger = UNCalendarNotificationTrigger(dateMatching: calendar.dateComponents([.year, .month, .day, .hour, .minute], from: morning), repeats: false)
            try? await notifications.add(UNNotificationRequest(identifier: "madrasadz.revision.daily.\(key)", content: content, trigger: trigger))
        }
    }
}

// MARK: - Orders, support and platform notifications (Build 15)

extension AppModel {
    /// Opens a support ticket; returns its id. Asks once for notifications so the reply reaches the student.
    func openTicket(_ draft: Support.NewTicket) async -> Result<String, PhoneError> {
        struct Reply: Decodable { let id: String; let number: Int }
        do {
            let reply = try await api.post(Reply.self, "/api/v1/ios/support", body: draft)
            Task { await enablePlatformPush(ask: true) }
            return .success(reply.id)
        } catch let failure as APIFailure {
            handle(failure)
            return .failure(PhoneError(failure.message))
        } catch {
            return .failure(PhoneError(L10n.text("error")))
        }
    }

    /// Returns an error message, or nil once the reply is saved.
    func replyTicket(id: String, body: String) async -> String? {
        struct Body: Encodable { let body: String }
        struct Reply: Decodable { let id: String }
        do {
            _ = try await api.post(Reply.self, "/api/v1/ios/support/\(id)/reply", body: Body(body: body.trimmingCharacters(in: .whitespacesAndNewlines)))
            return nil
        } catch let failure as APIFailure {
            handle(failure)
            return failure.message
        } catch {
            return L10n.text("error")
        }
    }

    func closeTicket(id: String) async -> String? {
        struct Reply: Decodable { let closed: Bool }
        do {
            _ = try await api.post(Reply.self, "/api/v1/ios/support/\(id)/close", body: Empty())
            await refreshSupportBadge()
            return nil
        } catch let failure as APIFailure {
            handle(failure)
            return failure.message
        } catch {
            return L10n.text("error")
        }
    }

    func refreshSupportBadge() async {
        guard phase == .ready, let list = try? await api.get(Support.List.self, "/api/v1/ios/support").value else { return }
        supportWaiting = list.waiting
    }

    /// A tapped platform notification: its website link opens the matching screen.
    func openNotification(link: String?) {
        guard phase == .ready else {
            pendingLink = .some(link)
            return
        }
        switch NotificationLink(link: link) {
        case .ticket(let id):
            selectedTab = .account
            accountPath = [.support, .ticket(id)]
        case .orders:
            selectedTab = .account
            accountPath = [.orders]
        case .classroom(let group):
            classroomGroup = group
            classroomOpen = true
        case .home:
            break
        }
    }

    /// Registers this iPhone with Apple once notifications are allowed (asked only after a ticket is sent).
    func enablePlatformPush(ask: Bool) async {
        guard phase == .ready else { return }
        #if DEBUG
        if Fixtures.enabled { return }
        #endif
        let settings = await notifications.notificationSettings()
        var allowed = ([.authorized, .provisional, .ephemeral] as [UNAuthorizationStatus]).contains(settings.authorizationStatus)
        if !allowed, ask, settings.authorizationStatus == .notDetermined {
            allowed = (try? await notifications.requestAuthorization(options: [.alert, .sound])) ?? false
        }
        if allowed { UIApplication.shared.registerForRemoteNotifications() }
    }

    func pushTokenArrived(_ data: Data) {
        pushToken = data.map { String(format: "%02x", $0) }.joined()
        Task { await sendPushToken() }
    }

    private func sendPushToken() async {
        guard phase == .ready, let token = pushToken, let account = session?.accountID else { return }
        let key = "\(account.lowercased()):\(token)"
        guard pushSentFor != key else { return }
        struct Body: Encodable { let token: String; let environment: String }
        struct Reply: Decodable { let registered: Bool }
        #if DEBUG
        let environment = "sandbox"
        #else
        let environment = "production"
        #endif
        if (try? await api.post(Reply.self, "/api/v1/ios/push", body: Body(token: token, environment: environment))) != nil, session?.accountID == account {
            pushSentFor = key
        }
    }

    private func forgetPushToken() async {
        guard let token = pushToken, let body = try? JSONEncoder.api.encode(["token": token]),
              let request = api.request(path: "/api/v1/ios/push", method: "DELETE", body: body) else { return }
        _ = try? await api.send(request)
    }
}

// MARK: - Virtual classroom (Build 16)

extension AppModel {
    static func hiddenKey(_ account: String) -> String { "classroom.hidden.\(account.lowercased())" }

    var hiddenClassmates: Int { hiddenClassmateKeys.count }

    /// Hides a classmate's comments on this phone (their key is meaningful for this account only).
    func hideClassmate(_ key: String) {
        guard let account = session?.accountID else { return }
        hiddenClassmateKeys.insert(key)
        UserDefaults.standard.set(Array(hiddenClassmateKeys), forKey: Self.hiddenKey(account))
    }

    func showHiddenClassmates() {
        guard let account = session?.accountID else { return }
        hiddenClassmateKeys = []
        UserDefaults.standard.removeObject(forKey: Self.hiddenKey(account))
    }

    /// Returns an error message, or nil once the comment is saved.
    func addClassComment(postId: String, body: String) async -> String? {
        struct Body: Encodable { let body: String }
        struct Reply: Decodable { let id: String }
        return await classroomCall { _ = try await self.api.post(Reply.self, "/api/v1/ios/classroom/posts/\(postId)/comments", body: Body(body: body.trimmingCharacters(in: .whitespacesAndNewlines))) }
    }

    func deleteClassComment(id: String) async -> String? {
        struct Reply: Decodable { let deleted: Bool }
        return await classroomCall { _ = try await self.api.post(Reply.self, "/api/v1/ios/classroom/comments/\(id)/delete", body: Empty()) }
    }

    func reportClassComment(id: String, reason: String) async -> String? {
        struct Body: Encodable { let reason: String? }
        struct Reply: Decodable { let reported: Bool }
        let text = reason.trimmingCharacters(in: .whitespacesAndNewlines)
        return await classroomCall { _ = try await self.api.post(Reply.self, "/api/v1/ios/classroom/comments/\(id)/report", body: Body(reason: text.isEmpty ? nil : text)) }
    }

    private func classroomCall(_ run: () async throws -> Void) async -> String? {
        do {
            try await run()
            return nil
        } catch let failure as APIFailure {
            handle(failure)
            return failure.message
        } catch {
            return L10n.text("error")
        }
    }
}
