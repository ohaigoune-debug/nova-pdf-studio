import SwiftUI
import UIKit
import MadrasadzCore

/// Destinations pushed on the shell's one navigation stack. Its root is the
/// selected bottom-bar destination (`ShellTab`).
enum LearnRoute: Hashable {
    case course(String)
    /// Native lesson page (Build 9) when the server offers the lesson endpoint.
    case lesson(String)
    /// One free-lessons collection from the home screen (its `FreeEntry.id`).
    case collection(String)
    /// The personal space on this device, reached from «حسابي» (before the
    /// site shell these were tabs of their own).
    case saved, planner, downloads
    /// The one shared web view. At most once in the path, and always last.
    case web
}

/// Why a native screen has no content. Mapped from the server's status, code and
/// reason only; the server decides access, the app only chooses what to show.
enum NativeFailure: Equatable {
    case offline, signIn, phone, role, notFound, ended, server
}

enum NativeLoad<Value: Equatable>: Equatable {
    case idle, loading, loaded(Value), failed(NativeFailure)

    var value: Value? { if case .loaded(let value) = self { return value }; return nil }
    var failure: NativeFailure? { if case .failed(let failure) = self { return failure }; return nil }
}

/// Debug-only switches for UI tests. Release ignores them.
enum NativeDebug {
    private static func flag(_ name: String) -> Bool {
        #if DEBUG
        return ProcessInfo.processInfo.arguments.contains(name)
        #else
        return false
        #endif
    }
    /// Native screens with built-in sample data and no network (combine with the
    /// offline shell flag so the web view does not load either).
    static var fixture: Bool { flag("--madrasadz-native-fixture") }
    /// The web learning pages only, as in Build 7 (public WebKit tests).
    static var forceWeb: Bool { flag("--madrasadz-web-learning") }
}

/// Native learning home and course screens (plan phase 2). They read the iOS API
/// v1 with the website session and show nothing the /ios pages would not show.
/// Lessons, tools and every other page still open in the shared web view.
@MainActor
final class NativeLearningModel: ObservableObject {
    /// nil until the server has answered once (the answer is kept for later launches).
    @Published private(set) var available: Bool? = nil
    @Published var path: [LearnRoute] = [] {
        didSet {
            if oldValue.last == .web, path.last != .web {
                // After the stack update: closing the destination publishes browser state.
                Task { @MainActor [weak self] in self?.webDestinationClosed() }
            }
        }
    }
    /// The settled identity the screens may show data for; nil while it is checked.
    @Published private(set) var accountKey: String? = nil
    @Published private(set) var home: NativeLoad<NativeHome> = .idle
    @Published private(set) var courses: [String: NativeLoad<NativeCourse>] = [:]
    @Published private(set) var lessons: [String: NativeLoad<NativeLesson>] = [:]
    /// The server's lesson endpoint is usable: lessons open natively (else the web page).
    @Published private(set) var nativeLessons = false

    private weak var app: AppModel?
    /// The identity the cached content belongs to; a different one clears it.
    private var contentKey: String?
    private var revision = 0
    private var homeLoadedAt: Date?
    private var courseLoadedAt: [String: Date] = [:]
    private var lastCapabilityCheck: Date?
    /// The server gave a definite answer (capabilities or 404) in this session.
    private var capabilityAnswered = false
    private var capabilityRetries = 0
    private var capabilityTask: Task<Void, Never>?
    private var undecidedFallback: Task<Void, Never>?
    /// A course whose terms page is open in the web destination: that page must load.
    private var termsSlug: String?
    private static let storageKey = "madrasadz.nativeLearning.available.v1"
    private static let lessonKey = "madrasadz.nativeLearning.lesson.v1"
    private var lessonLoadedAt: [String: Date] = [:]

    init() {
        if NativeDebug.fixture { available = true; nativeLessons = true }
        else if NativeDebug.forceWeb || OfflineShellValidation.enabled { available = false }
        else {
            available = UserDefaults.standard.object(forKey: Self.storageKey) as? Bool
            nativeLessons = UserDefaults.standard.bool(forKey: Self.lessonKey)
        }
    }

    var rootIsNative: Bool { available == true }

    static var appBuild: Int {
        Int(Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "") ?? 0
    }

    func attach(_ app: AppModel) {
        self.app = app
        app.browser.nativeRouteHandler = { [weak self] route in self?.handleWebRoute(route) ?? false }
        identityDidChange()
    }

    private var browser: BrowserController? { app?.browser }

    private func record(_ event: String, _ fields: String) {
        // Codes and states only: never a slug, title, URL or account id.
        browser?.diagnostics.record(event, fields)
    }

    // MARK: Server capability

    /// Asks the server whether this build may use the native screens. Without an
    /// answer the previous one is kept; without any answer the web pages are used.
    func checkCapabilities(force: Bool = false) {
        guard !NativeDebug.fixture, !NativeDebug.forceWeb, !OfflineShellValidation.enabled else { return }
        // Until the server has answered once, ask again sooner.
        let interval: TimeInterval = capabilityAnswered ? 600 : 30
        if !force, let last = lastCapabilityCheck, Date().timeIntervalSince(last) < interval { return }
        lastCapabilityCheck = Date()
        capabilityTask?.cancel()
        capabilityTask = Task { @MainActor [weak self] in await self?.runCapabilityCheck() }
        if available == nil, undecidedFallback == nil {
            undecidedFallback = Task { @MainActor [weak self] in
                do { try await Task.sleep(nanoseconds: 8_000_000_000) } catch { return }
                guard let self, self.available == nil else { return }
                self.setAvailable(false, persist: false, reason: "timeout")
            }
        }
    }

    private func runCapabilityCheck() async {
        guard let app else { return }
        do {
            let (status, data) = try await app.nativeFetch(path: "/api/v1/ios/capabilities", checkAccount: false)
            guard !Task.isCancelled else { return }
            if status == 200, let caps = (try? JSONDecoder().decode(IOSAPI.Envelope<IOSAPI.Capabilities>.self, from: data))?.data {
                capabilityAnswered = true
                let lessonsOn = caps.supportsNativeLearning(appBuild: Self.appBuild) && caps.features.contains("lesson")
                UserDefaults.standard.set(lessonsOn, forKey: Self.lessonKey)
                if nativeLessons != lessonsOn { nativeLessons = lessonsOn }
                setAvailable(caps.supportsNativeLearning(appBuild: Self.appBuild), persist: true, reason: "server")
            } else if status == 404 {
                capabilityAnswered = true
                setAvailable(false, persist: true, reason: "no-api") // Server without the iOS API v1.
            } else {
                record("native.capabilities", "status=\(status)")
                if available == nil { setAvailable(false, persist: false, reason: "status-\(status)") }
                scheduleCapabilityRetry()
            }
        } catch {
            guard !Task.isCancelled else { return }
            record("native.capabilities", "error=\((error as NSError).domain)/\((error as NSError).code)")
            if available == nil { setAvailable(false, persist: false, reason: "offline") }
            scheduleCapabilityRetry()
        }
    }

    /// A failed first check (network blip at launch) is retried a few times, so
    /// one lost request does not keep the web pages for the whole session.
    private func scheduleCapabilityRetry() {
        guard !capabilityAnswered, capabilityRetries < 3 else { return }
        let delays: [UInt64] = [2, 5, 15]
        let delay = delays[capabilityRetries]
        capabilityRetries += 1
        Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: delay * 1_000_000_000)
            guard let self, !self.capabilityAnswered else { return }
            self.checkCapabilities(force: true)
        }
    }

    private func setAvailable(_ value: Bool, persist: Bool, reason: String) {
        if persist { UserDefaults.standard.set(value, forKey: Self.storageKey) }
        undecidedFallback?.cancel()
        undecidedFallback = nil
        let previous = available
        guard previous != value else { return }
        available = value
        record("native.root", "native=\(value) reason=\(reason) build=\(Self.appBuild)")
        path = []
        // Leaving native screens: the web root starts on the learning home.
        if !value, previous == true { browser?.open() }
    }

    func sceneBecameActive() {
        checkCapabilities()
        guard rootIsNative, accountKey != nil, let loaded = homeLoadedAt,
              Date().timeIntervalSince(loaded) > 300 else { return }
        Task { await loadHome() }
    }

    // MARK: Identity

    private static func key(for identity: AppModel.Identity, account: String?) -> String? {
        switch identity {
        case .checking: return nil
        case .ready: return account.map { "account:" + $0 }
        case .signedOut: return "guest"
        case .phoneRequired: return "phone"
        case .unsupportedRole: return "role"
        case .unavailable: return "unavailable"
        }
    }

    /// Called on every identity change. While the account is checked the screens
    /// hide their content; another account (or a sign-out) discards it.
    func identityDidChange() {
        guard let app else { return }
        let key = NativeDebug.fixture ? "fixture" : Self.key(for: app.identity, account: app.verifiedAccountID)
        guard key != accountKey else { return }
        accountKey = key
        guard let key, key != contentKey else { return }
        let first = contentKey == nil
        contentKey = key
        revision += 1
        home = .idle
        homeLoadedAt = nil
        courses = [:]
        courseLoadedAt = [:]
        lessons = [:]
        lessonLoadedAt = [:]
        record("native.identity", "changed first=\(first)")
        guard !first else { return }
        // Never keep another account's course screens on the stack.
        if path.last == .web {
            if let url = browser?.currentURL, let route = browser?.policy.nativeRoute(for: url), !bypassesNative(route) {
                show(route)
            } else {
                path = [.web]
            }
        } else {
            path = []
        }
    }

    // MARK: Navigation

    private var phoneRequired: Bool {
        if app?.identity == .phoneRequired { return true }
        return home.failure == .phone
    }

    /// The web /ios pages carry the phone check and a course's terms; those
    /// pages must load in the web view even though they have native screens.
    private func bypassesNative(_ route: NativeRoute) -> Bool {
        if phoneRequired { return true }
        if case .course(let slug) = route, slug == termsSlug { return true }
        return false
    }

    /// A web page (or the app) asked for the learning home or a course page.
    /// Returns true when the native screen takes it, so the web load is cancelled.
    func handleWebRoute(_ route: NativeRoute) -> Bool {
        guard rootIsNative, !bypassesNative(route) else { return false }
        if path.last == .web { show(route) }
        return true
    }

    func show(_ route: NativeRoute) {
        switch route {
        case .home:
            // The learning home is the «الرئيسية» destination of the bottom bar.
            if let app { app.selectTab(.home) } else { path = [] }
        case .course(let slug):
            if let index = path.firstIndex(of: .course(slug)) {
                path = Array(path[...index])
            } else {
                path = path.filter { $0 != .web } + [.course(slug)]
            }
        }
    }

    /// Open a website URL from a native control. Returns false when native
    /// learning is off, so the caller uses the web root instead.
    func open(url: URL) -> Bool {
        guard rootIsNative, let browser else { return false }
        if let route = browser.policy.nativeRoute(for: url), !bypassesNative(route) {
            show(route)
        } else if nativeLessons, !phoneRequired, let slug = Self.lessonSlug(in: url, policy: browser.policy) {
            // A bookmarked lesson page opens as the native lesson.
            path = path.filter { $0 != .web } + [.lesson(slug)]
        } else {
            openWeb(url)
        }
        return true
    }

    /// `/ios/lesson/{slug}` (decoded slug) for an allowed internal page, else nil.
    static func lessonSlug(in url: URL, policy: NavigationPolicy) -> String? {
        guard case .internalPage = policy.decision(for: url),
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              components.percentEncodedPath.hasPrefix("/ios/lesson/") else { return nil }
        let tail = String(components.percentEncodedPath.dropFirst("/ios/lesson/".count))
        guard !tail.isEmpty, !tail.contains("/"), let slug = tail.removingPercentEncoding,
              !slug.isEmpty, slug.count <= 200 else { return nil }
        return slug
    }

    func openWeb(path webPath: String) {
        guard let browser, let url = URL(string: webPath, relativeTo: browser.baseURL)?.absoluteURL else { return }
        openWeb(url)
    }

    func openWeb(_ url: URL) {
        guard let browser else { return }
        if path.last != .web { path.append(.web) }
        browser.openWebDestination(url)
    }

    /// A lesson from a native list: the native page when the server offers it.
    func openLesson(slug: String) {
        guard nativeLessons, rootIsNative else { return openWebLesson(slug: slug) }
        path = path.filter { $0 != .web } + [.lesson(slug)]
    }

    /// The protected web page of a lesson (PDF viewer, private video, comments).
    func openWebLesson(slug: String) {
        openWeb(path: "/ios/lesson/" + Self.encoded(slug))
    }

    /// The course's terms are accepted on its web page (the existing TermsGate).
    func openTerms(slug: String) {
        termsSlug = slug
        openWeb(path: "/ios/course/" + Self.encoded(slug))
    }

    func closeWeb() {
        if path.last == .web { path.removeLast() }
    }

    private func webDestinationClosed() {
        guard path.last != .web else { return }
        termsSlug = nil
        browser?.endWebDestination()
        // Signing in, verifying the phone or accepting terms happens on the web.
        if home.failure != nil || phoneRequired {
            Task { await refreshAfterWeb() }
        }
        for (slug, state) in courses where state.value?.needsTerms == true || state.failure != nil {
            Task { await loadCourse(slug) }
        }
        for (slug, state) in lessons where state.failure != nil {
            Task { await loadLesson(slug) }
        }
    }

    private func refreshAfterWeb() async {
        guard let app else { return }
        await app.refreshIdentity()
        await loadHome()
    }

    static func encoded(_ slug: String) -> String {
        var allowed = CharacterSet.urlPathAllowed
        allowed.remove(charactersIn: "/?#")
        return slug.addingPercentEncoding(withAllowedCharacters: allowed) ?? slug
    }

    // MARK: Loading

    private enum Fetched<Value> {
        case value(Value)
        case failure(NativeFailure)
        /// The account changed or is being checked again: try once it settles.
        case superseded
    }

    private func fetch<Value: Decodable>(_ type: Value.Type, path apiPath: String) async -> Fetched<Value> {
        #if DEBUG
        if NativeDebug.fixture {
            if let value = NativeFixtures.fetch(Value.self, path: apiPath) { return .value(value) }
            return .failure(.notFound)
        }
        #endif
        guard let app else { return .superseded }
        do {
            let (status, data) = try await app.nativeFetch(path: apiPath)
            let envelope = try? JSONDecoder().decode(IOSAPI.Envelope<Value>.self, from: data)
            if status == 200, envelope?.ok == true, let value = envelope?.data { return .value(value) }
            let code = envelope?.error?.code
            let reason = envelope?.error?.reason
            record("native.fetch", "status=\(status) code=\(code ?? "-") reason=\(reason ?? "-")")
            if status == 401 || code == "AUTH_REQUIRED" { return .failure(.signIn) }
            if reason == "PHONE_VERIFICATION_REQUIRED" { return .failure(.phone) }
            if reason == "ROLE" { return .failure(.role) }
            if code == "COURSE_NOT_ENROLLED" { return .failure(.ended) }
            if status == 404 { return .failure(.notFound) }
            return .failure(.server)
        } catch AppModel.NativeFetchError.cancelled {
            return .superseded
        } catch AppModel.NativeFetchError.accountMismatch {
            record("native.fetch", "account-mismatch")
            return .superseded
        } catch {
            record("native.fetch", "error=\((error as NSError).domain)/\((error as NSError).code)")
            return .failure(.offline)
        }
    }

    /// Runs one load for the current identity, retrying a little while the
    /// account is re-checked. nil means the result belongs to an old identity.
    private func settledFetch<Value: Decodable & Equatable>(_ type: Value.Type, path apiPath: String) async -> NativeLoad<Value>? {
        let token = revision
        for attempt in 0..<4 {
            if attempt > 0 {
                // Let the identity re-check start, then wait for it to finish (bounded).
                try? await Task.sleep(nanoseconds: 400_000_000)
                for _ in 0..<25 where accountKey == nil {
                    try? await Task.sleep(nanoseconds: 200_000_000)
                }
            }
            guard token == revision, accountKey != nil else {
                if token != revision { return nil }
                continue
            }
            switch await fetch(Value.self, path: apiPath) {
            case .value(let value): return token == revision ? .loaded(value) : nil
            case .failure(let failure): return token == revision ? .failed(failure) : nil
            case .superseded: continue
            }
        }
        return token == revision ? .failed(.offline) : nil
    }

    func loadHomeIfNeeded() async {
        guard accountKey != nil, home == .idle else { return }
        await loadHome()
    }

    func loadHome() async {
        guard accountKey != nil else { return }
        if home.value == nil { home = .loading }
        guard let result = await settledFetch(NativeHome.self, path: "/api/v1/ios/home") else { return }
        // A failed refresh keeps the content already shown (offline after a load).
        if result.failure == .offline, home.value != nil { return }
        home = result
        if result.value != nil { homeLoadedAt = Date() }
        record("native.home", result.value != nil ? "loaded courses=\(result.value?.courses.count ?? 0)" : "failed=\(result.failure.map { "\($0)" } ?? "-")")
    }

    func lesson(_ slug: String) -> NativeLoad<NativeLesson> { lessons[slug] ?? .idle }

    func loadLessonIfNeeded(_ slug: String) async {
        guard accountKey != nil else { return }
        if lesson(slug) == .idle { await loadLesson(slug); return }
        if let loaded = lessonLoadedAt[slug], Date().timeIntervalSince(loaded) > 300 { await loadLesson(slug) }
    }

    func loadLesson(_ slug: String) async {
        guard accountKey != nil else { return }
        if lesson(slug).value == nil { lessons[slug] = .loading }
        guard let result = await settledFetch(NativeLesson.self, path: "/api/v1/ios/lessons/" + Self.encoded(slug)) else { return }
        if result.failure == .offline, lesson(slug).value != nil { return }
        lessons[slug] = result
        if result.value != nil { lessonLoadedAt[slug] = Date() }
        record("native.lesson", result.value != nil ? "loaded" : "failed=\(result.failure.map { "\($0)" } ?? "-")")
    }

    /// One viewing heartbeat for a natively played video (views report and the
    /// one-device limit, as on the web). nil when it could not be sent.
    func heartbeat(contentID: UUID, position: Int, delta: Int) async -> AppModel.HeartbeatResult? {
        #if DEBUG
        if NativeDebug.fixture { return .accepted }
        #endif
        guard let app, app.personalSpaceReady else { return nil }
        return await app.mediaHeartbeat(contentID: contentID, viewerKey: NativeDeviceKey.value, position: position, delta: delta)
    }

    func course(_ slug: String) -> NativeLoad<NativeCourse> { courses[slug] ?? .idle }

    func loadCourseIfNeeded(_ slug: String) async {
        guard accountKey != nil else { return }
        if course(slug) == .idle { await loadCourse(slug); return }
        if let loaded = courseLoadedAt[slug], Date().timeIntervalSince(loaded) > 300 { await loadCourse(slug) }
    }

    func loadCourse(_ slug: String) async {
        guard accountKey != nil else { return }
        if course(slug).value == nil { courses[slug] = .loading }
        guard let result = await settledFetch(NativeCourse.self, path: "/api/v1/ios/courses/" + Self.encoded(slug)) else { return }
        if result.failure == .offline, course(slug).value != nil { return }
        courses[slug] = result
        if result.value != nil { courseLoadedAt[slug] = Date() }
        record("native.course", result.value != nil ? "loaded items=\(result.value?.itemCount ?? 0) terms=\(result.value?.needsTerms ?? false)" : "failed=\(result.failure.map { "\($0)" } ?? "-")")
    }

    /// Pull to refresh / Retry: re-check the account first when it is not settled.
    func retryHome() async {
        if let app, home.failure == .offline || accountKey == "unavailable" { await app.refreshIdentity() }
        await loadHome()
    }
}

/// Reports the scene's screen-capture state (recording, mirroring) for native
/// screens, where no web container is on screen to observe it.
@MainActor
final class SceneCaptureState: ObservableObject {
    @Published fileprivate(set) var captured = false
}

struct SceneCaptureProbe: UIViewRepresentable {
    let state: SceneCaptureState

    func makeUIView(context: Context) -> ProbeView { ProbeView(state: state) }
    func updateUIView(_ uiView: ProbeView, context: Context) {}

    final class ProbeView: UIView {
        private let state: SceneCaptureState

        init(state: SceneCaptureState) {
            self.state = state
            super.init(frame: .zero)
            isUserInteractionEnabled = false
            isAccessibilityElement = false
            registerForTraitChanges([UITraitSceneCaptureState.self]) { (view: ProbeView, _: UITraitCollection) in
                view.publish()
            }
        }

        required init?(coder: NSCoder) { fatalError("Use init(state:)") }

        override func didMoveToWindow() {
            super.didMoveToWindow()
            publish()
        }

        private func publish() {
            let captured = window != nil && traitCollection.sceneCaptureState == .active
            guard captured != state.captured else { return }
            // Trait callbacks can arrive inside a SwiftUI update.
            Task { @MainActor [state] in state.captured = captured }
        }
    }
}

/// This install's viewing-device key for native players (the web view keeps its
/// own in localStorage). Random, no personal data; sent only with heartbeats.
enum NativeDeviceKey {
    private static let storageKey = "madrasadz.deviceKey.v1"

    static var value: String {
        let defaults = UserDefaults.standard
        if let stored = defaults.string(forKey: storageKey), stored.count == 24, stored.allSatisfy({ $0.isHexDigit }) {
            return stored
        }
        let fresh = String(UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased().prefix(24))
        defaults.set(fresh, forKey: storageKey)
        return fresh
    }
}
