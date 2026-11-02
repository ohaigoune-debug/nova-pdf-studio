import Foundation
import Security
import MadrasadzCore

/// The signed-in account, kept in the Keychain on this device only.
/// The token is the website's own session (sent as its session cookie);
/// there is no web view, so nothing else ever holds it.
struct SavedSession: Codable, Equatable {
    var token: String
    var expiresAt: Date?
    var accountID: String
    var role: String
    var name: String?
    var email: String?
}

enum Keychain {
    private static let service = "com.madrasadz.student.native"

    private static func query(_ account: String) -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: service,
         kSecAttrAccount as String: account]
    }

    static func data(_ account: String) -> Data? {
        var q = query(account)
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &item) == errSecSuccess else { return nil }
        return item as? Data
    }

    @discardableResult
    static func write(_ data: Data, _ account: String) -> Bool {
        SecItemDelete(query(account) as CFDictionary)
        var q = query(account)
        q[kSecValueData as String] = data
        q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        return SecItemAdd(q as CFDictionary, nil) == errSecSuccess
    }

    static func remove(_ account: String) {
        SecItemDelete(query(account) as CFDictionary)
    }

    static var session: SavedSession? {
        get {
            guard let data = data("session") else { return nil }
            return try? JSONDecoder.api.decode(SavedSession.self, from: data)
        }
        set {
            if let newValue, let data = try? JSONEncoder.api.encode(newValue) { write(data, "session") } else { remove("session") }
        }
    }

    /// A random per-installation key for the one-device viewing limit (no hardware id).
    static var deviceKey: String {
        if let data = data("device-key"), let key = String(data: data, encoding: .utf8), key.count >= 16 { return key }
        var bytes = [UInt8](repeating: 0, count: 16)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        let key = "ios-" + bytes.map { String(format: "%02x", $0) }.joined()
        write(Data(key.utf8), "device-key")
        return key
    }
}

extension JSONEncoder {
    static let api: JSONEncoder = {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        return e
    }()
}

extension JSONDecoder {
    static let api: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }()
}

enum APIFailure: Error, Equatable {
    /// No connection (or the server could not be reached).
    case offline
    /// The session is missing, expired or revoked.
    case unauthorized
    /// The server refused the request with its own error code and Arabic message.
    case server(code: String, message: String?, reason: String?, status: Int)
    /// Something unexpected came back.
    case invalid

    var message: String {
        switch self {
        case .offline: return L10n.text("nativeOfflineBody")
        case .unauthorized: return L10n.text("sessionExpired")
        case .server(let code, let message, _, _):
            switch code {
            // Never point to buying anything from inside the app.
            case "PLAY_TRIAL_EXPIRED": return L10n.text("playTrialEnded")
            case "PLAY_TRIAL_REQUIRED": return L10n.text("playUnavailable")
            case "MEDIA_TOO_MANY_DEVICES": return L10n.text("deviceBlocked")
            default: return message ?? L10n.text("error")
            }
        case .invalid: return L10n.text("error")
        }
    }

    var code: String? {
        if case .server(let code, _, _, _) = self { return code }
        return nil
    }
}

private final class NoRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest,
                    completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}

/// JSON API v1 of madrasadz.com. Every request is ephemeral (no cookie jar, no
/// URL cache, no redirects); the session token is attached explicitly.
@MainActor
final class APIClient {
    let baseURL: URL
    private(set) var token: String?
    /// The account the token belongs to: a response for another account is refused.
    private(set) var accountID: String?
    private let session: URLSession

    init() {
        let configured = Bundle.main.object(forInfoDictionaryKey: "MadrasadzBaseURL") as? String
        let url = URL(string: configured ?? "https://madrasadz.com") ?? URL(string: "https://madrasadz.com")!
        baseURL = url.scheme == "https" ? url : URL(string: "https://madrasadz.com")!
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpShouldSetCookies = false
        configuration.httpCookieAcceptPolicy = .never
        configuration.httpCookieStorage = nil
        configuration.urlCache = nil
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        configuration.timeoutIntervalForRequest = 30
        configuration.waitsForConnectivity = false
        session = URLSession(configuration: configuration, delegate: NoRedirects(), delegateQueue: nil)
    }

    func use(token: String?, account: String?) {
        self.token = token
        accountID = account?.lowercased()
    }

    var origin: String {
        var parts = URLComponents()
        parts.scheme = baseURL.scheme
        parts.host = baseURL.host
        parts.port = baseURL.port
        return parts.string ?? "https://madrasadz.com"
    }

    func url(_ path: String) -> URL? {
        URL(string: path, relativeTo: baseURL)?.absoluteURL
    }

    /// A request carrying the session. nil when a session is required and absent.
    func request(path: String, method: String = "GET", body: Data? = nil, requireSession: Bool = true) -> URLRequest? {
        guard let url = url(path) else { return nil }
        if requireSession && token == nil { return nil }
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("ios", forHTTPHeaderField: "X-Madrasadz-Client")
        if let token { request.setValue("madrasa_session=\(token)", forHTTPHeaderField: "Cookie") }
        if method != "GET" {
            request.setValue(origin, forHTTPHeaderField: "Origin")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = body
        }
        return request
    }

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        #if DEBUG
        if Fixtures.enabled { return try Fixtures.respond(to: request) }
        #endif
        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else { throw APIFailure.invalid }
            // A redirect (refused above) or another host is never a valid answer.
            guard http.url?.host == baseURL.host else { throw APIFailure.invalid }
            return (data, http)
        } catch let error as URLError {
            if error.code == .cancelled { throw CancellationError() }
            throw APIFailure.offline
        }
    }

    /// Decodes `{ok, data}` / `{ok:false, error}` and checks the account header.
    func decode<T: Decodable>(_ type: T.Type, data: Data, response: HTTPURLResponse) throws -> T {
        let envelope = try? JSONDecoder.api.decode(IOSAPI.Envelope<T>.self, from: data)
        if response.statusCode == 401 || envelope?.error?.code == "AUTH_REQUIRED" { throw APIFailure.unauthorized }
        if let error = envelope?.error, envelope?.ok == false {
            throw APIFailure.server(code: error.code, message: error.message, reason: error.reason, status: response.statusCode)
        }
        guard (200..<300).contains(response.statusCode), envelope?.ok == true, let value = envelope?.data else {
            if response.statusCode >= 500 { throw APIFailure.server(code: "SERVER", message: nil, reason: nil, status: response.statusCode) }
            throw APIFailure.invalid
        }
        if let account = response.value(forHTTPHeaderField: "X-Madrasadz-Account")?.lowercased(),
           let expected = accountID, account != expected {
            throw APIFailure.unauthorized
        }
        return value
    }

    func get<T: Decodable>(_ type: T.Type, _ path: String) async throws -> (value: T, raw: Data) {
        guard let request = request(path: path) else { throw APIFailure.unauthorized }
        let (data, response) = try await send(request)
        return (try decode(type, data: data, response: response), data)
    }

    func post<T: Decodable, Body: Encodable>(_ type: T.Type, _ path: String, body: Body, requireSession: Bool = true) async throws -> T {
        let encoded = try JSONEncoder.api.encode(body)
        guard let request = request(path: path, method: "POST", body: encoded, requireSession: requireSession) else { throw APIFailure.unauthorized }
        let (data, response) = try await send(request)
        return try decode(type, data: data, response: response)
    }

    /// Raw bytes of a binary endpoint (PDF), with the same account check.
    func bytes(_ path: String, accept: String) async throws -> (Data, HTTPURLResponse) {
        guard var request = request(path: path) else { throw APIFailure.unauthorized }
        request.setValue(accept, forHTTPHeaderField: "Accept")
        request.timeoutInterval = 60
        let (data, response) = try await send(request)
        if response.statusCode == 401 { throw APIFailure.unauthorized }
        guard response.statusCode == 200 else {
            if let envelope = try? JSONDecoder.api.decode(IOSAPI.Envelope<Empty>.self, from: data), let error = envelope.error {
                throw APIFailure.server(code: error.code, message: error.message, reason: error.reason, status: response.statusCode)
            }
            throw APIFailure.invalid
        }
        if let account = response.value(forHTTPHeaderField: "X-Madrasadz-Account")?.lowercased(),
           let expected = accountID, account != expected {
            throw APIFailure.unauthorized
        }
        return (data, response)
    }
}

struct Empty: Codable {}

/// Extracts the `data` member of an API envelope as raw JSON bytes.
func envelopeData(_ raw: Data) -> Data? {
    guard let object = try? JSONSerialization.jsonObject(with: raw) as? [String: Any],
          object["ok"] as? Bool == true, let data = object["data"],
          JSONSerialization.isValidJSONObject(data) else { return nil }
    return try? JSONSerialization.data(withJSONObject: data)
}
