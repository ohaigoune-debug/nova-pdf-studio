import Foundation

/// A presentation boundary for the first iOS release, never an authorization check.
/// Every content request still requires the server's session and entitlement checks.
public struct NavigationPolicy: Sendable {
    public static let production = NavigationPolicy(baseURL: URL(string: "https://madrasadz.com")!)
    public let baseURL: URL

    public init(baseURL: URL) {
        self.baseURL = baseURL
    }

    public func decision(for url: URL) -> NavigationDecision {
        guard validBase, let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              components.user == nil, components.password == nil,
              let scheme = components.scheme?.lowercased() else { return .blocked(.unsafeURL) }

        if scheme == "mailto" || scheme == "tel" {
            guard !url.absoluteString.contains("\n"), !url.absoluteString.contains("\r"),
                  !url.absoluteString.lowercased().contains("%0a"),
                  !url.absoluteString.lowercased().contains("%0d"),
                  !components.path.isEmpty else { return .blocked(.unsafeURL) }
            return .external(url)
        }

        guard scheme == "https", let host = components.host?.lowercased(),
              components.port == nil || components.port == 443 else { return .blocked(.unsafeURL) }
        if host != baseURL.host?.lowercased() {
            if Self.paymentHosts.contains(where: { host == $0 || host.hasSuffix("." + $0) }) {
                return .blocked(.purchasesUnavailable)
            }
            return .external(url)
        }

        guard let path = normalizedPath(components) else { return .blocked(.unsafeURL) }
        let lower = path.lowercased()
        if Self.purchasePaths.contains(where: { lower == $0 || lower.hasPrefix($0 + "/") }) ||
            (lower.hasPrefix("/student/courses/") && lower.hasSuffix("/order")) {
            return .blocked(.purchasesUnavailable)
        }
        // Owner decision (2026-10-27): the teacher-led virtual classroom is allowed in the
        // internal build; App Review needs report/block/filter/contact (guideline 1.2).
        if ["/forum", "/community", "/student/forum", "/student/groups"].contains(where: { lower == $0 || lower.hasPrefix($0 + "/") }) {
            return .blocked(.communityUnavailable)
        }
        if ["/admin", "/teacher", "/assistant"].contains(where: { lower == $0 || lower.hasPrefix($0 + "/") }) {
            return .blocked(.roleUnavailable)
        }
        if Self.allowedPaths.contains(where: { lower == $0 || lower.hasPrefix($0 + "/") }) ||
            ["/", "/ios", "/student"].contains(lower) {
            return .internalPage(url)
        }
        return .blocked(.unsupportedRoute)
    }

    /// Store only an approved study page path. Query strings/fragments may contain
    /// short-lived signatures or tokens and are deliberately never persisted.
    public func bookmarkPath(for url: URL) -> String? {
        guard case .internalPage = decision(for: url),
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let path = normalizedPath(components),
              Self.bookmarkPaths.contains(where: { path == $0 || path.hasPrefix($0 + "/") }) else { return nil }
        return components.percentEncodedPath.isEmpty ? "/" : components.percentEncodedPath
    }

    public func url(forBookmarkPath path: String) -> URL? {
        guard path.hasPrefix("/"), !path.hasPrefix("//"), !path.contains("?"), !path.contains("#"),
              path.utf8.count <= 4_096, let url = URL(string: path, relativeTo: baseURL)?.absoluteURL,
              bookmarkPath(for: url) == path else { return nil }
        return url
    }

    private var validBase: Bool {
        guard let value = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else { return false }
        return value.scheme?.lowercased() == "https" && value.host?.lowercased() == "madrasadz.com" &&
            value.user == nil && value.password == nil && (value.port == nil || value.port == 443) &&
            (value.path.isEmpty || value.path == "/") && value.query == nil && value.fragment == nil
    }

    private func normalizedPath(_ value: URLComponents) -> String? {
        let encoded = value.percentEncodedPath
        guard encoded.utf8.count <= 4_096, !encoded.contains("\\"),
              let decoded = encoded.removingPercentEncoding,
              !decoded.contains("\\"), !decoded.contains("\0"),
              !decoded.unicodeScalars.contains(where: { $0.value < 0x20 || $0.value == 0x7F }),
              !decoded.contains("%"), !decoded.contains("//"),
              !decoded.split(separator: "/", omittingEmptySubsequences: false).contains(where: { $0 == "." || $0 == ".." }) else { return nil }
        // Encoded separators would be interpreted differently by proxies/frameworks.
        let lowerEncoded = encoded.lowercased()
        guard !lowerEncoded.contains("%2f"), !lowerEncoded.contains("%5c"),
              !lowerEncoded.contains("%00") else { return nil }
        let path = decoded.isEmpty ? "/" : decoded
        return path.hasPrefix("/") ? path : nil
    }

    private static let purchasePaths = [
        "/store", "/checkout", "/cart", "/purchase", "/buy", "/claim", "/activate", "/activation",
        "/student/courses/catalog", "/student/courses/orders", "/student/activate", "/student/activation",
        "/student/claim", "/student/codes", "/courses", "/ios/purchase", "/ios/activate", "/ios/store", "/ios/checkout", "/ios/claim"
    ]
    private static let paymentHosts = ["stripe.com", "paypal.com", "chargily.com", "chargily.net", "checkout.com", "paddle.com", "lemonsqueezy.com"]
    private static let allowedPaths = [
        "/ios/course", "/ios/lesson", "/login", "/register", "/forgot-password", "/reset-password", "/verify-phone", "/phone-verification", "/student/verify-phone",
        "/lessons", "/bac", "/past-bac", "/library", "/play", "/exams", "/privacy", "/terms", "/contact", "/support", "/delete-account",
        "/student/courses", "/student/lessons", "/student/files", "/student/videos", "/student/practice", "/student/quizzes",
        "/student/play", "/student/exams", "/student/assignments", "/student/classroom", "/student/groups", "/student/grades",
        "/student/progress", "/student/notifications", "/student/profile", "/student/support", "/student/past-bac",
        "/api/v1/ios", "/api/v1/media", "/api/v1/files", "/print/exams"
    ]
    private static let bookmarkPaths = [
        "/ios", "/lessons", "/bac", "/past-bac", "/library", "/play", "/exams",
        "/student/courses", "/student/lessons", "/student/files", "/student/videos", "/student/practice",
        "/student/quizzes", "/student/play", "/student/exams", "/student/assignments", "/student/classroom", "/student/past-bac"
    ]
}

public enum NavigationDecision: Equatable, Sendable {
    case internalPage(URL)
    case external(URL)
    case blocked(NavigationBlockReason)
}

public enum NavigationBlockReason: String, Codable, Sendable {
    case unsafeURL
    case purchasesUnavailable
    case communityUnavailable
    case roleUnavailable
    case unsupportedRoute
}
