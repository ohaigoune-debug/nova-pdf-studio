import XCTest
@testable import MadrasadzCore

/// Fixtures/cards-pack.json is a real lesson pack built by the server (lessonPack) with one
/// question of each type; cards-expected.json holds the server's gradePlayAnswer result for
/// eleven answers, so the phone grades a card exactly like the website.
final class CardTests: XCTestCase {
    private struct Expected: Decodable {
        struct Case: Decodable {
            let questionId: String
            let answer: Cards.Answer
            let isCorrect: Bool
            let score: Double
        }
        let cases: [Case]
    }

    private func fixture(_ name: String) throws -> Data {
        let url = try XCTUnwrap(Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures"))
        return try Data(contentsOf: url)
    }

    private func pack() throws -> Cards.Pack {
        try XCTUnwrap(try JSONDecoder().decode(IOSAPI.Envelope<Cards.Pack>.self, from: fixture("cards-pack")).data)
    }

    func testDecodesARealLessonPack() throws {
        let pack = try pack()
        XCTAssertEqual(pack.lesson.lessonName, "الصور البيانية")
        XCTAssertEqual(pack.roundSize, 12)
        XCTAssertEqual(pack.questions.count, 4)
        var kinds = Set<String>()
        for q in pack.questions {
            switch q.payload {
            case .mcq(let options): kinds.insert("mcq"); XCTAssertEqual(options.count, 4)
            case .fill(let segments, let blanks, let bank):
                kinds.insert("fill")
                XCTAssertEqual(blanks, 2)
                XCTAssertEqual(segments.filter { if case .blank = $0 { return true }; return false }.count, 2)
                XCTAssertEqual(bank.count, 4)
            case .matching(let lefts, let rights): kinds.insert("matching"); XCTAssertEqual(lefts.count, rights.count)
            case .ordering(let items): kinds.insert("ordering"); XCTAssertEqual(items.count, 4)
            }
            XCTAssertFalse(q.correctText.isEmpty)
            XCTAssertFalse(q.explanation.isEmpty)
        }
        XCTAssertEqual(kinds, ["mcq", "fill", "matching", "ordering"])
    }

    func testGradesExactlyLikeTheServer() throws {
        let pack = try pack()
        let expected = try JSONDecoder().decode(Expected.self, from: fixture("cards-expected"))
        XCTAssertEqual(expected.cases.count, 11)
        for c in expected.cases {
            let q = try XCTUnwrap(pack.questions.first { $0.id == c.questionId })
            let g = Cards.grade(q, answer: c.answer)
            XCTAssertEqual(g.isCorrect, c.isCorrect, "\(c.answer)")
            XCTAssertEqual(g.score, c.score, accuracy: 1e-9, "\(c.answer)")
        }
        XCTAssertEqual(Cards.grade(pack.questions[0], answer: nil), Cards.Grade(isCorrect: false, score: 0))
    }

    func testAnswerEncodingMatchesTheSyncSchema() throws {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let cases: [(Cards.Answer, String)] = [
            (.mcq("b"), #"{"key":"b","type":"MCQ"}"#),
            (.fill(["أ", "ب"]), #"{"blanks":["أ","ب"],"type":"FILL_BLANK"}"#),
            (.matching(["l0": "r1"]), #"{"matches":{"l0":"r1"},"type":"MATCHING"}"#),
            (.ordering(["o1", "o0"]), #"{"order":["o1","o0"],"type":"ORDERING"}"#)
        ]
        for (answer, json) in cases {
            XCTAssertEqual(String(data: try encoder.encode(answer), encoding: .utf8), json)
            XCTAssertEqual(try JSONDecoder().decode(Cards.Answer.self, from: Data(json.utf8)), answer)
        }
    }

    func testExactTokenKeepsDiacritics() {
        XCTAssertEqual(Cards.exactToken("  كَتَـبَ   الدرس "), "كَتَبَ الدرس")
        XCTAssertNotEqual(Cards.exactToken("كتب"), Cards.exactToken("كَتَبَ"))
    }

    func testRoundPicksMissedAndUnseenFirstAndIsStable() throws {
        let pack = try pack()
        let a = Cards.pickRound(pack, size: 3, memory: [:], seed: 42)
        let b = Cards.pickRound(pack, size: 3, memory: [:], seed: 42)
        XCTAssertEqual(a.map(\.id), b.map(\.id))
        XCTAssertEqual(a.count, 3)
        XCTAssertEqual(Set(a.map(\.id)).count, 3)
        XCTAssertEqual(Cards.pickRound(pack, size: 50, memory: [:], seed: 1).count, 4)
        // Easy before hard.
        let all = Cards.pickRound(pack, size: 4, memory: [:], seed: 7)
        XCTAssertEqual(all.last?.difficulty, "HARD")
        // A shuffled ordering card never starts solved.
        for q in pack.questions {
            if case .ordering(let items) = q.payload {
                for seed in 0..<40 {
                    if case .ordering(let shown) = Cards.shuffled(q.payload, seed: UInt64(seed)) { XCTAssertNotEqual(shown, items) }
                }
            }
        }
        let xp = Cards.estimatedXP(pack.questions, results: [pack.questions[0].id: .init(isCorrect: true, score: 1)], rules: pack.xp, complete: true)
        XCTAssertEqual(xp, pack.xp.correct + pack.xp.sessionComplete)
    }

    func testPlayStoreKeepsCardsAndReadsAnOlderIndex() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let account = UUID().uuidString.lowercased()
        // An index written by Build 10/11 (exam data only) must still open.
        let dir = root.appendingPathComponent(account)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        try Data(#"{"downloaded":[],"attempts":[]}"#.utf8).write(to: dir.appendingPathComponent("index.json"))
        let store = PlayStore(root: root)
        let opened = try await store.activate(account: account)
        XCTAssertTrue(opened.downloaded.isEmpty)
        let envelope = try XCTUnwrap(try JSONSerialization.jsonObject(with: fixture("cards-pack")) as? [String: Any])
        let data = try JSONSerialization.data(withJSONObject: try XCTUnwrap(envelope["data"]))
        let pack = try await store.saveCardPack(data)
        let stored = try await store.cardPack(id: pack.id)
        XCTAssertEqual(stored, pack)
        let q = pack.questions[0]
        let round = try await store.addCardRound(lessonId: pack.id, lessonName: pack.lesson.lessonName,
                                                 answers: [.init(questionId: q.id, answer: .mcq("a"), timeMs: 900, correct: false)], estimatedXP: 0)
        let memory = await store.cardMemory()
        XCTAssertEqual(memory[q.id], false)
        var pending = await store.pendingCardRounds()
        XCTAssertEqual(pending.map(\.id), [round.id])
        try await store.markCardSynced(round.id, result: .init(correctCount: 0, total: 1, xpEarned: 0, xpTotal: 40, levelTitle: "مبتدئ", lessonMastered: false))
        pending = await store.pendingCardRounds()
        XCTAssertTrue(pending.isEmpty)
        // Reopened from disk: still there.
        let again = PlayStore(root: root)
        try await again.activate(account: account)
        let lessons = await again.cardLessons()
        XCTAssertEqual(lessons.map(\.id), [pack.id])
        let rounds = await again.cardRounds()
        XCTAssertEqual(rounds.first?.server?.xpTotal, 40)
    }
}
