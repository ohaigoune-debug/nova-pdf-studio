import Foundation

/// Creating a student account inside the app (`/api/v1/ios/register`), with the same
/// rules as the website form. The server checks everything again; these checks only
/// spare the student a round trip and name the field to fix.
public enum Signup {
    public struct Option: Decodable, Equatable, Identifiable, Hashable, Sendable {
        public let id: String
        public let name: String
    }

    public struct Level: Decodable, Equatable, Identifiable, Hashable, Sendable {
        public let id: String
        public let name: String
        /// Secondary school (…AS): the stream is required.
        public let secondary: Bool

        private enum CodingKeys: String, CodingKey { case id, name, secondary }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id = try c.decode(String.self, forKey: .id)
            name = try c.decode(String.self, forKey: .name)
            secondary = (try? c.decode(Bool.self, forKey: .secondary)) ?? false
        }
    }

    public struct Options: Decodable, Equatable, Sendable {
        public let wilayas: [Option]
        public let levels: [Level]
        public let streams: [Option]

        private enum CodingKeys: String, CodingKey { case wilayas, levels, streams }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            wilayas = c.lossyArray(Option.self, forKey: .wilayas)
            levels = c.lossyArray(Level.self, forKey: .levels)
            streams = c.lossyArray(Option.self, forKey: .streams)
        }
    }

    public enum Field: String, CaseIterable, Sendable {
        case fullName, email, phone, guardianPhone, password, wilayaId, levelId, streamId
    }

    public struct Form: Equatable, Sendable {
        public var fullName = ""
        public var email = ""
        public var phone = ""
        public var guardianPhone = ""
        public var password = ""
        public var wilayaID = ""
        public var levelID = ""
        public var streamID = ""

        public init() {}

        /// The first field to fix, in the order of the form; nil when the form can be sent.
        public func firstInvalidField(levels: [Level]) -> Field? {
            if fullName.trimmingCharacters(in: .whitespacesAndNewlines).count < 3 { return .fullName }
            if !Signup.isEmail(email) { return .email }
            if Signup.normalizedPhone(phone) == nil { return .phone }
            if Signup.normalizedPhone(guardianPhone) == nil { return .guardianPhone }
            if password.count < 8 { return .password }
            if wilayaID.isEmpty { return .wilayaId }
            guard let level = levels.first(where: { $0.id == levelID }) else { return .levelId }
            if level.secondary && streamID.isEmpty { return .streamId }
            return nil
        }

        /// What is sent: trimmed text, phones as 0XXXXXXXXX, the stream only when the level has one.
        public func payload(levels: [Level]) -> Payload {
            let secondary = levels.first(where: { $0.id == levelID })?.secondary ?? false
            return Payload(
                fullName: fullName.trimmingCharacters(in: .whitespacesAndNewlines),
                email: email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
                phone: Signup.normalizedPhone(phone) ?? phone,
                guardianPhone: Signup.normalizedPhone(guardianPhone) ?? guardianPhone,
                password: password,
                wilayaId: wilayaID,
                levelId: levelID,
                streamId: secondary && !streamID.isEmpty ? streamID : nil
            )
        }
    }

    public struct Payload: Encodable, Equatable, Sendable {
        public let fullName: String
        public let email: String
        public let phone: String
        public let guardianPhone: String
        public let password: String
        public let wilayaId: String
        public let levelId: String
        public let streamId: String?
    }

    /// Algerian mobile number as the website stores it (05/06/07 + 8 digits), from what a
    /// student types: Arabic-Indic digits, spaces, dashes, +213 or 213 prefix. nil if not a mobile.
    public static func normalizedPhone(_ raw: String) -> String? {
        var digits = ""
        for scalar in raw.unicodeScalars {
            switch scalar.value {
            case 0x30...0x39: digits.unicodeScalars.append(scalar)
            case 0x0660...0x0669: digits += String(scalar.value - 0x0660)
            case 0x06F0...0x06F9: digits += String(scalar.value - 0x06F0)
            case 0x2B where digits.isEmpty: continue // a leading +
            case 0x20, 0x2D, 0x28, 0x29, 0x2E, 0xA0: continue
            default: return nil
            }
        }
        if digits.hasPrefix("213") { digits = "0" + digits.dropFirst(3) }
        guard digits.count == 10, digits.hasPrefix("0"), let second = digits.dropFirst().first, "567".contains(second) else { return nil }
        return digits
    }

    public static func isEmail(_ raw: String) -> Bool {
        let value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard value.count <= 200, let at = value.firstIndex(of: "@"), value.filter({ $0 == "@" }).count == 1 else { return false }
        let local = value[..<at]
        let domain = value[value.index(after: at)...]
        return !local.isEmpty && !local.contains(" ") && domain.contains(".") && !domain.hasPrefix(".") && !domain.hasSuffix(".") && !domain.contains(" ")
    }

    /// «…4567»: the end of a number, for showing where the code was sent.
    public static func phoneHint(_ phone: String?) -> String? {
        guard let phone, phone.count >= 4 else { return nil }
        return "…" + phone.suffix(4)
    }
}

// MARK: - Google and Apple (owner, 5 Nov 2026)

public extension Signup.Form {
    /// After «Continue with Google / Apple»: the provider gives the e-mail and there is no
    /// password, so only the student's own details are checked.
    func firstInvalidProfileField(levels: [Signup.Level]) -> Signup.Field? {
        if fullName.trimmingCharacters(in: .whitespacesAndNewlines).count < 3 { return .fullName }
        if Signup.normalizedPhone(phone) == nil { return .phone }
        if Signup.normalizedPhone(guardianPhone) == nil { return .guardianPhone }
        if wilayaID.isEmpty { return .wilayaId }
        guard let level = levels.first(where: { $0.id == levelID }) else { return .levelId }
        if level.secondary && streamID.isEmpty { return .streamId }
        return nil
    }

    /// What `/api/v1/ios/auth/complete` receives.
    func profilePayload(levels: [Signup.Level], signupToken: String) -> SocialSignIn.ProfilePayload {
        let secondary = levels.first(where: { $0.id == levelID })?.secondary ?? false
        return SocialSignIn.ProfilePayload(
            signupToken: signupToken,
            fullName: fullName.trimmingCharacters(in: .whitespacesAndNewlines),
            phone: Signup.normalizedPhone(phone) ?? phone,
            guardianPhone: Signup.normalizedPhone(guardianPhone) ?? guardianPhone,
            wilayaId: wilayaID,
            levelId: levelID,
            streamId: secondary && !streamID.isEmpty ? streamID : nil
        )
    }
}

/// Signing in with Google (system browser sheet) or Apple (native button).
/// The server answers with a session, or with a short-lived token for completing a new account.
public enum SocialSignIn {
    /// The scheme the website sends the student back to after Google.
    public static let callbackScheme = "madrasadz-auth"
    /// Opened in the system browser sheet; ends at `madrasadz-auth://oauth?…`.
    public static let googleStartPath = "/api/auth/oauth/google/start?app=ios"

    /// Which buttons the server has turned on (`/api/v1/ios/capabilities` → `signIn`).
    public struct Options: Decodable, Equatable, Sendable {
        public let google: Bool
        public let apple: Bool
        public init(google: Bool, apple: Bool) {
            self.google = google
            self.apple = apple
        }
        public static let none = Options(google: false, apple: false)
    }

    public struct Capabilities: Decodable, Equatable, Sendable {
        public let signIn: Options?
    }

    /// A new account waiting for the student's details.
    public struct PendingSignup: Equatable, Identifiable, Sendable {
        public let token: String
        public let fullName: String?
        public let email: String?
        public var id: String { token }
        public init(token: String, fullName: String?, email: String?) {
            self.token = token
            self.fullName = fullName?.isEmpty == false ? fullName : nil
            self.email = email?.isEmpty == false ? email : nil
        }
    }

    /// `/api/v1/ios/auth/apple`, `/ticket` and `/complete`.
    public struct Reply: Decodable, Equatable, Sendable {
        public let status: String
        public let token: String?
        public let expiresAt: Date?
        public let role: String?
        public let signupToken: String?
        public let fullName: String?
        public let email: String?

        public var pending: PendingSignup? {
            guard status == "needs_profile", let signupToken, !signupToken.isEmpty else { return nil }
            return PendingSignup(token: signupToken, fullName: fullName, email: email)
        }
    }

    public struct ProfilePayload: Encodable, Equatable, Sendable {
        public let signupToken: String
        public let fullName: String
        public let phone: String
        public let guardianPhone: String
        public let wilayaId: String
        public let levelId: String
        public let streamId: String?
    }

    /// Where the Google sheet came back to.
    public enum Callback: Equatable, Sendable {
        /// An existing account: exchange this one-time ticket for the session.
        case ticket(String)
        /// A new account to complete.
        case signup(PendingSignup)
        /// The server's error code (OAUTH_PASSWORD_ONLY, ACCOUNT_DISABLED, …).
        case failure(String)
    }

    /// nil for anything that is not `madrasadz-auth://oauth?…` with one of the expected fields.
    public static func parse(callback url: URL) -> Callback? {
        guard url.scheme == callbackScheme, url.host == "oauth",
              let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems else { return nil }
        func value(_ name: String) -> String? {
            guard let v = items.first(where: { $0.name == name })?.value, !v.isEmpty else { return nil }
            return v
        }
        if let ticket = value("ticket") { return .ticket(ticket) }
        if let token = value("signup") { return .signup(PendingSignup(token: token, fullName: value("name"), email: value("email"))) }
        if let code = value("error") { return .failure(code) }
        return nil
    }
}
