import SwiftUI
import MadrasadzCore

// Native learning home and course screens (Build 8). Content comes from the iOS
// API v1; lessons, tools and every other page open in the shared web view.

private let brandBlue = Color(red: 49/255, green: 85/255, blue: 245/255)

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

private enum NativeTool {
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

private enum NativeDates {
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

private struct Card<Content: View>: View {
    let content: Content
    init(@ViewBuilder content: () -> Content) { self.content = content() }
    var body: some View {
        content
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}

private struct SectionTitle: View {
    let text: String
    let symbol: String
    var tint: Color = brandBlue
    var trailing: String?
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: symbol).foregroundStyle(tint).accessibilityHidden(true)
            Text(text).font(.title3.bold())
            Spacer(minLength: 8)
            if let trailing {
                Text(trailing).font(.footnote.weight(.semibold)).foregroundStyle(.secondary)
                    .padding(.horizontal, 10).padding(.vertical, 4)
                    .background(Color(.tertiarySystemFill), in: Capsule())
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }
}

private struct IconTile: View {
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
            RoundedRectangle(cornerRadius: 20).fill(Color(.secondarySystemGroupedBackground)).frame(height: 120)
            ForEach(0..<3, id: \.self) { _ in
                RoundedRectangle(cornerRadius: 18).fill(Color(.secondarySystemGroupedBackground)).frame(height: 76)
            }
        }
        .overlay { ProgressView() }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(L10n.text("loading"))
        .accessibilityIdentifier("nativeLoading")
    }
}

/// A full-width message with actions (failure, sign-in, phone, terms…).
private struct NoticeCard<Actions: View>: View {
    let symbol: String
    let tint: Color
    let title: String
    let message: String
    let actions: Actions

    init(symbol: String, tint: Color = brandBlue, title: String, message: String, @ViewBuilder actions: () -> Actions) {
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
                Text(title).font(.title3.bold()).multilineTextAlignment(.center)
                Text(message).font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)
                actions
            }
            .frame(maxWidth: .infinity)
        }
    }
}

/// The failure states shared by the home and course screens.
private struct FailureCard: View {
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
                    .buttonStyle(.borderedProminent).controlSize(.large)
            }
        case .phone:
            NoticeCard(symbol: "phone.badge.checkmark", tint: .green, title: L10n.text("phoneTitle"), message: L10n.text("phoneBody")) {
                Button(L10n.text("phoneAction")) { native.openWeb(path: "/ios") }
                    .buttonStyle(.borderedProminent).controlSize(.large)
            }
        case .role:
            NoticeCard(symbol: "graduationcap.fill", title: L10n.text("studentOnlyTitle"), message: L10n.text("studentOnlyBody")) {
                Button(L10n.text("logout"), role: .destructive) { Task { await model.logout() } }
                    .buttonStyle(.bordered).controlSize(.large).disabled(model.busy)
            }
        case .ended:
            NoticeCard(symbol: "clock.badge.xmark", tint: .orange, title: L10n.text("courseEnded"), message: L10n.text("courseEndedBody")) {
                Button(L10n.text("menuHome")) { native.show(.home) }.buttonStyle(.bordered)
            }
        case .notFound:
            NoticeCard(symbol: "questionmark.folder", tint: .secondary, title: L10n.text("courseMissingTitle"), message: L10n.text("courseMissing")) {
                Button(L10n.text("menuHome")) { native.show(.home) }.buttonStyle(.bordered)
            }
        case .offline, .server:
            NoticeCard(symbol: "wifi.exclamationmark", tint: .orange, title: L10n.text("nativeLoadFailed"), message: L10n.text("nativeOfflineBody")) {
                Button(L10n.text("retry")) { Task { await retry() } }
                    .buttonStyle(.borderedProminent).controlSize(.large)
                    .accessibilityIdentifier("nativeRetry")
            }
        }
    }
}

// MARK: - Home

struct NativeHomeView: View {
    @ObservedObject var model: AppModel
    @ObservedObject var native: NativeLearningModel
    @Binding var showingAccount: Bool

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
            .padding(16)
        }
        .background(Color(.systemGroupedBackground))
        .refreshable { await native.retryHome() }
        .task(id: native.accountKey) { await native.loadHomeIfNeeded() }
        .navigationTitle("مدرسة")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { MenuToolbarButton(showing: $showingAccount) } }
    }

    @ViewBuilder private func content(_ home: NativeHome) -> some View {
        if home.account == nil {
            welcome
        } else {
            VStack(alignment: .leading, spacing: 4) {
                Text(L10n.text("nativeLearnTitle")).font(.title.bold())
                Text(L10n.text("nativeLearnIntro")).font(.subheadline).foregroundStyle(.secondary)
            }
            courses(home.courses)
            if !home.tools.isEmpty { tools(home.tools) }
        }
        freeLessons(home.freeLessons)
    }

    private var welcome: some View {
        Card {
            VStack(spacing: 16) {
                Image("BrandLogo").resizable().scaledToFit().frame(maxWidth: 150, maxHeight: 64)
                    .accessibilityHidden(true)
                VStack(spacing: 6) {
                    Text(L10n.text("nativeWelcome")).font(.title2.bold())
                    Text(L10n.text("nativeWelcomeIntro")).foregroundStyle(.secondary)
                }
                .multilineTextAlignment(.center)
                Button { native.openWeb(path: "/login?next=/ios") } label: {
                    Label(L10n.text("signIn"), systemImage: "person.crop.circle.badge.checkmark")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent).controlSize(.large)
                .accessibilityIdentifier("nativeSignIn")
                HStack(spacing: 4) {
                    Text(L10n.text("nativeNoAccount")).foregroundStyle(.secondary)
                    Button(L10n.text("register")) { native.openWeb(path: "/register") }.fontWeight(.semibold)
                }
                .font(.subheadline)
            }
            .frame(maxWidth: .infinity)
        }
    }

    @ViewBuilder private func courses(_ courses: [NativeHome.Course]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionTitle(text: L10n.text("myCourses"), symbol: "books.vertical.fill")
            if courses.isEmpty {
                Card { Text(L10n.text("noCourses")).font(.subheadline).foregroundStyle(.secondary) }
            } else {
                ForEach(courses) { course in
                    if course.status == .active {
                        NavigationLink(value: LearnRoute.course(course.slug)) { CourseCard(course: course) }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("courseCard")
                    } else {
                        CourseCard(course: course).opacity(0.65)
                    }
                }
            }
        }
    }

    private func tools(_ tools: [NativeHome.Tool]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionTitle(text: L10n.text("practiceTitle"), symbol: "figure.mind.and.body", tint: .purple)
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                ForEach(tools) { tool in
                    if let style = NativeTool.style(tool.id) {
                        Button { native.openWeb(path: tool.webPath) } label: {
                            VStack(alignment: .leading, spacing: 14) {
                                IconTile(symbol: style.symbol, tint: style.tint, size: 42)
                                Text(L10n.text(style.key)).font(.subheadline.weight(.semibold))
                                    .foregroundStyle(.primary).multilineTextAlignment(.leading)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .padding(14)
                            .frame(maxWidth: .infinity, minHeight: 108, alignment: .topLeading)
                            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    @ViewBuilder private func freeLessons(_ entries: [NativeHome.FreeEntry]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionTitle(text: L10n.text("freeForAll"), symbol: "gift.fill", tint: .green)
            if entries.isEmpty {
                Card { Text(L10n.text("noFreeLessons")).font(.subheadline).foregroundStyle(.secondary) }
            }
            ForEach(entries) { entry in
                switch entry {
                case .group(let heading, let detail, let items):
                    Card {
                        VStack(alignment: .leading, spacing: 12) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(heading).font(.headline)
                                if let detail { Text(detail).font(.subheadline).foregroundStyle(.secondary) }
                            }
                            LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
                                ForEach(items) { item in
                                    Button { native.openLesson(slug: item.slug) } label: {
                                        HStack(spacing: 6) {
                                            Text(item.label).font(.subheadline.weight(.semibold)).lineLimit(2)
                                                .multilineTextAlignment(.leading)
                                            Spacer(minLength: 4)
                                            Image(systemName: "chevron.forward").font(.caption.bold()).foregroundStyle(.tertiary)
                                        }
                                        .padding(.horizontal, 12)
                                        .frame(maxWidth: .infinity, minHeight: 48)
                                        .background(Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                case .single(let link):
                    Button { native.openLesson(slug: link.slug) } label: {
                        Card {
                            HStack(spacing: 12) {
                                IconTile(symbol: ContentKind.symbol(link.type), tint: .green, size: 42)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(link.label).font(.headline).multilineTextAlignment(.leading)
                                    if let summary = link.summary, !summary.isEmpty {
                                        Text(summary).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
                                            .multilineTextAlignment(.leading)
                                    }
                                }
                                Spacer(minLength: 4)
                                Image(systemName: "chevron.forward").font(.footnote.bold()).foregroundStyle(.tertiary)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
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
        .background(Color(.systemGroupedBackground))
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
                .buttonStyle(.borderedProminent).controlSize(.large)
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
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
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
