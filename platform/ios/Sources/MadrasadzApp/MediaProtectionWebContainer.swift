import UIKit
import WebKit
import MadrasadzCore

/// Native, opaque cover around the current WKWebView. Unlike JavaScript or a
/// SwiftUI-only overlay, this shield changes synchronously on UIKit's main
/// thread before an asynchronous media-pause completion can arrive.
@MainActor
final class MediaProtectionWebContainer: UIView {
    let webView: WKWebView
    private weak var browser: BrowserController?
    private let shield = UIView()
    private let message = UILabel()
    private var observations: [NSObjectProtocol] = []
    private var lifecycleActive = UIApplication.shared.applicationState == .active
    private var currentState = MediaProtectionState()
    private var renderingRevision = 0
    private var hasAppliedState = false

    init(webView: WKWebView, browser: BrowserController) {
        self.webView = webView
        self.browser = browser
        super.init(frame: .zero)
        backgroundColor = .systemBackground
        webView.frame = bounds
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        addSubview(webView)

        shield.backgroundColor = .black
        shield.isOpaque = true
        shield.alpha = 1
        shield.frame = bounds
        shield.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        shield.isUserInteractionEnabled = true
        shield.isAccessibilityElement = true
        shield.accessibilityViewIsModal = true
        shield.accessibilityIdentifier = "mediaProtectionShield"
        message.textColor = .white
        message.font = .preferredFont(forTextStyle: .body)
        message.adjustsFontForContentSizeCategory = true
        message.numberOfLines = 0
        message.textAlignment = .center
        message.translatesAutoresizingMaskIntoConstraints = false
        message.isAccessibilityElement = false
        shield.addSubview(message)
        NSLayoutConstraint.activate([
            message.leadingAnchor.constraint(equalTo: shield.leadingAnchor, constant: 24),
            message.trailingAnchor.constraint(equalTo: shield.trailingAnchor, constant: -24),
            message.centerYAnchor.constraint(equalTo: shield.centerYAnchor)
        ])
        addSubview(shield) // Visible from the first frame, before scene attachment.

        registerForTraitChanges([UITraitSceneCaptureState.self]) { (view: MediaProtectionWebContainer, _: UITraitCollection) in
            view.refreshProtection()
        }
        observeLifecycle()
        browser.attachMediaProtectionContainer(self)
        refreshProtection()
    }

    required init?(coder: NSCoder) { fatalError("Use init(webView:browser:)") }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        refreshProtection() // Trait registration does not deliver an initial state.
    }

    private func observeLifecycle() {
        let center = NotificationCenter.default
        for name in [UIApplication.willResignActiveNotification, UIApplication.didEnterBackgroundNotification] {
            observations.append(center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated {
                    self?.lifecycleActive = false
                    self?.refreshProtection()
                }
            })
        }
        observations.append(center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated {
                self?.lifecycleActive = true
                self?.refreshProtection()
            }
        })
        for name in [UIScene.willDeactivateNotification, UIScene.didEnterBackgroundNotification, UIScene.didActivateNotification] {
            observations.append(center.addObserver(forName: name, object: nil, queue: .main) { [weak self] notification in
                MainActor.assumeIsolated {
                    guard let self, let ownScene = self.window?.windowScene,
                          let scene = notification.object as? UIScene, scene === ownScene else { return }
                    self.lifecycleActive = name == UIScene.didActivateNotification
                    self.refreshProtection()
                }
            })
        }
    }

    func refreshProtection() {
        guard webView.superview === self else { return }
        let capture: MediaProtectionState.CaptureStatus
        switch traitCollection.sceneCaptureState {
        case .active: capture = .active
        case .inactive: capture = .inactive
        case .unspecified: capture = .unknown
        @unknown default: capture = .unknown
        }
        let visibility: MediaProtectionState.Visibility
        if window?.windowScene?.activationState == .background { visibility = .background }
        else if lifecycleActive && browser?.sceneIsActive == true && window?.windowScene?.activationState == .foregroundActive { visibility = .active }
        else { visibility = .inactive }
        var state = MediaProtectionState(capture: capture, visibility: visibility, isAttached: window != nil)
        // A Debug-only disconnected test can add a simulated capture. It can
        // never mark a real active capture as inactive or unlock real content.
        if browser?.captureValidationActive == true { state.capture = .active }
        apply(state)
    }

    private func apply(_ state: MediaProtectionState) {
        let changed = !hasAppliedState || state != currentState
        currentState = state
        browser?.updateMediaProtection(state, for: webView)
        let key: String
        switch state.reason {
        case .capture: key = "captureBlocked"
        case .inactive: key = "privacyInactive"
        default: key = "privacyPreparing"
        }
        message.text = L10n.text(key)
        shield.accessibilityLabel = L10n.text("protectedContent") + ". " + L10n.text(key)
        #if DEBUG
        // The disconnected fixture's stop-simulation control is in the outer
        // SwiftUI cover. Keep it reachable to UI automation/VoiceOver instead
        // of trapping focus in this inner noninteractive UIKit shield. This
        // changes accessibility scope only; a real active trait still covers
        // and suspends playback after ending the synthetic state.
        shield.accessibilityViewIsModal = !(OfflineShellValidation.enabled && browser?.captureValidationActive == true)
        #endif
        guard changed else { return }
        hasAppliedState = true
        renderingRevision += 1
        let revision = renderingRevision
        if state.mustCover {
            shield.isHidden = false
            bringSubviewToFront(shield)
            webView.accessibilityElementsHidden = true
            // Cover first. Suspending also prevents page scripts/iframes from
            // starting playback again while a recording or inactive scene lasts.
            webView.pauseAllMediaPlayback(completionHandler: nil)
            webView.setAllMediaPlaybackSuspended(true, completionHandler: nil)
        } else {
            // Release suspension without auto-resuming a previous lesson. Keep
            // the opaque cover until the WebKit pause acknowledgement arrives.
            webView.setAllMediaPlaybackSuspended(false) { [weak self] in
                guard let self, self.webView.superview === self,
                      self.renderingRevision == revision, !self.currentState.mustCover else { return }
                self.webView.pauseAllMediaPlayback { [weak self] in
                    guard let self, self.webView.superview === self,
                          self.renderingRevision == revision, !self.currentState.mustCover else { return }
                    self.webView.accessibilityElementsHidden = false
                    self.shield.isHidden = true
                }
            }
        }
    }

    func detach() {
        observations.forEach { NotificationCenter.default.removeObserver($0) }
        observations.removeAll()
        renderingRevision += 1 // Late WebKit completions cannot remove a new shield.
        shield.isHidden = false
        if webView.superview === self {
            webView.pauseAllMediaPlayback(completionHandler: nil)
            webView.setAllMediaPlaybackSuspended(true, completionHandler: nil)
        }
        browser?.detachMediaProtectionContainer(self)
    }
}
