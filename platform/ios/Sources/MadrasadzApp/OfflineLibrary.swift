import SwiftUI
import UIKit
import PDFKit

/// A PDF the teacher allows to download, kept inside the app for one account.
struct OfflineDocument: Codable, Identifiable, Equatable {
    let id: UUID
    var title: String
    var bytes: Int64
    var downloadedAt: Date
    var verifiedAt: Date
}

private struct OfflineIndex: Codable {
    var owner: String
    var documents: [OfflineDocument]
}

private struct FetchedPDF {
    let file: URL
    let title: String
    let bytes: Int64
}

private enum OfflineFetchError: Error {
    /// The server refused this account (403/404): access, terms or allowDownload changed.
    case denied
    case unauthenticated
    case invalid
}

/// URLSession delegate that reports download progress and refuses redirects.
private final class OfflineDownloadDelegate: NSObject, URLSessionDownloadDelegate {
    private let onProgress: (Double) -> Void
    private let lock = NSLock()
    private var continuation: CheckedContinuation<(URL, URLResponse), Error>?

    init(onProgress: @escaping (Double) -> Void) {
        self.onProgress = onProgress
    }

    func start(_ task: URLSessionDownloadTask, continuation: CheckedContinuation<(URL, URLResponse), Error>) {
        lock.lock()
        self.continuation = continuation
        lock.unlock()
        task.resume()
    }

    private func finish(_ result: Result<(URL, URLResponse), Error>) {
        lock.lock()
        let pending = continuation
        continuation = nil
        lock.unlock()
        pending?.resume(with: result)
    }

    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64,
                    totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
        guard totalBytesExpectedToWrite > 0 else { return }
        onProgress(min(1, Double(totalBytesWritten) / Double(totalBytesExpectedToWrite)))
    }

    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
        // The system deletes `location` when this method returns: move it first.
        let target = FileManager.default.temporaryDirectory
            .appendingPathComponent("madrasadz-\(UUID().uuidString).download")
        do {
            try FileManager.default.moveItem(at: location, to: target)
            guard let response = downloadTask.response else { throw URLError(.badServerResponse) }
            finish(.success((target, response)))
        } catch {
            finish(.failure(error))
        }
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let error { finish(.failure(error)) }
    }

    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest,
                    completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

/// In-app offline copies of teacher-allowed PDFs (owner decision, 27 October 2026).
/// The server re-checks session, enrolment, terms, READY, PDF MIME, allowDownload and
/// 25 MiB on every download and re-check; a URL or anchor is never an entitlement.
/// One account owns the library at a time; another verified account, sign-out or an
/// expired session removes every file. Files use complete data protection and are
/// excluded from backups. Videos are never downloaded.
@MainActor
final class OfflineLibrary: ObservableObject {
    static let offlineValidity: TimeInterval = 30 * 24 * 3600
    static let recheckAfter: TimeInterval = 24 * 3600
    static let maximumBytes: UInt64 = 25 * 1024 * 1024
    static let maximumDocuments = 200

    @Published private(set) var documents: [OfflineDocument] = []
    @Published private(set) var progress: Double?
    @Published var notice: String?
    private(set) var owner: String?
    private var generation = 0
    private var downloading = false
    private var rechecking = false
    private let root: URL

    init() {
        root = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("OfflineDownloads", isDirectory: true)
        loadIndex()
    }

    private var indexURL: URL { root.appendingPathComponent("index.json") }

    func fileURL(for document: OfflineDocument) -> URL { fileURL(for: document.id) }

    private func fileURL(for id: UUID) -> URL {
        root.appendingPathComponent(id.uuidString.lowercased() + ".pdf")
    }

    func isUsable(_ document: OfflineDocument) -> Bool {
        Date().timeIntervalSince(document.verifiedAt) <= Self.offlineValidity
    }

    private func loadIndex() {
        guard let data = try? Data(contentsOf: indexURL),
              let index = try? JSONDecoder().decode(OfflineIndex.self, from: data),
              UUID(uuidString: index.owner) != nil else {
            owner = nil
            documents = []
            return
        }
        owner = index.owner.lowercased()
        documents = index.documents.filter { FileManager.default.fileExists(atPath: fileURL(for: $0.id).path) }
    }

    private func prepareRoot() throws {
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true,
                                                attributes: [.protectionKey: FileProtectionType.complete])
        var directory = root
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try directory.setResourceValues(values)
    }

    private func saveIndex() throws {
        try prepareRoot()
        guard let owner else {
            try? FileManager.default.removeItem(at: indexURL)
            return
        }
        let data = try JSONEncoder().encode(OfflineIndex(owner: owner, documents: documents))
        try data.write(to: indexURL, options: [.atomic, .completeFileProtection])
    }

    /// A verified account other than the owner never sees or keeps the owner's files.
    func accountVerified(_ account: String) {
        if let owner, owner != account.lowercased() { purgeAll() }
    }

    /// Removes every offline file and the index. Returns false if removal failed.
    @discardableResult
    func purgeAll() -> Bool {
        generation += 1
        downloading = false
        progress = nil
        documents = []
        owner = nil
        guard FileManager.default.fileExists(atPath: root.path) else { return true }
        do {
            try FileManager.default.removeItem(at: root)
            return true
        } catch {
            return false
        }
    }

    func remove(_ document: OfflineDocument) {
        try? FileManager.default.removeItem(at: fileURL(for: document.id))
        documents.removeAll { $0.id == document.id }
        try? saveIndex()
    }

    func download(contentID: UUID, browser: BrowserController,
                  currentAccount: @escaping @MainActor () -> String?) async {
        guard !downloading, let account = currentAccount()?.lowercased(), UUID(uuidString: account) != nil else { return }
        if let owner, owner != account { purgeAll() }
        guard documents.count < Self.maximumDocuments || documents.contains(where: { $0.id == contentID }) else {
            notice = L10n.text("downloadLimit")
            return
        }
        generation += 1
        let revision = generation
        downloading = true
        progress = 0
        defer {
            if generation == revision {
                downloading = false
                progress = nil
            }
        }
        do {
            let fetched = try await fetch(contentID: contentID, browser: browser, account: account) { [weak self] value in
                guard let self, self.generation == revision else { return }
                self.progress = value
            }
            defer { try? FileManager.default.removeItem(at: fetched.file) }
            guard generation == revision, currentAccount()?.lowercased() == account else { return }
            try store(fetched, contentID: contentID, account: account)
            notice = L10n.text("downloaded")
        } catch {
            guard generation == revision else { return }
            notice = L10n.text("downloadFailed")
        }
    }

    /// Re-check files older than a day while the account is verified and online.
    /// A server refusal removes the file; offline or transient errors keep it
    /// within the 30-day validity window.
    func recheck(browser: BrowserController, currentAccount: @escaping @MainActor () -> String?) async {
        guard !rechecking, !downloading, let account = currentAccount()?.lowercased() else { return }
        if let owner, owner != account {
            purgeAll()
            return
        }
        let stale = documents.filter { Date().timeIntervalSince($0.verifiedAt) > Self.recheckAfter }
        guard !stale.isEmpty else { return }
        rechecking = true
        defer { rechecking = false }
        let revision = generation
        var removed = 0
        for document in stale {
            guard generation == revision, currentAccount()?.lowercased() == account else { return }
            do {
                let fetched = try await fetch(contentID: document.id, browser: browser, account: account) { _ in }
                defer { try? FileManager.default.removeItem(at: fetched.file) }
                guard generation == revision, currentAccount()?.lowercased() == account else { return }
                try store(fetched, contentID: document.id, account: account)
            } catch OfflineFetchError.denied {
                guard generation == revision else { return }
                remove(document)
                removed += 1
            } catch {
                continue
            }
        }
        if removed > 0, generation == revision { notice = L10n.text("downloadRevoked") }
    }

    private func store(_ fetched: FetchedPDF, contentID: UUID, account: String) throws {
        try prepareRoot()
        let destination = fileURL(for: contentID)
        if FileManager.default.fileExists(atPath: destination.path) {
            try FileManager.default.removeItem(at: destination)
        }
        try FileManager.default.moveItem(at: fetched.file, to: destination)
        try FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: destination.path)
        let now = Date()
        owner = account
        if let index = documents.firstIndex(where: { $0.id == contentID }) {
            documents[index].title = fetched.title
            documents[index].bytes = fetched.bytes
            documents[index].verifiedAt = now
        } else {
            documents.insert(OfflineDocument(id: contentID, title: fetched.title, bytes: fetched.bytes,
                                             downloadedAt: now, verifiedAt: now), at: 0)
        }
        try saveIndex()
    }

    private func fetch(contentID: UUID, browser: BrowserController, account: String,
                       progress: @escaping @MainActor (Double) -> Void) async throws -> FetchedPDF {
        guard browser.baseURL.scheme == "https", browser.baseURL.host == "madrasadz.com" else {
            throw OfflineFetchError.invalid
        }
        let cookies: [HTTPCookie] = await withCheckedContinuation { continuation in
            browser.webView.configuration.websiteDataStore.httpCookieStore.getAllCookies { continuation.resume(returning: $0) }
        }
        let sessionCookies = cookies.filter {
            $0.name == "madrasa_session" && $0.isSecure && $0.isHTTPOnly && $0.path == "/"
            && $0.domain.trimmingCharacters(in: CharacterSet(charactersIn: ".")).lowercased() == "madrasadz.com"
            && ($0.expiresDate == nil || $0.expiresDate! > Date())
        }
        guard sessionCookies.count == 1,
              let url = URL(string: "/api/v1/ios/materials/\(contentID.uuidString.lowercased())/export",
                            relativeTo: browser.baseURL)?.absoluteURL else {
            throw OfflineFetchError.unauthenticated
        }
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 60)
        request.setValue("application/pdf", forHTTPHeaderField: "Accept")
        for (name, value) in HTTPCookie.requestHeaderFields(with: sessionCookies) {
            request.setValue(value, forHTTPHeaderField: name)
        }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpShouldSetCookies = false
        configuration.httpCookieStorage = nil
        configuration.urlCache = nil
        let delegate = OfflineDownloadDelegate { value in
            Task { @MainActor in progress(value) }
        }
        let session = URLSession(configuration: configuration, delegate: delegate, delegateQueue: nil)
        defer { session.finishTasksAndInvalidate() }
        let (file, response) = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<(URL, URLResponse), Error>) in
            delegate.start(session.downloadTask(with: request), continuation: continuation)
        }
        var keep = false
        defer { if !keep { try? FileManager.default.removeItem(at: file) } }
        guard let http = response as? HTTPURLResponse else { throw OfflineFetchError.invalid }
        if http.statusCode == 401 { throw OfflineFetchError.unauthenticated }
        if http.statusCode == 403 || http.statusCode == 404 { throw OfflineFetchError.denied }
        guard http.statusCode == 200, http.url?.host == "madrasadz.com", http.url?.scheme == "https",
              http.url?.path == url.path, http.mimeType == "application/pdf",
              http.value(forHTTPHeaderField: "X-Madrasadz-Account")?.lowercased() == account else {
            throw OfflineFetchError.invalid
        }
        let handle = try FileHandle(forReadingFrom: file)
        defer { try? handle.close() }
        let bytes = try handle.seekToEnd()
        guard bytes > 0, bytes <= Self.maximumBytes else { throw OfflineFetchError.invalid }
        try handle.seek(toOffset: 0)
        guard try handle.read(upToCount: 5) == Data("%PDF-".utf8) else { throw OfflineFetchError.invalid }
        keep = true
        return FetchedPDF(file: file, title: Self.title(from: http) ?? "PDF", bytes: Int64(bytes))
    }

    /// Title from `Content-Disposition: attachment; filename*=UTF-8''…`.
    private static func title(from response: HTTPURLResponse) -> String? {
        guard let header = response.value(forHTTPHeaderField: "Content-Disposition"),
              let range = header.range(of: "filename*=UTF-8''") else { return nil }
        let encoded = header[range.upperBound...].split(separator: ";").first.map(String.init) ?? ""
        guard var name = encoded.removingPercentEncoding?.trimmingCharacters(in: .whitespacesAndNewlines),
              !name.isEmpty else { return nil }
        if name.lowercased().hasSuffix(".pdf") { name = String(name.dropLast(4)) }
        return String(name.prefix(200))
    }
}

/// Determinate progress ring for an in-app download.
struct DownloadProgressRing: View {
    let value: Double
    var body: some View {
        VStack(spacing: 12) {
            ZStack {
                Circle().stroke(Color.secondary.opacity(0.25), lineWidth: 6)
                Circle().trim(from: 0, to: max(0.02, value))
                    .stroke(Color.accentColor, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                Text("\(Int((value * 100).rounded()))%").font(.footnote.monospacedDigit().bold())
            }
            .frame(width: 64, height: 64)
            Text(L10n.text("downloading")).font(.footnote)
        }
        .padding(24)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("downloadProgress")
    }
}

struct OfflineDownloadsView: View {
    @ObservedObject var library: OfflineLibrary

    var body: some View {
        Group {
            if library.documents.isEmpty {
                ContentUnavailableView {
                    Label(L10n.text("downloadsEmpty"), systemImage: "arrow.down.circle")
                } description: {
                    Text(L10n.text("downloadsEmptyBody"))
                }
            } else {
                List {
                    Section {
                        ForEach(library.documents) { document in
                            NavigationLink {
                                OfflinePDFViewer(library: library, document: document)
                            } label: {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(document.title).font(.headline)
                                    HStack(spacing: 8) {
                                        Text(ByteCountFormatter.string(fromByteCount: document.bytes, countStyle: .file))
                                        Text(document.downloadedAt, style: .date)
                                        if !library.isUsable(document) {
                                            Image(systemName: "wifi.exclamationmark").accessibilityLabel(L10n.text("downloadNeedsCheck"))
                                        }
                                    }
                                    .font(.caption).foregroundStyle(.secondary)
                                }
                                .padding(.vertical, 4)
                            }
                            .swipeActions {
                                Button(L10n.text("delete"), role: .destructive) { library.remove(document) }
                            }
                        }
                    } footer: {
                        Text(L10n.text("downloadsFooter"))
                    }
                }
            }
        }
        .navigationTitle(L10n.text("downloads"))
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct OfflinePDFViewer: View {
    @ObservedObject var library: OfflineLibrary
    let document: OfflineDocument

    var body: some View {
        Group {
            if library.isUsable(document) {
                PDFKitView(url: library.fileURL(for: document))
                    .overlay { watermark.allowsHitTesting(false) }
                    .ignoresSafeArea(edges: .bottom)
            } else {
                ContentUnavailableView {
                    Label(L10n.text("downloads"), systemImage: "wifi.exclamationmark")
                } description: {
                    Text(L10n.text("downloadNeedsCheck"))
                }
            }
        }
        .navigationTitle(document.title)
        .navigationBarTitleDisplayMode(.inline)
    }

    /// Same idea as the web viewer: a light, account-bound mark (no e-mail stored).
    private var watermark: some View {
        let mark = "madrasadz · \((library.owner ?? "").prefix(8)) · \(document.downloadedAt.formatted(date: .numeric, time: .omitted))"
        return VStack(spacing: 140) {
            ForEach(0..<4, id: \.self) { _ in
                Text(mark).font(.caption).foregroundStyle(Color.gray.opacity(0.25)).rotationEffect(.degrees(-24))
            }
        }
        .environment(\.layoutDirection, .leftToRight)
    }
}

private struct PDFKitView: UIViewRepresentable {
    let url: URL
    func makeUIView(context: Context) -> PDFView {
        let view = PDFView()
        view.autoScales = true
        view.displayMode = .singlePageContinuous
        view.displayDirection = .vertical
        view.document = PDFDocument(url: url)
        return view
    }
    func updateUIView(_ view: PDFView, context: Context) {
        if view.document?.documentURL != url { view.document = PDFDocument(url: url) }
    }
}
