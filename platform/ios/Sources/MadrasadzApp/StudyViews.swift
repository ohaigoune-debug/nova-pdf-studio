import SwiftUI
import MadrasadzCore

private let brandBlue = Color(red: 49/255, green: 85/255, blue: 245/255)

struct StudyRootView: View {
    @ObservedObject var model: AppModel
    @ObservedObject private var browser: BrowserController
    @State private var showingAccount = false
    @StateObject private var exporter = FileExporter()

    init(model: AppModel) { self.model = model; browser = model.browser }

    var body: some View {
        TabView(selection: $model.selectedTab) {
            NavigationStack {
                ZStack {
                    PlatformWebView(browser: browser)
                        .id(ObjectIdentifier(browser.webView))
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
                    if exporter.busy {
                        ProgressView(L10n.text("share")).padding(24).background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18))
                    }
                }
                .safeAreaInset(edge: .top, spacing: 0) {
                    if browser.loading { ProgressView().progressViewStyle(.linear).accessibilityLabel(L10n.text("checking")) }
                }
                .navigationTitle("مدرسة")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItemGroup(placement: .topBarLeading) {
                        Button { browser.webView.goBack() } label: { Image(systemName: "chevron.backward") }
                            .disabled(!browser.canGoBack).accessibilityLabel(L10n.text("back"))
                        Button { browser.retry() } label: { Image(systemName: "arrow.clockwise") }
                            .accessibilityLabel(L10n.text("reload"))
                    }
                    ToolbarItemGroup(placement: .topBarTrailing) {
                        if model.personalSpaceReady, let url = browser.currentURL,
                           browser.policy.bookmarkPath(for: url) != nil {
                            Button { Task { await model.saveCurrentPage() } } label: { Image(systemName: "bookmark") }
                                .accessibilityLabel(L10n.text("bookmark"))
                            if let path = browser.policy.bookmarkPath(for: url), let shared = browser.policy.url(forBookmarkPath: path) {
                                ShareLink(item: shared) { Image(systemName: "square.and.arrow.up") }
                                    .accessibilityLabel(L10n.text("share"))
                            }
                        }
                        Button { showingAccount = true } label: { Image(systemName: "person.crop.circle") }
                            .accessibilityLabel(L10n.text("account")).accessibilityIdentifier("accountButton")
                    }
                }
            }.tabItem { Label(L10n.text("study"), systemImage: "book") }.tag(0)
            NavigationStack { BookmarksView(model: model) }
                .tabItem { Label(L10n.text("saved"), systemImage: "bookmark") }.tag(1)
            NavigationStack { PlannerView(model: model) }
                .tabItem { Label(L10n.text("planner"), systemImage: "calendar") }.tag(2)
        }
        .tint(brandBlue)
        .overlay {
            if browser.mediaProtection.capture == .active {
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
            browser.onDownloadRequested = { contentID in
                Task { await exporter.export(contentID: contentID, browser: browser, currentAccount: { model.verifiedAccountID }) }
            }
        }
        .onChange(of: model.verifiedAccountID) { _, _ in exporter.reset() }
        .sheet(item: $exporter.document, onDismiss: { exporter.reset() }) { document in
            DocumentShareSheet(url: document.url) { exporter.reset() }
        }
        .sheet(isPresented: $showingAccount) { AccountView(model: model, showing: $showingAccount) }
        .sheet(isPresented: Binding(get: { browser.externalURL != nil }, set: { if !$0 { browser.externalURL = nil } })) {
            if let url = browser.externalURL { ExternalBrowser(url: url).ignoresSafeArea(edges: .bottom) }
        }
        .alert(L10n.text("notice"), isPresented: Binding(get: { model.notice != nil || browser.notice != nil || exporter.notice != nil }, set: {
            if !$0 { model.notice = nil; browser.notice = nil; exporter.notice = nil }
        })) {
            Button(L10n.text("ok"), role: .cancel) { model.notice = nil; browser.notice = nil; exporter.notice = nil }
        } message: { Text(model.notice ?? browser.notice ?? exporter.notice ?? "") }
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
    }
}

extension PrivacyProtectionCover where Actions == EmptyView {
    init(messageKey: String) { self.init(messageKey: messageKey) { EmptyView() } }
}

struct IdentityGate: View {
    @ObservedObject var model: AppModel
    var body: some View {
        if case .checking = model.identity {
            VStack(spacing: 24) {
                ProgressView(L10n.text("checking"))
                    .accessibilityIdentifier("checkingAccount")
                Button(L10n.text("signIn")) { model.selectedTab = 0; model.browser.open(path: "/login") }
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
                Button(L10n.text("signIn")) { model.selectedTab = 0; model.browser.open(path: "/login") }
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
        }.navigationTitle(L10n.text("saved")).navigationBarTitleDisplayMode(.inline)
    }
}

struct PlannerView: View {
    @ObservedObject var model: AppModel
    @State private var adding = false
    @State private var editing: RevisionTask?
    var body: some View {
        Group {
            if !model.personalSpaceReady { IdentityGate(model: model) }
            else if model.snapshot.tasks.isEmpty {
                ContentUnavailableView {
                    Label(L10n.text("planEmpty"), systemImage: "calendar")
                } description: { Text(L10n.text("planBody")) } actions: {
                    Button(L10n.text("add")) { adding = true }.buttonStyle(.borderedProminent)
                }
            } else {
                List {
                    ForEach(model.snapshot.tasks) { task in
                        HStack(alignment: .top, spacing: 12) {
                            Button {
                                var updated = task
                                updated.completed.toggle()
                                Task { await model.saveTask(updated) }
                            } label: {
                                Image(systemName: task.completed ? "checkmark.circle.fill" : "circle").font(.title2)
                            }.buttonStyle(.plain)
                                .accessibilityLabel(L10n.text(task.completed ? "reopen" : "complete"))
                            VStack(alignment: .leading, spacing: 6) {
                                Text(task.title).font(.headline).strikethrough(task.completed)
                                Text(task.date, format: .dateTime.day().month().hour().minute()).font(.subheadline).foregroundStyle(.secondary)
                                if task.reminderEnabled { Label(L10n.text("reminder"), systemImage: "bell").font(.caption) }
                            }
                            Spacer(minLength: 4)
                            Button { editing = task } label: { Image(systemName: "pencil").frame(minWidth: 44, minHeight: 44) }
                                .buttonStyle(.plain).accessibilityLabel(L10n.text("edit"))
                        }.padding(.vertical, 6)
                        .swipeActions {
                            Button(L10n.text("delete"), role: .destructive) { Task { await model.deleteTask(task) } }
                        }
                    }
                }
            }
        }
        .navigationTitle(L10n.text("planner"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if model.personalSpaceReady {
                Button { adding = true } label: { Image(systemName: "plus") }.accessibilityLabel(L10n.text("add"))
            }
        }
        .sheet(isPresented: $adding) { NewRevisionView(model: model) }
        .sheet(item: $editing) { task in NewRevisionView(model: model, task: task) }
        .onChange(of: model.verifiedAccountID) { _, _ in adding = false; editing = nil }
    }
}

struct NewRevisionView: View {
    @ObservedObject var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var date = Date().addingTimeInterval(3600)
    @State private var reminder = false
    @State private var saving = false
    @State private var editorAccount: String?
    private let original: RevisionTask?

    init(model: AppModel, task: RevisionTask? = nil) {
        self.model = model
        original = task
        _title = State(initialValue: task?.title ?? "")
        _date = State(initialValue: task?.date ?? Date().addingTimeInterval(3600))
        _reminder = State(initialValue: task?.reminderEnabled ?? false)
    }
    var body: some View {
        NavigationStack {
            Form {
                TextField(L10n.text("title"), text: $title, axis: .vertical).lineLimit(1...4)
                DatePicker(L10n.text("date"), selection: $date, in: Date()..., displayedComponents: [.date, .hourAndMinute])
                Toggle(L10n.text("reminder"), isOn: $reminder).disabled(original?.completed == true)
                Text(L10n.text("reminderPrivacy")).font(.footnote).foregroundStyle(.secondary)
            }
            .navigationTitle(L10n.text(original == nil ? "add" : "edit"))
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(L10n.text("cancel")) { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(L10n.text("save")) {
                        saving = true
                        Task {
                            let task = RevisionTask(id: original?.id ?? UUID(), title: title, date: date,
                                completed: original?.completed ?? false, reminderEnabled: reminder)
                            let success = await model.saveTask(task)
                            saving = false
                            if success { dismiss() }
                        }
                    }.disabled(saving || title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || title.count > 200 || !model.personalSpaceReady)
                }
            }
        }
        .onAppear { editorAccount = model.verifiedAccountID }
        .onChange(of: model.verifiedAccountID) { _, account in
            if account != editorAccount { title = ""; dismiss() }
        }
    }
}

struct AccountView: View {
    @ObservedObject var model: AppModel
    @Binding var showing: Bool
    @State private var confirmingLogout = false
    var body: some View {
        NavigationStack {
            List {
                Section {
                    Image("BrandLogo").resizable().scaledToFit().frame(maxWidth: 220)
                        .padding(12).background(.white, in: RoundedRectangle(cornerRadius: 12))
                        .accessibilityLabel("مدرسة — Madrasadz")
                    Text(L10n.text("studyOnly")).font(.footnote)
                }
                Button(L10n.text("profile")) { showing = false; model.selectedTab = 0; model.browser.open(path: "/student/profile#delete") }
                Button(L10n.text("privacy")) { showing = false; model.selectedTab = 0; model.browser.open(path: "/privacy") }
                Button(L10n.text("support")) { showing = false; model.selectedTab = 0; model.browser.open(path: "/student/support") }
                Button(L10n.text("logout"), role: .destructive) { confirmingLogout = true }
                    .disabled(model.busy)
            }.navigationTitle(L10n.text("account"))
                .toolbar { Button(L10n.text("ok")) { showing = false } }
                .confirmationDialog(L10n.text("logout"), isPresented: $confirmingLogout, titleVisibility: .visible) {
                    Button(L10n.text("logout"), role: .destructive) { showing = false; Task { await model.logout() } }
                    Button(L10n.text("cancel"), role: .cancel) {}
                } message: { Text(L10n.text("logoutBody")) }
        }
    }
}
