import SwiftUI
import UIKit
import WebKit
import SafariServices

/// WKWebView that reports window attachment. WebKit only renders a page whose view
/// is in a window of a foreground scene, so recovery loads wait for this event.
final class MadrasadzWebView: WKWebView {
    var onWindowChange: (@MainActor (MadrasadzWebView) -> Void)?

    override func didMoveToWindow() {
        super.didMoveToWindow()
        onWindowChange?(self)
    }
}

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
