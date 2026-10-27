import SwiftUI

@main
struct MadrasadzApp: App {
    @StateObject private var model = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            StudyRootView(model: model)
                .task { await model.start() }
                .privacySensitive()
                .overlay {
                    if scenePhase == .background { Color(uiColor: .systemBackground).ignoresSafeArea() }
                }
                .onChange(of: scenePhase) { previous, phase in
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
