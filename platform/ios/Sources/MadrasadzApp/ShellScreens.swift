import SwiftUI
import MadrasadzCore

// Root screens of the bottom-bar destinations other than «الرئيسية». They read
// the same iOS API home answer as the home screen; nothing is invented: what
// the API does not return (names, counts, orders) is not shown.

// MARK: - Shared page pieces

/// The site's page body: `px-4 py-6` on the background colour.
struct SitePage<Content: View>: View {
    let content: Content
    init(@ViewBuilder content: () -> Content) { self.content = content() }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) { content }
                .padding(.horizontal, 16)
                .padding(.vertical, 24)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Brand.background)
    }
}

/// The site's `PageHeader`: a 28 pt title and a muted description.
struct SitePageHeader: View {
    let title: String
    var description: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.title.bold())
                .foregroundStyle(Brand.foreground)
                .accessibilityAddTraits(.isHeader)
            if let description {
                Text(description).font(.subheadline).foregroundStyle(Brand.mutedForeground)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// The home answer for a destination: placeholders while the account is
/// checked, the shared failure card, or the content. Without native learning
/// (older server, no answer yet) it points to the web learning root at Home.
struct NativeHomeContent<Content: View>: View {
    @ObservedObject var model: AppModel
    @ObservedObject var native: NativeLearningModel
    let content: (NativeHome) -> Content

    init(model: AppModel, native: NativeLearningModel, @ViewBuilder content: @escaping (NativeHome) -> Content) {
        self.model = model
        self.native = native
        self.content = content
    }

    var body: some View {
        if !native.rootIsNative {
            if native.available == nil {
                NativeLoadingView()
            } else {
                NoticeCard(symbol: "house", title: L10n.text("nativeUnavailableTitle"), message: L10n.text("nativeUnavailableBody")) {
                    Button(L10n.text("tab.home")) { model.selectTab(.home) }
                        .buttonStyle(SiteButtonStyle(kind: .primary))
                        .accessibilityIdentifier("nativeUnavailableHome")
                }
            }
        } else if native.accountKey == nil {
            NativeLoadingView()
        } else {
            switch native.home {
            case .idle, .loading: NativeLoadingView()
            case .failed(let failure):
                FailureCard(failure: failure, model: model, native: native) { await native.retryHome() }
            case .loaded(let home): content(home)
            }
        }
    }
}

private extension View {
    /// Pull to refresh and the first load of the shared home answer.
    func loadsNativeHome(_ native: NativeLearningModel) -> some View {
        refreshable { if native.rootIsNative { await native.retryHome() } }
            .task(id: native.accountKey) { if native.rootIsNative { await native.loadHomeIfNeeded() } }
    }
}

/// One row of a card list (account, explore): tinted icon, title, chevron.
struct SiteRowLabel: View {
    let symbol: String
    let title: String
    var destructive = false

    var body: some View {
        let tint = destructive ? Brand.destructive : Brand.primary
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 17, weight: .medium))
                .foregroundStyle(tint)
                .frame(width: 36, height: 36)
                .background(tint.opacity(0.12), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                .accessibilityHidden(true)
            Text(title)
                .font(.body.weight(.semibold))
                .foregroundStyle(destructive ? Brand.destructive : Brand.foreground)
                .multilineTextAlignment(.leading)
            Spacer(minLength: 8)
            if !destructive {
                Image(systemName: "chevron.forward")
                    .font(.footnote.bold())
                    .foregroundStyle(Brand.mutedForeground)
                    .accessibilityHidden(true)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .frame(minHeight: 56)
        .contentShape(Rectangle())
    }
}

/// A titled card holding rows separated by the border colour.
private struct SiteRowGroup<Rows: View>: View {
    var title: String? = nil
    let rows: Rows

    init(title: String? = nil, @ViewBuilder rows: () -> Rows) {
        self.title = title
        self.rows = rows()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let title {
                Text(title)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Brand.mutedForeground)
                    .padding(.horizontal, 4)
                    .accessibilityAddTraits(.isHeader)
            }
            VStack(spacing: 0) { rows }
                .siteCard()
        }
    }
}

private struct RowDivider: View {
    var body: some View { Brand.border.frame(height: 1).padding(.leading, 60) }
}

// MARK: - دروسي

/// «دروسي» (`/student/lessons`): the lessons hub tabs and the free lessons the
/// API returns (series and single lessons). Videos and files keep their pages.
struct LessonsTabView: View {
    @ObservedObject var model: AppModel
    @ObservedObject var native: NativeLearningModel

    var body: some View {
        SitePage {
            SiteHubTabs(items: [
                .init(id: "hub.lessons", title: ShellTab.lessons.title, selected: true) {},
                .init(id: "hub.videos", title: L10n.text("menuVideos"), selected: false) { model.openWebsite(path: "/student/videos") },
                .init(id: "hub.files", title: L10n.text("menuFiles"), selected: false) { model.openWebsite(path: "/student/files") }
            ])
            SitePageHeader(title: ShellTab.lessons.title, description: L10n.text("lessonsIntro"))
            NativeHomeContent(model: model, native: native) { home in
                lessons(home.freeLessons)
            }
        }
        .loadsNativeHome(native)
    }

    @ViewBuilder private func lessons(_ entries: [NativeHome.FreeEntry]) -> some View {
        let groups = entries.filter { if case .group = $0 { return true }; return false }
        let singles: [NativeHome.LessonLink] = entries.compactMap { if case .single(let link) = $0 { return link }; return nil }
        if entries.isEmpty {
            Card { Text(L10n.text("noFreeLessons")).font(.subheadline).foregroundStyle(Brand.mutedForeground) }
        }
        if !groups.isEmpty {
            VStack(spacing: 0) {
                ForEach(Array(groups.enumerated()), id: \.element.id) { index, entry in
                    if case .group(let heading, let detail, let items) = entry {
                        NavigationLink(value: LearnRoute.collection(entry.id)) {
                            CollectionRow(symbol: "rectangle.stack.fill", tint: Brand.success, title: heading, subtitle: detail, count: items.count)
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("freeCollection")
                        if index < groups.count - 1 { Brand.border.frame(height: 1).padding(.leading, 66) }
                    }
                }
            }
            .siteCard()
        }
        if !singles.isEmpty {
            VStack(spacing: 0) {
                ForEach(Array(singles.enumerated()), id: \.element.id) { index, link in
                    Button { native.openLesson(slug: link.slug) } label: { LessonLinkRow(link: link) }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("lessonsSingle")
                    if index < singles.count - 1 { Brand.border.frame(height: 1).padding(.leading, 66) }
                }
            }
            .siteCard()
        }
    }
}

// MARK: - استكشف

/// «استكشف»: on the website this button opens the course catalogue, a store
/// page the iPhone app does not offer (study-only presentation, guideline
/// 3.1.1). In the same place the app opens the practice tools the server
/// lists for the account, and the bac bank.
struct ExploreTabView: View {
    @ObservedObject var model: AppModel
    @ObservedObject var native: NativeLearningModel

    var body: some View {
        SitePage {
            SitePageHeader(title: ShellTab.explore.title, description: L10n.text("exploreIntro"))
            NativeHomeContent(model: model, native: native) { home in
                tools(home)
                SiteRowGroup {
                    Button { native.openWeb(path: "/bac") } label: { SiteRowLabel(symbol: "doc.on.doc", title: L10n.text("bacBank")) }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("exploreBacBank")
                }
            }
        }
        .loadsNativeHome(native)
    }

    @ViewBuilder private func tools(_ home: NativeHome) -> some View {
        let styled = home.tools.compactMap { tool -> (tool: NativeHome.Tool, key: String, symbol: String)? in
            guard let style = NativeTool.style(tool.id) else { return nil }
            return (tool, style.key, style.symbol)
        }
        if styled.isEmpty {
            if home.account == nil {
                NoticeCard(symbol: "person.badge.key.fill", title: L10n.text("signIn"), message: L10n.text("exploreSignIn")) {
                    Button(L10n.text("signIn")) { native.openWeb(path: "/login?next=/ios") }
                        .buttonStyle(SiteButtonStyle(kind: .primary))
                        .accessibilityIdentifier("exploreSignIn")
                }
            }
        } else {
            VStack(alignment: .leading, spacing: 16) {
                Text(L10n.text("practiceTitle"))
                    .font(.title2.bold())
                    .foregroundStyle(Brand.foreground)
                    .accessibilityAddTraits(.isHeader)
                Grid(horizontalSpacing: 16, verticalSpacing: 16) {
                    ForEach(Array(stride(from: 0, to: styled.count, by: 2)), id: \.self) { start in
                        GridRow {
                            tile(styled[start])
                            if start + 1 < styled.count {
                                tile(styled[start + 1])
                            } else {
                                Color.clear.gridCellUnsizedAxes([.horizontal, .vertical])
                            }
                        }
                    }
                }
            }
        }
    }

    private func tile(_ entry: (tool: NativeHome.Tool, key: String, symbol: String)) -> some View {
        HomeTile(identifier: "exploreTool." + entry.tool.id, title: L10n.text(entry.key), hint: "",
                 lime: entry.tool.id == "play") {
            Image(systemName: entry.symbol)
        } action: { native.openWeb(path: entry.tool.webPath) }
    }
}

// MARK: - دوراتي

/// «دوراتي» (`/student/courses`, IMG_6713): hub tabs, title, description, the
/// two buttons and the enrolled courses as cards (active first, ended dimmed).
/// The website's «شراء دورة» / «طلباتي» tabs and «اكتشف الدورات المتاحة» /
/// «طلباتي وحالة التوصيل» buttons are store pages; the app keeps their places
/// for study destinations (virtual classroom, progress, practice tools, plan).
struct CoursesTabView: View {
    @ObservedObject var model: AppModel
    @ObservedObject var native: NativeLearningModel

    var body: some View {
        SitePage {
            SiteHubTabs(items: [
                .init(id: "hub.courses", title: L10n.text("myCourses"), selected: true) {},
                .init(id: "hub.classroom", title: L10n.text("menuClassroom"), selected: false) { model.openWebsite(path: "/student/classroom") },
                .init(id: "hub.progress", title: L10n.text("menuProgress"), selected: false) { model.openWebsite(path: "/student/progress") }
            ])
            SitePageHeader(title: L10n.text("myCourses"), description: L10n.text("coursesIntro"))
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 12) { actions }
                VStack(alignment: .leading, spacing: 12) { actions }
            }
            NativeHomeContent(model: model, native: native) { home in
                courses(home)
            }
        }
        .loadsNativeHome(native)
    }

    @ViewBuilder private var actions: some View {
        Button(L10n.text("exploreTools")) { model.selectTab(.explore) }
            .buttonStyle(SiteButtonStyle(kind: .primary))
            .accessibilityIdentifier("coursesExplore")
        NavigationLink(value: LearnRoute.planner) { Label(L10n.text("planner"), systemImage: "calendar") }
            .buttonStyle(SiteButtonStyle(kind: .outline))
            .accessibilityIdentifier("coursesPlanner")
    }

    @ViewBuilder private func courses(_ home: NativeHome) -> some View {
        if home.account == nil {
            NoticeCard(symbol: "person.badge.key.fill", title: L10n.text("signIn"), message: L10n.text("signInToContinue")) {
                Button(L10n.text("signIn")) { native.openWeb(path: "/login?next=/ios") }
                    .buttonStyle(SiteButtonStyle(kind: .primary))
                    .accessibilityIdentifier("coursesSignIn")
            }
        } else if home.courses.isEmpty {
            VStack(spacing: 12) {
                Image(systemName: "book.closed")
                    .font(.system(size: 24, weight: .medium))
                    .foregroundStyle(Brand.onSecondary)
                    .frame(width: 56, height: 56)
                    .background(Brand.secondary, in: Circle())
                    .accessibilityHidden(true)
                Text(L10n.text("noCoursesTitle")).font(.headline).foregroundStyle(Brand.foreground)
                Text(L10n.text("noCourses")).font(.subheadline).foregroundStyle(Brand.mutedForeground)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(24)
            .siteCard()
        } else {
            let ordered = home.courses.filter { $0.status == .active } + home.courses.filter { $0.status != .active }
            ForEach(ordered) { course in
                CourseTile(course: course)
            }
        }
    }
}

/// The website's course card on «دوراتي». Videos and lesson counts, the next
/// live session and covers are not in the iOS API, so they are not shown.
private struct CourseTile: View {
    let course: NativeHome.Course

    var body: some View {
        let expired = course.status != .active
        let shape = RoundedRectangle(cornerRadius: 18, style: .continuous)
        VStack(alignment: .leading, spacing: 0) {
            ZStack {
                LinearGradient(colors: [Brand.primary.opacity(0.2), Brand.primary.opacity(0.05)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
                Image(systemName: "book.closed")
                    .font(.system(size: 36, weight: .medium))
                    .foregroundStyle(Brand.primary)
            }
            .aspectRatio(16.0 / 7.0, contentMode: .fit)
            .frame(maxWidth: .infinity)
            .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top, spacing: 8) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(course.title).font(.body.bold()).foregroundStyle(Brand.foreground)
                        let line = [course.teacherName, course.season].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
                        if !line.isEmpty { Text(line).font(.subheadline).foregroundStyle(Brand.mutedForeground) }
                    }
                    Spacer(minLength: 4)
                    Text(L10n.text(expired ? "courseEndedBadge" : "courseActiveBadge"))
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(expired ? Brand.mutedForeground : Brand.success)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background((expired ? Brand.muted : Brand.success.opacity(0.15)), in: Capsule())
                }
                if let ends = NativeDates.day(course.accessEndsOn) {
                    Label(String(format: L10n.text("accessEnds"), ends), systemImage: "clock")
                        .font(.caption)
                        .foregroundStyle(Brand.mutedForeground)
                }
                if expired {
                    Text(L10n.text("courseEndedBody")).font(.caption).foregroundStyle(Brand.mutedForeground)
                } else {
                    NavigationLink(value: LearnRoute.course(course.slug)) {
                        Text(L10n.text(course.termsAccepted ? "courseEnter" : "courseTermsEnter"))
                    }
                    .buttonStyle(SiteButtonStyle(kind: course.termsAccepted ? .primary : .outline, fullWidth: true))
                    .accessibilityIdentifier("courseEnter")
                }
            }
            .padding(20)
        }
        .clipShape(shape)
        .siteCard()
        .opacity(expired ? 0.7 : 1)
        .grayscale(expired ? 1 : 0)
        .accessibilityElement(children: .contain)
    }
}

// MARK: - حسابي

/// «حسابي» (`/student/profile`): the account pages of the website and the
/// personal space of this device (bookmarks, revision plan, downloads), which
/// were tabs of their own before the site shell. Nothing is removed.
struct AccountTabView: View {
    @ObservedObject var model: AppModel
    @State private var confirmingLogout = false
    @State private var showingDiagnostics = false

    var body: some View {
        SitePage {
            SitePageHeader(title: ShellTab.account.title, description: L10n.text("accountIntro"))
            SiteRowGroup(title: L10n.text("menuAccount")) {
                if !model.personalSpaceReady {
                    row("person.badge.key", "signIn", "account.signIn", "/login")
                    RowDivider()
                }
                row("bell", "menuNotifications", "account.notifications", "/student/notifications")
                RowDivider()
                row("person.crop.circle", "profile", "account.profile", "/student/profile#delete")
                RowDivider()
                row("lifepreserver", "support", "account.support", "/student/support")
                RowDivider()
                row("hand.raised", "privacy", "account.privacy", "/privacy")
            }
            SiteRowGroup(title: L10n.text("accountPersonal")) {
                link(.saved, "bookmark", "saved", "account.saved")
                RowDivider()
                link(.planner, "calendar", "planner", "account.planner")
                RowDivider()
                link(.downloads, "arrow.down.circle", "downloads", "account.downloads")
            }
            if ForegroundDiagnostics.isAvailable {
                SiteRowGroup {
                    Button { showingDiagnostics = true } label: { SiteRowLabel(symbol: "waveform.path.ecg", title: L10n.text("diagnostics")) }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("account.diagnostics")
                }
            }
            SiteRowGroup {
                Button { confirmingLogout = true } label: {
                    SiteRowLabel(symbol: "rectangle.portrait.and.arrow.right", title: L10n.text("logout"), destructive: true)
                }
                .buttonStyle(.plain)
                .disabled(model.busy)
                .accessibilityIdentifier("account.logout")
            }
            Text(L10n.text("studyOnly")).font(.footnote).foregroundStyle(Brand.mutedForeground)
        }
        .sheet(isPresented: $showingDiagnostics) { DiagnosticsView(diagnostics: model.browser.diagnostics) }
        .confirmationDialog(L10n.text("logout"), isPresented: $confirmingLogout, titleVisibility: .visible) {
            Button(L10n.text("logout"), role: .destructive) { Task { await model.logout() } }
            Button(L10n.text("cancel"), role: .cancel) {}
        } message: { Text(L10n.text("logoutBody")) }
    }

    private func row(_ symbol: String, _ key: String, _ identifier: String, _ path: String) -> some View {
        Button { model.openWebsite(path: path) } label: { SiteRowLabel(symbol: symbol, title: L10n.text(key)) }
            .buttonStyle(.plain)
            .accessibilityIdentifier(identifier)
    }

    private func link(_ route: LearnRoute, _ symbol: String, _ key: String, _ identifier: String) -> some View {
        NavigationLink(value: route) { SiteRowLabel(symbol: symbol, title: L10n.text(key)) }
            .buttonStyle(.plain)
            .accessibilityIdentifier(identifier)
    }
}
