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
        List {
            Section { filters }
            if !bank.items.isEmpty {
                Section {
                    ForEach(bank.items) { item in
                        NavigationLink { BacPaperView(model: model, item: item) } label: { BacRow(item: item) }
                            .accessibilityIdentifier("bac-\(item.id)")
                    }
                    if bank.nextCursor != nil {
                        Button {
                            Task { await bank.loadMore(model) }
                        } label: {
                            HStack {
                                Text(L10n.text("bacMore"))
                                if bank.loading { Spacer(); ProgressView() }
                            }
                        }
                        .disabled(bank.loading)
                        .accessibilityIdentifier("bacMore")
                    }
                } header: {
                    Text(String(format: L10n.text("bacCount"), bank.total))
                }
            } else if bank.loading {
                Section { LoadingView() }
            } else if let failure = bank.failure {
                Section { FailureView(message: failure.message) { Task { await bank.reload(model) } } }
            } else {
                Section { Text(L10n.text("bacEmpty")).foregroundStyle(.secondary).accessibilityIdentifier("bacEmpty") }
            }
            if bank.savedAt != nil || !model.online {
                Section { OfflineBanner(savedAt: bank.savedAt).listRowInsets(EdgeInsets()) }
            }
        }
        .navigationTitle(L10n.text("bacBank"))
        .refreshable { await bank.reload(model) }
        .task { await bank.start(model) }
    }

    @ViewBuilder
    private var filters: some View {
        Picker(L10n.text("bacStreamLabel"), selection: Binding(get: { bank.stream }, set: { value in Task { await bank.setStream(value, model) } })) {
            Text(L10n.text("bacAllStreams")).tag(String?.none)
            ForEach(bank.facets.streams) { stream in Text(verbatim: "\(stream.name) (\(stream.count))").tag(String?.some(stream.id)) }
        }
        .pickerStyle(.menu)
        .accessibilityIdentifier("bacStream")
        Picker(L10n.text("bacSubjectLabel"), selection: Binding(get: { bank.subject }, set: { value in Task { await bank.setSubject(value, model) } })) {
            Text(L10n.text("bacAllSubjects")).tag(String?.none)
            ForEach(bank.facets.subjects) { subject in Text(verbatim: "\(subject.name) (\(subject.count))").tag(String?.some(subject.id)) }
        }
        .pickerStyle(.menu)
        .accessibilityIdentifier("bacSubject")
        Picker(L10n.text("bacYearLabel"), selection: Binding(get: { bank.year }, set: { value in Task { await bank.setYear(value, model) } })) {
            Text(L10n.text("bacAllYears")).tag(Int?.none)
            ForEach(bank.facets.years) { year in Text(verbatim: "\(year.year) (\(year.count))").tag(Int?.some(year.year)) }
        }
        .pickerStyle(.menu)
        .accessibilityIdentifier("bacYear")
    }
}

private struct BacRow: View {
    let item: Bac.Item

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(item.title).font(.subheadline.bold()).multilineTextAlignment(.leading)
            HStack(spacing: 6) {
                if let year = item.year {
                    Text(verbatim: "BAC \(year)")
                        .font(.caption2.bold())
                        .padding(.horizontal, 7).padding(.vertical, 2)
                        .background(Brand.blue.opacity(0.12), in: Capsule())
                        .foregroundStyle(Brand.blue)
                }
                if !item.detail.isEmpty { Text(item.detail).font(.caption).foregroundStyle(.secondary).lineLimit(1) }
            }
            if item.hasSolution {
                Label(L10n.text("bacSolution"), systemImage: "checkmark.seal.fill").font(.caption2.weight(.semibold)).foregroundStyle(Brand.success)
            }
        }
        .padding(.vertical, 2)
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
                VStack(alignment: .leading, spacing: 8) {
                    Text(item.title).font(.title3.bold())
                    if !item.detail.isEmpty { Text(item.detail).font(.subheadline).foregroundStyle(.secondary) }
                    if item.official {
                        Label(L10n.text("bacOfficial"), systemImage: "checkmark.shield.fill").font(.caption.weight(.semibold)).foregroundStyle(Brand.blue)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .card()

                if let paper = loader.value {
                    files(paper)
                } else if let failure = loader.failure {
                    FailureView(message: failure.message) { Task { await loader.load(path, model: model, force: true) } }
                } else {
                    LoadingView()
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

    @ViewBuilder
    private func files(_ paper: Bac.Paper) -> some View {
        VStack(spacing: 12) {
            if let link = paper.paper {
                fileButton(L10n.text("bacPaper"), icon: "doc.text.fill", link: link, id: "bacOpenPaper", prominent: true)
            }
            if let link = paper.solution {
                fileButton(L10n.text("bacSolution"), icon: "checkmark.seal.fill", link: link, id: "bacOpenSolution", prominent: false)
            } else {
                Text(L10n.text("bacNoSolution")).font(.footnote).foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .leading)
            }
            if paper.paper == nil && paper.solution == nil {
                Text(L10n.text("bacFileUnavailable")).font(.footnote).foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .leading)
            }
            if [paper.paper, paper.solution].contains(where: { $0 != nil && $0?.inApp == false }) {
                Text(L10n.text("bacOpensBrowser")).font(.caption).foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .leading)
            }
            if let source = paper.source {
                Text(String(format: L10n.text("bacSource"), source.name)).font(.caption).foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    @ViewBuilder
    private func fileButton(_ title: String, icon: String, link: Bac.Link, id: String, prominent: Bool) -> some View {
        let button = Button {
            Task { await open(link, title: title) }
        } label: {
            HStack(spacing: 10) {
                if opening == link.url { ProgressView() } else { Image(systemName: link.inApp ? icon : "safari") }
                Text(title).font(.headline)
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, minHeight: 44)
        }
        .disabled(opening != nil)
        .accessibilityIdentifier(id)
        if prominent {
            button.buttonStyle(.borderedProminent).tint(Brand.blue)
        } else {
            button.buttonStyle(.bordered)
        }
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
