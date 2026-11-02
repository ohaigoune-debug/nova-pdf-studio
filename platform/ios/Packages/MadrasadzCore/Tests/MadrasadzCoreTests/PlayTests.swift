import XCTest
@testable import MadrasadzCore

/// Fixtures/play-package.json is a real offline package built by the server engine
/// from five published exam papers; play-expected.json holds the server's own
/// scores (scoreSteps) for three answer sets, so the app grades exactly like it.
final class PlayTests: XCTestCase {
    private struct Expected: Decodable {
        struct Case: Decodable {
            let answers: [String: Play.Answer?]?
            let score: Double
            let perStep: [String: Double]?
        }
        let correct: Case
        let mixed: Case
        let empty: Case
        let max: Double
        let types: [String]
    }

    private func fixture(_ name: String) throws -> Data {
        let url = try XCTUnwrap(Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures"))
        return try Data(contentsOf: url)
    }

    private func package() throws -> Play.Package {
        let envelope = try JSONDecoder().decode(IOSAPI.Envelope<Play.Package>.self, from: fixture("play-package"))
        return try XCTUnwrap(envelope.data)
    }

    private func expected() throws -> Expected {
        try JSONDecoder().decode(Expected.self, from: fixture("play-expected"))
    }

    private static func answers(_ raw: [String: Play.Answer?]?) -> [String: Play.Answer] {
        (raw ?? [:]).compactMapValues { $0 }
    }

    func testDecodesEveryStepOfARealPackage() throws {
        let pkg = try package()
        let exp = try expected()
        XCTAssertEqual(pkg.id, "11111111-2222-4333-8444-555555555555")
        XCTAssertEqual(pkg.kind, .bac)
        XCTAssertFalse(pkg.steps.isEmpty)
        XCTAssertEqual(pkg.steps.reduce(0) { $0 + $1.points }, exp.max, accuracy: 1e-9)
        XCTAssertEqual(pkg.maxScore, exp.max, accuracy: 1e-9)
        var seen = Set<String>()
        for step in pkg.steps {
            switch step.payload {
            case .mcq: seen.insert("mcq")
            case .multi: seen.insert("multi")
            case .fillBlank: seen.insert("fill_blank"); XCTAssertGreaterThan(step.blankCount, 0)
            case .ordering: seen.insert("ordering")
            case .matching: seen.insert("matching")
            case .numeric: seen.insert("numeric")
            case .portrait: seen.insert("portrait")
            case .shortText: seen.insert("short_text")
            }
            XCTAssertFalse(step.prompt.isEmpty)
            XCTAssertFalse(step.correctText.isEmpty)
        }
        XCTAssertEqual(seen, Set(exp.types))
        XCTAssertEqual(pkg.steps.map(\.index), pkg.steps.map(\.index).sorted())
    }

    func testScoresMatchTheServerEngine() throws {
        let pkg = try package()
        let exp = try expected()
        XCTAssertEqual(Play.score(pkg, answers: Self.answers(exp.correct.answers)).score, exp.correct.score, accuracy: 1e-9)
        XCTAssertEqual(Play.score(pkg, answers: Self.answers(exp.mixed.answers)).score, exp.mixed.score, accuracy: 1e-9)
        XCTAssertEqual(Play.score(pkg, answers: [:]).score, exp.empty.score, accuracy: 1e-9)
        let mixed = Self.answers(exp.mixed.answers)
        for step in pkg.steps {
            let want = exp.mixed.perStep?[step.id] ?? 0
            XCTAssertEqual(Play.grade(step, answer: mixed[step.id]), want, accuracy: 1e-9, "step \(step.id)")
        }
    }

    func testAnswerEncodingMatchesTheSyncSchema() throws {
        let cases: [(Play.Answer, String)] = [
            (.mcq(2), #"{"choice":2,"type":"mcq"}"#),
            (.multi([0, 3]), #"{"choices":[0,3],"type":"multi"}"#),
            (.fillBlank(["أ", "ب"]), #"{"blanks":["أ","ب"],"type":"fill_blank"}"#),
            (.ordering([2, 0, 1]), #"{"order":[2,0,1],"type":"ordering"}"#),
            (.matching([1, -1]), #"{"pairs":[1,-1],"type":"matching"}"#),
            (.portrait(1), #"{"choice":1,"type":"portrait"}"#),
            (.numeric(2.5), #"{"type":"numeric","value":2.5}"#),
            (.shortText("نعم"), #"{"text":"نعم","type":"short_text"}"#)
        ]
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        for (answer, json) in cases {
            XCTAssertEqual(String(data: try encoder.encode(answer), encoding: .utf8), json)
            XCTAssertEqual(try JSONDecoder().decode(Play.Answer.self, from: Data(json.utf8)), answer)
        }
    }

    func testArabicNormalisationLikeTheServer() {
        XCTAssertEqual(Play.normalizeArabic("  الْمَدْرَسَةُ  "), "المدرسه")
        XCTAssertEqual(Play.normalizeArabic("إِلى"), "الي")
        XCTAssertEqual(Play.normalizeArabic("مؤمن، سائل!"), "مومن سايل")
        XCTAssertEqual(Play.normalizeArabic("Hello,   World"), "hello world")
        XCTAssertEqual(Play.exact(" فِعْلٌ   ماضٍ "), "فِعْلٌ ماضٍ")
    }

    func testFillBlankIsStrictWhenTheBankDiffersOnlyByDiacritics() throws {
        let strict = try JSONDecoder().decode(Play.Step.self, from: Data(#"""
        {"id":"s","index":0,"type":"fill_blank","prompt":"p","points":1,"payload":{"type":"fill_blank","text":"هذا ____","bank":["كَتَبَ","كُتُبٌ"]},"answer":{"type":"fill_blank","blanks":[["كَتَبَ"]]},"explanation":"","correctText":"كَتَبَ"}
        """#.utf8))
        XCTAssertEqual(Play.grade(strict, answer: .fillBlank(["كَتَبَ"])), 1)
        XCTAssertEqual(Play.grade(strict, answer: .fillBlank(["كُتُبٌ"])), 0)
        let loose = try JSONDecoder().decode(Play.Step.self, from: Data(#"""
        {"id":"s","index":0,"type":"fill_blank","prompt":"p","points":1,"payload":{"type":"fill_blank","text":"____ و ____","bank":["المدرسة","البيت"]},"answer":{"type":"fill_blank","blanks":[["المدرسة"],["البيت"]]},"explanation":"","correctText":"المدرسة"}
        """#.utf8))
        XCTAssertEqual(loose.blankCount, 2)
        XCTAssertEqual(Play.grade(loose, answer: .fillBlank(["المدرسه", "خطأ"])), 0.5)
    }

    func testOtherStepTypes() throws {
        func step(_ json: String) throws -> Play.Step { try JSONDecoder().decode(Play.Step.self, from: Data(json.utf8)) }
        let multi = try step(#"{"id":"m","index":0,"type":"multi","prompt":"p","points":1,"payload":{"type":"multi","options":["a","b","c","d"]},"answer":{"type":"multi","correct":[0,2]},"explanation":"","correctText":"a ، c"}"#)
        XCTAssertEqual(Play.grade(multi, answer: .multi([0, 2])), 1)
        XCTAssertEqual(Play.grade(multi, answer: .multi([0])), 0.5)
        XCTAssertEqual(Play.grade(multi, answer: .multi([0, 1])), 0)
        XCTAssertEqual(Play.grade(multi, answer: .mcq(0)), 0)
        let numeric = try step(#"{"id":"n","index":0,"type":"numeric","prompt":"p","points":1,"payload":{"type":"numeric","unit":"m"},"answer":{"type":"numeric","value":9.8,"tolerance":0.1,"unit":"m"},"explanation":"","correctText":"9.8"}"#)
        XCTAssertEqual(Play.grade(numeric, answer: .numeric(9.75)), 1)
        XCTAssertEqual(Play.grade(numeric, answer: .numeric(9.6)), 0)
        let text = try step(#"{"id":"t","index":0,"type":"short_text","prompt":"p","points":1,"payload":{"type":"short_text"},"answer":{"type":"short_text","accepted":["الاستعارة المكنية"]},"explanation":"","correctText":"الاستعارة المكنية"}"#)
        XCTAssertEqual(Play.grade(text, answer: .shortText("  الإستعارةُ المكنيّة ")), 1)
        let portrait = try step(#"{"id":"q","index":0,"type":"portrait","prompt":"p","points":2,"payload":{"type":"portrait","media":{"local_path":"/play/a.jpg","alt":"x"},"options":["a","b"]},"answer":{"type":"portrait","correct":1},"explanation":"","correctText":"b"}"#)
        XCTAssertEqual(Play.grade(portrait, answer: .portrait(1)), 1)
        // A step type this build does not know is skipped, not a decoding failure of the package.
        let pkg = try JSONDecoder().decode(Play.Package.self, from: Data(#"""
        {"id":"p","title":"t","steps":[{"id":"x","index":1,"type":"map_locate","prompt":"p","points":1,"payload":{"type":"map_locate","spec":{}},"answer":{"type":"map_locate","spec":{}}},{"id":"m","index":0,"type":"mcq","prompt":"p","points":1,"payload":{"type":"mcq","options":["a","b"]},"answer":{"type":"mcq","correct":0},"explanation":"","correctText":"a"}]}
        """#.utf8))
        XCTAssertEqual(pkg.steps.map(\.id), ["m"])
        XCTAssertEqual(pkg.maxScore, 1)
        XCTAssertEqual(Play.scaled(Play.Score(score: 0.5, max: 1), total: 20), 10)
    }

    func testSubjectsAndSetsDecodeTolerantly() throws {
        let subjects = try JSONDecoder().decode(Play.Subjects.self, from: Data(#"""
        {"gradeCode":null,"streamCode":null,"subjects":[],"grades":[{"code":"3AS","nameAr":"الثالثة ثانوي","streams":[{"code":"LIT","nameAr":"آداب وفلسفة"}]},{"broken":true}]}
        """#.utf8))
        XCTAssertTrue(subjects.needsProfile)
        XCTAssertEqual(subjects.grades.map(\.code), ["3AS"])
        let sets = try JSONDecoder().decode(Play.SetList.self, from: Data(#"""
        {"items":[{"id":"a","setId":"x","kind":"BAC","year":2022,"term":null,"paper":1,"title":"بكالوريا 2022","stepCount":12,"interactivePoints":14,"scoreTotal":20,"preview":false,"attempts":2,"best":{"score":11,"max":14}},{"id":"b","title":"فرض","kind":"NEW_KIND"}],"preview":false}
        """#.utf8))
        XCTAssertEqual(sets.items.count, 2)
        XCTAssertEqual(sets.items[0].best, Play.Score(score: 11, max: 14))
        XCTAssertEqual(sets.items[1].kind, .test)
    }

    func testPlayStoreKeepsPackagesAndAttemptsPerAccount() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let store = PlayStore(root: root)
        let a = UUID().uuidString.lowercased()
        let b = UUID().uuidString.lowercased()
        let envelope = try XCTUnwrap(try JSONSerialization.jsonObject(with: fixture("play-package")) as? [String: Any])
        let data = try JSONSerialization.data(withJSONObject: try XCTUnwrap(envelope["data"]))
        try await store.activate(account: a)
        let pkg = try await store.savePackage(data)
        let stored = try await store.package(id: pkg.id)
        XCTAssertEqual(stored, pkg)
        let attempt = try await store.addAttempt(package: pkg, answers: Self.answers(try expected().correct.answers))
        XCTAssertEqual(attempt.score, attempt.max, accuracy: 1e-9)
        var pending = await store.pendingAttempts()
        XCTAssertEqual(pending.map(\.id), [attempt.id])
        // Another account sees nothing.
        let other = try await store.activate(account: b)
        XCTAssertTrue(other.downloaded.isEmpty && other.attempts.isEmpty)
        // Back to the first account: the state was persisted.
        let back = try await store.activate(account: a)
        XCTAssertEqual(back.downloaded.map(\.id), [pkg.id])
        try await store.markSynced(attempt.id, server: Play.Score(score: 17, max: 17))
        pending = await store.pendingAttempts()
        XCTAssertTrue(pending.isEmpty)
        try await store.purge(account: a)
        let afterPurge = try await store.activate(account: a)
        XCTAssertTrue(afterPurge.downloaded.isEmpty && afterPurge.attempts.isEmpty)
    }

    func testResponseCacheIsPerAccount() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let cache = ResponseCache(root: root)
        let a = UUID().uuidString
        await cache.store(Data("home".utf8), path: "/api/v1/ios/home", account: a)
        let hit = await cache.load(path: "/api/v1/ios/home", account: a)
        XCTAssertEqual(hit?.data, Data("home".utf8))
        let miss = await cache.load(path: "/api/v1/ios/home", account: UUID().uuidString)
        XCTAssertNil(miss)
        await cache.purge(account: a)
        let gone = await cache.load(path: "/api/v1/ios/home", account: a)
        XCTAssertNil(gone)
    }

    func testNativeLessonLinkVideoProviderAndCourseTerms() throws {
        func lesson(_ media: String) throws -> NativeLesson {
            let json = #"{"ok":true,"data":{"lesson":{"slug":"s","title":"T","type":"LINK","media":"# + media + #","webPath":"/ios/lesson/s"}}}"#
            return try XCTUnwrap(try JSONDecoder().decode(IOSAPI.Envelope<NativeLesson>.self, from: Data(json.utf8)).data)
        }
        XCTAssertEqual(try lesson(#"{"kind":"external","url":"https://example.com/a"}"#).media, .link(URL(string: "https://example.com/a")!))
        XCTAssertEqual(try lesson(#"{"kind":"external","url":"http://example.com/a"}"#).media, .external)
        XCTAssertEqual(try lesson(#"{"kind":"external"}"#).media, .external)
        let id = "a3a44d91-0705-48fd-95ea-545859a4acfe"
        XCTAssertEqual(try lesson(#"{"kind":"video","contentId":"\#(id)","provider":"BUNNY"}"#).media, .video(contentID: UUID(uuidString: id), provider: "BUNNY"))
        XCTAssertEqual(try lesson(#"{"kind":"video","contentId":"\#(id)"}"#).media, .video(contentID: UUID(uuidString: id), provider: nil))
        let player = try JSONDecoder().decode(NativeLesson.Player.self, from: Data(#"{"provider":"bunny","url":"https://iframe.mediadelivery.net/embed/1/abc?token=t&expires=9","expires":9,"watermark":["تلميذ","…1234 · 2026-11-02"],"contentId":"x","title":"y"}"#.utf8))
        XCTAssertEqual(player.url.host, "iframe.mediadelivery.net")
        XCTAssertEqual(player.watermark.count, 2)
        let course = try JSONDecoder().decode(NativeCourse.self, from: Data(#"{"needsTerms":true,"course":{"slug":"c","title":"C"},"terms":{"text":"شروط","version":3},"webPath":"/ios/course/c"}"#.utf8))
        XCTAssertTrue(course.needsTerms)
        XCTAssertEqual(course.terms, NativeCourse.Terms(text: "شروط", version: 3))
    }
}
