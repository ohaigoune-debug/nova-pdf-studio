import SwiftUI
import WebKit
import SafariServices

struct PlatformWebView: UIViewRepresentable {
    @ObservedObject var browser: BrowserController
    func makeUIView(context: Context) -> MediaProtectionWebContainer {
        MediaProtectionWebContainer(webView: browser.webView, browser: browser)
    }
    func updateUIView(_ uiView: MediaProtectionWebContainer, context: Context) {}
    static func dismantleUIView(_ uiView: MediaProtectionWebContainer, coordinator: ()) { uiView.detach() }
}

struct ExternalBrowser: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> SFSafariViewController {
        SFSafariViewController(url: url)
    }
    func updateUIViewController(_ controller: SFSafariViewController, context: Context) {}
}
