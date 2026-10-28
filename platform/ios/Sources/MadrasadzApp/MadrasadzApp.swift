import SwiftUI

@main
struct MadrasadzApp: App {
    @StateObject private var model = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            StudyRootView(model: model)
                .task {
                    model.browser.updateSceneActivity(scenePhase == .active)
                    await model.start()
                }
                // No app-wide privacySensitive(): on iOS 27 its .privacy redaction on
                // every resign made SwiftUI rebuild the web host and carry the shared
                // WKWebView off screen (device log, Build 4). The opaque cover below,
                // the native shield and the per-view markers on personal lists remain.
                .overlay {
                    if scenePhase != .active {
                        PrivacyProtectionCover(messageKey: "privacyInactive")
                    }
                }
                .onChange(of: scenePhase) { previous, phase in
                    model.browser.diagnostics.record("scene.phase", "\(previous)->\(phase) privacyCover=\(phase != .active)")
                    if previous == .active && phase != .active { model.browser.sceneWillResignActive() }
                    model.browser.updateSceneActivity(phase == .active)
                    // Do not invalidate an in-progress notification-permission
                    // dialog merely because it temporarily makes us inactive.
                    if phase == .background { model.browser.enterBackground() }
                    if phase == .active, model.browser.restoreAfterBackground() {
                        Task { await model.refreshIdentity(superseding: true) }
                    }
                    // Re-ask the server about native screens at most every 10 minutes.
                    if phase == .active { model.native.sceneBecameActive() }
                }
        }
    }
}
