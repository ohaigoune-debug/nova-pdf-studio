import SwiftUI
import UIKit
import WebKit
import SafariServices
import MadrasadzCore

/// Debug-only, signed-out native-shell validation without any backend requests.
/// This never authenticates an account, reads stored study data, or changes Release behavior.
enum OfflineShellValidation {
    static var enabled: Bool {
        #if DEBUG
        return ProcessInfo.processInfo.arguments.contains("--madrasadz-offline-shell-validation")
        #else
        return false
        #endif
    }
}

@MainActor
final class BrowserController: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate, WKHTTPCookieStoreObserver {
    @Published private(set) var webView: MadrasadzWebView
    let policy: NavigationPolicy
    let baseURL: URL
    let diagnostics = ForegroundDiagnostics()
    @Published var loading = false
    @Published var failure = false
    /// Native placeholder while a foreground recovery step runs, instead of an
    /// empty web view (black in dark mode) between the native bars.
    @Published private(set) var restoring = false
    @Published var canGoBack = false
    @Published var canGoForward = false
    @Published var currentURL: URL?
    @Published var currentTitle = ""
    @Published var externalURL: URL?
    @Published var notice: String?
    @Published private(set) var mediaProtection = MediaProtectionState()
    private(set) var sceneIsActive = false
    private weak var mediaProtectionContainer: MediaProtectionWebContainer?
    private var mediaProtectionRevision = 0
    #if DEBUG
    private(set) var captureValidationActive = OfflineShellValidation.enabled
        && ProcessInfo.processInfo.arguments.contains("--madrasadz-capture-shield-validation")
    #else
    let captureValidationActive = false
    #endif
    var onPageFinished: (() -> Void)?
    var onAuthenticationPage: (() -> Void)?
    var onDownloadRequested: ((UUID) -> Void)?
    var onCookiesChanged: (() -> Void)?
    private var wasBackgrounded = false
    private var backgroundedAt: Date?
    private var processRecoveryAttempted = false
    private var contentProcessTerminated = false
    private var navigationTimeout: Task<Void, Never>?
    private var navigationRevision = 0
    private var activeNavigation: WKNavigation?
    private var observations: [NSKeyValueObservation] = []
    private var webViewGeneration = 0
    private var pendingLoad: URL?
    private var pendingLoadFallback: Task<Void, Never>?
    private var recoveryPlanner = ForegroundRecoveryPlanner()
    private var foregroundCheck: Task<Void, Never>?
    private var foregroundRevision = 0
    private var foregroundCheckDeferred = false
    private var verifyAfterLoad = false
    /// The Study tab is not on screen (another tab selected): verify once the
    /// web view is attached again instead of treating it as a detached failure.
    private var verifyWhenAttached = false
    /// A page confirm() holds WebKit's main thread until the user answers.
    private var scriptDialogPending = false
    private var renderedBeforeResign: (generation: Int, rendered: Bool?)?
    private var memoryWarningObserver: NSObjectProtocol?

    override init() {
        // A configured deployment is not implicitly a trusted origin. Expanding
        // this list requires a reviewed policy change and a new app build.
        let configured = Bundle.main.object(forInfoDictionaryKey: "MadrasadzBaseURL") as? String
        baseURL = URL(string: configured ?? "https://madrasadz.com") ?? URL(string: "https://madrasadz.com")!
        policy = NavigationPolicy(baseURL: baseURL)
        webView = Self.makeWebView()
        super.init()
        configureWebView()
        memoryWarningObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.didReceiveMemoryWarningNotification, object: nil, queue: .main
        ) { [weak self] _ in
            Task { @MainActor in self?.diagnostics.record("memory.warning", "gen=\(self?.webViewGeneration ?? -1)") }
        }
    }

    private static func makeWebView() -> MadrasadzWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.allowsAirPlayForMediaPlayback = false
        configuration.mediaTypesRequiringUserActionForPlayback = .audio
        // No JavaScript message handler, native execution bridge, injected
        // credentials, altered user-agent authorization, or trust exceptions.
        let view = MadrasadzWebView(frame: .zero, configuration: configuration)
        // A new/recovered renderer stays suspended until its scene has a known
        // safe capture state and its native opaque container is attached.
        view.setAllMediaPlaybackSuspended(true, completionHandler: nil)
        return view
    }

    func attachMediaProtectionContainer(_ container: MediaProtectionWebContainer) {
        guard container.webView === webView else { return }
        mediaProtectionContainer = container
    }

    func detachMediaProtectionContainer(_ container: MediaProtectionWebContainer) {
        if mediaProtectionContainer === container { mediaProtectionContainer = nil }
    }

    func updateMediaProtection(_ state: MediaProtectionState, for view: WKWebView) {
        guard view === webView else { return }
        mediaProtectionRevision += 1
        let revision = mediaProtectionRevision
        // The UIKit shield is already updated synchronously. Publish its
        // supplementary SwiftUI banner after the current view update finishes.
        Task { @MainActor [weak self] in
            guard let self, view === self.webView, revision == self.mediaProtectionRevision,
                  state != self.mediaProtection else { return }
            self.mediaProtection = state
            // An opaque black shield between the native bars looks exactly like
            // the reported defect, so every published change is logged.
            self.diagnostics.record("shield", "gen=\(self.webViewGeneration) \(Self.describe(state))")
        }
    }

    private static func describe(_ state: MediaProtectionState) -> String {
        let reason = state.reason.map { "\($0)" } ?? "none"
        return "covered=\(state.mustCover) reason=\(reason) capture=\(state.capture) visibility=\(state.visibility) attached=\(state.isAttached)"
    }

    func updateSceneActivity(_ active: Bool) {
        sceneIsActive = active
        mediaProtectionContainer?.refreshProtection()
    }

    #if DEBUG
    func endCaptureValidation() {
        guard OfflineShellValidation.enabled, captureValidationActive else { return }
        captureValidationActive = false
        mediaProtectionContainer?.refreshProtection()
    }
    #endif

    private func configureWebView() {
        webViewGeneration += 1
        contentProcessTerminated = false
        webView.onWindowChange = { [weak self] view in self?.webViewWindowChanged(view) }
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.configuration.websiteDataStore.httpCookieStore.add(self)
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        webView.isOpaque = false
        webView.backgroundColor = .systemBackground
        observations = [
            webView.observe(\.isLoading, options: [.new]) { [weak self] view, _ in
                Task { @MainActor in
                    guard let self, view === self.webView else { return }
                    self.loading = view.isLoading
                }
            },
            webView.observe(\.canGoBack, options: [.new]) { [weak self] view, _ in
                Task { @MainActor in
                    guard let self, view === self.webView else { return }
                    self.canGoBack = view.canGoBack
                }
            },
            webView.observe(\.canGoForward, options: [.new]) { [weak self] view, _ in
                Task { @MainActor in
                    guard let self, view === self.webView else { return }
                    self.canGoForward = view.canGoForward
                }
            },
            webView.observe(\.url, options: [.new]) { [weak self] view, _ in
                Task { @MainActor in
                    guard let self, view === self.webView, let url = view.url else { return }
                    self.currentURL = url
                    self.currentTitle = view.title ?? "Madrasadz"
                    // Observe SPA history too. Server presentation middleware
                    // independently handles RSC/prefetch route restrictions.
                    if case .blocked(let reason) = self.policy.decision(for: url) {
                        self.show(reason)
                        self.open()
                    }
                }
            }
        ]
        diagnostics.record("web.created", "gen=\(webViewGeneration)")
    }

    func open(path: String = "/ios") {
        guard let url = URL(string: path, relativeTo: baseURL)?.absoluteURL else { return }
        open(url)
    }

    func open(_ url: URL) {
        guard !OfflineShellValidation.enabled else { failure = true; return }
        switch policy.decision(for: url) {
        case .internalPage(let target):
            cancelPendingLoad()
            failure = false
            let destination = canonical(target)
            var request = URLRequest(url: destination, cachePolicy: .reloadIgnoringLocalCacheData)
            request.setValue("study-only", forHTTPHeaderField: "x-madrasadz-ios-client")
            let sameDocument = destination.fragment != nil && webView.url.map { Self.withoutFragment($0) } == Self.withoutFragment(destination)
            activeNavigation = webView.load(request)
            // Bound the request itself: if WebKit never starts the provisional
            // navigation (renderer not launched/suspended), Retry still appears.
            // A fragment change in the current document is same-document: WebKit
            // reports no provisional start/finish for it, so no deadline.
            if !sameDocument { armNavigationDeadline() }
            diagnostics.record("nav.request", "gen=\(webViewGeneration) page=\(pageCategory(destination)) attached=\(webView.window != nil) sameDocument=\(sameDocument)")
        case .external(let target): openExternal(target)
        case .blocked(let reason): show(reason)
        }
    }

    // MARK: Foreground lifecycle

    /// The scene is leaving the foreground (app switcher, another app, Control
    /// Center). Remember only whether this document showed visible content.
    func sceneWillResignActive() {
        let rendered = Self.visibleVariation(of: webView)
        renderedBeforeResign = (webViewGeneration, rendered)
        diagnostics.record("scene.resign", "gen=\(webViewGeneration) rendered=\(flag(rendered)) loading=\(webView.isLoading) page=\(pageCategory(webView.url))")
    }

    func enterBackground() {
        wasBackgrounded = true
        backgroundedAt = Date()
        foregroundRevision += 1
        foregroundCheck?.cancel()
        foregroundCheck = nil
        diagnostics.record("scene.background", "gen=\(webViewGeneration) restoring=\(restoring) failure=\(failure)")
        // The next activation runs a fresh check; never keep a stale placeholder.
        restoring = false
        diagnostics.flush()
    }

    /// Scene transitions may be background -> inactive -> active. Remember the
    /// background event rather than relying on the immediately previous phase.
    /// Returns true when this activation follows a background period.
    @discardableResult
    func restoreAfterBackground() -> Bool {
        guard wasBackgrounded else {
            // Inactive -> active without background (Control Center, a system
            // dialog): verify only if the renderer died or a check was deferred.
            if contentProcessTerminated || foregroundCheckDeferred {
                foregroundCheckDeferred = false
                scheduleForegroundCheck(after: 300_000_000, reason: "active")
            }
            return false
        }
        wasBackgrounded = false
        processRecoveryAttempted = false
        foregroundCheckDeferred = false
        recoveryPlanner.reset()
        let away = backgroundedAt.map { Int(Date().timeIntervalSince($0)) } ?? -1
        diagnostics.record("scene.foreground", "gen=\(webViewGeneration) awaySeconds=\(away) attached=\(webView.window != nil) navPending=\(navigationTimeout != nil)")
        // Time spent suspended must not count against an in-flight navigation.
        if navigationTimeout != nil { armNavigationDeadline() }
        // Keep the rendered document, its scroll/video/form state and history.
        // Give WebKit a moment to resume its renderer, then verify the document;
        // only a failed check leads to the bounded recovery ladder.
        scheduleForegroundCheck(after: 700_000_000, reason: "foreground")
        return true
    }

    private func scheduleForegroundCheck(after delay: UInt64, reason: String) {
        foregroundCheck?.cancel()
        foregroundRevision += 1
        let revision = foregroundRevision
        foregroundCheck = Task { @MainActor [weak self] in
            do { try await Task.sleep(nanoseconds: delay) }
            catch { return }
            guard let self, self.foregroundRevision == revision else { return }
            await self.verifyForegroundDocument(revision: revision, reason: reason)
        }
    }

    private func verifyForegroundDocument(revision: Int, reason: String) async {
        guard !OfflineShellValidation.enabled else { return }
        guard UIApplication.shared.applicationState == .active else {
            foregroundCheckDeferred = true
            restoring = false
            diagnostics.record("fg.deferred", "reason=\(reason)")
            return
        }
        // The failure state already offers Retry; do not stack recovery on it.
        guard !failure else {
            restoring = false
            return
        }
        let view = webView
        // Hosted but off screen (Bookmarks/Planner tab selected): not a failure.
        // Verify when the Study tab attaches the view again.
        if view.window == nil, view.superview != nil {
            verifyWhenAttached = true
            restoring = false
            diagnostics.record("fg.deferred", "reason=\(reason) offWindow=1")
            return
        }
        let generation = webViewGeneration
        // Fail-closed re-evaluation of the capture/inactive shield from current
        // scene facts; it can only uncover a known-safe, active, attached scene.
        mediaProtectionContainer?.refreshProtection()
        var before: Bool?
        if let sample = renderedBeforeResign, sample.generation == generation { before = sample.rendered }
        // A cheap on-screen sample first. If the document visibly disappeared and
        // the liveness probe is slow (frozen renderer), show the native
        // placeholder instead of an empty area; a quick probe avoids any flash.
        let early = view.window != nil ? Self.visibleVariation(of: view) : nil
        let reveal: Task<Void, Never>? = (view.window == nil || (before == true && early == false))
            ? Task { @MainActor [weak self] in
                do { try await Task.sleep(nanoseconds: 300_000_000) }
                catch { return }
                self?.restoring = true
            }
            : nil
        let started = Date()
        let responsive = scriptDialogPending ? true : await Self.scriptResponds(view)
        reveal?.cancel()
        guard foregroundRevision == revision, view === webView else { return }
        let attached = view.window != nil && !view.isHidden && view.alpha > 0.01
            && view.bounds.width >= 1 && view.bounds.height >= 1
        let now = attached ? Self.visibleVariation(of: view) : nil
        let health = WebDocumentHealth(attached: attached, hasDocument: view.url != nil,
                                       processTerminated: contentProcessTerminated,
                                       scriptResponsive: responsive, loading: view.isLoading,
                                       renderedBefore: before, renderedNow: now)
        let action = recoveryPlanner.next(for: health)
        let probeMilliseconds = Int(Date().timeIntervalSince(started) * 1000)
        let fields: [String] = [
            "reason=\(reason)", "gen=\(generation)", "attached=\(attached)",
            "size=\(Int(view.bounds.width))x\(Int(view.bounds.height))",
            "document=\(health.hasDocument)", "terminated=\(health.processTerminated)",
            "script=\(responsive)/\(probeMilliseconds)ms", "loading=\(health.loading)",
            "before=\(flag(before))", "early=\(flag(early))", "now=\(flag(now))",
            "page=\(pageCategory(view.url))", "sceneActive=\(sceneIsActive)",
            "container=\(mediaProtectionContainer != nil)", "shield[\(Self.describe(mediaProtection))]",
            "action=\(action.rawValue)"
        ]
        diagnostics.record("fg.check", fields.joined(separator: " "))
        switch action {
        case .keep:
            restoring = false
        case .reattach:
            restoring = true
            reattachWebView()
            scheduleForegroundCheck(after: 900_000_000, reason: "after-reattach")
        case .replace:
            restoring = true
            verifyAfterLoad = true
            replaceWebView()
            loadWhenAttached(restorationURL)
        case .retry:
            restoring = false
            failure = true
        }
    }

    /// Remove and re-add the same view in its SwiftUI-owned protection container,
    /// beneath the opaque shield. WebKit then re-evaluates window/scene visibility
    /// without discarding the document; the shield re-reads the scene state.
    private func reattachWebView() {
        guard let host = webView.superview else {
            // Not hosted at all: rebuilding the view tree re-hosts the current view.
            objectWillChange.send()
            return
        }
        let frame = webView.frame
        webView.removeFromSuperview()
        webView.frame = frame
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        host.insertSubview(webView, at: 0)
        mediaProtectionContainer?.refreshProtection()
    }

    private func replaceWebView() {
        cancelPendingLoad()
        finishNavigationWait()
        navigationRevision += 1
        activeNavigation = nil
        let previous = webView
        previous.onWindowChange = nil
        previous.navigationDelegate = nil
        previous.uiDelegate = nil
        previous.configuration.websiteDataStore.httpCookieStore.remove(self)
        previous.stopLoading()
        observations.removeAll()
        mediaProtectionContainer = nil
        mediaProtectionRevision += 1
        mediaProtection = MediaProtectionState()
        // A new view and renderer attachment; WKWebsiteDataStore.default() keeps
        // the server session cookie. Page-local state and web history reset.
        // SwiftUI gives the new view its own protection container (keyed by
        // view identity); its load waits for that attachment (loadWhenAttached).
        webView = Self.makeWebView()
        canGoBack = false
        canGoForward = false
        configureWebView()
    }

    /// Only an allowed internal page is restored; anything else falls back to /ios.
    private var restorationURL: URL {
        if let url = currentURL, case .internalPage = policy.decision(for: url) { return url }
        return baseURL.appendingPathComponent("ios")
    }

    private static func withoutFragment(_ url: URL) -> URL {
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return url }
        components.fragment = nil
        return components.url ?? url
    }

    /// Start a recovery load only once WebKit sees the new view in a window: a
    /// renderer launched for an off-window view during a scene transition can be
    /// suspended or reclaimed before its first paint, with no delegate callback.
    private func loadWhenAttached(_ url: URL) {
        if webView.window != nil {
            open(url)
            return
        }
        pendingLoad = url
        pendingLoadFallback?.cancel()
        let generation = webViewGeneration
        pendingLoadFallback = Task { @MainActor [weak self] in
            do { try await Task.sleep(nanoseconds: 2_000_000_000) }
            catch { return }
            guard let self, self.webViewGeneration == generation, self.pendingLoad != nil else { return }
            self.diagnostics.record("web.attach-timeout", "gen=\(generation)")
            self.flushPendingLoad()
        }
    }

    private func flushPendingLoad() {
        guard let url = pendingLoad else { return }
        pendingLoad = nil
        pendingLoadFallback?.cancel()
        pendingLoadFallback = nil
        open(url)
    }

    private func cancelPendingLoad() {
        pendingLoad = nil
        pendingLoadFallback?.cancel()
        pendingLoadFallback = nil
    }

    private func webViewWindowChanged(_ view: MadrasadzWebView) {
        guard view === webView else { return }
        let attached = view.window != nil
        diagnostics.record(attached ? "web.attached" : "web.detached",
                           "gen=\(webViewGeneration) size=\(Int(view.bounds.width))x\(Int(view.bounds.height))")
        // Window changes can arrive inside a SwiftUI update; publish afterwards.
        if attached, pendingLoad != nil {
            Task { @MainActor [weak self] in self?.flushPendingLoad() }
        }
        if attached, verifyWhenAttached {
            verifyWhenAttached = false
            scheduleForegroundCheck(after: 300_000_000, reason: "attached")
        }
    }

    private func restoreCurrentPage() {
        webView.stopLoading()
        open(currentURL ?? webView.url ?? baseURL.appendingPathComponent("ios"))
    }

    private func armNavigationDeadline() {
        navigationRevision += 1
        let revision = navigationRevision
        navigationTimeout?.cancel()
        loading = true
        navigationTimeout = Task { @MainActor [weak self] in
            do { try await Task.sleep(nanoseconds: 30_000_000_000) }
            catch { return }
            guard let self, self.navigationRevision == revision else { return }
            self.diagnostics.record("nav.timeout", "gen=\(self.webViewGeneration)")
            self.webView.stopLoading()
            self.finishNavigationWait()
            self.restoring = false
            self.verifyAfterLoad = false
            self.failure = true
        }
    }

    private func finishNavigationWait() {
        navigationTimeout?.cancel()
        navigationTimeout = nil
        loading = false
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        guard webView === self.webView else { return }
        activeNavigation = navigation
        armNavigationDeadline()
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        guard webView === self.webView, navigation === activeNavigation else { return }
        diagnostics.record("nav.commit", "gen=\(webViewGeneration)")
    }

    func retry() {
        guard !OfflineShellValidation.enabled else { failure = true; return }
        failure = false
        processRecoveryAttempted = false
        diagnostics.record("retry", "gen=\(webViewGeneration) terminated=\(contentProcessTerminated) document=\(webView.url != nil)")
        if contentProcessTerminated || webView.url == nil {
            // A reclaimed renderer may ignore a reload; use a new attachment.
            replaceWebView()
            loadWhenAttached(restorationURL)
        } else {
            restoreCurrentPage()
        }
    }

    private func canonical(_ url: URL) -> URL {
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return url }
        if components.path == "/student" || components.path == "/student/courses" || components.path == "/" {
            components.path = "/ios"
            components.query = nil
            components.fragment = nil
        } else if components.path.hasPrefix("/student/courses/") {
            let tail = String(components.path.dropFirst("/student/courses/".count))
            if !tail.isEmpty && !tail.contains("/") {
                components.percentEncodedPath = "/ios/course/" + String(components.percentEncodedPath.dropFirst("/student/courses/".count))
                components.query = nil
                components.fragment = nil
            }
        }
        return components.url ?? url
    }

    private func show(_ reason: NavigationBlockReason) {
        switch reason {
        case .purchasesUnavailable: notice = L10n.text("purchaseBlocked")
        case .communityUnavailable: notice = L10n.text("communityBlocked")
        case .roleUnavailable: notice = L10n.text("studentOnly")
        default: notice = L10n.text("routeBlocked")
        }
    }

    private func openExternal(_ url: URL) {
        if url.scheme == "https" { externalURL = url }
        else if url.scheme == "tel" || url.scheme == "mailto" {
            UIApplication.shared.open(url)
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard webView === self.webView else { decisionHandler(.cancel); return }
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if action.shouldPerformDownload {
            decisionHandler(.cancel)
            if action.sourceFrame.isMainFrame, url.scheme == "https", url.host == baseURL.host,
               url.path.hasPrefix("/api/v1/media/"),
               let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
               let value = components.queryItems?.first(where: { $0.name == "c" })?.value,
               let contentID = UUID(uuidString: value) {
                // The native exporter asks the server to check allowDownload,
                // enrollment, terms and current account again. A URL/anchor is
                // not a download entitlement.
                onDownloadRequested?(contentID)
            } else { notice = L10n.text("routeBlocked") }
            return
        }
        // The website controls its own sandboxed video frames. They cannot call
        // native code (there is no bridge); ATS remains enabled for resources.
        if let frame = action.targetFrame, !frame.isMainFrame {
            decisionHandler(url.scheme == "https" || url.scheme == "about" ? .allow : .cancel)
            return
        }
        switch policy.decision(for: url) {
        case .internalPage(let target):
            let mapped = canonical(target)
            if mapped != target || action.targetFrame == nil {
                decisionHandler(.cancel)
                open(mapped)
            } else {
                if ["/login", "/register", "/forgot-password", "/reset-password"].contains(target.path) {
                    onAuthenticationPage?()
                }
                decisionHandler(.allow)
            }
        case .external(let target):
            decisionHandler(.cancel)
            // Never open a redirect or a script-generated external popup on its
            // own. Only a deliberate user link gets a system browser window.
            if action.navigationType == .linkActivated { openExternal(target) }
            else { notice = L10n.text("routeBlocked"); failure = true }
        case .blocked(let reason): decisionHandler(.cancel); show(reason)
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        guard webView === self.webView else { decisionHandler(.cancel); return }
        if response.isForMainFrame && !response.canShowMIMEType {
            // No native raw-download fallback: the server's protected viewer and
            // download restrictions are preserved. We only share page links.
            decisionHandler(.cancel)
            notice = L10n.text("routeBlocked")
        } else {
            if response.isForMainFrame, let http = response.response as? HTTPURLResponse {
                if http.statusCode >= 400 { diagnostics.record("nav.status", "gen=\(webViewGeneration) code=\(http.statusCode)") }
                if http.statusCode >= 500 || http.statusCode == 404 { failure = true }
            }
            decisionHandler(.allow)
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard webView === self.webView, navigation === activeNavigation else { return }
        finishNavigationWait()
        currentURL = webView.url
        currentTitle = webView.title ?? "Madrasadz"
        diagnostics.record("nav.finish", "gen=\(webViewGeneration) page=\(pageCategory(webView.url))")
        if verifyAfterLoad {
            verifyAfterLoad = false
            scheduleForegroundCheck(after: 700_000_000, reason: "after-replace")
        } else {
            restoring = false
        }
        onPageFinished?()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        guard webView === self.webView, navigation === activeNavigation, (error as NSError).code != NSURLErrorCancelled else { return }
        navigationFailed(error, stage: "provisional")
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        guard webView === self.webView, navigation === activeNavigation, (error as NSError).code != NSURLErrorCancelled else { return }
        navigationFailed(error, stage: "committed")
    }

    private func navigationFailed(_ error: Error, stage: String) {
        let code = error as NSError
        // Error domain and code only; never the failing URL or description.
        diagnostics.record("nav.fail", "gen=\(webViewGeneration) stage=\(stage) error=\(code.domain)/\(code.code)")
        finishNavigationWait()
        restoring = false
        verifyAfterLoad = false
        failure = true
        onPageFinished?()
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        guard webView === self.webView else { return }
        finishNavigationWait()
        contentProcessTerminated = true
        let active = UIApplication.shared.applicationState == .active
        diagnostics.record("web.process-terminated", "gen=\(webViewGeneration) active=\(active) recoveryUsed=\(processRecoveryAttempted)")
        // Outside the foreground, the next activation check replaces the view
        // once it can be attached and rendered.
        guard active else { return }
        guard !processRecoveryAttempted else {
            restoring = false
            failure = true
            return
        }
        // At most one automatic recovery; repeated renderer failures expose Retry.
        processRecoveryAttempted = true
        restoring = true
        replaceWebView()
        loadWhenAttached(restorationURL)
    }

    func cookiesDidChange(in cookieStore: WKHTTPCookieStore) { onCookiesChanged?() }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard webView === self.webView else { return nil }
        if let url = action.request.url {
            switch policy.decision(for: url) {
            case .internalPage(let target): open(target)
            case .external(let target):
                if action.navigationType == .linkActivated { openExternal(target) }
            case .blocked(let reason): show(reason)
            }
        }
        return nil
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        // Website alerts never become trusted native security instructions.
        if frame.isMainFrame && frame.securityOrigin.host == baseURL.host { notice = String(message.prefix(500)) }
        completionHandler()
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        guard frame.isMainFrame, frame.securityOrigin.host == baseURL.host,
              var controller = webView.window?.rootViewController else { completionHandler(false); return }
        while let presented = controller.presentedViewController { controller = presented }
        guard !(controller is UIAlertController) else { completionHandler(false); return }
        let alert = UIAlertController(title: baseURL.host, message: String(message.prefix(500)), preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: L10n.text("cancel"), style: .cancel) { [weak self] _ in
            self?.scriptDialogPending = false
            completionHandler(false)
        })
        alert.addAction(UIAlertAction(title: L10n.text("ok"), style: .default) { [weak self] _ in
            self?.scriptDialogPending = false
            completionHandler(true)
        })
        scriptDialogPending = true
        controller.present(alert, animated: true)
    }

    // MARK: Privacy-bounded probes

    /// Coarse page category for diagnostics; never a path, identifier or query.
    private func pageCategory(_ url: URL?) -> String {
        guard let url else { return "none" }
        guard url.scheme == "https", url.host?.lowercased() == baseURL.host?.lowercased() else {
            return url.scheme == "about" ? "about" : "other-origin"
        }
        let path = url.path
        if path == "/ios" { return "ios-home" }
        if path.hasPrefix("/ios/course/") { return "ios-course" }
        if path.hasPrefix("/ios/") { return "ios-other" }
        if ["/login", "/register", "/forgot-password", "/reset-password"].contains(path) { return "auth" }
        return "site"
    }

    /// Liveness only: a constant boolean expression in WebKit's isolated client
    /// world, unreachable by page scripts. No page data returns to native code.
    private static func scriptResponds(_ view: WKWebView) async -> Bool {
        do {
            return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Bool, Error>) in
                let pending = CallbackDeadline(continuation)
                pending.armTimeout(nanoseconds: 4_000_000_000)
                view.evaluateJavaScript("document.readyState.length > 0", in: nil, in: .defaultClient) { result in
                    let alive: Bool
                    switch result {
                    case .success:
                        alive = true
                    case .failure(let error):
                        let code = error as NSError
                        alive = !(code.domain == WKError.errorDomain
                                  && code.code == WKError.Code.webContentProcessTerminated.rawValue)
                    }
                    Task { @MainActor in pending.finish(.success(alive)) }
                }
            }
        } catch {
            // Deadline reached: the renderer is suspended, hung or gone.
            return false
        }
    }

    /// Whether the web view as drawn on screen shows visible variation. The 32x64
    /// sample exists in memory for this call only; it is never stored or sent.
    private static func visibleVariation(of view: UIView) -> Bool? {
        guard view.window != nil, view.bounds.width >= 16, view.bounds.height >= 16 else { return nil }
        let width = 32
        let height = 64
        var pixels = [UInt8](repeating: 0, count: width * height * 4)
        let drawn = pixels.withUnsafeMutableBytes { buffer -> Bool in
            guard let context = CGContext(data: buffer.baseAddress, width: width, height: height,
                                          bitsPerComponent: 8, bytesPerRow: width * 4,
                                          space: CGColorSpaceCreateDeviceRGB(),
                                          bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
            context.translateBy(x: 0, y: CGFloat(height))
            context.scaleBy(x: 1, y: -1)
            UIGraphicsPushContext(context)
            defer { UIGraphicsPopContext() }
            return view.drawHierarchy(in: CGRect(x: 0, y: 0, width: width, height: height), afterScreenUpdates: false)
        }
        guard drawn else { return nil }
        return PixelSample.hasVisibleVariation(rgba: pixels)
    }
}

private func flag(_ value: Bool?) -> String {
    guard let value else { return "-" }
    return value ? "1" : "0"
}
