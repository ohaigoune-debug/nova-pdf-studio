import Foundation

/// MADRASA PLAY in the native app: subjects, exam sets and the offline package
/// (`/api/v1/ios/play/*`). The package carries the answer keys on purpose: the
/// student practises without internet and the server re-grades every synced
/// attempt with its own keys (`POST /api/v1/ios/play/sync`), so nothing here is
/// trusted for a grade. Decoding is tolerant like the rest of the iOS API.
public enum Play {
    // MARK: Subjects and profile

    public struct Stream: Decodable, Equatable, Hashable, Identifiable, Sendable {
        public let code: String
        public let nameAr: String
        public var id: String { code }
    }

    public struct Grade: Decodable, Equatable, Hashable, Identifiable, Sendable {
        public let code: String
        public let nameAr: String
        public let streams: [Stream]
        public var id: String { code }

        private enum CodingKeys: String, CodingKey { case code, nameAr, streams }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            code = try c.decode(String.self, forKey: .code)
            nameAr = (try? c.decode(String.self, forKey: .nameAr)) ?? code
            streams = c.lossyArray(Stream.self, forKey: .streams)
        }
    }

    public struct Subject: Decodable, Equatable, Identifiable, Sendable {
        public let code: String
        public let nameAr: String
        public let color: String?
        public let icon: String?
        public let language: String
        public var id: String { code }

        private enum CodingKeys: String, CodingKey { case code, nameAr, color, icon, language }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            code = try c.decode(String.self, forKey: .code)
            nameAr = (try? c.decode(String.self, forKey: .nameAr)) ?? code
            color = (try? c.decodeIfPresent(String.self, forKey: .color)) ?? nil
            icon = (try? c.decodeIfPresent(String.self, forKey: .icon)) ?? nil
            language = ((try? c.decodeIfPresent(String.self, forKey: .language)) ?? nil) ?? "ar"
        }

        public init(code: String, nameAr: String, color: String? = nil, icon: String? = nil, language: String = "ar") {
            self.code = code
            self.nameAr = nameAr
            self.color = color
            self.icon = icon
            self.language = language
        }
    }

    public struct Subjects: Decodable, Equatable, Sendable {
        public let gradeCode: String?
        public let streamCode: String?
        public let subjects: [Subject]
        public let grades: [Grade]

        private enum CodingKeys: String, CodingKey { case gradeCode, streamCode, subjects, grades }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            gradeCode = (try? c.decodeIfPresent(String.self, forKey: .gradeCode)) ?? nil
            streamCode = (try? c.decodeIfPresent(String.self, forKey: .streamCode)) ?? nil
            subjects = c.lossyArray(Subject.self, forKey: .subjects)
            grades = c.lossyArray(Grade.self, forKey: .grades)
        }

        public var needsProfile: Bool { gradeCode == nil }
    }

    // MARK: Exam sets

    public enum Kind: String, CaseIterable, Sendable {
        case bac = "BAC", devoir = "DEVOIR", test = "TEST"
    }

    public struct Score: Codable, Equatable, Sendable {
        public let score: Double
        public let max: Double
        public init(score: Double, max: Double) { self.score = score; self.max = max }
    }

    public struct SetSummary: Decodable, Equatable, Identifiable, Sendable {
        public let id: String
        public let setId: String
        public let kind: Kind
        public let year: Int?
        public let term: Int?
        public let paper: Int?
        public let title: String
        public let stepCount: Int
        public let interactivePoints: Double
        public let scoreTotal: Double
        public let preview: Bool
        public let attempts: Int
        public let best: Score?

        private enum CodingKeys: String, CodingKey { case id, setId, kind, year, term, paper, title, stepCount, interactivePoints, scoreTotal, preview, attempts, best }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id = try c.decode(String.self, forKey: .id)
            setId = (try? c.decode(String.self, forKey: .setId)) ?? id
            kind = Kind(rawValue: (try? c.decode(String.self, forKey: .kind)) ?? "") ?? .test
            year = (try? c.decodeIfPresent(Int.self, forKey: .year)) ?? nil
            term = (try? c.decodeIfPresent(Int.self, forKey: .term)) ?? nil
            paper = (try? c.decodeIfPresent(Int.self, forKey: .paper)) ?? nil
            title = try c.decode(String.self, forKey: .title)
            stepCount = (try? c.decode(Int.self, forKey: .stepCount)) ?? 0
            interactivePoints = (try? c.decode(Double.self, forKey: .interactivePoints)) ?? 0
            scoreTotal = (try? c.decode(Double.self, forKey: .scoreTotal)) ?? 20
            preview = (try? c.decode(Bool.self, forKey: .preview)) ?? false
            attempts = (try? c.decode(Int.self, forKey: .attempts)) ?? 0
            best = (try? c.decodeIfPresent(Score.self, forKey: .best)) ?? nil
        }
    }

    public struct SetList: Decodable, Equatable, Sendable {
        public let items: [SetSummary]
        public let preview: Bool

        private enum CodingKeys: String, CodingKey { case items, preview }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            items = c.lossyArray(SetSummary.self, forKey: .items)
            preview = (try? c.decode(Bool.self, forKey: .preview)) ?? false
        }
    }

    // MARK: Offline package

    public struct Media: Decodable, Equatable, Sendable {
        public let localPath: String
        public let alt: String
        public let attribution: String?
        public let license: String?

        private enum CodingKeys: String, CodingKey { case localPath = "local_path", alt, attribution, license }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            localPath = try c.decode(String.self, forKey: .localPath)
            alt = (try? c.decode(String.self, forKey: .alt)) ?? ""
            attribution = (try? c.decodeIfPresent(String.self, forKey: .attribution)) ?? nil
            license = (try? c.decodeIfPresent(String.self, forKey: .license)) ?? nil
        }
    }

    public enum Payload: Equatable, Sendable {
        case mcq(options: [String])
        case multi(options: [String])
        case fillBlank(text: String, bank: [String])
        case ordering(items: [String])
        case matching(lefts: [String], rights: [String])
        case portrait(media: Media, options: [String])
        case numeric(unit: String?)
        case shortText
    }

    public enum AnswerKey: Equatable, Sendable {
        case mcq(correct: Int)
        case multi(correct: [Int])
        case fillBlank(blanks: [[String]])
        case ordering(order: [Int])
        case matching(pairs: [Int])
        case portrait(correct: Int)
        case numeric(value: Double, tolerance: Double)
        case shortText(accepted: [String])
    }

    /// The student's answer, encoded exactly as the server's `StepAnswer`.
    public enum Answer: Codable, Equatable, Hashable, Sendable {
        case mcq(Int)
        case multi([Int])
        case fillBlank([String])
        case ordering([Int])
        case matching([Int])
        case portrait(Int)
        case numeric(Double)
        case shortText(String)

        public var type: String {
            switch self {
            case .mcq: return "mcq"
            case .multi: return "multi"
            case .fillBlank: return "fill_blank"
            case .ordering: return "ordering"
            case .matching: return "matching"
            case .portrait: return "portrait"
            case .numeric: return "numeric"
            case .shortText: return "short_text"
            }
        }

        private enum CodingKeys: String, CodingKey { case type, choice, choices, blanks, order, pairs, value, text }

        public func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: CodingKeys.self)
            try c.encode(type, forKey: .type)
            switch self {
            case .mcq(let v), .portrait(let v): try c.encode(v, forKey: .choice)
            case .multi(let v): try c.encode(v, forKey: .choices)
            case .fillBlank(let v): try c.encode(v, forKey: .blanks)
            case .ordering(let v): try c.encode(v, forKey: .order)
            case .matching(let v): try c.encode(v, forKey: .pairs)
            case .numeric(let v): try c.encode(v, forKey: .value)
            case .shortText(let v): try c.encode(v, forKey: .text)
            }
        }

        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            switch try c.decode(String.self, forKey: .type) {
            case "mcq": self = .mcq(try c.decode(Int.self, forKey: .choice))
            case "portrait": self = .portrait(try c.decode(Int.self, forKey: .choice))
            case "multi": self = .multi(try c.decode([Int].self, forKey: .choices))
            case "fill_blank": self = .fillBlank(try c.decode([String].self, forKey: .blanks))
            case "ordering": self = .ordering(try c.decode([Int].self, forKey: .order))
            case "matching": self = .matching(try c.decode([Int].self, forKey: .pairs))
            case "numeric": self = .numeric(try c.decode(Double.self, forKey: .value))
            case "short_text": self = .shortText(try c.decode(String.self, forKey: .text))
            default: throw DecodingError.dataCorruptedError(forKey: .type, in: c, debugDescription: "unknown answer type")
            }
        }
    }

    public enum Excerpt: Equatable, Sendable {
        public struct Verse: Equatable, Sendable {
            public let number: String
            public let first: String
            public let second: String
        }
        case verses([Verse])
        case prose([String])
    }

    public struct SourceDocument: Equatable, Sendable {
        public let caption: String
        public let text: String?
        public let table: [[String]]
        public let media: Media?
    }

    public struct SourceQuestion: Equatable, Sendable {
        public let number: String
        public let part: String
        public let text: String
        public let documents: [SourceDocument]
    }

    public struct Step: Decodable, Equatable, Identifiable, Sendable {
        public let id: String
        public let index: Int
        public let prompt: String
        public let payload: Payload
        public let key: AnswerKey
        public let points: Double
        public let explanation: String
        public let correctText: String
        public let rubricLabel: String?
        public let excerpt: Excerpt?
        public let source: SourceQuestion?

        private enum CodingKeys: String, CodingKey {
            case id, index, type, prompt, payload, answer, points, explanation, correctText
            case rubricLabel = "rubric_label", excerpt, source = "source_question"
        }
        private enum PayloadKeys: String, CodingKey { case options, text, bank, items, lefts, rights, media, unit }
        private enum KeyKeys: String, CodingKey { case type, correct, blanks, order, pairs, value, tolerance, accepted }
        private enum ExcerptKeys: String, CodingKey { case kind, rows, parts }
        private enum VerseKeys: String, CodingKey { case n, a, b }
        private enum SourceKeys: String, CodingKey { case number, part, verbatimText = "verbatim_text", documents }
        private enum DocumentKeys: String, CodingKey { case caption, text, table, media }

        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id = try c.decode(String.self, forKey: .id)
            index = (try? c.decode(Int.self, forKey: .index)) ?? 0
            prompt = try c.decode(String.self, forKey: .prompt)
            points = (try? c.decode(Double.self, forKey: .points)) ?? 0
            explanation = (try? c.decode(String.self, forKey: .explanation)) ?? ""
            correctText = (try? c.decode(String.self, forKey: .correctText)) ?? ""
            rubricLabel = ((try? c.decodeIfPresent(String.self, forKey: .rubricLabel)) ?? nil).flatMap { $0.isEmpty ? nil : $0 }
            let type = try c.decode(String.self, forKey: .type)
            let p = try c.nestedContainer(keyedBy: PayloadKeys.self, forKey: .payload)
            let k = try c.nestedContainer(keyedBy: KeyKeys.self, forKey: .answer)
            switch type {
            case "mcq":
                payload = .mcq(options: try p.decode([String].self, forKey: .options))
                key = .mcq(correct: try k.decode(Int.self, forKey: .correct))
            case "multi":
                payload = .multi(options: try p.decode([String].self, forKey: .options))
                key = .multi(correct: try k.decode([Int].self, forKey: .correct))
            case "fill_blank":
                payload = .fillBlank(text: try p.decode(String.self, forKey: .text), bank: try p.decode([String].self, forKey: .bank))
                key = .fillBlank(blanks: try k.decode([[String]].self, forKey: .blanks))
            case "ordering":
                payload = .ordering(items: try p.decode([String].self, forKey: .items))
                key = .ordering(order: try k.decode([Int].self, forKey: .order))
            case "matching":
                payload = .matching(lefts: try p.decode([String].self, forKey: .lefts), rights: try p.decode([String].self, forKey: .rights))
                key = .matching(pairs: try k.decode([Int].self, forKey: .pairs))
            case "portrait":
                payload = .portrait(media: try p.decode(Media.self, forKey: .media), options: try p.decode([String].self, forKey: .options))
                key = .portrait(correct: try k.decode(Int.self, forKey: .correct))
            case "numeric":
                payload = .numeric(unit: (try? p.decodeIfPresent(String.self, forKey: .unit)) ?? nil)
                key = .numeric(value: try k.decode(Double.self, forKey: .value), tolerance: (try? k.decode(Double.self, forKey: .tolerance)) ?? 0)
            case "short_text":
                payload = .shortText
                key = .shortText(accepted: try k.decode([String].self, forKey: .accepted))
            default:
                throw DecodingError.dataCorruptedError(forKey: .type, in: c, debugDescription: "unsupported step type")
            }
            excerpt = Self.excerpt(try? c.nestedContainer(keyedBy: ExcerptKeys.self, forKey: .excerpt))
            source = Self.source(try? c.nestedContainer(keyedBy: SourceKeys.self, forKey: .source))
        }

        private static func excerpt(_ e: KeyedDecodingContainer<ExcerptKeys>?) -> Excerpt? {
            guard let e, let kind = try? e.decode(String.self, forKey: .kind) else { return nil }
            if kind == "verses", var rows = try? e.nestedUnkeyedContainer(forKey: .rows) {
                var verses: [Excerpt.Verse] = []
                while !rows.isAtEnd {
                    guard let row = try? rows.nestedContainer(keyedBy: VerseKeys.self) else { break }
                    verses.append(Excerpt.Verse(number: (try? row.decode(String.self, forKey: .n)) ?? "",
                                                first: (try? row.decode(String.self, forKey: .a)) ?? "",
                                                second: (try? row.decode(String.self, forKey: .b)) ?? ""))
                }
                return verses.isEmpty ? nil : .verses(verses)
            }
            if kind == "prose", let parts = try? e.decode([String].self, forKey: .parts), !parts.isEmpty { return .prose(parts) }
            return nil
        }

        private static func source(_ s: KeyedDecodingContainer<SourceKeys>?) -> SourceQuestion? {
            guard let s else { return nil }
            var documents: [SourceDocument] = []
            if var list = try? s.nestedUnkeyedContainer(forKey: .documents) {
                while !list.isAtEnd {
                    guard let d = try? list.nestedContainer(keyedBy: DocumentKeys.self) else { break }
                    documents.append(SourceDocument(caption: (try? d.decode(String.self, forKey: .caption)) ?? "",
                                                    text: (try? d.decodeIfPresent(String.self, forKey: .text)) ?? nil,
                                                    table: (try? d.decode([[String]].self, forKey: .table)) ?? [],
                                                    media: (try? d.decodeIfPresent(Media.self, forKey: .media)) ?? nil))
                }
            }
            return SourceQuestion(number: (try? s.decode(String.self, forKey: .number)) ?? "",
                                  part: (try? s.decode(String.self, forKey: .part)) ?? "",
                                  text: (try? s.decode(String.self, forKey: .verbatimText)) ?? "",
                                  documents: documents)
        }

        /// Number of blanks in a fill-in step (the server marks them with `____`).
        public var blankCount: Int {
            guard case .fillBlank(let text, _) = payload else { return 0 }
            return max(0, text.components(separatedBy: "____").count - 1)
        }
    }

    public struct Package: Decodable, Equatable, Identifiable, Sendable {
        public let id: String
        public let setId: String
        public let checksum: String
        public let kind: Kind
        public let year: Int?
        public let title: String
        public let subjectCode: String
        public let language: String
        public let scoreTotal: Double
        public let maxScore: Double
        public let steps: [Step]

        private enum CodingKeys: String, CodingKey { case id, setId, checksum, kind, year, title, subjectCode, language, scoreTotal, maxScore, steps }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id = try c.decode(String.self, forKey: .id)
            setId = (try? c.decode(String.self, forKey: .setId)) ?? id
            checksum = (try? c.decode(String.self, forKey: .checksum)) ?? ""
            kind = Kind(rawValue: (try? c.decode(String.self, forKey: .kind)) ?? "") ?? .test
            year = (try? c.decodeIfPresent(Int.self, forKey: .year)) ?? nil
            title = try c.decode(String.self, forKey: .title)
            subjectCode = (try? c.decode(String.self, forKey: .subjectCode)) ?? ""
            language = (try? c.decode(String.self, forKey: .language)) ?? "ar"
            scoreTotal = (try? c.decode(Double.self, forKey: .scoreTotal)) ?? 20
            steps = c.lossyArray(Step.self, forKey: .steps).sorted { $0.index < $1.index }
            let declared = (try? c.decode(Double.self, forKey: .maxScore)) ?? 0
            maxScore = declared > 0 ? declared : steps.reduce(0) { $0 + $1.points }
        }

        /// Left-to-right content (French, English) inside the Arabic interface.
        public var isLeftToRight: Bool { language == "fr" || language == "en" }
    }

    // MARK: Grading (mirror of platform/src/server/play/exams/engine.ts gradeStep)

    /// 0…1 for one step; partial for composite types. A missing answer or another type is 0.
    public static func grade(_ step: Step, answer: Answer?) -> Double {
        guard let answer else { return 0 }
        switch (step.key, answer) {
        case (.mcq(let correct), .mcq(let choice)), (.portrait(let correct), .portrait(let choice)):
            return choice == correct ? 1 : 0
        case (.multi(let correct), .multi(let choices)):
            let want = Set(correct)
            var hit = 0
            var wrong = 0
            for choice in Set(choices) { if want.contains(choice) { hit += 1 } else { wrong += 1 } }
            return Swift.max(0, Swift.min(1, Double(hit - wrong) / Double(Swift.max(1, want.count))))
        case (.fillBlank(let blanks), .fillBlank(let given)):
            var bank: [String] = []
            if case .fillBlank(_, let b) = step.payload { bank = b }
            // Strict when two bank words differ only by diacritics (i'rab, prosody).
            let strict = Set(bank.map(normalizeArabic)).count != bank.count
            var ok = 0
            for (i, alternatives) in blanks.enumerated() where i < given.count {
                let value = given[i]
                if alternatives.contains(where: { exact($0) == exact(value) || (!strict && normalizeArabic($0) == normalizeArabic(value)) }) { ok += 1 }
            }
            return Double(ok) / Double(Swift.max(1, blanks.count))
        case (.ordering(let order), .ordering(let given)), (.matching(let order), .matching(let given)):
            guard given.count == order.count else { return 0 }
            let ok = zip(order, given).filter { $0 == $1 }.count
            return Double(ok) / Double(Swift.max(1, order.count))
        case (.numeric(let value, let tolerance), .numeric(let given)):
            return given.isFinite && abs(given - value) <= tolerance + 1e-6 ? 1 : 0
        case (.shortText(let accepted), .shortText(let text)):
            let wanted = normalizeArabic(text)
            return accepted.contains { normalizeArabic($0) == wanted } ? 1 : 0
        default:
            return 0
        }
    }

    /// Σ(points × grade) over the package; unanswered steps count 0.
    public static func score(_ package: Package, answers: [String: Answer]) -> Score {
        var score = 0.0
        var max = 0.0
        for step in package.steps {
            score += step.points * grade(step, answer: answers[step.id])
            max += step.points
        }
        return Score(score: score, max: max)
    }

    /// The score on the paper's scale (20 for the BAC), as the website shows it.
    public static func scaled(_ score: Score, total: Double) -> Double {
        guard score.max > 0 else { return 0 }
        return (score.score / score.max * total * 100).rounded() / 100
    }

    // MARK: Arabic text matching (mirror of src/server/lib/arabic.ts normalizeArabic)

    public static func normalizeArabic(_ input: String) -> String {
        var out = String.UnicodeScalarView()
        for scalar in input.precomposedStringWithCompatibilityMapping.unicodeScalars {
            switch scalar.value {
            case 0x064B...0x0652, 0x0670, 0x0640: continue // harakat, superscript alef, tatweel
            case 0x0623, 0x0625, 0x0622, 0x0671: out.append("\u{0627}") // أ إ آ ٱ → ا
            case 0x0629: out.append("\u{0647}") // ة → ه
            case 0x0649, 0x0626: out.append("\u{064A}") // ى ئ → ي
            case 0x0624: out.append("\u{0648}") // ؤ → و
            default:
                // Like JavaScript's [^\p{L}\p{N}\s] → ' '.
                if scalar.properties.isWhitespace || isLetterOrDigit(scalar) {
                    out.append(scalar)
                } else {
                    out.append(" ")
                }
            }
        }
        return collapse(String(out).lowercased())
    }

    /// Exact comparison (with diacritics and symbols): only spacing and composition are relaxed.
    public static func exact(_ input: String) -> String {
        collapse(input.precomposedStringWithCanonicalMapping)
    }

    private static func isLetterOrDigit(_ scalar: Unicode.Scalar) -> Bool {
        switch scalar.properties.generalCategory {
        case .uppercaseLetter, .lowercaseLetter, .titlecaseLetter, .modifierLetter, .otherLetter,
             .decimalNumber, .letterNumber, .otherNumber:
            return true
        default:
            return false
        }
    }

    private static func collapse(_ input: String) -> String {
        input.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
    }
}
