import Foundation

/// Mirrors of the server's iOS JSON API v1 (platform/ios/docs/IOS-API-V1.md).
/// Decoding is tolerant: unknown fields are ignored, unknown enum strings fall back
/// to a safe value and unknown list entries are skipped, so a newer server never
/// breaks an older app. The server decides access; these types grant nothing.
public enum IOSAPI {
    public static let supportedVersion = 1

    public struct ErrorBody: Decodable, Equatable, Sendable {
        public let code: String
        public let message: String?
        public let reason: String?
    }

    /// `{"ok":true,"data":…}` or `{"ok":false,"error":…}`.
    public struct Envelope<T: Decodable>: Decodable {
        public let ok: Bool
        public let data: T?
        public let error: ErrorBody?
    }

    public struct Capabilities: Decodable, Equatable, Sendable {
        public let apiVersion: Int
        public let features: [String]
        public let minAppBuild: Int

        public init(apiVersion: Int, features: [String], minAppBuild: Int) {
            self.apiVersion = apiVersion
            self.features = features
            self.minAppBuild = minAppBuild
        }

        /// Native learning screens need the home and course endpoints of a version
        /// this build understands, and a server that still accepts this build.
        public func supportsNativeLearning(appBuild: Int) -> Bool {
            apiVersion >= IOSAPI.supportedVersion && features.contains("home") && features.contains("course") && appBuild >= minAppBuild
        }
    }
}

/// Skips entries this build cannot decode instead of failing the whole list.
struct LossyArray<Element: Decodable>: Decodable {
    let values: [Element]
    /// Consumes one entry of any JSON shape without reading it.
    private struct Skip: Decodable { init(from decoder: Decoder) throws {} }

    init(from decoder: Decoder) throws {
        var container = try decoder.unkeyedContainer()
        var values: [Element] = []
        while !container.isAtEnd {
            if let value = try? container.decode(Element.self) { values.append(value); continue }
            if (try? container.decode(Skip.self)) != nil { continue }
            if (try? container.decodeNil()) == true { continue }
            break // Never loop on an entry that cannot be consumed.
        }
        self.values = values
    }
}

extension KeyedDecodingContainer {
    func lossyArray<T: Decodable>(_ type: T.Type, forKey key: Key) -> [T] {
        ((try? decodeIfPresent(LossyArray<T>.self, forKey: key)) ?? nil)?.values ?? []
    }
}

public struct NativeHome: Decodable, Equatable, Sendable {
    public struct Account: Decodable, Equatable, Sendable { public let id: String }

    public struct Course: Decodable, Equatable, Identifiable, Sendable {
        public enum Status: String, Sendable { case active = "ACTIVE", ended = "ENDED" }
        public let slug: String
        public let title: String
        public let teacherName: String?
        public let season: String?
        public let status: Status
        public let accessEndsOn: String?
        public let termsAccepted: Bool
        public var id: String { slug }

        private enum CodingKeys: String, CodingKey { case slug, title, teacherName, season, status, accessEndsOn, termsAccepted }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            slug = try c.decode(String.self, forKey: .slug)
            title = try c.decode(String.self, forKey: .title)
            teacherName = try c.decodeIfPresent(String.self, forKey: .teacherName)
            season = try c.decodeIfPresent(String.self, forKey: .season)
            status = Status(rawValue: (try? c.decode(String.self, forKey: .status)) ?? "") ?? .ended
            accessEndsOn = try c.decodeIfPresent(String.self, forKey: .accessEndsOn)
            termsAccepted = (try? c.decode(Bool.self, forKey: .termsAccepted)) ?? true
        }
    }

    public struct LessonLink: Decodable, Equatable, Identifiable, Sendable {
        public let slug: String
        public let label: String
        public let type: String
        public let summary: String?
        public var id: String { slug }
    }

    public enum FreeEntry: Decodable, Equatable, Identifiable, Sendable {
        case group(heading: String, detail: String?, items: [LessonLink])
        case single(LessonLink)

        public var id: String {
            switch self {
            case .group(let heading, _, let items): return "group:" + heading + ":" + (items.first?.slug ?? "")
            case .single(let link): return "single:" + link.slug
            }
        }

        private enum CodingKeys: String, CodingKey { case kind, heading, detail, items }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            switch try c.decode(String.self, forKey: .kind) {
            case "group":
                let items = c.lossyArray(LessonLink.self, forKey: .items)
                guard !items.isEmpty else { throw DecodingError.dataCorruptedError(forKey: .items, in: c, debugDescription: "empty group") }
                self = .group(heading: try c.decode(String.self, forKey: .heading), detail: try c.decodeIfPresent(String.self, forKey: .detail), items: items)
            case "single":
                self = .single(try LessonLink(from: decoder))
            default:
                throw DecodingError.dataCorruptedError(forKey: .kind, in: c, debugDescription: "unknown kind")
            }
        }
    }

    public struct Tool: Decodable, Equatable, Identifiable, Sendable {
        public let id: String
        public let webPath: String
    }

    public let account: Account?
    public let courses: [Course]
    public let freeLessons: [FreeEntry]
    public let tools: [Tool]

    private enum CodingKeys: String, CodingKey { case account, courses, freeLessons, tools }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        account = try c.decodeIfPresent(Account.self, forKey: .account)
        courses = c.lossyArray(Course.self, forKey: .courses)
        freeLessons = c.lossyArray(FreeEntry.self, forKey: .freeLessons)
        tools = c.lossyArray(Tool.self, forKey: .tools)
    }
}

public struct NativeCourse: Decodable, Equatable, Sendable {
    public enum SectionKind: String, CaseIterable, Sendable {
        case lessons, videos, homework, tests, files
    }

    public struct Info: Decodable, Equatable, Sendable {
        public let slug: String
        public let title: String
        public let teacherName: String?
        public let season: String?
        public let description: String?
        public let accessEndsOn: String?
    }

    public struct Item: Decodable, Equatable, Identifiable, Sendable {
        public let slug: String
        public let title: String
        public let displayTitle: String
        public let session: Int?
        public let type: String
        public let videoProvider: String?
        public let publishedAt: String?
        public var id: String { slug }

        private enum CodingKeys: String, CodingKey { case slug, title, displayTitle, session, type, videoProvider, publishedAt }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            slug = try c.decode(String.self, forKey: .slug)
            title = try c.decode(String.self, forKey: .title)
            let display = (try? c.decodeIfPresent(String.self, forKey: .displayTitle)) ?? nil
            displayTitle = (display?.isEmpty == false ? display : nil) ?? title
            session = (try? c.decodeIfPresent(Int.self, forKey: .session)) ?? nil
            type = (try? c.decode(String.self, forKey: .type)) ?? "LESSON"
            videoProvider = (try? c.decodeIfPresent(String.self, forKey: .videoProvider)) ?? nil
            publishedAt = (try? c.decodeIfPresent(String.self, forKey: .publishedAt)) ?? nil
        }
    }

    public struct Section: Decodable, Equatable, Identifiable, Sendable {
        public let kind: SectionKind
        public let items: [Item]
        public var id: String { kind.rawValue }

        private enum CodingKeys: String, CodingKey { case id, items }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            kind = SectionKind(rawValue: (try? c.decode(String.self, forKey: .id)) ?? "") ?? .files
            items = c.lossyArray(Item.self, forKey: .items)
        }
    }

    public struct Upcoming: Decodable, Equatable, Sendable {
        public let title: String
        public let startsAt: String?
        public let durationMinutes: Int?
    }

    public let needsTerms: Bool
    public let course: Info
    public let sections: [Section]
    public let upcoming: [Upcoming]
    public let webPath: String

    private enum CodingKeys: String, CodingKey { case needsTerms, course, sections, upcoming, webPath }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        needsTerms = (try? c.decode(Bool.self, forKey: .needsTerms)) ?? false
        course = try c.decode(Info.self, forKey: .course)
        // An unknown section id maps to files; merge so each kind appears once.
        var merged: [SectionKind: [Item]] = [:]
        for section in c.lossyArray(Section.self, forKey: .sections) where !section.items.isEmpty {
            merged[section.kind, default: []].append(contentsOf: section.items)
        }
        sections = SectionKind.allCases.compactMap { kind in merged[kind].map { Section(kind: kind, items: $0) } }
        upcoming = c.lossyArray(Upcoming.self, forKey: .upcoming)
        webPath = try c.decode(String.self, forKey: .webPath)
    }

    public var itemCount: Int { sections.reduce(0) { $0 + $1.items.count } }
}

extension NativeCourse.Section {
    init(kind: NativeCourse.SectionKind, items: [NativeCourse.Item]) {
        self.kind = kind
        self.items = items
    }
}
