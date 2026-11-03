import SwiftUI
import MadrasadzCore

// MARK: - Shared pieces of the step-by-step banks

/// The coloured banner at the top of a bank.
struct StepHero: View {
    let icon: String
    let title: String
    let text: String
    var badge: String?
    let colors: [Color]

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.title2.weight(.semibold))
                .foregroundStyle(colors.last ?? Brand.navy)
                .frame(width: 52, height: 52)
                .background(.white, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.title3.bold()).foregroundStyle(.white)
                Text(text).font(.subheadline).foregroundStyle(.white.opacity(0.88))
                if let badge {
                    Text(badge)
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Brand.navy)
                        .padding(.horizontal, 10).padding(.vertical, 4)
                        .background(Brand.sky, in: Capsule())
                        .padding(.top, 2)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(18)
        .background(LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing),
                    in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }
}

/// A large choice: icon, title and one line (subject, term, school year).
struct StepTile: View {
    let title: String
    let detail: String
    let icon: String
    let tint: Color
    var highlighted = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: icon)
                .font(.title3.weight(.semibold))
                .foregroundStyle(tint)
                .frame(width: 46, height: 46)
                .background(tint.opacity(0.14), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            Text(title).font(.headline).foregroundStyle(.primary).lineLimit(2).multilineTextAlignment(.leading)
            Text(detail).font(.caption).foregroundStyle(.secondary).lineLimit(1)
        }
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 128, alignment: .topLeading)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(highlighted ? tint : Color.clear, lineWidth: 2))
    }
}

/// A full-width choice row with a big number or icon (terms, school years).
struct StepRow: View {
    let title: String
    let detail: String
    let mark: String
    let tint: Color
    var tag: String?

    var body: some View {
        HStack(spacing: 14) {
            Text(mark)
                .font(.title2.bold())
                .foregroundStyle(.white)
                .frame(width: 54, height: 54)
                .background(LinearGradient(colors: [tint, tint.opacity(0.75)], startPoint: .topLeading, endPoint: .bottomTrailing),
                            in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(title).font(.headline).foregroundStyle(.primary)
                    if let tag { Badge(text: tag, tint: tint, icon: "star.fill") }
                }
                Text(detail).font(.caption).foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.forward").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary)
        }
        .card()
    }
}

/// An icon and colour for a school subject, from its Arabic name.
enum SubjectStyle {
    private static let table: [(keys: [String], symbol: String, tint: Color)] = [
        (["العربية", "الأدب"], "text.book.closed.fill", Color(red: 0.08, green: 0.34, blue: 0.77)),
        (["الرياضيات"], "function", Color(red: 0.42, green: 0.25, blue: 0.75)),
        (["الفيزياء"], "atom", Color(red: 0.85, green: 0.42, blue: 0.10)),
        (["الطبيعة", "العلوم"], "leaf.fill", Color(red: 0.09, green: 0.50, blue: 0.24)),
        (["الفلسفة"], "brain.head.profile", Color(red: 0.45, green: 0.30, blue: 0.20)),
        (["التاريخ", "الجغرافيا"], "globe.europe.africa.fill", Color(red: 0.62, green: 0.20, blue: 0.20)),
        (["الإسلامية"], "moon.stars.fill", Color(red: 0.0, green: 0.45, blue: 0.47)),
        (["الفرنسية"], "character.book.closed.fill", Color(red: 0.10, green: 0.30, blue: 0.60)),
        (["الإنجليزية"], "character.bubble.fill", Color(red: 0.70, green: 0.15, blue: 0.35)),
        (["الاقتصاد", "التسيير", "المحاسب", "القانون"], "chart.line.uptrend.xyaxis", Color(red: 0.20, green: 0.40, blue: 0.30)),
        (["التكنولوجيا", "الهندسة"], "gearshape.2.fill", Color(red: 0.35, green: 0.35, blue: 0.45))
    ]

    static func symbol(for name: String) -> String { table.first { entry in entry.keys.contains { name.contains($0) } }?.symbol ?? "book.closed.fill" }
    static func tint(for name: String) -> Color { table.first { entry in entry.keys.contains { name.contains($0) } }?.tint ?? Brand.blue }
}

private let testsColors = [Color(red: 0.0, green: 0.45, blue: 0.47), Color(red: 0.05, green: 0.30, blue: 0.40)]
private let testsTint = Color(red: 0.0, green: 0.45, blue: 0.47)

private func termName(_ term: Int) -> String { L10n.text("term\(term)") }

// MARK: - Tests bank: term → school year → subject → list

/// Step 1: the three terms, with how many papers the student's school year has.
struct TestsBankView: View {
    @ObservedObject var model: AppModel
    @StateObject private var loader = Loader<TestsBank.Page>()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                StepHero(icon: "doc.on.clipboard.fill", title: L10n.text("testsBank"), text: L10n.text("testsIntro"), colors: testsColors)
                if loader.value != nil, loader.savedAt != nil || !model.online { OfflineBanner(savedAt: loader.savedAt) }
                Text(L10n.text("chooseTerm")).font(.title3.bold())
                ForEach(1...3, id: \.self) { term in
                    NavigationLink { TestsLevelsView(model: model, term: term) } label: {
                        StepRow(title: termName(term), detail: count(term), mark: "\(term)", tint: testsTint)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("testsTerm-\(term)")
                }
                if let failure = loader.failure, loader.value == nil {
                    Text(failure.message).font(.footnote).foregroundStyle(.secondary)
                }
            }
            .padding(16)
        }
        .background(Brand.page)
        .navigationTitle(L10n.text("testsBank"))
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await loader.load(TestsBank.path(), model: model, force: true) }
        .task { await loader.load(TestsBank.path(), model: model) }
    }

    private func count(_ term: Int) -> String {
        guard let n = loader.value?.terms.first(where: { $0.term == term })?.count else { return L10n.text("testsTermHint") }
        return String(format: L10n.text("papersCount"), n)
    }
}

/// Step 2: the school year; the student's own comes first.
struct TestsLevelsView: View {
    @ObservedObject var model: AppModel
    let term: Int
    @StateObject private var loader = Loader<TestsBank.Page>()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text(L10n.text("chooseYear")).font(.title3.bold())
                if let page = loader.value {
                    if page.levels.isEmpty {
                        ContentUnavailableView(L10n.text("testsEmpty"), systemImage: "doc.on.clipboard")
                    }
                    ForEach(page.levels) { level in
                        NavigationLink { TestsSubjectsView(model: model, term: term, level: level) } label: {
                            StepRow(title: level.name, detail: String(format: L10n.text("papersCount"), level.count),
                                    mark: Self.mark(level), tint: level.id == page.myLevelId ? testsTint : Brand.navy,
                                    tag: level.id == page.myLevelId ? L10n.text("yourYear") : nil)
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("testsLevel-\(level.code ?? level.id)")
                    }
                } else if let failure = loader.failure {
                    FailureView(message: failure.message) { Task { await loader.load(path, model: model, force: true) } }
                } else {
                    LoadingView().frame(minHeight: 200)
                }
            }
            .padding(16)
        }
        .background(Brand.page)
        .navigationTitle(termName(term))
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await loader.load(path, model: model, force: true) }
        .task { await loader.load(path, model: model) }
    }

    private var path: String { TestsBank.path(term: term) }

    /// «3ث», «4م»: the year number and the cycle, like the school calls them.
    static func mark(_ level: TestsBank.Level) -> String {
        guard let code = level.code, let digit = code.first, digit.isNumber else { return "•" }
        return String(digit) + (code.hasSuffix("AS") ? "ث" : code.hasSuffix("AM") ? "م" : "")
    }
}

/// Step 3: the subjects that have papers for this term and year.
struct TestsSubjectsView: View {
    @ObservedObject var model: AppModel
    let term: Int
    let level: TestsBank.Level
    @StateObject private var loader = Loader<TestsBank.Page>()

    private let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text(L10n.text("chooseSubject")).font(.title3.bold())
                if let page = loader.value {
                    if page.subjects.isEmpty {
                        ContentUnavailableView(L10n.text("testsEmpty"), systemImage: "doc.on.clipboard")
                    } else {
                        LazyVGrid(columns: columns, spacing: 12) {
                            ForEach(page.subjects) { subject in
                                NavigationLink { TestsListView(model: model, term: term, level: level, subject: subject) } label: {
                                    StepTile(title: subject.name, detail: String(format: L10n.text("papersCount"), subject.count),
                                             icon: SubjectStyle.symbol(for: subject.name), tint: SubjectStyle.tint(for: subject.name))
                                }
                                .buttonStyle(.plain)
                                .accessibilityIdentifier("testsSubject-\(subject.id)")
                            }
                        }
                    }
                } else if let failure = loader.failure {
                    FailureView(message: failure.message) { Task { await loader.load(path, model: model, force: true) } }
                } else {
                    LoadingView().frame(minHeight: 200)
                }
            }
            .padding(16)
        }
        .background(Brand.page)
        .navigationTitle(termName(term) + " · " + level.name)
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await loader.load(path, model: model, force: true) }
        .task { await loader.load(path, model: model) }
    }

    private var path: String { TestsBank.path(term: term, level: level.id) }
}

/// Step 4: the papers, and their interactive versions in PLAY.
struct TestsListView: View {
    @ObservedObject var model: AppModel
    let term: Int
    let level: TestsBank.Level
    let subject: TestsBank.Subject
    @StateObject private var loader = Loader<TestsBank.Page>()
    @State private var more: [TestsBank.Paper] = []
    @State private var cursor: String?
    @State private var loadingMore = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                if let page = loader.value {
                    if loader.savedAt != nil || !model.online { OfflineBanner(savedAt: loader.savedAt) }
                    if !page.interactive.isEmpty {
                        Label(L10n.text("playItInteractive"), systemImage: "gamecontroller.fill").font(.headline).foregroundStyle(Brand.blue)
                        ForEach(page.interactive) { set in
                            NavigationLink { ExamLauncher(model: model, play: model.play, setID: set.id, title: set.title) } label: {
                                HStack(spacing: 12) {
                                    Image(systemName: "gamecontroller.fill").foregroundStyle(.white)
                                        .frame(width: 42, height: 42)
                                        .background(Brand.blue, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(set.title).font(.subheadline.bold()).foregroundStyle(.primary).multilineTextAlignment(.leading)
                                        Text(L10n.text(set.kind == "DEVOIR" ? "kindDevoir" : "kindTest")).font(.caption).foregroundStyle(.secondary)
                                    }
                                    Spacer(minLength: 0)
                                    Image(systemName: "chevron.forward").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary)
                                }
                                .card()
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("testsPlay-\(set.id)")
                        }
                    }
                    let papers = page.papers + more.filter { extra in !page.papers.contains { $0.id == extra.id } }
                    if !papers.isEmpty {
                        Label(L10n.text("papersAndSolutions"), systemImage: "doc.text.fill").font(.headline).foregroundStyle(testsTint).padding(.top, 4)
                        ForEach(papers) { paper in
                            NavigationLink {
                                PaperView(model: model, id: paper.id, bank: .tests, title: paper.title, year: paper.year, detail: subject.name + " · " + level.name, official: false, topic: nil)
                            } label: { TestsRow(paper: paper) }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("testsPaper-\(paper.id)")
                        }
                    }
                    let next = more.isEmpty ? page.nextCursor : cursor
                    if next != nil {
                        Button {
                            Task { await loadMore(from: next) }
                        } label: {
                            HStack(spacing: 8) {
                                if loadingMore { ProgressView() }
                                Text(L10n.text("bacMore")).font(.subheadline.weight(.semibold))
                            }
                            .frame(maxWidth: .infinity, minHeight: 44)
                        }
                        .buttonStyle(.bordered)
                        .tint(testsTint)
                        .disabled(loadingMore)
                    }
                    if page.interactive.isEmpty && papers.isEmpty {
                        ContentUnavailableView(L10n.text("testsEmpty"), systemImage: "doc.on.clipboard")
                    }
                } else if let failure = loader.failure {
                    FailureView(message: failure.message) { Task { await loader.load(path, model: model, force: true) } }
                } else {
                    LoadingView().frame(minHeight: 200)
                }
            }
            .padding(16)
        }
        .background(Brand.page)
        .navigationTitle(subject.name)
        .navigationBarTitleDisplayMode(.inline)
        .refreshable {
            more = []
            cursor = nil
            await loader.load(path, model: model, force: true)
        }
        .task { await loader.load(path, model: model) }
    }

    private var path: String { TestsBank.path(term: term, level: level.id, subject: subject.id) }

    private func loadMore(from next: String?) async {
        guard let next, !loadingMore else { return }
        loadingMore = true
        defer { loadingMore = false }
        if let page = try? await model.fetch(TestsBank.Page.self, TestsBank.path(term: term, level: level.id, subject: subject.id, cursor: next)) {
            more += page.papers
            cursor = page.nextCursor
        }
    }
}

private struct TestsRow: View {
    let paper: TestsBank.Paper

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: "doc.text.fill")
                .font(.title3)
                .foregroundStyle(testsTint)
                .frame(width: 46, height: 46)
                .background(testsTint.opacity(0.12), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            VStack(alignment: .leading, spacing: 6) {
                Text(paper.title).font(.subheadline.bold()).foregroundStyle(.primary).lineLimit(2).multilineTextAlignment(.leading)
                HStack(spacing: 6) {
                    if let label = paper.typeLabel { Badge(text: label, tint: Brand.navy) }
                    if let year = paper.year { Badge(text: String(year), tint: Brand.blue) }
                    if paper.hasSolution { Badge(text: L10n.text("bacSolution"), tint: Brand.success, icon: "checkmark.seal.fill") }
                }
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.forward").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary)
        }
        .card()
    }
}

// MARK: - One paper (BAC, devoir or test): the paper, the solution, play it

struct PaperView: View {
    @ObservedObject var model: AppModel
    let id: String
    let bank: Bac.Bank
    let title: String
    let year: Int?
    let detail: String
    let official: Bool
    let topic: Int?
    @StateObject private var loader = Loader<Bac.Paper>()
    @State private var viewing: PDFSource?
    @State private var opening: String?
    @State private var fileError: String?
    @Environment(\.openURL) private var openURL

    private var path: String { Bac.paperPath(id, bank: bank) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                if let paper = loader.value {
                    files(paper)
                } else if let failure = loader.failure {
                    FailureView(message: failure.message) { Task { await loader.load(path, model: model, force: true) } }
                } else {
                    LoadingView().frame(minHeight: 160)
                }
                if let fileError {
                    Label(fileError, systemImage: "exclamationmark.circle.fill")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Brand.danger)
                        .accessibilityIdentifier("bacFileError")
                }
            }
            .padding(16)
        }
        .background(Brand.page)
        .navigationTitle(year.map { bank == .bac ? "BAC \($0)" : String($0) } ?? L10n.text(bank == .bac ? "bacBankShort" : "testsBank"))
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await loader.load(path, model: model, force: true) }
        .task { await loader.load(path, model: model) }
        .sheet(item: $viewing) { source in NavigationStack { PublicPDFReader(source: source) } }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 14) {
            if bank == .bac { YearTile(year: year, size: 72) }
            VStack(alignment: .leading, spacing: 6) {
                Text(title).font(.headline).fixedSize(horizontal: false, vertical: true)
                if !detail.isEmpty { Text(detail).font(.subheadline).foregroundStyle(.secondary) }
                HStack(spacing: 6) {
                    if official { Badge(text: L10n.text("bacOfficial"), tint: Brand.blue, icon: "checkmark.shield.fill") }
                    if let topic { Badge(text: String(format: L10n.text("bacTopic"), topic), tint: Brand.navy) }
                    if let term = loader.value?.term, bank == .tests { Badge(text: termName(term), tint: testsTint) }
                }
            }
            Spacer(minLength: 0)
        }
        .card()
    }

    @ViewBuilder
    private func files(_ paper: Bac.Paper) -> some View {
        HStack(spacing: 12) {
            if let link = paper.paper {
                PaperTile(title: L10n.text("bacPaper"), icon: "doc.text.fill", tint: Brand.blue, caption: link.inApp ? "PDF" : "Safari", busy: opening == link.url) {
                    Task { await open(link, title: L10n.text("bacPaper")) }
                }
                .disabled(opening != nil)
                .accessibilityIdentifier("bacOpenPaper")
            }
            if let link = paper.solution {
                PaperTile(title: L10n.text("bacSolution"), icon: "checkmark.seal.fill", tint: Brand.success, caption: link.inApp ? "PDF" : "Safari", busy: opening == link.url) {
                    Task { await open(link, title: L10n.text("bacSolution")) }
                }
                .disabled(opening != nil)
                .accessibilityIdentifier("bacOpenSolution")
            }
        }
        if let play = paper.play {
            NavigationLink { ExamLauncher(model: model, play: model.play, setID: play.id, title: play.title) } label: {
                HStack(spacing: 14) {
                    Image(systemName: "gamecontroller.fill").font(.title2).foregroundStyle(.white)
                        .frame(width: 52, height: 52)
                        .background(.white.opacity(0.18), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    VStack(alignment: .leading, spacing: 3) {
                        Text(L10n.text("playItInteractive")).font(.headline).foregroundStyle(.white)
                        Text(L10n.text("playItHint")).font(.caption).foregroundStyle(.white.opacity(0.85))
                    }
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.forward").foregroundStyle(.white.opacity(0.8))
                }
                .padding(16)
                .background(LinearGradient(colors: [Brand.blue, Brand.navy], startPoint: .topLeading, endPoint: .bottomTrailing),
                            in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("paperPlay")
        }
        VStack(alignment: .leading, spacing: 6) {
            if paper.solution == nil { note(L10n.text("bacNoSolution"), icon: "info.circle") }
            if paper.paper == nil && paper.solution == nil { note(L10n.text("bacFileUnavailable"), icon: "exclamationmark.circle") }
            if [paper.paper, paper.solution].contains(where: { $0 != nil && $0?.inApp == false }) { note(L10n.text("bacOpensBrowser"), icon: "safari") }
            if let source = paper.source { note(String(format: L10n.text("bacSource"), source.name), icon: "building.columns") }
        }
    }

    private func note(_ text: String, icon: String) -> some View {
        Label(text, systemImage: icon).font(.caption).foregroundStyle(.secondary)
    }

    private func open(_ link: Bac.Link, title: String) async {
        fileError = nil
        guard Bac.isSafe(link) else { fileError = L10n.text("bacFileUnavailable"); return }
        guard link.inApp else {
            if let url = URL(string: link.url) { openURL(url) }
            return
        }
        opening = link.url
        defer { opening = nil }
        do {
            let (data, _) = try await model.api.bytes(link.url, accept: "application/pdf")
            guard data.starts(with: Data("%PDF-".utf8)) else { throw APIFailure.invalid }
            viewing = .data(data, year.map { "\(title) · \($0)" } ?? title)
        } catch let failure as APIFailure {
            model.handle(failure)
            fileError = failure == .offline ? failure.message : L10n.text("bacFileUnavailable")
        } catch {
            fileError = L10n.text("bacFileUnavailable")
        }
    }
}

/// A large, square button: the paper or its solution.
private struct PaperTile: View {
    let title: String
    let icon: String
    let tint: Color
    let caption: String
    let busy: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 10) {
                ZStack {
                    Circle().fill(tint.opacity(0.14)).frame(width: 60, height: 60)
                    if busy { ProgressView() } else { Image(systemName: icon).font(.title2).foregroundStyle(tint) }
                }
                Text(title).font(.headline).foregroundStyle(.primary)
                Text(caption).font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, minHeight: 150)
            .background(Brand.card, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(tint.opacity(0.25), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}
