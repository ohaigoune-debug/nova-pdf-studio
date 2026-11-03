import Foundation

/// The past BAC papers bank (`/api/v1/ios/bac`), free in the app as on the website.
/// Tolerant decoding: an unknown entry is skipped, a missing optional is nil.
public enum Bac {
    public struct Item: Decodable, Equatable, Identifiable, Hashable, Sendable {
        public let id: String
        public let title: String
        public let year: Int?
        public let session: String?
        public let subjectName: String?
        public let streamName: String?
        public let topic: Int?
        public let official: Bool
        public let hasPaper: Bool
        public let hasSolution: Bool

        private enum CodingKeys: String, CodingKey { case id, title, year, session, subjectName, streamName, topic, official, hasPaper, hasSolution }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id = try c.decode(String.self, forKey: .id)
            title = try c.decode(String.self, forKey: .title)
            year = try? c.decodeIfPresent(Int.self, forKey: .year)
            session = try? c.decodeIfPresent(String.self, forKey: .session)
            subjectName = try? c.decodeIfPresent(String.self, forKey: .subjectName)
            streamName = try? c.decodeIfPresent(String.self, forKey: .streamName)
            topic = try? c.decodeIfPresent(Int.self, forKey: .topic)
            official = (try? c.decode(Bool.self, forKey: .official)) ?? false
            hasPaper = (try? c.decode(Bool.self, forKey: .hasPaper)) ?? false
            hasSolution = (try? c.decode(Bool.self, forKey: .hasSolution)) ?? false
        }

        /// «علوم تجريبية · اللغة العربية · الموضوع 1»
        public var detail: String {
            var parts: [String] = []
            if let streamName, !streamName.isEmpty { parts.append(streamName) }
            if let subjectName, !subjectName.isEmpty { parts.append(subjectName) }
            return parts.joined(separator: " · ")
        }
    }

    public struct Facet: Decodable, Equatable, Identifiable, Hashable, Sendable {
        public let id: String
        public let name: String
        public let count: Int
    }

    public struct YearFacet: Decodable, Equatable, Identifiable, Hashable, Sendable {
        public let year: Int
        public let count: Int
        public var id: Int { year }
    }

    public struct Facets: Decodable, Equatable, Sendable {
        public let streams: [Facet]
        public let subjects: [Facet]
        public let years: [YearFacet]

        private enum CodingKeys: String, CodingKey { case streams, subjects, years }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            streams = c.lossyArray(Facet.self, forKey: .streams)
            subjects = c.lossyArray(Facet.self, forKey: .subjects)
            years = c.lossyArray(YearFacet.self, forKey: .years)
        }

        public static let empty = Facets()
        private init() { streams = []; subjects = []; years = [] }
    }

    public struct Page: Decodable, Equatable, Sendable {
        public let items: [Item]
        public let nextCursor: String?
        public let facets: Facets
        public let total: Int
        /// The student's own stream, to pre-select it.
        public let myStreamId: String?

        private enum CodingKeys: String, CodingKey { case items, nextCursor, facets, total, myStreamId }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            items = c.lossyArray(Item.self, forKey: .items)
            nextCursor = try? c.decodeIfPresent(String.self, forKey: .nextCursor)
            facets = (try? c.decodeIfPresent(Facets.self, forKey: .facets)) ?? .empty
            total = (try? c.decode(Int.self, forKey: .total)) ?? items.count
            myStreamId = try? c.decodeIfPresent(String.self, forKey: .myStreamId)
        }
    }

    public struct Link: Decodable, Equatable, Sendable {
        public let url: String
        /// true: a PDF on madrasadz.com shown inside the app; false: a page at the source, opened in the browser.
        public let inApp: Bool
    }

    public struct Paper: Decodable, Equatable, Sendable {
        public struct Source: Decodable, Equatable, Sendable {
            public let name: String
            public let attribution: String?
        }

        /// The same paper as an interactive exercise in PLAY (Build 14 servers).
        public struct PlayVersion: Decodable, Equatable, Sendable {
            public let id: String
            public let title: String
        }

        public let id: String
        public let title: String
        public let year: Int?
        public let session: String?
        public let term: Int?
        public let topic: Int?
        public let official: Bool
        public let subjectName: String?
        public let streamName: String?
        public let source: Source?
        public let paper: Link?
        public let solution: Link?
        public let play: PlayVersion?

        private enum CodingKeys: String, CodingKey { case id, title, year, session, term, topic, official, subjectName, streamName, source, paper, solution, play }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id = try c.decode(String.self, forKey: .id)
            title = try c.decode(String.self, forKey: .title)
            year = try? c.decodeIfPresent(Int.self, forKey: .year)
            session = try? c.decodeIfPresent(String.self, forKey: .session)
            official = (try? c.decode(Bool.self, forKey: .official)) ?? false
            subjectName = try? c.decodeIfPresent(String.self, forKey: .subjectName)
            streamName = try? c.decodeIfPresent(String.self, forKey: .streamName)
            source = try? c.decodeIfPresent(Source.self, forKey: .source)
            paper = try? c.decodeIfPresent(Link.self, forKey: .paper)
            solution = try? c.decodeIfPresent(Link.self, forKey: .solution)
            term = try? c.decodeIfPresent(Int.self, forKey: .term)
            topic = try? c.decodeIfPresent(Int.self, forKey: .topic)
            play = try? c.decodeIfPresent(PlayVersion.self, forKey: .play)
        }
    }

    /// Query string of the list: only the filters that are set, then the page cursor.
    public static func path(stream: String?, subject: String?, year: Int?, cursor: String? = nil) -> String {
        var items: [URLQueryItem] = []
        if let stream, !stream.isEmpty { items.append(URLQueryItem(name: "stream", value: stream)) }
        if let subject, !subject.isEmpty { items.append(URLQueryItem(name: "subject", value: subject)) }
        if let year { items.append(URLQueryItem(name: "year", value: String(year))) }
        if let cursor, !cursor.isEmpty { items.append(URLQueryItem(name: "cursor", value: cursor)) }
        var components = URLComponents()
        components.path = "/api/v1/ios/bac"
        components.queryItems = items.isEmpty ? nil : items
        return components.string ?? "/api/v1/ios/bac"
    }

    /// A link the app may follow: our own relative path (signed PDF) or an https page at the source.
    public static func isSafe(_ link: Link) -> Bool {
        if link.inApp { return link.url.hasPrefix("/api/v1/files/") }
        return URL(string: link.url)?.scheme?.lowercased() == "https"
    }

    /// Page path of one paper: the BAC bank or the tests bank (same answer).
    public static func paperPath(_ id: String, bank: Bank) -> String {
        bank == .bac ? "/api/v1/ios/bac/\(id)" : "/api/v1/ios/papers/\(id)"
    }

    public enum Bank: Sendable { case bac, tests }
}

/// The tests bank (`/api/v1/ios/tests`): term → school year → subject → list.
public enum TestsBank {
    public struct Term: Decodable, Equatable, Identifiable, Hashable, Sendable {
        public let term: Int
        public let count: Int
        public var id: Int { term }
    }

    public struct Level: Decodable, Equatable, Identifiable, Hashable, Sendable {
        public let id: String
        public let name: String
        public let code: String?
        public let count: Int

        private enum CodingKeys: String, CodingKey { case id, name, code, count }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id = try c.decode(String.self, forKey: .id)
            name = try c.decode(String.self, forKey: .name)
            code = try? c.decodeIfPresent(String.self, forKey: .code)
            count = (try? c.decode(Int.self, forKey: .count)) ?? 0
        }
    }

    public struct Subject: Decodable, Equatable, Identifiable, Hashable, Sendable {
        public let id: String
        public let name: String
        public let count: Int
    }

    public struct Paper: Decodable, Equatable, Identifiable, Hashable, Sendable {
        public let id: String
        public let title: String
        public let typeLabel: String?
        public let year: Int?
        public let hasSolution: Bool
        public let hasFile: Bool

        private enum CodingKeys: String, CodingKey { case id, title, typeLabel, year, hasSolution, hasFile }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id = try c.decode(String.self, forKey: .id)
            title = try c.decode(String.self, forKey: .title)
            typeLabel = try? c.decodeIfPresent(String.self, forKey: .typeLabel)
            year = try? c.decodeIfPresent(Int.self, forKey: .year)
            hasSolution = (try? c.decode(Bool.self, forKey: .hasSolution)) ?? false
            hasFile = (try? c.decode(Bool.self, forKey: .hasFile)) ?? true
        }
    }

    /// An interactive version in PLAY (opened with the offline exam player).
    public struct Interactive: Decodable, Equatable, Identifiable, Hashable, Sendable {
        public let id: String
        public let title: String
        public let kind: String
        public let year: Int?
    }

    public struct Page: Decodable, Equatable, Sendable {
        public let terms: [Term]
        public let levels: [Level]
        public let myLevelId: String?
        public let subjects: [Subject]
        public let papers: [Paper]
        public let nextCursor: String?
        public let interactive: [Interactive]

        private enum CodingKeys: String, CodingKey { case terms, levels, myLevelId, subjects, papers, nextCursor, interactive }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            terms = c.lossyArray(Term.self, forKey: .terms)
            levels = c.lossyArray(Level.self, forKey: .levels)
            myLevelId = try? c.decodeIfPresent(String.self, forKey: .myLevelId)
            subjects = c.lossyArray(Subject.self, forKey: .subjects)
            papers = c.lossyArray(Paper.self, forKey: .papers)
            nextCursor = try? c.decodeIfPresent(String.self, forKey: .nextCursor)
            interactive = c.lossyArray(Interactive.self, forKey: .interactive)
        }
    }

    public static func path(term: Int? = nil, level: String? = nil, subject: String? = nil, cursor: String? = nil) -> String {
        var items: [URLQueryItem] = []
        if let term { items.append(URLQueryItem(name: "term", value: String(term))) }
        if let level, !level.isEmpty { items.append(URLQueryItem(name: "level", value: level)) }
        if let subject, !subject.isEmpty { items.append(URLQueryItem(name: "subject", value: subject)) }
        if let cursor, !cursor.isEmpty { items.append(URLQueryItem(name: "cursor", value: cursor)) }
        var components = URLComponents()
        components.path = "/api/v1/ios/tests"
        components.queryItems = items.isEmpty ? nil : items
        return components.string ?? "/api/v1/ios/tests"
    }
}
