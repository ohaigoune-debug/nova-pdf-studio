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
    let webView: WKWebView
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
    var onPageFinished: (() -> Void)?
    var onAuthenticationPage: (() -> Void)?
    var onDownloadRequested: ((UUID) -> Void)?
    var onCookiesChanged: (() -> Void)?
    private var observations: [NSKeyValueObservation] = []

    override init() {
        // A configured deployment is not implicitly a trusted origin. Expanding
        // this list requires a reviewed policy change and a new app build.
        let configured = Bundle.main.object(forInfoDictionaryKey: "MadrasadzBaseURL") as? String
        baseURL = URL(string: configured ?? "https://madrasadz.com") ?? URL(string: "https://madrasadz.com")!
        policy = NavigationPolicy(baseURL: baseURL)
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.allowsAirPlayForMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = .audio
        // No JavaScript message handler, native execution bridge, injected
        // credentials, altered user-agent authorization, or trust exceptions.
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.configuration.websiteDataStore.httpCookieStore.add(self)
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        webView.isOpaque = false
        webView.backgroundColor = .systemBackground
        observations = [
            webView.observe(\.isLoading, options: [.new]) { [weak self] view, _ in
                Task { @MainActor in self?.loading = view.isLoading }
            },
            webView.observe(\.canGoBack, options: [.new]) { [weak self] view, _ in
                Task { @MainActor in self?.canGoBack = view.canGoBack }
            },
            webView.observe(\.canGoForward, options: [.new]) { [weak self] view, _ in
                Task { @MainActor in self?.canGoForward = view.canGoForward }
            },
            webView.observe(\.url, options: [.new]) { [weak self] view, _ in
                Task { @MainActor in
                    guard let self, let url = view.url else { return }
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

    func retry() {
        guard !OfflineShellValidation.enabled else { failure = true; return }
        failure = false
        if webView.url != nil { webView.reloadFromOrigin() } else { open() }
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
        currentURL = webView.url
        currentTitle = webView.title ?? "Madrasadz"
        onPageFinished?()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { failure = true }
        onPageFinished?()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { failure = true }
        onPageFinished?()
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { failure = true }

    func cookiesDidChange(in cookieStore: WKHTTPCookieStore) { onCookiesChanged?() }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
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
