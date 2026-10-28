import Foundation
import XCTest
@testable import MadrasadzCore

final class IOSAPIModelsTests: XCTestCase {
    private func decode<T: Decodable>(_ type: T.Type, _ json: String) throws -> IOSAPI.Envelope<T> {
        try JSONDecoder().decode(IOSAPI.Envelope<T>.self, from: Data(json.utf8))
    }

    func testCapabilitiesGateNativeLearning() throws {
        let caps = try XCTUnwrap(decode(IOSAPI.Capabilities.self, APIFixtures.capabilities).data)
        XCTAssertTrue(caps.supportsNativeLearning(appBuild: 8))
        XCTAssertFalse(IOSAPI.Capabilities(apiVersion: 0, features: ["home", "course"], minAppBuild: 1).supportsNativeLearning(appBuild: 8))
        XCTAssertFalse(IOSAPI.Capabilities(apiVersion: 1, features: ["home"], minAppBuild: 1).supportsNativeLearning(appBuild: 8))
        XCTAssertFalse(IOSAPI.Capabilities(apiVersion: 1, features: ["home", "course"], minAppBuild: 9).supportsNativeLearning(appBuild: 8))
    }

    func testGuestAndStudentHome() throws {
        let guest = try XCTUnwrap(decode(NativeHome.self, APIFixtures.homeGuest).data)
        XCTAssertNil(guest.account)
        XCTAssertEqual(guest.courses, [])
        XCTAssertEqual(guest.tools, [])
        guard case .group(let heading, let detail, let items) = try XCTUnwrap(guest.freeLessons.first) else { return XCTFail("group expected") }
        XCTAssertEqual(heading, "سلسلة الفروض")
        XCTAssertEqual(detail, "الثالثة ثانوي")
        XCTAssertEqual(items.map(\.label), ["آداب", "علوم"])

        let student = try XCTUnwrap(decode(NativeHome.self, APIFixtures.homeStudent).data)
        XCTAssertNotNil(student.account)
        XCTAssertEqual(student.courses.first?.status, .active)
        XCTAssertEqual(student.courses.first?.termsAccepted, true)
        XCTAssertEqual(student.tools.map(\.id), ["play", "practice", "quizzes", "exams"])
    }

    func testErrorsCarryCodeAndReason() throws {
        let role = try decode(NativeHome.self, APIFixtures.homeRole)
        XCTAssertFalse(role.ok)
        XCTAssertNil(role.data)
        XCTAssertEqual(role.error?.code, "FORBIDDEN")
        XCTAssertEqual(role.error?.reason, "ROLE")
        XCTAssertEqual(try decode(NativeCourse.self, APIFixtures.courseUnauth).error?.code, "AUTH_REQUIRED")
    }

    func testCourseSectionsAndTerms() throws {
        let course = try XCTUnwrap(decode(NativeCourse.self, APIFixtures.course).data)
        XCTAssertFalse(course.needsTerms)
        XCTAssertEqual(course.sections.map(\.kind), [.lessons, .videos, .homework, .tests])
        XCTAssertEqual(course.sections.first?.items.map(\.session), [1, 2])
        XCTAssertEqual(course.sections.first?.items.first?.displayTitle, "مدخل")
        XCTAssertEqual(course.itemCount, 5)
        XCTAssertTrue(course.webPath.hasPrefix("/ios/course/"))

        let terms = try XCTUnwrap(decode(NativeCourse.self, APIFixtures.courseTerms).data)
        XCTAssertTrue(terms.needsTerms)
        XCTAssertEqual(terms.sections, [])
        XCTAssertEqual(terms.course.title, "دورة بشروط")
    }

    func testNewerServerFieldsAndValuesDoNotBreakDecoding() throws {
        let json = #"""
        {"ok":true,"data":{"needsTerms":false,"newField":1,"course":{"slug":"c","title":"T","extra":true},
         "sections":[{"id":"podcasts","items":[{"slug":"a","title":"A","type":"AUDIO"}]},
                     {"id":"files","items":[{"slug":"b","title":"B","displayTitle":"","type":"PDF"},{"broken":true}]},
                     {"id":"lessons","items":[{"slug":"c1","title":"الحصة 1","displayTitle":"مدخل","session":1,"type":"LESSON"}]}],
         "upcoming":[{"title":"بث","startsAt":"2026-11-01T10:00:00Z","durationMinutes":60},{"oops":1}],
         "webPath":"/ios/course/c"}}
        """#
        let course = try XCTUnwrap(decode(NativeCourse.self, json).data)
        XCTAssertEqual(course.sections.map(\.kind), [.lessons, .files], "unknown section ids fold into files, order is fixed")
        XCTAssertEqual(course.sections.last?.items.map(\.slug), ["a", "b"])
        XCTAssertEqual(course.sections.last?.items.last?.displayTitle, "B", "empty display title falls back to the title")
        XCTAssertEqual(course.upcoming.count, 1)

        let home = #"""
        {"ok":true,"data":{"account":null,"courses":[{"slug":"x","title":"X","status":"PAUSED"},null,7,"y",[1]],
         "freeLessons":[{"kind":"carousel"},{"kind":"single","slug":"s","label":"S","type":"PDF"},{"kind":"group","heading":"G","items":[]}],
         "tools":[{"id":"play","webPath":"/student/play"},{"id":3}]}}
        """#
        let decoded = try XCTUnwrap(decode(NativeHome.self, home).data)
        XCTAssertEqual(decoded.courses.map(\.slug), ["x"], "entries of another JSON shape are skipped")
        XCTAssertEqual(decoded.courses.first?.status, .ended, "unknown status is treated as not active")
        XCTAssertEqual(decoded.freeLessons.map(\.id), ["single:s"])
        XCTAssertEqual(decoded.tools.map(\.id), ["play"])
    }
}
