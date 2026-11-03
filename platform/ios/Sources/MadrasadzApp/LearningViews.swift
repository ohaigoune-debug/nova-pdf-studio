import SwiftUI
import PDFKit
import WebKit
import MadrasadzCore

/// Loads a read-only API path: the saved copy first (works offline), then the server.
@MainActor
final class Loader<Value: Decodable>: ObservableObject {
    @Published private(set) var value: Value?
    @Published private(set) var savedAt: Date?
    @Published private(set) var failure: APIFailure?
    @Published private(set) var loading = false
    private var path: String?

    func load(_ path: String, model: AppModel, force: Bool = false) async {
        if path != self.path {
            self.path = path
            value = nil
            savedAt = nil
            failure = nil
        } else if value != nil, !force, savedAt == nil {
            return
        }
        if value == nil, let cached = await model.cached(Value.self, path), self.path == path {
            value = cached.value
            savedAt = cached.savedAt
        }
        loading = true
        defer { loading = false }
        do {
            let fresh = try await model.fetch(Value.self, path)
            guard self.path == path else { return }
            value = fresh
            savedAt = nil
            failure = nil
        } catch let error as APIFailure {
            guard self.path == path else { return }
            failure = error
        } catch {}
    }
}

private func encoded(_ slug: String) -> String {
    slug.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed.subtracting(CharacterSet(charactersIn: "/"))) ?? slug
}

// MARK: - Home

struct HomeView: View {
    @ObservedObject var model: AppModel
    @StateObject private var loader = Loader<NativeHome>()
    @Environment(\.openURL) private var openURL

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                greeting
                if loader.value != nil, loader.savedAt != nil || !model.online { OfflineBanner(savedAt: loader.savedAt) }
                if model.phoneVerificationRequired { phoneCard }
                playCard
                if let home = loader.value {
                    courses(home)
                    freeLessons(home)
                } else if let failure = loader.failure {
                    FailureView(message: failure.message) { Task { await loader.load("/api/v1/ios/home", model: model, force: true) } }
                } else {
                    LoadingView()
                }
            }
            .padding(16)
        }
        .background(Brand.page)
        .navigationTitle(L10n.text("appName"))
        .refreshable { await loader.load("/api/v1/ios/home", model: model, force: true) }
        .task { await loader.load("/api/v1/ios/home", model: model) }
    }

    private var greeting: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(String(format: L10n.text("hello"), model.displayName ?? L10n.text("student")))
                .font(.title2.bold()).foregroundStyle(.white)
            Text(L10n.text("homeIntro")).font(.subheadline).foregroundStyle(.white.opacity(0.85))
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(LinearGradient(colors: [Brand.navy, Brand.blue], startPoint: .topLeading, endPoint: .bottomTrailing),
                    in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .accessibilityIdentifier("homeGreeting")
    }

    private var phoneCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(L10n.text("phoneTitle"), systemImage: "phone.badge.checkmark").font(.headline)
            Text(L10n.text("phoneBody")).font(.subheadline).foregroundStyle(.secondary)
            Button(L10n.text("phoneAction")) { if let url = model.api.url("/student") { openURL(url) } }
                .buttonStyle(.bordered)
        }
        .card()
    }

    private var playCard: some View {
        Button { model.selectedTab = .play } label: {
            HStack(spacing: 14) {
                Image(systemName: "gamecontroller.fill").font(.title).foregroundStyle(.white)
                    .frame(width: 54, height: 54)
                    .background(Brand.blue, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                VStack(alignment: .leading, spacing: 4) {
                    Text(L10n.text("playTitle")).font(.headline).foregroundStyle(.primary)
                    Text(L10n.text("playIntro")).font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.leading)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.forward").foregroundStyle(.tertiary)
            }
            .card()
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("homePlayCard")
    }

    @ViewBuilder
    private func courses(_ home: NativeHome) -> some View {
        Text(L10n.text("myCourses")).font(.title3.bold())
        if home.courses.isEmpty {
            Text(L10n.text("noCourses")).font(.subheadline).foregroundStyle(.secondary).card()
        } else {
            ForEach(home.courses) { course in
                NavigationLink { CourseView(model: model, slug: course.slug, title: course.title) } label: {
                    CourseRow(course: course)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("course-\(course.slug)")
            }
        }
    }

    @ViewBuilder
    private func freeLessons(_ home: NativeHome) -> some View {
        if !home.freeLessons.isEmpty {
            Text(L10n.text("freeForAll")).font(.title3.bold()).padding(.top, 6)
            ForEach(home.freeLessons) { entry in
                switch entry {
                case .single(let link):
                    NavigationLink { LessonView(model: model, slug: link.slug) } label: { FreeLessonRow(title: link.label, detail: link.summary, type: link.type) }
                        .buttonStyle(.plain)
                case .group(let heading, let detail, let items):
                    VStack(alignment: .leading, spacing: 10) {
                        Text(heading).font(.headline)
                        if let detail { Text(detail).font(.footnote).foregroundStyle(.secondary) }
                        ForEach(items) { link in
                            NavigationLink { LessonView(model: model, slug: link.slug) } label: {
                                HStack {
                                    Image(systemName: icon(for: link.type)).foregroundStyle(Brand.blue)
                                    Text(link.label).foregroundStyle(.primary)
                                    Spacer()
                                    Image(systemName: "chevron.forward").font(.footnote).foregroundStyle(.tertiary)
                                }
                                .padding(.vertical, 6)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .card()
                }
            }
        }
    }
}

func icon(for type: String) -> String {
    switch type.uppercased() {
    case "VIDEO": return "play.rectangle.fill"
    case "PDF", "FILE": return "doc.richtext.fill"
    case "LINK": return "link"
    default: return "book.fill"
    }
}

struct CourseRow: View {
    let course: NativeHome.Course

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: "graduationcap.fill").font(.title2).foregroundStyle(.white)
                .frame(width: 52, height: 52)
                .background(course.status == .active ? Brand.navy : Color.gray, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            VStack(alignment: .leading, spacing: 4) {
                Text(course.title).font(.headline).foregroundStyle(.primary).multilineTextAlignment(.leading)
                HStack(spacing: 6) {
                    if let teacher = course.teacherName { Text(teacher) }
                    if let season = course.season { Text("· " + season) }
                }
                .font(.footnote).foregroundStyle(.secondary)
                if course.status == .ended {
                    Text(L10n.text("courseEnded")).font(.caption.bold()).foregroundStyle(Brand.danger)
                } else if !course.termsAccepted {
                    Text(L10n.text("termsTitle")).font(.caption.bold()).foregroundStyle(Brand.blue)
                }
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.forward").foregroundStyle(.tertiary)
        }
        .card()
    }
}

struct FreeLessonRow: View {
    let title: String
    let detail: String?
    let type: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon(for: type)).foregroundStyle(Brand.blue).frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.headline).foregroundStyle(.primary)
                if let detail { Text(detail).font(.footnote).foregroundStyle(.secondary) }
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.forward").foregroundStyle(.tertiary)
        }
        .card()
    }
}

// MARK: - Course

struct CourseView: View {
    @ObservedObject var model: AppModel
    let slug: String
    let title: String
    @StateObject private var loader = Loader<NativeCourse>()
    @State private var accepting = false
    @State private var acceptError: String?

    private var path: String { "/api/v1/ios/courses/" + encoded(slug) }

    var body: some View {
        List {
            if let course = loader.value {
                if loader.savedAt != nil || !model.online {
                    OfflineBanner(savedAt: loader.savedAt).listRowBackground(Color.clear).listRowInsets(EdgeInsets())
                }
                header(course)
                if course.needsTerms {
                    terms(course)
                } else if course.sections.isEmpty {
                    Text(L10n.text("courseEmpty")).foregroundStyle(.secondary)
                } else {
                    ForEach(course.sections) { section in
                        Section(sectionTitle(section.kind)) {
                            ForEach(section.items) { item in
                                NavigationLink { LessonView(model: model, slug: item.slug) } label: { ItemRow(item: item) }
                                    .accessibilityIdentifier("item-\(item.slug)")
                            }
                        }
                    }
                }
                if !course.upcoming.isEmpty {
                    Section(L10n.text("upcomingTitle")) {
                        ForEach(Array(course.upcoming.enumerated()), id: \.offset) { _, session in
                            VStack(alignment: .leading, spacing: 2) {
                                Text(session.title).font(.subheadline.bold())
                                if let date = session.startsAt.flatMap(parseDate) {
                                    Text(date.formatted(date: .complete, time: .shortened)).font(.footnote).foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
            } else if let failure = loader.failure {
                FailureView(message: failure.message) { Task { await loader.load(path, model: model, force: true) } }
                    .listRowBackground(Color.clear)
            } else {
                LoadingView().listRowBackground(Color.clear)
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await loader.load(path, model: model, force: true) }
        .task { await loader.load(path, model: model) }
    }

    @ViewBuilder
    private func header(_ course: NativeCourse) -> some View {
        Section {
            VStack(alignment: .leading, spacing: 6) {
                Text(course.course.title).font(.title3.bold())
                if let teacher = course.course.teacherName { Label(teacher, systemImage: "person.fill").font(.subheadline) }
                if let season = course.course.season { Label(season, systemImage: "calendar").font(.subheadline).foregroundStyle(.secondary) }
                if let ends = course.course.accessEndsOn {
                    Text(String(format: L10n.text("accessEnds"), ends)).font(.footnote).foregroundStyle(.secondary)
                }
                if let description = course.course.description, !description.isEmpty {
                    Text(description).font(.callout).padding(.top, 4)
                }
            }
            .padding(.vertical, 4)
        }
    }

    @ViewBuilder
    private func terms(_ course: NativeCourse) -> some View {
        Section(L10n.text("termsTitle")) {
            Text(L10n.text("termsBody")).font(.subheadline).foregroundStyle(.secondary)
            if let terms = course.terms {
                ScrollView { Text(terms.text).font(.callout).frame(maxWidth: .infinity, alignment: .leading) }
                    .frame(minHeight: 120, maxHeight: 320)
                if let acceptError { Text(acceptError).font(.footnote).foregroundStyle(Brand.danger) }
                Button {
                    Task { await accept(terms.version) }
                } label: {
                    HStack {
                        if accepting { ProgressView() }
                        Text(L10n.text("termsAccept")).fontWeight(.bold)
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(accepting || !model.online)
                .accessibilityIdentifier("acceptTerms")
            } else {
                Text(L10n.text("termsUpdateServer")).font(.footnote).foregroundStyle(.secondary)
            }
        }
    }

    private func accept(_ version: Int) async {
        struct Body: Encodable { let version: Int }
        struct Reply: Decodable { let accepted: Bool }
        accepting = true
        defer { accepting = false }
        do {
            _ = try await model.api.post(Reply.self, path + "/terms", body: Body(version: version))
            acceptError = nil
            await loader.load(path, model: model, force: true)
        } catch let failure as APIFailure {
            model.handle(failure)
            acceptError = failure.message
        } catch {
            acceptError = L10n.text("error")
        }
    }

    private func sectionTitle(_ kind: NativeCourse.SectionKind) -> String {
        switch kind {
        case .lessons: return L10n.text("sectionLessons")
        case .videos: return L10n.text("sectionVideos")
        case .homework: return L10n.text("sectionHomework")
        case .tests: return L10n.text("sectionTests")
        case .files: return L10n.text("sectionFiles")
        }
    }
}

func parseDate(_ value: String) -> Date? {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = formatter.date(from: value) { return date }
    formatter.formatOptions = [.withInternetDateTime]
    return formatter.date(from: value)
}

struct ItemRow: View {
    let item: NativeCourse.Item

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon(for: item.type)).foregroundStyle(Brand.blue).frame(width: 26)
            VStack(alignment: .leading, spacing: 2) {
                if let session = item.session {
                    Text(String(format: L10n.text("sessionNumber"), session)).font(.caption.bold()).foregroundStyle(Brand.blue)
                }
                Text(item.displayTitle).font(.body)
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Lesson

struct LessonView: View {
    @ObservedObject var model: AppModel
    @ObservedObject private var downloads: OfflineLibrary
    let slug: String
    @StateObject private var loader = Loader<NativeLesson>()
    @State private var viewing: PDFSource?
    @State private var preparing = false
    @State private var pdfError: String?
    @State private var player: NativeLesson.Player?
    @State private var playerError: String?
    @Environment(\.openURL) private var openURL

    init(model: AppModel, slug: String) {
        self.model = model
        downloads = model.downloads
        self.slug = slug
    }

    private var path: String { "/api/v1/ios/lessons/" + encoded(slug) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let lesson = loader.value {
                    if loader.savedAt != nil || !model.online { OfflineBanner(savedAt: loader.savedAt) }
                    Text(lesson.title).font(.title2.bold()).accessibilityIdentifier("lessonTitle")
                    if let summary = lesson.summary { Text(summary).font(.callout).foregroundStyle(.secondary) }
                    ForEach(Array(lesson.parts.enumerated()), id: \.offset) { _, part in media(part, lesson: lesson) }
                    if let body = lesson.bodyMarkdown { LessonBody(markdown: body) }
                    if lesson.parts.isEmpty && lesson.bodyMarkdown == nil && lesson.summary == nil {
                        Label(L10n.text("lessonEmpty"), systemImage: "doc.text").font(.subheadline).foregroundStyle(.secondary).card()
                            .accessibilityIdentifier("lessonEmpty")
                    }
                } else if let failure = loader.failure {
                    FailureView(message: failure.code == "FORBIDDEN" || failure.code?.hasSuffix("NOT_FOUND") == true ? L10n.text("lessonUnavailable") : failure.message) {
                        Task { await loader.load(path, model: model, force: true) }
                    }
                } else {
                    LoadingView()
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
        }
        .background(Brand.page)
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await loader.load(path, model: model, force: true) }
        .task { await loader.load(path, model: model) }
        .sheet(item: $viewing) { source in
            NavigationStack { PDFReader(source: source, owner: model.accountID ?? "") }
        }
    }

    @ViewBuilder
    private func media(_ part: NativeLesson.Media, lesson: NativeLesson) -> some View {
        switch part {
        case .none:
            EmptyView()
        case .youtube(let id, let contentID):
            ProtectedPlayer(model: model, source: .youtube(id), contentID: contentID,
                            watermark: [lesson.viewer?.name, lesson.viewer.map { "\(today) · \($0.code)" }].compactMap { $0 })
                .aspectRatio(16.0 / 9.0, contentMode: .fit)
        case .video(let contentID, let provider):
            if provider == "BUNNY", let contentID {
                Group {
                    if let player {
                        ProtectedPlayer(model: model, source: .bunny(player.url), contentID: contentID, watermark: player.watermark)
                    } else if let playerError {
                        unavailable(playerError)
                    } else {
                        ZStack { Color.black; ProgressView().tint(.white) }
                            .task { await loadPlayer(contentID) }
                    }
                }
                .aspectRatio(16.0 / 9.0, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            } else {
                unavailable(L10n.text("videoNotInApp"))
            }
        case .pdf(let contentID, let allowDownload):
            VStack(alignment: .leading, spacing: 10) {
                if allowDownload {
                    Button { Task { await saveAndOpen(contentID) } } label: {
                        Label(downloads.documents.contains(where: { $0.id == contentID }) ? L10n.text("lessonOpenSaved") : L10n.text("lessonSavePDF"),
                              systemImage: "arrow.down.doc.fill").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent).controlSize(.large)
                    .accessibilityIdentifier("lessonSavePDF")
                }
                Button { Task { await view(contentID) } } label: {
                    Label(L10n.text("lessonShowPDF"), systemImage: "doc.text.magnifyingglass").frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered).controlSize(.large)
                .disabled(!model.online)
                .accessibilityIdentifier("lessonViewPDF")
                if preparing || downloads.progress != nil { ProgressView(value: downloads.progress) }
                if let pdfError { Text(pdfError).font(.footnote).foregroundStyle(Brand.danger) }
            }
            .card()
        case .link(let url):
            Button { openURL(url) } label: { Label(L10n.text("lessonOpenLink"), systemImage: "link").frame(maxWidth: .infinity) }
                .buttonStyle(.bordered).controlSize(.large)
        case .external:
            unavailable(L10n.text("contentNotInApp"))
        }
    }

    private func unavailable(_ text: String) -> some View {
        Label(text, systemImage: "info.circle").font(.subheadline).foregroundStyle(.secondary).card()
    }

    private var today: String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }

    private func loadPlayer(_ contentID: UUID) async {
        do {
            player = try await model.fetch(NativeLesson.Player.self, "/api/v1/ios/media/\(contentID.uuidString.lowercased())/player")
        } catch let failure as APIFailure {
            playerError = failure == .offline ? L10n.text("videoNeedsInternet") : failure.message
        } catch {
            playerError = L10n.text("error")
        }
    }

    private func saveAndOpen(_ contentID: UUID) async {
        pdfError = nil
        if let document = downloads.documents.first(where: { $0.id == contentID }), downloads.isUsable(document) {
            viewing = .file(downloads.fileURL(for: document), document.title)
            return
        }
        preparing = true
        defer { preparing = false }
        await downloads.download(contentID: contentID, api: model.api, currentAccount: { model.verifiedAccountID })
        if let document = downloads.documents.first(where: { $0.id == contentID }) {
            viewing = .file(downloads.fileURL(for: document), document.title)
        } else {
            pdfError = L10n.text("downloadFailed")
        }
    }

    /// View-only: the stamped file stays in memory and is never saved or shared.
    private func view(_ contentID: UUID) async {
        pdfError = nil
        preparing = true
        defer { preparing = false }
        do {
            let (data, _) = try await model.api.bytes("/api/v1/ios/materials/\(contentID.uuidString.lowercased())/view", accept: "application/pdf")
            guard data.starts(with: Data("%PDF-".utf8)) else { throw APIFailure.invalid }
            viewing = .data(data, loader.value?.title ?? "PDF")
        } catch let failure as APIFailure {
            model.handle(failure)
            pdfError = failure.code == "FORBIDDEN" ? L10n.text("lessonUnavailable") : failure.message
        } catch {
            pdfError = L10n.text("error")
        }
    }
}

enum PDFSource: Identifiable {
    case file(URL, String)
    case data(Data, String)

    var id: String {
        switch self {
        case .file(let url, _): return url.path
        case .data(let data, let title): return "\(title)-\(data.count)"
        }
    }

    var title: String {
        switch self {
        case .file(_, let title), .data(_, let title): return title
        }
    }
}

struct PDFReader: View {
    let source: PDFSource
    let owner: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            PDFKitRepresentable(source: source)
            VStack(spacing: 140) {
                ForEach(0..<4, id: \.self) { _ in
                    Text("madrasadz · \(owner.prefix(8))").font(.caption).foregroundStyle(Color.gray.opacity(0.22)).rotationEffect(.degrees(-24))
                }
            }
            .environment(\.layoutDirection, .leftToRight)
            .allowsHitTesting(false)
        }
        .navigationTitle(source.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .confirmationAction) { Button(L10n.text("close")) { dismiss() } } }
    }
}

private struct PDFKitRepresentable: UIViewRepresentable {
    let source: PDFSource

    func makeUIView(context: Context) -> PDFView {
        let view = PDFView()
        view.autoScales = true
        view.displayMode = .singlePageContinuous
        view.displayDirection = .vertical
        switch source {
        case .file(let url, _): view.document = PDFDocument(url: url)
        case .data(let data, _): view.document = PDFDocument(data: data)
        }
        return view
    }

    func updateUIView(_ view: PDFView, context: Context) {}
}

/// Lesson text: headings, bullets and paragraphs with inline Markdown. No HTML,
/// and links in a teacher's text are shown but not opened.
struct LessonBody: View {
    let markdown: String

    private enum Block: Hashable { case heading(String), bullet(String), paragraph(String) }

    private var blocks: [Block] {
        var result: [Block] = []
        var paragraph: [String] = []
        func flush() {
            if !paragraph.isEmpty { result.append(.paragraph(paragraph.joined(separator: "\n"))); paragraph = [] }
        }
        for raw in markdown.prefix(60_000).components(separatedBy: .newlines) {
            let line = raw.trimmingCharacters(in: .whitespaces)
            if line.isEmpty { flush(); continue }
            if line.hasPrefix("#") {
                flush()
                result.append(.heading(line.drop(while: { $0 == "#" }).trimmingCharacters(in: .whitespaces)))
            } else if line.hasPrefix("- ") || line.hasPrefix("* ") || line.hasPrefix("• ") {
                flush()
                result.append(.bullet(String(line.dropFirst(2))))
            } else {
                paragraph.append(line)
            }
        }
        flush()
        return result
    }

    private func inline(_ text: String) -> Text {
        let options = AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        if let attributed = try? AttributedString(markdown: text, options: options) { return Text(attributed) }
        return Text(text)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(Array(blocks.enumerated()), id: \.offset) { _, block in
                switch block {
                case .heading(let text):
                    inline(text).font(.title3.bold()).padding(.top, 4)
                case .bullet(let text):
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text("•").foregroundStyle(Brand.blue)
                        inline(text)
                    }
                case .paragraph(let text):
                    inline(text).lineSpacing(5)
                }
            }
        }
        .font(.body)
        .card()
        .environment(\.openURL, OpenURLAction { _ in .discarded })
    }
}

// MARK: - Protected video

/// The video player alone in a small web view (YouTube privacy embed or the signed
/// Bunny player), never the website. A moving watermark with the student's identity,
/// the one-device heartbeat, and a cover while the screen is recorded.
struct ProtectedPlayer: View {
    enum Source: Equatable { case youtube(String), bunny(URL) }

    @ObservedObject var model: AppModel
    let source: Source
    let contentID: UUID?
    let watermark: [String]
    @Environment(\.scenePhase) private var scenePhase
    @State private var blocked: String?
    @State private var captured = UIScreen.main.isCaptured
    @State private var mark = CGPoint(x: 0.06, y: 0.08)

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                Color.black
                if blocked == nil, !captured {
                    #if DEBUG
                    if Fixtures.enabled {
                        Text("VIDEO").foregroundStyle(.white.opacity(0.6)).frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else {
                        VideoEmbed(source: source)
                    }
                    #else
                    VideoEmbed(source: source)
                    #endif
                }
                if !watermark.isEmpty {
                    VStack(alignment: .leading, spacing: 1) {
                        ForEach(watermark, id: \.self) { Text($0) }
                    }
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(.white.opacity(0.8))
                    .padding(.horizontal, 6).padding(.vertical, 3)
                    .background(.black.opacity(0.35), in: RoundedRectangle(cornerRadius: 4))
                    .environment(\.layoutDirection, .leftToRight)
                    .offset(x: mark.x * geo.size.width, y: mark.y * geo.size.height)
                    .animation(.easeInOut(duration: 1.2), value: mark)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
                }
                if captured || blocked != nil {
                    VStack(spacing: 10) {
                        Image(systemName: "lock.shield.fill").font(.largeTitle)
                        Text(blocked == nil ? L10n.text("captureBlocked") : L10n.text("deviceBlockedTitle")).font(.headline).multilineTextAlignment(.center)
                        if let blocked {
                            Text(blocked).font(.footnote).multilineTextAlignment(.center)
                            Button(L10n.text("retry")) { self.blocked = nil }.buttonStyle(.borderedProminent)
                        }
                    }
                    .foregroundStyle(.white)
                    .padding(20)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(.black.opacity(0.9))
                }
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .accessibilityIdentifier("lessonPlayer")
        .onReceive(NotificationCenter.default.publisher(for: UIScreen.capturedDidChangeNotification)) { _ in
            captured = UIScreen.main.isCaptured
        }
        .task(id: blocked == nil && scenePhase == .active) {
            guard blocked == nil, scenePhase == .active, let contentID else { return }
            var last = Date()
            var elapsed = 0
            var first = true
            while !Task.isCancelled {
                let now = Date()
                let delta = first ? 0 : min(120, Int(now.timeIntervalSince(last).rounded()))
                first = false
                last = now
                elapsed += delta
                if case .blocked(let message) = await model.heartbeat(contentID: contentID, position: elapsed, delta: delta) {
                    blocked = message
                    return
                }
                try? await Task.sleep(nanoseconds: 15_000_000_000)
            }
        }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 7_000_000_000)
                mark = CGPoint(x: Double.random(in: 0.04...0.55), y: Double.random(in: 0.06...0.75))
            }
        }
    }
}

/// A fixed local page holding only the player frame. Main-frame navigation never
/// leaves it; only the video providers' own frames load; pop-ups are refused.
private struct VideoEmbed: UIViewRepresentable {
    let source: ProtectedPlayer.Source

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.allowsInlineMediaPlayback = true
        configuration.allowsPictureInPictureMediaPlayback = false
        configuration.allowsAirPlayForMediaPlayback = false
        configuration.mediaTypesRequiringUserActionForPlayback = .all
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.isOpaque = false
        view.backgroundColor = .black
        view.scrollView.isScrollEnabled = false
        view.navigationDelegate = context.coordinator
        view.uiDelegate = context.coordinator
        load(into: view)
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {}

    static func dismantleUIView(_ view: WKWebView, coordinator: Coordinator) {
        view.stopLoading()
        view.loadHTMLString("", baseURL: nil)
    }

    private var frameURL: String? {
        switch source {
        case .youtube(let id):
            guard NativeLesson.isYouTubeID(id) else { return nil }
            return "https://www.youtube-nocookie.com/embed/\(id)?rel=0&modestbranding=1&playsinline=1&fs=0&iv_load_policy=3&disablekb=1"
        case .bunny(let url):
            guard url.scheme == "https", Coordinator.isBunny(url.host ?? "") else { return nil }
            return url.absoluteString
        }
    }

    private func load(into view: WKWebView) {
        guard let frame = frameURL else { return }
        let escaped = frame.replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: "\"", with: "&quot;")
        let html = """
        <!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
        <style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{position:fixed;inset:0;width:100%;height:100%;border:0}</style>
        </head><body><iframe src="\(escaped)" allow="accelerometer; encrypted-media; gyroscope" referrerpolicy="strict-origin-when-cross-origin"></iframe></body></html>
        """
        // The site origin as referrer: both players accept embeds from madrasadz.com only.
        view.loadHTMLString(html, baseURL: URL(string: "https://madrasadz.com/"))
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        static func isBunny(_ host: String) -> Bool {
            let h = host.lowercased()
            return h.hasSuffix(".mediadelivery.net") || h == "mediadelivery.net" || h.hasSuffix(".b-cdn.net") || h.hasSuffix(".bunnycdn.com") || h.hasSuffix(".bunny.net")
        }

        static func isYouTube(_ host: String) -> Bool {
            let h = host.lowercased()
            return h == "www.youtube-nocookie.com" || h == "youtube.com" || h.hasSuffix(".youtube.com") || h.hasSuffix(".google.com")
                || h.hasSuffix(".doubleclick.net") || h.hasSuffix(".ytimg.com") || h.hasSuffix(".googlevideo.com")
        }

        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = action.request.url else { return decisionHandler(.cancel) }
            if action.targetFrame?.isMainFrame == true {
                let local = url.absoluteString == "about:blank" || (url.host == "madrasadz.com" && url.path == "/")
                return decisionHandler(local && action.navigationType != .linkActivated ? .allow : .cancel)
            }
            let host = url.host ?? ""
            let allowed = url.scheme == "about" || url.scheme == "blob" || (url.scheme == "https" && (Self.isYouTube(host) || Self.isBunny(host)))
            decisionHandler(allowed ? .allow : .cancel)
        }

        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                     for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? { nil }
    }
}
