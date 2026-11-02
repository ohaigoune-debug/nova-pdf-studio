import SwiftUI
import MadrasadzCore

/// Offline PLAY: downloaded exam sets, local attempts and their sync to the
/// server, which re-grades every attempt with its own keys.
@MainActor
final class PlayModel: ObservableObject {
    @Published private(set) var downloaded: [PlayStore.Downloaded] = []
    @Published private(set) var attempts: [PlayStore.Attempt] = []
    @Published private(set) var syncing = false
    @Published private(set) var downloading: String?

    private let store: PlayStore
    private weak var app: AppModel?
    private var account: String?

    init(store: PlayStore) {
        self.store = store
    }

    func attach(_ app: AppModel) { self.app = app }

    var pendingCount: Int { attempts.filter(\.pending).count }

    func activate(account: String) async {
        self.account = account.lowercased()
        if let state = try? await store.activate(account: account.lowercased()) {
            downloaded = state.downloaded
            attempts = state.attempts
        } else {
            downloaded = []
            attempts = []
        }
    }

    func purge(account: String) async {
        try? await store.purge(account: account.lowercased())
        self.account = nil
        downloaded = []
        attempts = []
    }

    func isDownloaded(_ id: String) -> Bool { downloaded.contains { $0.id == id } }

    func package(id: String) async -> Play.Package? {
        try? await store.package(id: id)
    }

    /// Downloads (or refreshes) a set for offline use. Falls back to the stored copy offline.
    func open(setID: String) async throws -> Play.Package {
        guard let app else { throw APIFailure.invalid }
        downloading = setID
        defer { downloading = nil }
        do {
            let path = "/api/v1/ios/play/sets/" + (setID.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? setID)
            guard let request = app.api.request(path: path) else { throw APIFailure.unauthorized }
            let (raw, response) = try await app.api.send(request)
            _ = try app.api.decode(Play.Package.self, data: raw, response: response)
            guard let data = envelopeData(raw) else { throw APIFailure.invalid }
            let package = try await store.savePackage(data)
            downloaded = await store.downloaded()
            return package
        } catch let failure as APIFailure {
            if failure == .offline, let stored = await package(id: setID) { return stored }
            app.handle(failure)
            throw failure
        }
    }

    func remove(_ id: String) async {
        try? await store.removePackage(id: id)
        downloaded = await store.downloaded()
    }

    func attempts(for setID: String) -> [PlayStore.Attempt] { attempts.filter { $0.setId == setID } }

    /// Saves a finished attempt locally, then tries to sync it.
    @discardableResult
    func finish(_ package: Play.Package, answers: [String: Play.Answer]) async -> PlayStore.Attempt? {
        guard account != nil else { return nil }
        let attempt = try? await store.addAttempt(package: package, answers: answers)
        attempts = await store.attempts()
        Task { await sync() }
        return attempt
    }

    /// Uploads pending attempts, oldest first. Offline or server trouble keeps them pending.
    func sync() async {
        guard let app, !syncing, account != nil, app.phase == .ready else { return }
        let pending = await store.pendingAttempts()
        guard !pending.isEmpty else { return }
        syncing = true
        defer { syncing = false }
        struct Body: Encodable { let setId: String; let answers: [String: Play.Answer] }
        struct Reply: Decodable { let attemptId: String; let score: Double; let max: Double; let accepted: Int }
        for attempt in pending {
            guard account != nil else { return }
            do {
                let reply = try await app.api.post(Reply.self, "/api/v1/ios/play/sync", body: Body(setId: attempt.setId, answers: attempt.answers))
                try? await store.markSynced(attempt.id, server: Play.Score(score: reply.score, max: reply.max))
            } catch let failure as APIFailure {
                switch failure {
                case .offline:
                    attempts = await store.attempts()
                    return
                case .unauthorized:
                    app.handle(failure)
                    return
                case .server(let code, _, _, let status):
                    // Rate limit or server error: try later. A refusal (set removed, access ended): give up on this one.
                    if status >= 500 || code == "RATE_LIMITED" || code == "SERVER" {
                        attempts = await store.attempts()
                        return
                    }
                    try? await store.markRejected(attempt.id)
                case .invalid:
                    attempts = await store.attempts()
                    return
                }
            } catch {
                return
            }
        }
        attempts = await store.attempts()
    }
}
