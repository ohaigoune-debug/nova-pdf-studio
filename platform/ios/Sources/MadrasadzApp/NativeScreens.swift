import SwiftUI
import MadrasadzCore

// Native learning home and course screens (Build 8), in the site's look since
// the site shell (IMG_6714). Content comes from the iOS API v1; tools and every
// other page open in the shared web view.

private let brandBlue = Brand.primary

// MARK: - Presentation

extension NativeCourse.SectionKind {
    var name: String { L10n.text("section." + rawValue) }

    var symbol: String {
        switch self {
        case .lessons: return "book.closed.fill"
        case .videos: return "play.rectangle.fill"
        case .homework: return "pencil.and.list.clipboard"
        case .tests: return "checkmark.seal.fill"
        case .files: return "folder.fill"
        }
    }

    var tint: Color {
        switch self {
        case .lessons: return brandBlue
        case .videos: return .red
        case .homework: return .orange
        case .tests: return .purple
        case .files: return .teal
        }
    }
}

enum ContentKind {
    static func symbol(_ type: String) -> String {
        switch type {
        case "VIDEO": return "play.rectangle.fill"
        case "PDF": return "doc.richtext.fill"
        case "AUDIO": return "waveform"
        case "IMAGE": return "photo.fill"
        case "ARTICLE": return "newspaper.fill"
        case "EXERCISE": return "pencil.and.list.clipboard"
        case "QUIZ": return "checklist"
        default: return "book.pages.fill"
        }
    }

    static func name(_ type: String) -> String {
        let key = "type." + type
        let value = L10n.text(key)
        return value == key ? L10n.text("type.LESSON") : value
    }
}

enum NativeTool {
    static func style(_ id: String) -> (key: String, symbol: String, tint: Color)? {
        switch id {
        case "play": return ("tool.play", "gamecontroller.fill", .purple)
        case "practice": return ("tool.practice", "pencil.and.list.clipboard", .orange)
        case "quizzes": return ("tool.quizzes", "questionmark.circle.fill", .teal)
        case "exams": return ("tool.exams", "doc.text.fill", brandBlue)
        default: return nil
        }
    }
}

enum NativeDates {
    static func day(_ value: String?) -> String? {
        guard let value, value.count >= 10 else { return nil }
        let parser = DateFormatter()
        parser.calendar = Calendar(identifier: .gregorian)
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.timeZone = TimeZone(identifier: "Africa/Algiers")
        parser.dateFormat = "yyyy-MM-dd"
        guard let date = parser.date(from: String(value.prefix(10))) else { return nil }
        return date.formatted(date: .long, time: .omitted)
    }

    static func moment(_ value: String?) -> Date? {
        guard let value else { return nil }
        let precise = ISO8601DateFormatter()
        precise.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return precise.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }
}

// MARK: - Shared pieces

struct MenuToolbarButton: View {
    @Binding var showing: Bool
    var body: some View {
        Button { showing = true } label: { Image(systemName: "line.3.horizontal") }
            .accessibilityLabel(L10n.text("menu")).accessibilityIdentifier("accountButton")
    }
}

struct Card<Content: View>: View {
    let content: Content
    init(@ViewBuilder content: () -> Content) { self.content = content() }
    var body: some View {
        content
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .siteCard()
    }
}

struct SectionTitle: View {
    let text: String
    let symbol: String
    var tint: Color = Brand.primary
    var trailing: String?
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: symbol).foregroundStyle(tint).accessibilityHidden(true)
            Text(text).font(.title3.bold()).foregroundStyle(Brand.foreground)
            Spacer(minLength: 8)
            if let trailing {
                Text(trailing).font(.footnote.weight(.semibold)).foregroundStyle(Brand.mutedForeground)
                    .padding(.horizontal, 10).padding(.vertical, 4)
                    .background(Brand.muted, in: Capsule())
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }
}

struct IconTile: View {
    let symbol: String
    let tint: Color
    var size: CGFloat = 46
    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: size * 0.44, weight: .semibold))
            .foregroundStyle(tint)
            .frame(width: size, height: size)
            .background(tint.opacity(0.14), in: RoundedRectangle(cornerRadius: size * 0.3, style: .continuous))
            .accessibilityHidden(true)
    }
}

/// Placeholder while content loads or the account is being checked: shapes
/// only, so nothing of a previous account can show through.
struct NativeLoadingView: View {
    var body: some View {
        VStack(spacing: 14) {
            RoundedRectangle(cornerRadius: 22).fill(Brand.card).frame(height: 120)
            ForEach(0..<3, id: \.self) { _ in
                RoundedRectangle(cornerRadius: 18).fill(Brand.card).frame(height: 76)
            }
        }
        .overlay { ProgressView() }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(L10n.text("loading"))
        .accessibilityIdentifier("nativeLoading")
    }
}

/// A full-width message with actions (failure, sign-in, phone, terms…).
struct NoticeCard<Actions: View>: View {
    let symbol: String
    let tint: Color
    let title: String
    let message: String
    let actions: Actions

    init(symbol: String, tint: Color = Brand.primary, title: String, message: String, @ViewBuilder actions: () -> Actions) {
        self.symbol = symbol
        self.tint = tint
        self.title = title
        self.message = message
        self.actions = actions()
    }

    var body: some View {
        Card {
            VStack(spacing: 14) {
                IconTile(symbol: symbol, tint: tint, size: 58)
                Text(title).font(.title3.bold()).foregroundStyle(Brand.foreground).multilineTextAlignment(.center)
                Text(message).font(.subheadline).foregroundStyle(Brand.mutedForeground).multilineTextAlignment(.center)
                actions
            }
            .frame(maxWidth: .infinity)
        }
    }
}

/// The failure states shared by the home and course screens.
struct FailureCard: View {
    let failure: NativeFailure
    @ObservedObject var model: AppModel
    @ObservedObject var native: NativeLearningModel
    var signInPath = "/login?next=/ios"
    let retry: () async -> Void

    var body: some View {
        switch failure {
        case .signIn:
            NoticeCard(symbol: "person.badge.key.fill", title: L10n.text("signIn"), message: L10n.text("signInToContinue")) {
                Button(L10n.text("signIn")) { native.openWeb(path: signInPath) }
                    .buttonStyle(SiteButtonStyle(kind: .primary))
            }
        case .phone:
            NoticeCard(symbol: "phone.badge.checkmark", tint: .green, title: L10n.text("phoneTitle"), message: L10n.text("phoneBody")) {
                Button(L10n.text("phoneAction")) { native.openWeb(path: "/ios") }
                    .buttonStyle(SiteButtonStyle(kind: .primary))
            }
        case .role:
            NoticeCard(symbol: "graduationcap.fill", title: L10n.text("studentOnlyTitle"), message: L10n.text("studentOnlyBody")) {
                Button(L10n.text("logout"), role: .destructive) { Task { await model.logout() } }
                    .buttonStyle(SiteButtonStyle(kind: .outline)).disabled(model.busy)
            }
        case .ended:
            NoticeCard(symbol: "clock.badge.xmark", tint: .orange, title: L10n.text("courseEnded"), message: L10n.text("courseEndedBody")) {
                Button(L10n.text("menuHome")) { native.show(.home) }.buttonStyle(SiteButtonStyle(kind: .outline))
            }
        case .notFound:
            NoticeCard(symbol: "questionmark.folder", tint: .secondary, title: L10n.text("courseMissingTitle"), message: L10n.text("courseMissing")) {
                Button(L10n.text("menuHome")) { native.show(.home) }.buttonStyle(SiteButtonStyle(kind: .outline))
            }
        case .offline, .server:
            NoticeCard(symbol: "wifi.exclamationmark", tint: .orange, title: L10n.text("nativeLoadFailed"), message: L10n.text("nativeOfflineBody")) {
                Button(L10n.text("retry")) { Task { await retry() } }
                    .buttonStyle(SiteButtonStyle(kind: .primary))
                    .accessibilityIdentifier("nativeRetry")
            }
        }
    }
}

// MARK: - Home

/// The student home of the website (`/student`, IMG_6714): the dashboard card
/// with «متابعة التعلّم», «ماذا تريد أن تتعلم اليوم؟» with its four cards, the
/// bac bank, «دوراتي» and the free lessons. Purchase links of the website are
/// not shown in the app (study-only presentation, App Store guideline 3.1.1).
struct NativeHomeView: View {
    @ObservedObject var model: AppModel
    @ObservedObject var native: NativeLearningModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                if native.accountKey == nil {
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
            .padding(.horizontal, 16)
            .padding(.vertical, 24)
        }
        .background(Brand.background)
        .refreshable { await native.retryHome() }
        .task(id: native.accountKey) { await native.loadHomeIfNeeded() }
    }

    @ViewBuilder private func content(_ home: NativeHome) -> some View {
        if home.account == nil {
            welcome
        } else {
            dashboard(home)
        }
        HomeLearnGrid(model: model, native: native, home: home)
        Button { native.openWeb(path: "/bac") } label: {
            Label(L10n.text("bacBank"), systemImage: "doc.on.doc")
        }
        .buttonStyle(SiteButtonStyle(kind: .outline))
        .accessibilityIdentifier("homeBacBank")
        if home.account != nil { courses(home.courses) }
        freeLessons(home.freeLessons)
    }

    private var welcome: some View {
        Card {
            VStack(spacing: 16) {
                BrandLogoPlate(width: 164)
                    .accessibilityHidden(true)
                VStack(spacing: 6) {
                    Text(L10n.text("nativeWelcome")).font(.title2.bold()).foregroundStyle(Brand.foreground)
                    Text(L10n.text("nativeWelcomeIntro")).foregroundStyle(Brand.mutedForeground)
                }
                .multilineTextAlignment(.center)
                Button { native.openWeb(path: "/login?next=/ios") } label: {
                    Label(L10n.text("signIn"), systemImage: "person.crop.circle.badge.checkmark")
                }
                .buttonStyle(SiteButtonStyle(kind: .primary, fullWidth: true))
                .accessibilityIdentifier("nativeSignIn")
                HStack(spacing: 4) {
                    Text(L10n.text("nativeNoAccount")).foregroundStyle(Brand.mutedForeground)
                    Button(L10n.text("register")) { native.openWeb(path: "/register") }
                        .fontWeight(.semibold).foregroundStyle(Brand.primary)
                }
                .font(.subheadline)
            }
            .frame(maxWidth: .infinity)
        }
    }

    /// The site's welcome section (`rounded-xl border bg-card p-5`). The iOS API
    /// carries no name, so the heading is the learning space, not «مرحباً، …».
    private func dashboard(_ home: NativeHome) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(L10n.text("studentDashboard")).font(.subheadline).foregroundStyle(Brand.mutedForeground)
            Text(L10n.text("nativeLearnTitle")).font(.title.bold()).foregroundStyle(Brand.foreground)
                .padding(.top, 4)
                .accessibilityAddTraits(.isHeader)
            // «متابعة التعلّم» only with a real link: the first active course.
            if let course = home.courses.first(where: { $0.status == .active }) {
                resume(course).padding(.top, 20)
            } else {
                Text(L10n.text("noCourses")).font(.subheadline).foregroundStyle(Brand.mutedForeground)
                    .padding(.top, 20)
            }
            // The site's «اكتشف الدورات» / «طلباتي» (store and orders) are
            // replaced in the same place by study destinations of the app.
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 8) { shortcuts }
                VStack(alignment: .leading, spacing: 8) { shortcuts }
            }
            .padding(.top, 16)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .siteCard(radius: 22)
    }

    @ViewBuilder private var shortcuts: some View {
        Button { model.selectTab(.explore) } label: { Label(L10n.text("exploreTools"), systemImage: "safari") }
            .buttonStyle(SiteButtonStyle(kind: .outline, compact: true))
            .accessibilityIdentifier("homeExplore")
        NavigationLink(value: LearnRoute.planner) { Label(L10n.text("planner"), systemImage: "calendar") }
            .buttonStyle(SiteButtonStyle(kind: .outline, compact: true))
            .accessibilityIdentifier("homePlanner")
    }

    private func resume(_ course: NativeHome.Course) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(L10n.text("resumeTitle")).font(.subheadline.weight(.semibold)).foregroundStyle(Brand.onSecondary)
            Text(course.title).font(.title3.weight(.semibold)).foregroundStyle(Brand.foreground).lineLimit(2)
            let line = [course.teacherName, course.season].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
            if !line.isEmpty { Text(line).font(.subheadline).foregroundStyle(Brand.mutedForeground) }
            NavigationLink(value: LearnRoute.course(course.slug)) {
                HStack(spacing: 8) {
                    Text(L10n.text("resumeTitle"))
                    Image(systemName: "arrow.forward").accessibilityHidden(true)
                }
            }
            .buttonStyle(SiteButtonStyle(kind: .primary, fullWidth: true))
            .accessibilityIdentifier("resumeCourse")
            .padding(.top, 12)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Brand.secondary, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    /// The site's «دوراتي» card: active courses with «دخول». Its «شراء دورة»
    /// link becomes «عرض الكل», which opens the «دوراتي» destination.
    private func courses(_ courses: [NativeHome.Course]) -> some View {
        let active = courses.filter { $0.status == .active }
        return VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(L10n.text("myCourses")).font(.title3.bold()).foregroundStyle(Brand.foreground)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: 8)
                Button(L10n.text("viewAll")) { model.selectTab(.courses) }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Brand.primary)
                    .frame(minHeight: 44)
                    .accessibilityIdentifier("homeAllCourses")
            }
            if active.isEmpty {
                Text(L10n.text("noCourses")).font(.subheadline).foregroundStyle(Brand.mutedForeground)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(active.enumerated()), id: \.element.id) { index, course in
                        NavigationLink(value: LearnRoute.course(course.slug)) { HomeCourseRow(course: course) }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("courseCard")
                        if index < active.count - 1 { Brand.border.frame(height: 1) }
                    }
                }
            }
        }
        .padding(20)
        .siteCard()
    }

    /// Owner request (Build 9): no long chip grids. Each series is one row that opens
    /// its own screen; loose lessons show the newest three and a «show all» row.
    @ViewBuilder private func freeLessons(_ entries: [NativeHome.FreeEntry]) -> some View {
        let groups = entries.filter { if case .group = $0 { return true }; return false }
        let singles: [NativeHome.LessonLink] = entries.compactMap { if case .single(let link) = $0 { return link }; return nil }
        VStack(alignment: .leading, spacing: 12) {
            SectionTitle(text: L10n.text("freeForAll"), symbol: "gift.fill", tint: Brand.success)
            if entries.isEmpty {
                Card { Text(L10n.text("noFreeLessons")).font(.subheadline).foregroundStyle(Brand.mutedForeground) }
            }
            if !groups.isEmpty {
                VStack(spacing: 0) {
                    ForEach(Array(groups.enumerated()), id: \.element.id) { index, entry in
                        if case .group(let heading, let detail, let items) = entry {
                            NavigationLink(value: LearnRoute.collection(entry.id)) {
                                CollectionRow(symbol: "rectangle.stack.fill", tint: Brand.success, title: heading, subtitle: detail,
                                              count: items.count)
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
                    ForEach(singles.prefix(3)) { link in
                        Button { native.openLesson(slug: link.slug) } label: { LessonLinkRow(link: link) }
                            .buttonStyle(.plain)
                        Brand.border.frame(height: 1).padding(.leading, 66)
                    }
                    NavigationLink(value: LearnRoute.collection(NativeCollection.singlesID)) {
                        HStack {
                            Text(String(format: L10n.text("showAllCount"), singles.count)).font(.subheadline.weight(.semibold))
                                .foregroundStyle(Brand.primary)
                            Spacer()
                            Image(systemName: "chevron.forward").font(.footnote.bold()).foregroundStyle(Brand.mutedForeground)
                        }
                        .padding(.horizontal, 16).padding(.vertical, 14)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("freeShowAll")
                }
                .siteCard()
            }
        }
    }
}

private struct HomeCourseRow: View {
    let course: NativeHome.Course

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(course.title).font(.body.bold()).foregroundStyle(Brand.foreground).multilineTextAlignment(.leading)
                let line = [course.teacherName, course.season].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
                if !line.isEmpty { Text(line).font(.caption).foregroundStyle(Brand.mutedForeground) }
            }
            Spacer(minLength: 8)
            Text(L10n.text("courseEnter"))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Brand.foreground)
                .padding(.horizontal, 14)
                .frame(minHeight: 44)
                .overlay { RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Brand.border, lineWidth: 1) }
        }
        .padding(.vertical, 12)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

/// «ماذا تريد أن تتعلم اليوم؟»: the website's four cards (`tiles` in
/// `app/student/page.tsx`), each a real button. Counts only from the API.
struct HomeLearnGrid: View {
    @ObservedObject var model: AppModel
    @ObservedObject var native: NativeLearningModel
    let home: NativeHome

    var body: some View {
        let active = home.courses.filter { $0.status == .active }.count
        VStack(alignment: .leading, spacing: 16) {
            Text(L10n.text("homeQuestion"))
                .font(.title2.bold())
                .foregroundStyle(Brand.foreground)
                .accessibilityAddTraits(.isHeader)
                .accessibilityIdentifier("homeQuestion")
            Grid(horizontalSpacing: 16, verticalSpacing: 16) {
                GridRow {
                    HomeTile(identifier: "homeTile.lessons", title: L10n.text("tile.lessons"), hint: L10n.text("tile.lessonsHint"), lime: false) {
                        Image(systemName: "book")
                    } action: { model.selectTab(.lessons) }
                    HomeTile(identifier: "homeTile.courses", title: L10n.text("myCourses"),
                             hint: active > 0 ? String(format: L10n.text("tile.coursesActive"), active) : L10n.text("tile.coursesHint"),
                             lime: false) {
                        Image(systemName: "book.closed")
                    } action: { model.selectTab(.courses) }
                }
                GridRow {
                    HomeTile(identifier: "homeTile.exams", title: L10n.text("tile.exams"), hint: L10n.text("tile.examsHint"), lime: false) {
                        // lucide CheckCheck: two overlapping ticks.
                        HStack(spacing: -14) {
                            Image(systemName: "checkmark")
                            Image(systemName: "checkmark")
                        }
                    } action: { native.openWeb(path: "/student/exams") }
                    HomeTile(identifier: "homeTile.play", title: L10n.text("tile.play"), hint: L10n.text("tile.playHint"), lime: true) {
                        Image(systemName: "gamecontroller")
                    } action: { native.openWeb(path: "/student/play") }
                }
            }
        }
    }
}

/// One card of the grid: `min-h-36 rounded-lg border bg-card p-5`, a 56 pt
/// round icon (secondary, or lime for PLAY), an 18 pt title and a 12 pt hint.
struct HomeTile<Icon: View>: View {
    let identifier: String
    let title: String
    let hint: String
    let lime: Bool
    let icon: Icon
    let action: () -> Void
    @ScaledMetric(relativeTo: .headline) private var titleSize: CGFloat = 18

    init(identifier: String, title: String, hint: String, lime: Bool,
         @ViewBuilder icon: () -> Icon, action: @escaping () -> Void) {
        self.identifier = identifier
        self.title = title
        self.hint = hint
        self.lime = lime
        self.icon = icon()
        self.action = action
    }

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 18, style: .continuous)
        Button(action: action) {
            VStack(spacing: 0) {
                icon
                    .font(.system(size: 22, weight: .medium))
                    .foregroundStyle(lime ? Brand.onAccent : Brand.onSecondary)
                    .frame(width: 56, height: 56)
                    .background(lime ? Brand.accent : Brand.secondary, in: Circle())
                Text(title)
                    .font(.system(size: titleSize, weight: .semibold))
                    .foregroundStyle(Brand.foreground)
                    .multilineTextAlignment(.center)
                    .padding(.top, 8)
                if !hint.isEmpty {
                    Text(hint)
                        .font(.caption)
                        .foregroundStyle(Brand.mutedForeground)
                        .multilineTextAlignment(.center)
                }
            }
            .padding(20)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .frame(minHeight: 144)
            .background(Brand.card, in: shape)
            .overlay { shape.strokeBorder(Brand.border, lineWidth: 1) }
            .contentShape(shape)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
        .accessibilityValue(hint)
        .accessibilityIdentifier(identifier)
    }
}

/// A free-lessons collection: a series from the home screen, or all loose lessons.
enum NativeCollection {
    static let singlesID = "singles"

    static func content(_ id: String, in home: NativeHome) -> (title: String, detail: String?, items: [NativeHome.LessonLink])? {
        if id == singlesID {
            let items = home.freeLessons.compactMap { entry -> NativeHome.LessonLink? in
                if case .single(let link) = entry { return link }
                return nil
            }
            return (L10n.text("freeLessonsAll"), nil, items)
        }
        for entry in home.freeLessons where entry.id == id {
            if case .group(let heading, let detail, let items) = entry { return (heading, detail, items) }
        }
        return nil
    }
}

struct CollectionRow: View {
    let symbol: String
    let tint: Color
    let title: String
    let subtitle: String?
    let count: Int

    var body: some View {
        HStack(spacing: 12) {
            IconTile(symbol: symbol, tint: tint, size: 42)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.headline).multilineTextAlignment(.leading)
                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle).font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.leading)
                }
            }
            Spacer(minLength: 4)
            Text(String(format: L10n.text("lessonsCount"), count)).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(Brand.muted, in: Capsule())
            Image(systemName: "chevron.forward").font(.footnote.bold()).foregroundStyle(.tertiary)
        }
        .padding(.horizontal, 12).padding(.vertical, 12)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

struct LessonLinkRow: View {
    let link: NativeHome.LessonLink

    var body: some View {
        HStack(spacing: 12) {
            IconTile(symbol: ContentKind.symbol(link.type), tint: .green, size: 42)
            VStack(alignment: .leading, spacing: 3) {
                Text(link.label).font(.body.weight(.semibold)).multilineTextAlignment(.leading)
                if let summary = link.summary, !summary.isEmpty {
                    Text(summary).font(.caption).foregroundStyle(.secondary).lineLimit(2).multilineTextAlignment(.leading)
                }
            }
            Spacer(minLength: 4)
            Image(systemName: "chevron.forward").font(.footnote.bold()).foregroundStyle(.tertiary)
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

/// One free collection with full, unshortened names and a search field.
struct NativeCollectionView: View {
    @ObservedObject var native: NativeLearningModel
    let id: String
    @Binding var showingAccount: Bool
    @State private var query = ""

    private var content: (title: String, detail: String?, items: [NativeHome.LessonLink])? {
        guard native.accountKey != nil, let home = native.home.value else { return nil }
        return NativeCollection.content(id, in: home)
    }

    var body: some View {
        List {
            if let content {
                if let detail = content.detail, !detail.isEmpty {
                    Section { Text(detail).font(.subheadline).foregroundStyle(Brand.mutedForeground) }
                        .listRowBackground(Brand.card)
                }
                let needle = query.trimmingCharacters(in: .whitespaces)
                let items = needle.isEmpty ? content.items : content.items.filter { $0.label.localizedCaseInsensitiveContains(needle) }
                Section {
                    ForEach(items) { link in
                        Button { native.openLesson(slug: link.slug) } label: { LessonLinkRow(link: link) }
                            .buttonStyle(.plain)
                            .listRowInsets(EdgeInsets(top: 0, leading: 4, bottom: 0, trailing: 4))
                            .listRowBackground(Brand.card)
                            .accessibilityIdentifier("collectionLesson")
                    }
                } footer: {
                    if items.isEmpty { Text(L10n.text("searchEmpty")) }
                }
            } else {
                NativeLoadingView().listRowBackground(Color.clear)
            }
        }
        .listStyle(.insetGrouped)
        .siteListBackground()
        .searchable(text: $query, prompt: L10n.text("searchLessons"))
        .navigationTitle(content?.title ?? "")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { MenuToolbarButton(showing: $showingAccount) } }
    }
}

private struct CourseCard: View {
    let course: NativeHome.Course

    var body: some View {
        Card {
            HStack(spacing: 14) {
                IconTile(symbol: "book.fill", tint: course.status == .active ? brandBlue : .secondary, size: 50)
                VStack(alignment: .leading, spacing: 4) {
                    Text(course.title).font(.headline).multilineTextAlignment(.leading)
                    if course.status == .active {
                        let line = [course.teacherName, course.season].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
                        if !line.isEmpty { Text(line).font(.subheadline).foregroundStyle(.secondary) }
                        if let ends = NativeDates.day(course.accessEndsOn) {
                            Label(String(format: L10n.text("accessEnds"), ends), systemImage: "calendar")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    } else {
                        Label(L10n.text("courseEnded"), systemImage: "clock.badge.xmark")
                            .font(.subheadline).foregroundStyle(.secondary)
                    }
                }
                Spacer(minLength: 4)
                if course.status == .active {
                    Image(systemName: "chevron.forward").font(.footnote.bold()).foregroundStyle(.tertiary)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Course

struct NativeCourseView: View {
    @ObservedObject var model: AppModel
    @ObservedObject var native: NativeLearningModel
    let slug: String
    @Binding var showingAccount: Bool

    private var state: NativeLoad<NativeCourse> { native.course(slug) }
    private var loaded: NativeCourse? { native.accountKey == nil ? nil : state.value }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 20) {
                    if native.accountKey == nil {
                        NativeLoadingView()
                    } else {
                        switch state {
                        case .idle, .loading: NativeLoadingView()
                        case .failed(let failure):
                            FailureCard(failure: failure, model: model, native: native,
                                        signInPath: "/login?next=/ios/course/" + NativeLearningModel.encoded(slug)) {
                                await native.loadCourse(slug)
                            }
                        case .loaded(let course):
                            if course.needsTerms { terms(course) } else { content(course, proxy: proxy) }
                        }
                    }
                }
                .padding(16)
            }
        }
        .background(Brand.background)
        .refreshable { await native.loadCourse(slug) }
        .task(id: native.accountKey) { await native.loadCourseIfNeeded(slug) }
        .navigationTitle(loaded?.course.title ?? "")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                if model.personalSpaceReady, let course = loaded, !course.needsTerms {
                    Button {
                        Task { await model.saveBookmark(title: course.course.title, path: "/ios/course/" + NativeLearningModel.encoded(slug)) }
                    } label: { Image(systemName: "bookmark") }
                        .accessibilityLabel(L10n.text("bookmark"))
                }
                MenuToolbarButton(showing: $showingAccount)
            }
        }
    }

    private func terms(_ course: NativeCourse) -> some View {
        NoticeCard(symbol: "doc.text.magnifyingglass", title: L10n.text("termsTitle"), message: L10n.text("termsBody")) {
            Text(course.course.title).font(.headline).multilineTextAlignment(.center)
            Button(L10n.text("termsAction")) { native.openTerms(slug: slug) }
                .buttonStyle(SiteButtonStyle(kind: .primary))
                .accessibilityIdentifier("nativeTerms")
        }
    }

    @ViewBuilder private func content(_ course: NativeCourse, proxy: ScrollViewProxy) -> some View {
        header(course.course)
        if !course.upcoming.isEmpty { upcoming(course.upcoming) }
        if course.sections.isEmpty {
            Card { Text(L10n.text("courseEmpty")).font(.subheadline).foregroundStyle(.secondary) }
        } else {
            if course.sections.count > 1 { sectionChips(course.sections, proxy: proxy) }
            ForEach(course.sections) { section in
                // No identifier here: on a plain container SwiftUI passes it to
                // every child element, replacing the rows' own identifiers.
                sectionView(section).id(section.kind)
            }
        }
    }

    private func header(_ info: NativeCourse.Info) -> some View {
        Card {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top, spacing: 14) {
                    IconTile(symbol: "book.fill", tint: brandBlue, size: 52)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(info.title).font(.title3.bold())
                        let line = [info.teacherName, info.season].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
                        if !line.isEmpty { Text(line).font(.subheadline).foregroundStyle(.secondary) }
                    }
                }
                if let description = info.description, !description.isEmpty {
                    Text(description).font(.subheadline).foregroundStyle(.secondary).lineLimit(5)
                }
                if let ends = NativeDates.day(info.accessEndsOn) {
                    Label(String(format: L10n.text("accessEnds"), ends), systemImage: "calendar")
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }
        }
    }

    private func upcoming(_ sessions: [NativeCourse.Upcoming]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionTitle(text: L10n.text("upcomingTitle"), symbol: "calendar.badge.clock", tint: .pink)
            Card {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(Array(sessions.enumerated()), id: \.offset) { _, session in
                        HStack(spacing: 12) {
                            IconTile(symbol: "video.fill", tint: .pink, size: 38)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(session.title).font(.subheadline.weight(.semibold))
                                if let date = NativeDates.moment(session.startsAt) {
                                    Text(date.formatted(date: .abbreviated, time: .shortened)).font(.caption).foregroundStyle(.secondary)
                                }
                            }
                            Spacer(minLength: 0)
                            if let minutes = session.durationMinutes {
                                Text(String(format: L10n.text("minutesShort"), minutes)).font(.caption.weight(.semibold))
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
        }
    }

    private func sectionChips(_ sections: [NativeCourse.Section], proxy: ScrollViewProxy) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(sections) { section in
                    Button {
                        withAnimation { proxy.scrollTo(section.kind, anchor: .top) }
                    } label: {
                        Label("\(section.kind.name) · \(section.items.count)", systemImage: section.kind.symbol)
                            .font(.subheadline.weight(.semibold))
                            .padding(.horizontal, 12).padding(.vertical, 8)
                            .foregroundStyle(section.kind.tint)
                            .background(section.kind.tint.opacity(0.12), in: Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func sectionView(_ section: NativeCourse.Section) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionTitle(text: section.kind.name, symbol: section.kind.symbol, tint: section.kind.tint, trailing: "\(section.items.count)")
            VStack(spacing: 0) {
                ForEach(Array(section.items.enumerated()), id: \.element.id) { index, item in
                    Button { native.openLesson(slug: item.slug) } label: { ItemRow(item: item, tint: section.kind.tint) }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("lessonRow")
                    if index < section.items.count - 1 { Divider().padding(.leading, 66) }
                }
            }
            .siteCard()
        }
    }
}

private struct ItemRow: View {
    let item: NativeCourse.Item
    let tint: Color

    var body: some View {
        HStack(spacing: 12) {
            if let session = item.session {
                VStack(spacing: 0) {
                    Text(verbatim: "\(session)").font(.headline.monospacedDigit())
                    Text(L10n.text("sessionShort")).font(.system(size: 9, weight: .semibold))
                }
                .foregroundStyle(tint)
                .frame(width: 42, height: 42)
                .background(tint.opacity(0.14), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .accessibilityHidden(true)
            } else {
                IconTile(symbol: ContentKind.symbol(item.type), tint: tint, size: 42)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(item.displayTitle).font(.body.weight(.semibold)).multilineTextAlignment(.leading)
                HStack(spacing: 6) {
                    if item.session != nil {
                        Image(systemName: ContentKind.symbol(item.type)).accessibilityHidden(true)
                    }
                    Text(item.videoProvider == "YOUTUBE" ? "YouTube" : ContentKind.name(item.type))
                }
                .font(.caption).foregroundStyle(.secondary)
            }
            Spacer(minLength: 4)
            Image(systemName: "chevron.forward").font(.footnote.bold()).foregroundStyle(.tertiary)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel(item.session.map { String(format: L10n.text("sessionNumber"), $0) + ", " + item.displayTitle } ?? item.displayTitle)
    }
}
