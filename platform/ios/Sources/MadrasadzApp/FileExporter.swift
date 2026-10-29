import SwiftUI
import UIKit
import WebKit

struct ExportedDocument: Identifiable {
    let id = UUID()
    let url: URL
}

private final class NoExportRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest,
                    completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}

/// Temporary, explicitly authorized PDF sharing, not an offline course library.
/// Cookie credentials stay in memory; no signed media URL is shared or persisted.
@MainActor
final class FileExporter: ObservableObject {
    @Published var document: ExportedDocument?
    @Published var busy = false
    @Published var notice: String?
    private var generation = 0
    private let directory: URL

    init() {
        directory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("TemporaryLessonExports", isDirectory: true)
        reset()
    }

    func reset() {
        generation += 1
        document = nil
        busy = false
        if FileManager.default.fileExists(atPath: directory.path) {
            do { try FileManager.default.removeItem(at: directory) }
            catch { notice = L10n.text("localCleanupFailed") }
        }
    }

    func export(contentID: UUID, browser: BrowserController,
                currentAccount: @escaping @MainActor () -> String?) async {
        guard !busy, let account = currentAccount(), UUID(uuidString: account) != nil,
              browser.baseURL.scheme == "https", browser.baseURL.host == "madrasadz.com" else { return }
        generation += 1
        let revision = generation
        busy = true
        defer { if generation == revision { busy = false } }
        do {
            let cookies: [HTTPCookie] = await withCheckedContinuation { continuation in
                browser.webView.configuration.websiteDataStore.httpCookieStore.getAllCookies { continuation.resume(returning: $0) }
            }
            guard generation == revision, currentAccount() == account else { return }
            let sessionCookies = cookies.filter {
                $0.name == "madrasa_session" && $0.isSecure && $0.isHTTPOnly && $0.path == "/"
                && $0.domain.trimmingCharacters(in: CharacterSet(charactersIn: ".")).lowercased() == "madrasadz.com"
                && ($0.expiresDate == nil || $0.expiresDate! > Date())
            }
            guard sessionCookies.count == 1,
                  let url = URL(string: "/api/v1/ios/materials/\(contentID.uuidString.lowercased())/export", relativeTo: browser.baseURL)?.absoluteURL else { throw URLError(.userAuthenticationRequired) }
            var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30)
            request.setValue("application/pdf", forHTTPHeaderField: "Accept")
            for (name, value) in HTTPCookie.requestHeaderFields(with: sessionCookies) { request.setValue(value, forHTTPHeaderField: name) }
            let configuration = URLSessionConfiguration.ephemeral
            configuration.httpShouldSetCookies = false
            configuration.httpCookieStorage = nil
            configuration.urlCache = nil
            let session = URLSession(configuration: configuration, delegate: NoExportRedirects(), delegateQueue: nil)
            defer { session.invalidateAndCancel() }
            let (temporary, response) = try await session.download(for: request)
            defer { try? FileManager.default.removeItem(at: temporary) }
            guard generation == revision, currentAccount() == account else { return }
            guard let http = response as? HTTPURLResponse, http.statusCode == 200,
                  http.url?.host == "madrasadz.com", http.url?.scheme == "https",
                  http.url?.path == url.path, http.mimeType == "application/pdf",
                  http.value(forHTTPHeaderField: "X-Madrasadz-Account")?.lowercased() == account.lowercased() else { throw URLError(.noPermissionsToReadFile) }
            let handle = try FileHandle(forReadingFrom: temporary)
            defer { try? handle.close() }
            let bytes = try handle.seekToEnd()
            guard bytes > 0, bytes <= 25 * 1024 * 1024 else { throw URLError(.dataLengthExceedsMaximum) }
            try handle.seek(toOffset: 0)
            let magic = try handle.read(upToCount: 5)
            guard magic == Data("%PDF-".utf8) else { throw URLError(.cannotDecodeContentData) }
            let accountDirectory = directory.appendingPathComponent(account, isDirectory: true)
            try FileManager.default.createDirectory(at: accountDirectory, withIntermediateDirectories: true,
                attributes: [.protectionKey: FileProtectionType.complete])
            var rootDirectory = directory
            var resources = URLResourceValues()
            resources.isExcludedFromBackup = true
            try rootDirectory.setResourceValues(resources)
            let destination = accountDirectory.appendingPathComponent("Madrasadz-\(UUID().uuidString).pdf")
            try FileManager.default.copyItem(at: temporary, to: destination)
            try FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: destination.path)
            guard generation == revision, currentAccount() == account else { reset(); return }
            document = ExportedDocument(url: destination)
        } catch {
            guard generation == revision, currentAccount() == account else { return }
            reset()
            notice = L10n.text("exportDenied")
        }
    }
}

struct DocumentShareSheet: UIViewControllerRepresentable {
    let url: URL
    let onFinish: () -> Void
    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        controller.completionWithItemsHandler = { _, _, _, _ in Task { @MainActor in onFinish() } }
        return controller
    }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
