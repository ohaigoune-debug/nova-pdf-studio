import SwiftUI
import MadrasadzCore

// MARK: - Past BAC papers bank (free, as on the website)

/// The list with its filters. The first page is cached per account like every other
/// screen, so the bank still opens without a connection; further pages load on demand.
@MainActor
final class BacBankModel: ObservableObject {
    @Published private(set) var items: [Bac.Item] = []
    @Published private(set) var facets = Bac.Facets.empty
    @Published private(set) var total = 0
    @Published private(set) var nextCursor: String?
    @Published private(set) var loading = false
    @Published private(set) var failure: APIFailure?
    @Published private(set) var savedAt: Date?
    @Published private(set) var stream: String?
    @Published private(set) var subject: String?
    @Published private(set) var year: Int?
    private var started = false
    private var generation = 0

    func start(_ model: AppModel) async {
        guard !started else { return }
        started = true
        await reload(model, preselectStream: true)
    }

    func setStream(_ value: String?, _ model: AppModel) async { stream = value; await reload(model) }
    func setSubject(_ value: String?, _ model: AppModel) async { subject = value; await reload(model) }
    func setYear(_ value: Int?, _ model: AppModel) async { year = value; await reload(model) }

    func reload(_ model: AppModel, preselectStream: Bool = false) async {
        generation += 1
        let mine = generation
        let path = Bac.path(stream: stream, subject: subject, year: year)
        items = []
        nextCursor = nil
        failure = nil
        savedAt = nil
        if let cached = await model.cached(Bac.Page.self, path), mine == generation {
            apply(cached.value)
            savedAt = cached.savedAt
        }
        loading = true
        defer { if mine == generation { loading = false } }
        do {
            let page = try await model.fetch(Bac.Page.self, path)
            guard mine == generation else { return }
            // The student's own stream first, when the bank has papers for it.
            if preselectStream, stream == nil, let mineStream = page.myStreamId, page.facets.streams.contains(where: { $0.id == mineStream }) {
                stream = mineStream
                await reload(model)
                return
            }
            apply(page)
            savedAt = nil
        } catch let error as APIFailure {
            guard mine == generation else { return }
            failure = error
        } catch {}
    }

    func loadMore(_ model: AppModel) async {
        guard let cursor = nextCursor, !loading else { return }
        let mine = generation
        loading = true
        defer { if mine == generation { loading = false } }
        do {
            let page = try await model.fetch(Bac.Page.self, Bac.path(stream: stream, subject: subject, year: year, cursor: cursor))
            guard mine == generation else { return }
            let known = Set(items.map(\.id))
            items += page.items.filter { !known.contains($0.id) }
            nextCursor = page.nextCursor
        } catch let error as APIFailure {
            if mine == generation { failure = error }
        } catch {}
    }

    private func apply(_ page: Bac.Page) {
        items = page.items
        facets = page.facets
        total = page.total
        nextCursor = page.nextCursor
    }
}

struct BacBankView: View {
    @ObservedObject var model: AppModel
    @StateObject private var bank = BacBankModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                hero
                filters
                if bank.savedAt != nil || !model.online { OfflineBanner(savedAt: bank.savedAt) }
                if !bank.items.isEmpty {
                    LazyVStack(spacing: 10) {
                        ForEach(bank.items) { item in
                            NavigationLink { BacPaperView(model: model, item: item) } label: { BacRow(item: item) }
                                .buttonStyle(.plain)
                                .accessibilityIdentifier("bac-\(item.id)")
                        }
                    }
                    if bank.nextCursor != nil {
                        Button {
                            Task { await bank.loadMore(model) }
                        } label: {
                            HStack(spacing: 8) {
                                if bank.loading { ProgressView() }
                                Text(L10n.text("bacMore")).font(.subheadline.weight(.semibold))
                            }
                            .frame(maxWidth: .infinity, minHeight: 44)
                        }
                        .buttonStyle(.bordered)
                        .tint(Brand.blue)
                        .disabled(bank.loading)
                        .accessibilityIdentifier("bacMore")
                    }
                } else if bank.loading {
                    LoadingView().frame(minHeight: 220)
                } else if let failure = bank.failure {
                    FailureView(message: failure.message) { Task { await bank.reload(model) } }
                } else {
                    ContentUnavailableView(L10n.text("bacEmpty"), systemImage: "doc.text.magnifyingglass")
                        .accessibilityIdentifier("bacEmpty")
                }
            }
            .padding(16)
        }
        .background(Brand.page)
        .navigationTitle(L10n.text("bacBank"))
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await bank.reload(model) }
        .task { await bank.start(model) }
    }

    private var hero: some View {
        HStack(spacing: 14) {
            Image(systemName: "doc.text.magnifyingglass")
                .font(.title2.weight(.semibold))
                .foregroundStyle(Brand.navy)
                .frame(width: 52, height: 52)
                .background(.white, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            VStack(alignment: .leading, spacing: 4) {
                Text(L10n.text("bacBank")).font(.title3.bold()).foregroundStyle(.white)
                Text(L10n.text("bacBankHint")).font(.subheadline).foregroundStyle(.white.opacity(0.88))
                if bank.total > 0 {
                    Text(String(format: L10n.text("bacCount"), bank.total))
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
        .background(LinearGradient(colors: [Brand.blue, Brand.navy], startPoint: .topLeading, endPoint: .bottomTrailing),
                    in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }

    /// Three filter chips; a chosen filter turns blue.
    private var filters: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                FilterChip(title: bank.facets.streams.first(where: { $0.id == bank.stream })?.name ?? L10n.text("bacAllStreams"),
                           icon: "person.3.fill", active: bank.stream != nil) {
                    Button { Task { await bank.setStream(nil, model) } } label: { choice(L10n.text("bacAllStreams"), bank.stream == nil) }
                    ForEach(bank.facets.streams) { stream in
                        Button { Task { await bank.setStream(stream.id, model) } } label: { choice("\(stream.name) (\(stream.count))", bank.stream == stream.id) }
                    }
                }
                .accessibilityIdentifier("bacStream")
                FilterChip(title: bank.facets.subjects.first(where: { $0.id == bank.subject })?.name ?? L10n.text("bacAllSubjects"),
                           icon: "book.closed.fill", active: bank.subject != nil) {
                    Button { Task { await bank.setSubject(nil, model) } } label: { choice(L10n.text("bacAllSubjects"), bank.subject == nil) }
                    ForEach(bank.facets.subjects) { subject in
                        Button { Task { await bank.setSubject(subject.id, model) } } label: { choice("\(subject.name) (\(subject.count))", bank.subject == subject.id) }
                    }
                }
                .accessibilityIdentifier("bacSubject")
                FilterChip(title: bank.year.map { String($0) } ?? L10n.text("bacAllYears"), icon: "calendar", active: bank.year != nil) {
                    Button { Task { await bank.setYear(nil, model) } } label: { choice(L10n.text("bacAllYears"), bank.year == nil) }
                    ForEach(bank.facets.years) { year in
                        Button { Task { await bank.setYear(year.year, model) } } label: { choice("\(year.year) (\(year.count))", bank.year == year.year) }
                    }
                }
                .accessibilityIdentifier("bacYear")
            }
            .padding(.vertical, 2)
        }
    }

    @ViewBuilder
    private func choice(_ title: String, _ selected: Bool) -> some View {
        if selected { Label(title, systemImage: "checkmark") } else { Text(verbatim: title) }
    }
}

/// A rounded filter button that opens its choices.
private struct FilterChip<Items: View>: View {
    let title: String
    let icon: String
    let active: Bool
    @ViewBuilder let items: () -> Items

    var body: some View {
        Menu {
            items()
        } label: {
            HStack(spacing: 6) {
                Image(systemName: icon).font(.caption)
                Text(verbatim: title).font(.subheadline.weight(.semibold)).lineLimit(1)
                Image(systemName: "chevron.down").font(.caption2.weight(.bold))
            }
            .padding(.horizontal, 14).padding(.vertical, 9)
            .foregroundStyle(active ? Color.white : Color.primary)
            .background(active ? Brand.blue : Brand.card, in: Capsule())
            .overlay(Capsule().stroke(active ? Color.clear : Color.secondary.opacity(0.18), lineWidth: 1))
        }
    }
}

/// The year in a tile, like the cover of a paper.
private struct YearTile: View {
    let year: Int?
    var size: CGFloat = 58

    var body: some View {
        VStack(spacing: 0) {
            Text(verbatim: "BAC").font(.caption2.weight(.heavy)).opacity(0.75)
            Text(verbatim: year.map { String($0) } ?? "—").font(size > 60 ? .title2.bold() : .headline.bold())
        }
        .foregroundStyle(Brand.blue)
        .frame(width: size, height: size)
        .background(Brand.sky, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .environment(\.layoutDirection, .leftToRight)
    }
}

private struct BacRow: View {
    let item: Bac.Item

    var body: some View {
        HStack(spacing: 14) {
            YearTile(year: item.year)
            VStack(alignment: .leading, spacing: 6) {
                Text(item.title)
                    .font(.subheadline.bold())
                    .foregroundStyle(.primary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                if !item.detail.isEmpty {
                    Text(item.detail).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                }
                HStack(spacing: 6) {
                    if let topic = item.topic { Badge(text: String(format: L10n.text("bacTopic"), topic), tint: Brand.navy) }
                    if item.hasSolution { Badge(text: L10n.text("bacSolution"), tint: Brand.success, icon: "checkmark.seal.fill") }
                }
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.forward").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary)
        }
        .card()
    }
}

private struct Badge: View {
    let text: String
    let tint: Color
    var icon: String?

    var body: some View {
        HStack(spacing: 4) {
            if let icon { Image(systemName: icon) }
            Text(text)
        }
        .font(.caption2.weight(.bold))
        .foregroundStyle(tint)
        .padding(.horizontal, 8).padding(.vertical, 3)
        .background(tint.opacity(0.12), in: Capsule())
    }
}

struct BacPaperView: View {
    @ObservedObject var model: AppModel
    let item: Bac.Item
    @StateObject private var loader = Loader<Bac.Paper>()
    @State private var viewing: PDFSource?
    @State private var opening: String?
    @State private var fileError: String?
    @Environment(\.openURL) private var openURL

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
        .navigationTitle(item.year.map { "BAC \($0)" } ?? L10n.text("bacBank"))
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await loader.load(path, model: model, force: true) }
        .task { await loader.load(path, model: model) }
        .sheet(item: $viewing) { source in NavigationStack { PublicPDFReader(source: source) } }
    }

    private var path: String { "/api/v1/ios/bac/\(item.id)" }

    private var header: some View {
        HStack(alignment: .top, spacing: 14) {
            YearTile(year: item.year, size: 72)
            VStack(alignment: .leading, spacing: 6) {
                Text(item.title).font(.headline).fixedSize(horizontal: false, vertical: true)
                if !item.detail.isEmpty { Text(item.detail).font(.subheadline).foregroundStyle(.secondary) }
                HStack(spacing: 6) {
                    if item.official { Badge(text: L10n.text("bacOfficial"), tint: Brand.blue, icon: "checkmark.shield.fill") }
                    if let topic = item.topic { Badge(text: String(format: L10n.text("bacTopic"), topic), tint: Brand.navy) }
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
                FileTile(title: L10n.text("bacPaper"), icon: "doc.text.fill", tint: Brand.blue, browser: !link.inApp, busy: opening == link.url) {
                    Task { await open(link, title: L10n.text("bacPaper")) }
                }
                .disabled(opening != nil)
                .accessibilityIdentifier("bacOpenPaper")
            }
            if let link = paper.solution {
                FileTile(title: L10n.text("bacSolution"), icon: "checkmark.seal.fill", tint: Brand.success, browser: !link.inApp, busy: opening == link.url) {
                    Task { await open(link, title: L10n.text("bacSolution")) }
                }
                .disabled(opening != nil)
                .accessibilityIdentifier("bacOpenSolution")
            }
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
            viewing = .data(data, item.year.map { "\(title) · BAC \($0)" } ?? title)
        } catch let failure as APIFailure {
            model.handle(failure)
            fileError = failure == .offline ? failure.message : L10n.text("bacFileUnavailable")
        } catch {
            fileError = L10n.text("bacFileUnavailable")
        }
    }
}

/// A large, square button: the paper or its solution.
private struct FileTile: View {
    let title: String
    let icon: String
    let tint: Color
    let browser: Bool
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
                Label(browser ? "Safari" : "PDF", systemImage: browser ? "safari" : "doc.richtext")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, minHeight: 150)
            .background(Brand.card, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(tint.opacity(0.25), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

/// A public PDF (BAC paper or solution): no account mark, nothing saved on the phone.
struct PublicPDFReader: View {
    let source: PDFSource
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        PDFKitRepresentable(source: source)
            .ignoresSafeArea(edges: .bottom)
            .navigationTitle(source.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button(L10n.text("close")) { dismiss() } } }
    }
}
