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
    @Published private(set) var webView: WKWebView
    let policy: NavigationPolicy
    let baseURL: URL
    @Published var loading = false
    @Published var failure = false
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
    private var processRecoveryAttempted = false
    private var navigationTimeout: Task<Void, Never>?
    private var navigationRevision = 0
    private var activeNavigation: WKNavigation?
    private var observations: [NSKeyValueObservation] = []

    override init() {
        // A configured deployment is not implicitly a trusted origin. Expanding
        // this list requires a reviewed policy change and a new app build.
        let configured = Bundle.main.object(forInfoDictionaryKey: "MadrasadzBaseURL") as? String
        baseURL = URL(string: configured ?? "https://madrasadz.com") ?? URL(string: "https://madrasadz.com")!
        policy = NavigationPolicy(baseURL: baseURL)
        webView = Self.makeWebView()
        super.init()
        configureWebView()
    }

    private static func makeWebView() -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.allowsAirPlayForMediaPlayback = false
        configuration.mediaTypesRequiringUserActionForPlayback = .audio
        // No JavaScript message handler, native execution bridge, injected
        // credentials, altered user-agent authorization, or trust exceptions.
        let view = WKWebView(frame: .zero, configuration: configuration)
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
        }
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
    }

    func open(path: String = "/ios") {
        guard let url = URL(string: path, relativeTo: baseURL)?.absoluteURL else { return }
        open(url)
    }

    func open(_ url: URL) {
        guard !OfflineShellValidation.enabled else { failure = true; return }
        switch policy.decision(for: url) {
        case .internalPage(let target):
            failure = false
            var request = URLRequest(url: canonical(target), cachePolicy: .reloadIgnoringLocalCacheData)
            request.setValue("study-only", forHTTPHeaderField: "x-madrasadz-ios-client")
            webView.load(request)
        case .external(let target): openExternal(target)
        case .blocked(let reason): show(reason)
        }
    }

    func enterBackground() { wasBackgrounded = true }

    /// Scene transitions may be background -> inactive -> active. Remember the
    /// background event rather than relying on the immediately previous phase.
    @discardableResult
    func restoreAfterBackground() -> Bool {
        guard wasBackgrounded else { return false }
        wasBackgrounded = false
        processRecoveryAttempted = false
        // Recreate the current allowed document with a GET, preserving WebKit's
        // persistent cookies. Never replay a submitted POST or restore auth data.
        // This intentionally resets page-local form/video state after background.
        replaceWebView()
        restoreCurrentPage()
        return true
    }

    private func replaceWebView() {
        finishNavigationWait()
        navigationRevision += 1
        activeNavigation = nil
        let previous = webView
        previous.navigationDelegate = nil
        previous.uiDelegate = nil
        previous.configuration.websiteDataStore.httpCookieStore.remove(self)
        previous.stopLoading()
        observations.removeAll()
        mediaProtectionContainer = nil
        mediaProtectionRevision += 1
        mediaProtection = MediaProtectionState()
        // A suspended/terminated renderer can remain blank even after reload.
        // Use a new view and renderer attachment, retaining the default data store.
        webView = Self.makeWebView()
        canGoBack = false
        canGoForward = false
        configureWebView()
    }

    private func restoreCurrentPage() {
        webView.stopLoading()
        open(currentURL ?? webView.url ?? baseURL.appendingPathComponent("ios"))
    }

    private func finishNavigationWait() {
        navigationTimeout?.cancel()
        navigationTimeout = nil
        loading = false
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        guard webView === self.webView else { return }
        activeNavigation = navigation
        navigationRevision += 1
        let revision = navigationRevision
        navigationTimeout?.cancel()
        loading = true
        navigationTimeout = Task { @MainActor [weak self] in
            do { try await Task.sleep(nanoseconds: 30_000_000_000) }
            catch { return }
            guard let self, self.navigationRevision == revision else { return }
            self.webView.stopLoading()
            self.finishNavigationWait()
            self.failure = true
        }
    }

    func retry() {
        guard !OfflineShellValidation.enabled else { failure = true; return }
        failure = false
        processRecoveryAttempted = false
        restoreCurrentPage()
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
            if response.isForMainFrame, let http = response.response as? HTTPURLResponse,
               http.statusCode >= 500 || http.statusCode == 404 { failure = true }
            decisionHandler(.allow)
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard webView === self.webView, navigation === activeNavigation else { return }
        finishNavigationWait()
        currentURL = webView.url
        currentTitle = webView.title ?? "Madrasadz"
        onPageFinished?()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        guard webView === self.webView, navigation === activeNavigation, (error as NSError).code != NSURLErrorCancelled else { return }
        finishNavigationWait()
        failure = true
        onPageFinished?()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        guard webView === self.webView, navigation === activeNavigation, (error as NSError).code != NSURLErrorCancelled else { return }
        finishNavigationWait()
        failure = true
        onPageFinished?()
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        guard webView === self.webView else { return }
        finishNavigationWait()
        guard UIApplication.shared.applicationState == .active,
              !processRecoveryAttempted else { failure = true; return }
        // At most one automatic recovery; repeated renderer failures expose Retry.
        processRecoveryAttempted = true
        replaceWebView()
        restoreCurrentPage()
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
        alert.addAction(UIAlertAction(title: L10n.text("cancel"), style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: L10n.text("ok"), style: .default) { _ in completionHandler(true) })
        controller.present(alert, animated: true)
    }
}
