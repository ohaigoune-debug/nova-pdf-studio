import SwiftUI

@main
struct MadrasadzApp: App {
    @StateObject private var model = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView(model: model)
                .task { await model.start() }
                // A plain opaque cover in the app switcher; no web view, no redaction of the whole app.
                .overlay {
                    if scenePhase == .background { PrivacyCover() }
                }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active { model.becameActive() }
                }
        }
    }
}

struct PrivacyCover: View {
    var body: some View {
        ZStack {
            Brand.navy.ignoresSafeArea()
            Image("BrandLogo").resizable().scaledToFit().frame(width: 210, height: 70).accessibilityHidden(true)
        }
    }
}
