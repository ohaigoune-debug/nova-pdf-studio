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
                .privacySensitive()
                .overlay {
                    if scenePhase != .active {
                        PrivacyProtectionCover(messageKey: "privacyInactive")
                    }
                }
                .onChange(of: scenePhase) { previous, phase in
                    model.browser.updateSceneActivity(phase == .active)
                    // Do not invalidate an in-progress notification-permission
                    // dialog merely because it temporarily makes us inactive.
                    if phase == .background { model.browser.enterBackground() }
                    if phase == .active, model.browser.restoreAfterBackground() {
                        Task { await model.refreshIdentity(superseding: true) }
                    }
                }
        }
    }
}
