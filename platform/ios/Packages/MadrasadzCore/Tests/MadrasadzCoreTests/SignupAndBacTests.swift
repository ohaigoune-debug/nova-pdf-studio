import Foundation
import XCTest
@testable import MadrasadzCore

final class SignupAndBacTests: XCTestCase {
    private func decode<T: Decodable>(_ type: T.Type, _ json: String) throws -> T {
        try XCTUnwrap(JSONDecoder().decode(IOSAPI.Envelope<T>.self, from: Data(json.utf8)).data)
    }

    // MARK: Signup

    func testPhonesAreNormalizedLikeTheWebsite() {
        XCTAssertEqual(Signup.normalizedPhone("0661 23 45 67"), "0661234567")
        XCTAssertEqual(Signup.normalizedPhone("+213 770-11-22-33"), "0770112233")
        XCTAssertEqual(Signup.normalizedPhone("213551234567"), "0551234567")
        XCTAssertEqual(Signup.normalizedPhone("٠٦٦١٢٣٤٥٦٧"), "0661234567")
        XCTAssertNil(Signup.normalizedPhone("0461234567"), "landline")
        XCTAssertNil(Signup.normalizedPhone("066123456"), "too short")
        XCTAssertNil(Signup.normalizedPhone("06612345a7"))
        XCTAssertNil(Signup.normalizedPhone(""))
        XCTAssertEqual(Signup.phoneHint("0661234567"), "…4567")
    }

    func testEmails() {
        XCTAssertTrue(Signup.isEmail(" amina@example.dz "))
        XCTAssertFalse(Signup.isEmail("amina@example"))
        XCTAssertFalse(Signup.isEmail("amina example.dz"))
        XCTAssertFalse(Signup.isEmail("a@b@c.dz"))
    }

    func testFormNamesTheFirstFieldToFixAndSendsCleanValues() throws {
        let options = try decode(Signup.Options.self, #"{"ok":true,"data":{"wilayas":[{"id":"w1","name":"28 — المسيلة"}],"levels":[{"id":"l3","name":"الثالثة ثانوي","secondary":true},{"id":"m4","name":"الرابعة متوسط","secondary":false},{"bad":1}],"streams":[{"id":"s1","name":"آداب وفلسفة"}]}}"#)
        XCTAssertEqual(options.levels.map(\.id), ["l3", "m4"], "an unknown entry is skipped")
        var form = Signup.Form()
        XCTAssertEqual(form.firstInvalidField(levels: options.levels), .fullName)
        form.fullName = "أمينة بن سالم"
        form.email = "Amina@Example.dz"
        form.phone = "0661 23 45 67"
        form.guardianPhone = "07701122"
        XCTAssertEqual(form.firstInvalidField(levels: options.levels), .guardianPhone)
        form.guardianPhone = "+213770112233"
        form.password = "short"
        XCTAssertEqual(form.firstInvalidField(levels: options.levels), .password)
        form.password = "Bac2027-strong"
        form.wilayaID = "w1"
        form.levelID = "l3"
        XCTAssertEqual(form.firstInvalidField(levels: options.levels), .streamId)
        form.streamID = "s1"
        XCTAssertNil(form.firstInvalidField(levels: options.levels))
        let payload = form.payload(levels: options.levels)
        XCTAssertEqual(payload.email, "amina@example.dz")
        XCTAssertEqual(payload.phone, "0661234567")
        XCTAssertEqual(payload.guardianPhone, "0770112233")
        XCTAssertEqual(payload.streamId, "s1")
        // Middle school: no stream is sent even if one was picked before.
        form.levelID = "m4"
        XCTAssertNil(form.firstInvalidField(levels: options.levels))
        XCTAssertNil(form.payload(levels: options.levels).streamId)
    }

    // MARK: BAC bank

    func testBacPageDecodesTolerantly() throws {
        let page = try decode(Bac.Page.self, #"{"ok":true,"data":{"items":[{"id":"a","title":"موضوع العربية آداب — بكالوريا 2024","year":2024,"session":"NORMAL","subjectName":"اللغة العربية","streamName":"آداب وفلسفة","topic":1,"official":true,"hasPaper":true,"hasSolution":true},{"id":"b","title":"قديم","year":null,"official":true},{"title":"بلا معرّف"}],"nextCursor":"MjAyNHxh","facets":{"streams":[{"id":"s1","name":"آداب وفلسفة","count":2}],"subjects":[],"years":[{"year":2024,"count":1}]},"total":2,"myStreamId":"s1"}}"#)
        XCTAssertEqual(page.items.map(\.id), ["a", "b"])
        XCTAssertEqual(page.items[0].detail, "آداب وفلسفة · اللغة العربية")
        XCTAssertFalse(page.items[1].hasPaper)
        XCTAssertEqual(page.nextCursor, "MjAyNHxh")
        XCTAssertEqual(page.facets.years.map(\.year), [2024])
        XCTAssertEqual(page.myStreamId, "s1")
        let bare = try decode(Bac.Page.self, #"{"ok":true,"data":{"items":[]}}"#)
        XCTAssertEqual(bare.facets, .empty)
        XCTAssertEqual(bare.total, 0)
    }

    func testBacPaperLinksAndPaths() throws {
        let paper = try decode(Bac.Paper.self, #"{"ok":true,"data":{"id":"a","title":"موضوع","year":2024,"official":true,"source":{"name":"DzExams","attribution":"المصدر"},"paper":{"url":"/api/v1/files/f?exp=1&sig=x","inApp":true},"solution":{"url":"https://www.dzexams.com/x.pdf","inApp":false}}}"#)
        XCTAssertTrue(Bac.isSafe(try XCTUnwrap(paper.paper)))
        XCTAssertTrue(Bac.isSafe(try XCTUnwrap(paper.solution)))
        XCTAssertFalse(Bac.isSafe(Bac.Link(url: "http://old.test/x.pdf", inApp: false)))
        XCTAssertFalse(Bac.isSafe(Bac.Link(url: "https://evil.test/api/v1/files/x", inApp: true)))
        XCTAssertEqual(Bac.path(stream: nil, subject: nil, year: nil), "/api/v1/ios/bac")
        XCTAssertEqual(Bac.path(stream: "s1", subject: nil, year: 2024, cursor: "MjAy"), "/api/v1/ios/bac?stream=s1&year=2024&cursor=MjAy")
    }
}
