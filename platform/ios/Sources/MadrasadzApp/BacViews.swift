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
    private let preset: Bool

    init(stream: String? = nil, subject: String? = nil) {
        preset = stream != nil || subject != nil
        self.stream = stream
        self.subject = subject
    }

    func start(_ model: AppModel) async {
        guard !started else { return }
        started = true
        await reload(model, preselectStream: !preset)
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

/// Step 1: the stream (the student's own, chosen for him) and the subjects as large tiles.
struct BacBankView: View {
    @ObservedObject var model: AppModel
    @StateObject private var bank = BacBankModel()

    private let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                hero
                streamChip
                if bank.savedAt != nil || !model.online { OfflineBanner(savedAt: bank.savedAt) }
                if !bank.facets.subjects.isEmpty {
                    Text(L10n.text("chooseSubject")).font(.title3.bold())
                    LazyVGrid(columns: columns, spacing: 12) {
                        ForEach(bank.facets.subjects) { subject in
                            NavigationLink { BacListView(model: model, stream: bank.stream, subject: subject) } label: {
                                StepTile(title: subject.name, detail: String(format: L10n.text("bacCount"), subject.count), icon: SubjectStyle.symbol(for: subject.name), tint: SubjectStyle.tint(for: subject.name))
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("bacSubject-\(subject.id)")
                        }
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
        StepHero(icon: "scroll.fill", title: L10n.text("bacBank"), text: L10n.text("bacBankHint"),
                 badge: bank.total > 0 ? String(format: L10n.text("bacCount"), bank.total) : nil, colors: [Brand.blue, Brand.navy])
    }

    private var streamChip: some View {
        FilterChip(title: bank.facets.streams.first(where: { $0.id == bank.stream })?.name ?? L10n.text("bacAllStreams"),
                   icon: "person.3.fill", active: bank.stream != nil) {
            Button { Task { await bank.setStream(nil, model) } } label: { choice(L10n.text("bacAllStreams"), bank.stream == nil) }
            ForEach(bank.facets.streams) { stream in
                Button { Task { await bank.setStream(stream.id, model) } } label: { choice("\(stream.name) (\(stream.count))", bank.stream == stream.id) }
            }
        }
        .accessibilityIdentifier("bacStream")
    }
}

/// Step 2: the papers of one subject, newest year first, grouped by year.
struct BacListView: View {
    @ObservedObject var model: AppModel
    let subject: Bac.Facet
    @StateObject private var bank: BacBankModel

    init(model: AppModel, stream: String?, subject: Bac.Facet) {
        self.model = model
        self.subject = subject
        _bank = StateObject(wrappedValue: BacBankModel(stream: stream, subject: subject.id))
    }

    private var years: [(year: Int?, items: [Bac.Item])] {
        var order: [Int?] = []
        var groups: [Int?: [Bac.Item]] = [:]
        for item in bank.items {
            if groups[item.year] == nil { order.append(item.year) }
            groups[item.year, default: []].append(item)
        }
        return order.map { ($0, groups[$0] ?? []) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if bank.savedAt != nil || !model.online { OfflineBanner(savedAt: bank.savedAt) }
                if !bank.items.isEmpty {
                    ForEach(years, id: \.year) { group in
                        VStack(alignment: .leading, spacing: 10) {
                            Text(verbatim: group.year.map { "BAC \($0)" } ?? "—").font(.headline).foregroundStyle(Brand.navy)
                            ForEach(group.items) { item in
                                NavigationLink {
                                    PaperView(model: model, id: item.id, bank: .bac, title: item.title, year: item.year, detail: item.detail, official: item.official, topic: item.topic)
                                } label: { BacRow(item: item) }
                                .buttonStyle(.plain)
                                .accessibilityIdentifier("bac-\(item.id)")
                            }
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
                }
            }
            .padding(16)
        }
        .background(Brand.page)
        .navigationTitle(subject.name)
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await bank.reload(model) }
        .task { await bank.start(model) }
    }
}

@ViewBuilder
func choice(_ title: String, _ selected: Bool) -> some View {
    if selected { Label(title, systemImage: "checkmark") } else { Text(verbatim: title) }
}

/// A rounded filter button that opens its choices.
struct FilterChip<Items: View>: View {
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
struct YearTile: View {
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

struct Badge: View {
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
