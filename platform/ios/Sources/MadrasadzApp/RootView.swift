import SwiftUI
import MadrasadzCore

/// The student's choice of appearance, kept on this phone: follow the iPhone, light or dark.
enum Appearance: String, CaseIterable, Identifiable {
    case system, light, dark
    var id: String { rawValue }
    var scheme: ColorScheme? { self == .light ? .light : self == .dark ? .dark : nil }
    var title: String { L10n.text(self == .system ? "appearanceSystem" : self == .light ? "appearanceLight" : "appearanceDark") }
}

struct RootView: View {
    @ObservedObject var model: AppModel
    @AppStorage("appearance") private var appearance = Appearance.system.rawValue

    var body: some View {
        Group {
            switch model.phase {
            case .launching:
                ZStack {
                    Brand.navy.ignoresSafeArea()
                    ProgressView().tint(.white)
                }
            case .signedOut:
                LoginView(model: model)
            case .ready:
                MainTabs(model: model)
            }
        }
        .tint(Brand.blue)
        .preferredColorScheme(Appearance(rawValue: appearance)?.scheme)
        .alert(L10n.text("notice"), isPresented: Binding(get: { model.notice != nil }, set: { if !$0 { model.notice = nil } })) {
            Button(L10n.text("ok"), role: .cancel) { model.notice = nil }
        } message: {
            Text(model.notice ?? "")
        }
    }
}

// MARK: - Sign in

struct LoginView: View {
    @ObservedObject var model: AppModel
    @State private var identifier = ""
    @State private var password = ""
    @State private var error: String?
    @State private var working = false
    @State private var signingUp = false
    @FocusState private var focus: Field?
    @Environment(\.openURL) private var openURL

    private enum Field { case identifier, password }

    var body: some View {
        ScrollView {
            VStack(spacing: 22) {
                VStack(spacing: 10) {
                    Image("BrandLogo").resizable().scaledToFit().frame(width: 230, height: 77)
                        .accessibilityHidden(true)
                    Text(L10n.text("appName")).font(.largeTitle.bold()).foregroundStyle(.white)
                    Text(L10n.text("appTagline")).font(.headline).foregroundStyle(.white.opacity(0.85))
                }
                .padding(.top, 36)

                VStack(alignment: .leading, spacing: 14) {
                    Text(L10n.text("signIn")).font(.title2.bold())
                    TextField(L10n.text("loginIdentifier"), text: $identifier)
                        .textContentType(.username)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .submitLabel(.next)
                        .focused($focus, equals: .identifier)
                        .onSubmit { focus = .password }
                        .padding(14)
                        .background(Color(.tertiarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
                        .accessibilityIdentifier("loginIdentifier")
                    SecureField(L10n.text("loginPassword"), text: $password)
                        .textContentType(.password)
                        // Passwords on the site are typed in Latin letters: open the Latin keyboard
                        // even when the phone's own keyboard is Arabic.
                        .keyboardType(.asciiCapable)
                        .submitLabel(.go)
                        .focused($focus, equals: .password)
                        .onSubmit { Task { await submit() } }
                        .padding(14)
                        .background(Color(.tertiarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
                        .accessibilityIdentifier("loginPassword")
                    if let error {
                        Label(error, systemImage: "exclamationmark.circle.fill")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(Brand.danger)
                            .accessibilityIdentifier("loginError")
                    }
                    Button {
                        Task { await submit() }
                    } label: {
                        HStack {
                            if working { ProgressView().tint(.white) }
                            Text(L10n.text("signIn")).font(.headline)
                        }
                        .frame(maxWidth: .infinity, minHeight: 50)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Brand.blue)
                    .disabled(working)
                    .accessibilityIdentifier("loginSubmit")
                    HStack {
                        Text(L10n.text("loginHint")).font(.footnote).foregroundStyle(.secondary)
                        Spacer(minLength: 8)
                        Button(L10n.text("forgotPassword")) { open("/forgot-password") }
                            .font(.footnote.weight(.semibold))
                    }
                    Divider().padding(.vertical, 2)
                    Button {
                        signingUp = true
                    } label: {
                        Label(L10n.text("register"), systemImage: "person.crop.circle.badge.plus")
                            .font(.headline)
                            .frame(maxWidth: .infinity, minHeight: 46)
                    }
                    .buttonStyle(.bordered)
                    .tint(Brand.blue)
                    .accessibilityIdentifier("openSignup")
                }
                .card()
                .padding(.horizontal, 16)

                Button(L10n.text("privacy")) { open("/privacy") }
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.85))
                    .padding(.bottom, 24)
            }
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(LinearGradient(colors: [Brand.navy, Brand.blue], startPoint: .top, endPoint: .bottom).ignoresSafeArea())
        .sheet(isPresented: $signingUp) { NavigationStack { SignupView(model: model) } }
    }

    /// The password reset page and the privacy policy open in Safari; accounts are created here.
    private func open(_ path: String) {
        if let url = model.api.url(path) { openURL(url) }
    }

    private func submit() async {
        guard !working else { return }
        focus = nil
        working = true
        error = await model.login(identifier: identifier, password: password)
        working = false
        // Cleared after every attempt: a refused password is typed again from scratch.
        password = ""
    }
}

// MARK: - Tabs

struct MainTabs: View {
    @ObservedObject var model: AppModel
    @ObservedObject private var play: PlayModel

    init(model: AppModel) {
        self.model = model
        play = model.play
    }

    var body: some View {
        TabView(selection: $model.selectedTab) {
            NavigationStack { HomeView(model: model) }
                .tabItem { Label(L10n.text("tabHome"), systemImage: "house.fill") }
                .tag(AppTab.home)
            NavigationStack { PlayHomeView(model: model, play: play) }
                .tabItem { Label("PLAY", systemImage: "gamecontroller.fill") }
                .badge(play.pendingCount)
                .tag(AppTab.play)
            NavigationStack { OfflineDownloadsView(library: model.downloads) }
                .tabItem { Label(L10n.text("tabFiles"), systemImage: "folder.fill") }
                .tag(AppTab.library)
            NavigationStack { PlannerView(model: model) }
                .tabItem { Label(L10n.text("tabPlan"), systemImage: "calendar") }
                .tag(AppTab.planner)
            NavigationStack { AccountView(model: model) }
                .tabItem { Label(L10n.text("tabAccount"), systemImage: "person.crop.circle") }
                .tag(AppTab.account)
        }
    }
}

/// Shown by the planner while the personal space is not open (kept from the previous app).
struct IdentityGate: View {
    @ObservedObject var model: AppModel

    var body: some View {
        ContentUnavailableView {
            Label(L10n.text("checking"), systemImage: "person.crop.circle.badge.clock")
        } description: {
            Text(L10n.text("signInRequired"))
        }
    }
}

// MARK: - Account

struct AccountView: View {
    @ObservedObject var model: AppModel
    @ObservedObject private var play: PlayModel
    @AppStorage("appearance") private var appearance = Appearance.system.rawValue
    @State private var confirmLogout = false
    @State private var deleting = false
    @Environment(\.openURL) private var openURL

    init(model: AppModel) {
        self.model = model
        play = model.play
    }

    var body: some View {
        List {
            Section {
                HStack(spacing: 14) {
                    Image(systemName: "person.crop.circle.fill").font(.system(size: 46)).foregroundStyle(Brand.blue)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(model.displayName ?? L10n.text("student")).font(.headline)
                        if let email = model.session?.email, !email.isEmpty {
                            Text(email).font(.footnote).foregroundStyle(.secondary).environment(\.layoutDirection, .leftToRight)
                        }
                    }
                }
                .padding(.vertical, 6)
            }
            Section(L10n.text("appearance")) {
                Picker(L10n.text("appearance"), selection: $appearance) {
                    ForEach(Appearance.allCases) { Text($0.title).tag($0.rawValue) }
                }
                .pickerStyle(.segmented)
                .accessibilityIdentifier("appearancePicker")
            }
            Section(L10n.text("offlineSection")) {
                LabeledContent(L10n.text("connectionStatus"), value: model.online ? L10n.text("onlineNow") : L10n.text("offlineNow"))
                LabeledContent(L10n.text("savedSets"), value: "\(play.downloaded.count)")
                LabeledContent(L10n.text("savedFiles"), value: "\(model.downloads.documents.count)")
                if play.pendingCount > 0 {
                    Button {
                        Task { await play.sync() }
                    } label: {
                        Label(String(format: L10n.text("pendingSync"), play.pendingCount), systemImage: "arrow.triangle.2.circlepath")
                    }
                    .disabled(play.syncing || !model.online)
                }
            }
            Section {
                Button { open("/privacy") } label: { Label(L10n.text("privacy"), systemImage: "hand.raised") }
            }
            Section {
                Button(role: .destructive) { confirmLogout = true } label: {
                    Label(L10n.text("logout"), systemImage: "rectangle.portrait.and.arrow.right")
                }
                .accessibilityIdentifier("logoutButton")
                Button(role: .destructive) { deleting = true } label: {
                    Label(L10n.text("deleteAccount"), systemImage: "trash")
                }
                .accessibilityIdentifier("deleteAccountButton")
            } footer: {
                Text(L10n.text("deleteAccountFooter"))
            }
            Section {
                Text(appVersion).font(.footnote).foregroundStyle(.secondary).frame(maxWidth: .infinity)
            }
        }
        .navigationTitle(L10n.text("tabAccount"))
        .confirmationDialog(L10n.text("logout"), isPresented: $confirmLogout, titleVisibility: .visible) {
            Button(L10n.text("logout"), role: .destructive) { Task { await model.logout() } }
            Button(L10n.text("cancel"), role: .cancel) {}
        } message: {
            Text(L10n.text("logoutNative"))
        }
        .sheet(isPresented: $deleting) { DeleteAccountView(model: model) }
    }

    private var appVersion: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1"
        return "مدرسة — Madrasadz \(version) (\(build))"
    }

    private func open(_ path: String) {
        if let url = model.api.url(path) { openURL(url) }
    }
}

struct DeleteAccountView: View {
    @ObservedObject var model: AppModel
    @State private var password = ""
    @State private var understood = false
    @State private var error: String?
    @State private var working = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Label(L10n.text("deleteAccountWarning"), systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(Brand.danger)
                    Text(L10n.text("deleteAccountBody")).font(.callout)
                }
                Section {
                    SecureField(L10n.text("loginPassword"), text: $password)
                        .textContentType(.password)
                        .keyboardType(.asciiCapable)
                        .accessibilityIdentifier("deletePassword")
                    Toggle(L10n.text("deleteAccountUnderstood"), isOn: $understood)
                        .accessibilityIdentifier("deleteUnderstood")
                    if let error {
                        Text(error).font(.footnote).foregroundStyle(Brand.danger)
                    }
                }
                Section {
                    Button(role: .destructive) {
                        Task {
                            working = true
                            error = await model.deleteAccount(password: password)
                            working = false
                            if error == nil { dismiss() }
                        }
                    } label: {
                        HStack {
                            if working { ProgressView() }
                            Text(L10n.text("deleteAccountAction")).fontWeight(.bold)
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .disabled(!understood || password.isEmpty || working || !model.online)
                    .accessibilityIdentifier("deleteConfirm")
                } footer: {
                    if !model.online { Text(L10n.text("nativeOfflineBody")) }
                }
            }
            .navigationTitle(L10n.text("deleteAccount"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(L10n.text("cancel")) { dismiss() } }
            }
        }
    }
}
