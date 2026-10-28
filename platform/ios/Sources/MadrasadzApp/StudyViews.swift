import SwiftUI
import MadrasadzCore

private let brandBlue = Color(red: 49/255, green: 85/255, blue: 245/255)

struct StudyRootView: View {
    @ObservedObject var model: AppModel
    @ObservedObject private var browser: BrowserController
    @ObservedObject private var downloads: OfflineLibrary
    @ObservedObject private var native: NativeLearningModel
    @StateObject private var capture = SceneCaptureState()
    @State private var showingAccount = false

    init(model: AppModel) {
        self.model = model
        browser = model.browser
        downloads = model.downloads
        native = model.native
    }

    var body: some View {
        TabView(selection: $model.selectedTab) {
            learning.tabItem { Label(L10n.text("study"), systemImage: "book") }.tag(0)
            NavigationStack { BookmarksView(model: model) }
                .tabItem { Label(L10n.text("saved"), systemImage: "bookmark") }.tag(1)
            NavigationStack { PlannerView(model: model) }
                .tabItem { Label(L10n.text("planner"), systemImage: "calendar") }.tag(2)
        }
        .tint(brandBlue)
        // Scene capture for native screens; a web page also has its own shield.
        .background { SceneCaptureProbe(state: capture).frame(width: 0, height: 0).accessibilityHidden(true) }
        .overlay {
            if browser.mediaProtection.capture == .active || capture.captured {
                PrivacyProtectionCover(messageKey: "captureBlocked") {
                    #if DEBUG
                    if browser.captureValidationActive {
                        Button("End simulated capture") { browser.endCaptureValidation() }
                            .accessibilityIdentifier("endCaptureValidation")
                    }
                    #endif
                }
                .accessibilityIdentifier("captureProtectionOverlay")
            }
        }
        .onAppear {
            // An explicit PDF download goes into the in-app offline library after the
            // server re-checks access and allowDownload for the current account.
            browser.onDownloadRequested = { contentID in
                Task { await downloads.download(contentID: contentID, browser: browser, currentAccount: { model.verifiedAccountID }) }
            }
        }
        .modifier(DisplayStateLogger(browser: browser))
        .onChange(of: model.verifiedAccountID) { _, account in
            guard let account else { return }
            downloads.accountVerified(account)
            Task { await downloads.recheck(browser: browser, currentAccount: { model.verifiedAccountID }) }
        }
        .sheet(isPresented: $showingAccount) { AccountView(model: model, showing: $showingAccount) }
        .sheet(isPresented: Binding(get: { browser.externalURL != nil }, set: { if !$0 { browser.externalURL = nil } })) {
            if let url = browser.externalURL { ExternalBrowser(url: url).ignoresSafeArea(edges: .bottom) }
        }
        .alert(L10n.text("notice"), isPresented: Binding(get: { model.notice != nil || browser.notice != nil || downloads.notice != nil }, set: {
            if !$0 { model.notice = nil; browser.notice = nil; downloads.notice = nil }
        })) {
            Button(L10n.text("ok"), role: .cancel) { model.notice = nil; browser.notice = nil; downloads.notice = nil }
        } message: { Text(model.notice ?? browser.notice ?? downloads.notice ?? "") }
    }

    /// Native home and course screens when the server offers them (Build 8);
    /// otherwise, or until the server has answered once, the web learning pages.
    @ViewBuilder private var learning: some View {
        if native.rootIsNative {
            NavigationStack(path: $native.path) {
                NativeHomeView(model: model, native: native, showingAccount: $showingAccount)
                    .navigationDestination(for: LearnRoute.self) { route in
                        switch route {
                        case .course(let slug):
                            NativeCourseView(model: model, native: native, slug: slug, showingAccount: $showingAccount)
                        case .web:
                            WebLearningScreen(model: model, destination: true, showingAccount: $showingAccount) { native.closeWeb() }
                        }
                    }
            }
        } else if native.available == nil {
            NavigationStack {
                ProgressView(L10n.text("loading"))
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .accessibilityIdentifier("learningStarting")
                    .navigationTitle("مدرسة")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar { ToolbarItem(placement: .topBarTrailing) { MenuToolbarButton(showing: $showingAccount) } }
            }
        } else {
            NavigationStack {
                WebLearningScreen(model: model, destination: false, showingAccount: $showingAccount) {}
            }
        }
    }
}

/// The shared WKWebView with its recovery, failure and download overlays. As the
/// Study root (web learning) it keeps the Build 7 behaviour; as a destination
/// above native screens, back walks the page history and then returns to native.
struct WebLearningScreen: View {
    @ObservedObject var model: AppModel
    @ObservedObject private var browser: BrowserController
    @ObservedObject private var downloads: OfflineLibrary
    let destination: Bool
    @Binding var showingAccount: Bool
    let close: () -> Void

    init(model: AppModel, destination: Bool, showingAccount: Binding<Bool>, close: @escaping () -> Void) {
        self.model = model
        browser = model.browser
        downloads = model.downloads
        self.destination = destination
        _showingAccount = showingAccount
        self.close = close
    }

    var body: some View {
        ZStack {
            // One SwiftUI-owned protection container per WKWebView: a
            // replacement view gets a new container and capture observer.
            PlatformWebView(browser: browser)
                .id(ObjectIdentifier(browser.webView))
            if destination && browser.destinationPending && !browser.failure {
                // Not the previous destination's page while the new one starts.
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(.background)
                    .accessibilityIdentifier("openingPage")
            }
            if browser.restoring && !browser.failure {
                VStack(spacing: 12) {
                    ProgressView()
                    Text(L10n.text("restoring")).font(.footnote).foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(.background)
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("restoringPage")
            }
            if browser.failure {
                ContentUnavailableView {
                    Label(L10n.text("connection"), systemImage: "wifi.exclamationmark")
                } description: {
                    Text(L10n.text("connectionBody"))
                } actions: {
                    Button(L10n.text("retry")) { browser.retry() }
                        .buttonStyle(.borderedProminent)
                        .accessibilityIdentifier("retryPage")
                }.background(.background)
            }
            if let value = downloads.progress {
                DownloadProgressRing(value: value)
            }
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            if browser.loading { ProgressView().progressViewStyle(.linear).accessibilityLabel(L10n.text("checking")) }
        }
        .navigationTitle("مدرسة")
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(destination)
        .toolbar {
            // Owner decision (Build 7): no share or reload buttons in the bar.
            // A failed page still shows the Retry overlay; the foreground
            // recovery ladder is unchanged.
            ToolbarItem(placement: .topBarLeading) {
                if destination {
                    Button { if !browser.goBackWithinDestination() { close() } } label: { Image(systemName: "chevron.backward") }
                        .accessibilityLabel(L10n.text("back")).accessibilityIdentifier("webBack")
                } else {
                    Button { browser.webView.goBack() } label: { Image(systemName: "chevron.backward") }
                        .disabled(!browser.canGoBack).accessibilityLabel(L10n.text("back"))
                }
            }
            ToolbarItemGroup(placement: .topBarTrailing) {
                if model.personalSpaceReady, let url = browser.currentURL,
                   browser.policy.bookmarkPath(for: url) != nil, !browser.destinationPending {
                    Button { Task { await model.saveCurrentPage() } } label: { Image(systemName: "bookmark") }
                        .accessibilityLabel(L10n.text("bookmark"))
                }
                MenuToolbarButton(showing: $showingAccount)
            }
        }
    }
}

/// Opaque, not material/blur. Screenshot capture itself is not preventable by
/// this view; the native WebKit container independently covers live capture.
struct PrivacyProtectionCover<Actions: View>: View {
    let messageKey: String
    let actions: Actions

    init(messageKey: String, @ViewBuilder actions: () -> Actions) {
        self.messageKey = messageKey
        self.actions = actions()
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            VStack(spacing: 20) {
                Image(systemName: "lock.shield.fill").font(.largeTitle).accessibilityHidden(true)
                Text(L10n.text("protectedContent")).font(.title2.bold())
                Text(L10n.text(messageKey)).font(.body).multilineTextAlignment(.center)
                actions
            }.padding(32).foregroundStyle(.white)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.black)
        .ignoresSafeArea()
        // Keep a real accessibility container so its identifier does not
        // propagate into the disconnected Debug fixture's child button.
        .accessibilityElement(children: .contain)
    }
}

extension PrivacyProtectionCover where Actions == EmptyView {
    init(messageKey: String) { self.init(messageKey: messageKey) { EmptyView() } }
}

/// Logs display-relevant state for the tester-only technical report: appearance,
/// SwiftUI redaction reasons (privacySensitive only acts if the system applies
/// .privacy) and whether the native placeholder or failure view is shown.
private struct DisplayStateLogger: ViewModifier {
    @ObservedObject var browser: BrowserController
    @Environment(\.redactionReasons) private var redactionReasons
    @Environment(\.colorScheme) private var colorScheme

    func body(content: Content) -> some View {
        content
            .onAppear { logEnvironment() }
            .onChange(of: colorScheme) { _, _ in logEnvironment() }
            .onChange(of: redactionReasons) { _, _ in logEnvironment() }
            .onChange(of: browser.restoring) { _, shown in browser.diagnostics.record("ui.restoring", "shown=\(shown)") }
            .onChange(of: browser.failure) { _, shown in browser.diagnostics.record("ui.failure", "shown=\(shown)") }
    }

    private func logEnvironment() {
        browser.diagnostics.record("ui.environment", "dark=\(colorScheme == .dark) redaction=\(redactionReasons.rawValue)")
    }
}

struct IdentityGate: View {
    @ObservedObject var model: AppModel
    var body: some View {
        if case .checking = model.identity {
            VStack(spacing: 24) {
                ProgressView(L10n.text("checking"))
                    .accessibilityIdentifier("checkingAccount")
                Button(L10n.text("signIn")) { model.openWebsite(path: "/login") }
                    .buttonStyle(.borderedProminent)
            }.frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            ContentUnavailableView {
                Label(L10n.text("verifyAccount"), systemImage: "person.badge.key")
            } description: {
                switch model.identity {
                case .checking: Text(L10n.text("checking"))
                case .signedOut: Text(L10n.text("signInRequired"))
                case .phoneRequired: Text(L10n.text("verifyPhone"))
                case .unsupportedRole: Text(L10n.text("studentOnly"))
                default: Text(L10n.text("offlineAccount"))
                }
            } actions: {
                Button(L10n.text("signIn")) { model.openWebsite(path: "/login") }
                    .buttonStyle(.borderedProminent)
                Button(L10n.text("retry")) { Task { await model.refreshIdentity() } }
            }
        }
    }
}

struct BookmarksView: View {
    @ObservedObject var model: AppModel
    var body: some View {
        Group {
            if !model.personalSpaceReady { IdentityGate(model: model) }
            else if model.snapshot.bookmarks.isEmpty {
                ContentUnavailableView(L10n.text("savedEmpty"), systemImage: "bookmark", description: Text(L10n.text("savedBody")))
            } else {
                List {
                    ForEach(model.snapshot.bookmarks) { bookmark in
                        Button { model.openBookmark(bookmark) } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                Text(bookmark.title).font(.headline)
                                Text(bookmark.createdAt, style: .date).font(.caption).foregroundStyle(.secondary)
                            }.padding(.vertical, 6).frame(maxWidth: .infinity, alignment: .leading)
                        }.swipeActions {
                            Button(L10n.text("delete"), role: .destructive) { Task { await model.deleteBookmark(bookmark) } }
                        }
                    }
                }
            }
        }
        .privacySensitive() // Personal list only; the web host is not redacted.
        .navigationTitle(L10n.text("saved")).navigationBarTitleDisplayMode(.inline)
    }
}

// PlannerView, NewRevisionView and the suggested plans live in PlannerViews.swift.

/// Native menu (☰): the allowed learning and account destinations of the website's
/// student menu, without purchase, activation codes or the forum.
struct AccountView: View {
    @ObservedObject var model: AppModel
    @Binding var showing: Bool
    @State private var confirmingLogout = false
    @State private var showingDiagnostics = false

    private func go(_ path: String) {
        showing = false
        model.openWebsite(path: path)
    }

    private func row(_ key: String, _ icon: String, _ path: String) -> some View {
        Button { go(path) } label: { Label(L10n.text(key), systemImage: icon) }
    }

    var body: some View {
        NavigationStack {
            List {
                Section(L10n.text("menuAccount")) {
                    row("menuNotifications", "bell", "/student/notifications")
                    row("profile", "person.crop.circle", "/student/profile#delete")
                    row("support", "lifepreserver", "/student/support")
                    row("privacy", "hand.raised", "/privacy")
                    if !model.personalSpaceReady {
                        row("signIn", "person.badge.key", "/login")
                    }
                    Button(role: .destructive) { confirmingLogout = true } label: {
                        Label(L10n.text("logout"), systemImage: "rectangle.portrait.and.arrow.right")
                    }
                    .disabled(model.busy)
                }
                Section(L10n.text("menuLearning")) {
                    row("menuHome", "house", "/ios")
                    row("menuVideos", "play.rectangle", "/student/videos")
                    row("menuFiles", "doc", "/student/files")
                    NavigationLink {
                        OfflineDownloadsView(library: model.downloads)
                    } label: {
                        Label(L10n.text("downloads"), systemImage: "arrow.down.circle")
                    }
                    .accessibilityIdentifier("offlineDownloads")
                    row("menuExams", "doc.text", "/student/exams")
                    row("menuBac", "books.vertical", "/bac")
                    row("menuTrain", "gamecontroller", "/student/play")
                    row("menuClassroom", "person.3", "/student/classroom")
                    row("menuProgress", "chart.bar", "/student/progress")
                }
                if ForegroundDiagnostics.isAvailable {
                    Section {
                        Button(L10n.text("diagnostics")) { showingDiagnostics = true }
                            .accessibilityIdentifier("foregroundDiagnostics")
                    } footer: { Text(L10n.text("diagnosticsFooter")) }
                }
                Section {
                    Text(L10n.text("studyOnly")).font(.footnote).foregroundStyle(.secondary)
                }
            }
            .navigationTitle(L10n.text("menu"))
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showingDiagnostics) { DiagnosticsView(diagnostics: model.browser.diagnostics) }
            // WebKit media state (none/playing/paused/suspended) at the moment a
            // tester opens the menu after a player did not start; no URL or id.
            .onAppear { model.browser.recordMediaState("menu") }
            .toolbar { Button(L10n.text("ok")) { showing = false } }
            .confirmationDialog(L10n.text("logout"), isPresented: $confirmingLogout, titleVisibility: .visible) {
                Button(L10n.text("logout"), role: .destructive) { showing = false; Task { await model.logout() } }
                Button(L10n.text("cancel"), role: .cancel) {}
            } message: { Text(L10n.text("logoutBody")) }
        }
    }
}
