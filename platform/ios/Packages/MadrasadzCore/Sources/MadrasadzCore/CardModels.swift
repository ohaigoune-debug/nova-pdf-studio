import Foundation

/// MADRASA PLAY card game in the native app (`/api/v1/ios/play/lessons*`, `/cards/sync`).
/// A lesson pack is stored on the phone with its answer keys so rounds work offline;
/// the server re-grades every synced round through the website's own engine.
public enum Cards {
    // MARK: Lessons of a subject

    public struct Level: Decodable, Equatable, Sendable {
        public let index: Int
        public let title: String
        public let progressPct: Int

        private enum CodingKeys: String, CodingKey { case index, title, progressPct }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            index = (try? c.decode(Int.self, forKey: .index)) ?? 0
            title = (try? c.decode(String.self, forKey: .title)) ?? ""
            progressPct = Int((try? c.decode(Double.self, forKey: .progressPct)) ?? 0)
        }
    }

    public struct Stats: Decodable, Equatable, Sendable {
        public let xpTotal: Int
        public let streakDays: Int
        public let level: Level?

        private enum CodingKeys: String, CodingKey { case xpTotal, streakDays, level }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            xpTotal = (try? c.decode(Int.self, forKey: .xpTotal)) ?? 0
            streakDays = (try? c.decode(Int.self, forKey: .streakDays)) ?? 0
            level = (try? c.decodeIfPresent(Level.self, forKey: .level)) ?? nil
        }
    }

    public struct LessonRow: Decodable, Equatable, Identifiable, Sendable {
        public let id: String
        public let lessonName: String
        public let objective: String?
        public let questions: Int
        public let masteryPct: Int
        public let mastered: Bool
        public let answered: Int

        private enum CodingKeys: String, CodingKey { case id, lessonName, objective, questions, masteryPct, mastered, answered }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id = try c.decode(String.self, forKey: .id)
            lessonName = try c.decode(String.self, forKey: .lessonName)
            objective = ((try? c.decodeIfPresent(String.self, forKey: .objective)) ?? nil).flatMap { $0.isEmpty ? nil : $0 }
            questions = (try? c.decode(Int.self, forKey: .questions)) ?? 0
            masteryPct = (try? c.decode(Int.self, forKey: .masteryPct)) ?? 0
            mastered = (try? c.decode(Bool.self, forKey: .mastered)) ?? false
            answered = (try? c.decode(Int.self, forKey: .answered)) ?? 0
        }
    }

    public struct Unit: Decodable, Equatable, Identifiable, Sendable {
        public let unitCode: String
        public let unitName: String
        public let lessons: [LessonRow]
        public var id: String { unitCode }

        private enum CodingKeys: String, CodingKey { case unitCode, unitName, lessons }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            unitCode = try c.decode(String.self, forKey: .unitCode)
            unitName = (try? c.decode(String.self, forKey: .unitName)) ?? unitCode
            lessons = c.lossyArray(LessonRow.self, forKey: .lessons)
        }
    }

    public struct LessonList: Decodable, Equatable, Sendable {
        public let units: [Unit]
        public let stats: Stats?

        private enum CodingKeys: String, CodingKey { case units, stats }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            units = c.lossyArray(Unit.self, forKey: .units)
            stats = (try? c.decodeIfPresent(Stats.self, forKey: .stats)) ?? nil
        }
    }

    // MARK: Lesson pack

    public struct Option: Codable, Equatable, Hashable, Sendable {
        public let key: String
        public let text: String
        public init(key: String, text: String) { self.key = key; self.text = text }
    }

    public enum Segment: Equatable, Sendable { case text(String), blank(Int) }

    public enum Payload: Equatable, Sendable {
        case mcq([Option])
        case fill(segments: [Segment], blanks: Int, bank: [String])
        case matching(lefts: [Option], rights: [Option])
        case ordering([Option])
    }

    public enum Key: Equatable, Sendable {
        case mcq(String)
        case fill([[String]])
        case matching([String: String])
        case ordering([String])
    }

    /// The answer exactly as the server's `PlayStudentAnswer`.
    public enum Answer: Codable, Equatable, Hashable, Sendable {
        case mcq(String)
        case fill([String])
        case matching([String: String])
        case ordering([String])

        private enum CodingKeys: String, CodingKey { case type, key, blanks, matches, order }

        public func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: CodingKeys.self)
            switch self {
            case .mcq(let v): try c.encode("MCQ", forKey: .type); try c.encode(v, forKey: .key)
            case .fill(let v): try c.encode("FILL_BLANK", forKey: .type); try c.encode(v, forKey: .blanks)
            case .matching(let v): try c.encode("MATCHING", forKey: .type); try c.encode(v, forKey: .matches)
            case .ordering(let v): try c.encode("ORDERING", forKey: .type); try c.encode(v, forKey: .order)
            }
        }

        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            switch try c.decode(String.self, forKey: .type) {
            case "MCQ": self = .mcq(try c.decode(String.self, forKey: .key))
            case "FILL_BLANK": self = .fill(try c.decode([String].self, forKey: .blanks))
            case "MATCHING": self = .matching(try c.decode([String: String].self, forKey: .matches))
            case "ORDERING": self = .ordering(try c.decode([String].self, forKey: .order))
            default: throw DecodingError.dataCorruptedError(forKey: .type, in: c, debugDescription: "unknown answer type")
            }
        }
    }

    public struct Question: Decodable, Equatable, Identifiable, Sendable {
        public let id: String
        public let difficulty: String
        public let language: String
        public let text: String
        public let payload: Payload
        public let key: Key
        public let explanation: String
        public let correctText: String

        public var isHard: Bool { difficulty == "HARD" }
        public var isLeftToRight: Bool { language == "fr" || language == "en" }

        private enum CodingKeys: String, CodingKey { case id, type, difficulty, language, questionText, payload, answerKey, explanation, correctText }
        private enum PayloadKeys: String, CodingKey { case options, segments, blanks, bank, lefts, rights, items }
        private enum KeyKeys: String, CodingKey { case correct, answers, pairs, order }
        private enum SegmentKeys: String, CodingKey { case t, b }

        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id = try c.decode(String.self, forKey: .id)
            difficulty = (try? c.decode(String.self, forKey: .difficulty)) ?? "MEDIUM"
            language = (try? c.decode(String.self, forKey: .language)) ?? "ar"
            text = try c.decode(String.self, forKey: .questionText)
            explanation = (try? c.decode(String.self, forKey: .explanation)) ?? ""
            correctText = (try? c.decode(String.self, forKey: .correctText)) ?? ""
            let p = try c.nestedContainer(keyedBy: PayloadKeys.self, forKey: .payload)
            let k = try c.nestedContainer(keyedBy: KeyKeys.self, forKey: .answerKey)
            switch try c.decode(String.self, forKey: .type) {
            case "MCQ":
                payload = .mcq(try p.decode([Option].self, forKey: .options))
                key = .mcq(try k.decode(String.self, forKey: .correct))
            case "FILL_BLANK":
                var segments: [Segment] = []
                var list = try p.nestedUnkeyedContainer(forKey: .segments)
                while !list.isAtEnd {
                    let s = try list.nestedContainer(keyedBy: SegmentKeys.self)
                    if let b = try? s.decode(Int.self, forKey: .b) { segments.append(.blank(b)) }
                    else { segments.append(.text((try? s.decode(String.self, forKey: .t)) ?? "")) }
                }
                let blanks = (try? p.decode(Int.self, forKey: .blanks)) ?? segments.filter { if case .blank = $0 { return true }; return false }.count
                payload = .fill(segments: segments, blanks: blanks, bank: try p.decode([String].self, forKey: .bank))
                key = .fill(try k.decode([[String]].self, forKey: .answers))
            case "MATCHING":
                payload = .matching(lefts: try p.decode([Option].self, forKey: .lefts), rights: try p.decode([Option].self, forKey: .rights))
                key = .matching(try k.decode([String: String].self, forKey: .pairs))
            case "ORDERING":
                payload = .ordering(try p.decode([Option].self, forKey: .items))
                key = .ordering(try k.decode([String].self, forKey: .order))
            default:
                throw DecodingError.dataCorruptedError(forKey: .type, in: c, debugDescription: "unsupported card type")
            }
        }
    }

    public struct LessonInfo: Decodable, Equatable, Sendable {
        public let id: String
        public let subjectCode: String
        public let unitName: String
        public let lessonName: String
        public let language: String

        private enum CodingKeys: String, CodingKey { case id, subjectCode, unitName, lessonName, language }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id = try c.decode(String.self, forKey: .id)
            subjectCode = (try? c.decode(String.self, forKey: .subjectCode)) ?? ""
            unitName = (try? c.decode(String.self, forKey: .unitName)) ?? ""
            lessonName = try c.decode(String.self, forKey: .lessonName)
            language = (try? c.decode(String.self, forKey: .language)) ?? "ar"
        }
    }

    public struct XPRules: Decodable, Equatable, Sendable {
        public let correct: Int
        public let correctHard: Int
        public let sessionComplete: Int

        public init(correct: Int = 10, correctHard: Int = 15, sessionComplete: Int = 30) {
            self.correct = correct
            self.correctHard = correctHard
            self.sessionComplete = sessionComplete
        }

        private enum CodingKeys: String, CodingKey { case correct, correctHard, sessionComplete }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            correct = (try? c.decode(Int.self, forKey: .correct)) ?? 10
            correctHard = (try? c.decode(Int.self, forKey: .correctHard)) ?? 15
            sessionComplete = (try? c.decode(Int.self, forKey: .sessionComplete)) ?? 30
        }
    }

    public struct Pack: Decodable, Equatable, Identifiable, Sendable {
        public let lesson: LessonInfo
        public let checksum: String
        public let roundSize: Int
        public let xp: XPRules
        public let questions: [Question]
        public var id: String { lesson.id }

        private enum CodingKeys: String, CodingKey { case lesson, checksum, roundSize, xp, questions }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            lesson = try c.decode(LessonInfo.self, forKey: .lesson)
            checksum = (try? c.decode(String.self, forKey: .checksum)) ?? ""
            roundSize = max(1, (try? c.decode(Int.self, forKey: .roundSize)) ?? 12)
            xp = (try? c.decode(XPRules.self, forKey: .xp)) ?? XPRules()
            questions = c.lossyArray(Question.self, forKey: .questions)
        }
    }

    // MARK: Grading (mirror of platform/src/server/play/engine.ts gradePlayAnswer)

    public struct Grade: Equatable, Sendable {
        public let isCorrect: Bool
        public let score: Double
        public init(isCorrect: Bool, score: Double) { self.isCorrect = isCorrect; self.score = score }
    }

    /// `s.normalize('NFKC').replace(/ـ/g, '').replace(/\s+/g, ' ').trim()` — diacritics matter.
    public static func exactToken(_ s: String) -> String {
        let cleaned = s.precomposedStringWithCompatibilityMapping.replacingOccurrences(of: "\u{0640}", with: "")
        return cleaned.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
    }

    public static func grade(_ question: Question, answer: Answer?) -> Grade {
        guard let answer else { return Grade(isCorrect: false, score: 0) }
        switch (question.key, answer) {
        case (.mcq(let correct), .mcq(let given)):
            return given == correct ? Grade(isCorrect: true, score: 1) : Grade(isCorrect: false, score: 0)
        case (.fill(let answers), .fill(let given)):
            var hit = 0
            for (i, alternatives) in answers.enumerated() {
                let g = exactToken(i < given.count ? given[i] : "")
                if !g.isEmpty, alternatives.contains(g) { hit += 1 }
            }
            let score = answers.isEmpty ? 0 : Double(hit) / Double(answers.count)
            return Grade(isCorrect: !answers.isEmpty && hit == answers.count, score: score)
        case (.matching(let pairs), .matching(let given)):
            let hit = pairs.filter { given[$0.key] == $0.value }.count
            return Grade(isCorrect: hit == pairs.count, score: pairs.isEmpty ? 0 : Double(hit) / Double(pairs.count))
        case (.ordering(let order), .ordering(let given)):
            let complete = given.count == order.count && zip(given, order).allSatisfy { $0 == $1 }
            var hit = 0
            for (i, k) in order.enumerated() where i < given.count && given[i] == k { hit += 1 }
            return Grade(isCorrect: complete, score: order.isEmpty ? 0 : Double(hit) / Double(order.count))
        default:
            return Grade(isCorrect: false, score: 0)
        }
    }

    /// The XP the server will most likely award (shown until the round is synced).
    public static func estimatedXP(_ questions: [Question], results: [String: Grade], rules: XPRules, complete: Bool) -> Int {
        var xp = 0
        for q in questions where results[q.id]?.isCorrect == true { xp += q.isHard ? rules.correctHard : rules.correct }
        if complete, !results.isEmpty { xp += rules.sessionComplete }
        return xp
    }

    // MARK: Round selection

    /// Picks a round: unseen and missed cards first, then the rest; easy → hard, like the website.
    /// `memory` holds the last local result of each question (true = right).
    public static func pickRound(_ pack: Pack, size: Int, memory: [String: Bool], seed: UInt64) -> [Question] {
        var generator = SeededGenerator(seed: seed)
        func weight(_ q: Question) -> Double {
            switch memory[q.id] {
            case .none: return 1.5
            case .some(false): return 2.2
            case .some(true): return 0.4
            }
        }
        var pool = pack.questions
        var picked: [Question] = []
        let count = min(max(1, size), pool.count)
        while picked.count < count, !pool.isEmpty {
            let total = pool.reduce(0) { $0 + weight($1) }
            var r = Double(generator.next() % 1_000_000) / 1_000_000 * total
            var index = pool.count - 1
            for (i, q) in pool.enumerated() {
                r -= weight(q)
                if r <= 0 { index = i; break }
            }
            picked.append(pool.remove(at: index))
        }
        let rank = ["EASY": 0, "MEDIUM": 1, "HARD": 2]
        return picked.enumerated().sorted { a, b in
            let ra = rank[a.element.difficulty] ?? 1, rb = rank[b.element.difficulty] ?? 1
            return ra == rb ? a.offset < b.offset : ra < rb
        }.map(\.element)
    }

    /// Shuffled presentation of a card (options, bank, right column, items) — answers use keys,
    /// so order never matters to grading. Ordering never starts already solved.
    public static func shuffled(_ payload: Payload, seed: UInt64) -> Payload {
        var generator = SeededGenerator(seed: seed)
        switch payload {
        case .mcq(let options): return .mcq(options.shuffled(using: &generator))
        case .fill(let segments, let blanks, let bank): return .fill(segments: segments, blanks: blanks, bank: bank.shuffled(using: &generator))
        case .matching(let lefts, let rights): return .matching(lefts: lefts, rights: rights.shuffled(using: &generator))
        case .ordering(let items):
            var out = items.shuffled(using: &generator)
            if out.count > 1, out == items { out = Array(out.dropFirst()) + [out[0]] }
            return .ordering(out)
        }
    }

    /// Small deterministic generator (SplitMix64) so a round is stable while it is played.
    public struct SeededGenerator: RandomNumberGenerator {
        private var state: UInt64
        public init(seed: UInt64) { state = seed &+ 0x9E3779B97F4A7C15 }
        public mutating func next() -> UInt64 {
            state &+= 0x9E3779B97F4A7C15
            var z = state
            z = (z ^ (z >> 30)) &* 0xBF58476D1CE4E5B9
            z = (z ^ (z >> 27)) &* 0x94D049BB133111EB
            return z ^ (z >> 31)
        }
    }
}
