import Foundation
import XCTest
@testable import MadrasadzCore

final class ClassroomModelsTests: XCTestCase {
    private func decode<T: Decodable>(_ type: T.Type, _ json: String) throws -> T {
        try XCTUnwrap(JSONDecoder().decode(IOSAPI.Envelope<T>.self, from: Data(json.utf8)).data)
    }

    func testClassroomPage() throws {
        let page = try decode(Classroom.Page.self, #"""
        {"ok":true,"data":{"groups":[{"id":"g1","name":"فوج الدورة"}],"posts":[
          {"id":"p1","body":"واجب الأسبوع","linkUrl":"https://example.com/x","file":{"name":"درس.pdf","url":"/api/v1/files/f1?exp=1&sig=s"},"pinned":true,"allowComments":true,"createdAt":"2026-11-04T08:00:00.000Z","groupName":"فوج الدورة","authorName":"الأستاذ",
           "comments":[{"id":"c1","body":"سؤال","createdAt":"2026-11-04T08:10:00.000Z","authorName":"كريم","teacher":false,"mine":false,"authorKey":"aaaaaaaaaaaaaaaaaaaa"},
                       {"id":"c2","body":"جواب","authorName":"الأستاذ","teacher":true,"mine":false,"authorKey":"bbbbbbbbbbbbbbbbbbbb"},
                       {"id":"c3","body":"شكرًا","authorName":"أنا","teacher":false,"mine":true,"authorKey":null}]},
          {"id":"p2","body":"إعلان","linkUrl":"http://insecure.example","file":null,"pinned":false,"allowComments":false,"authorName":"الأستاذ","comments":[]},
          {"broken":true}
        ]}}
        """#)
        XCTAssertEqual(page.groups.map(\.name), ["فوج الدورة"])
        XCTAssertEqual(page.posts.map(\.id), ["p1", "p2"], "a broken post is skipped")
        let p = page.posts[0]
        XCTAssertTrue(p.pinned)
        XCTAssertNotNil(p.link)
        XCTAssertNil(page.posts[1].link, "only https links open")
        XCTAssertEqual(p.file?.name, "درس.pdf")
        XCTAssertEqual(p.comments.map(\.reportable), [true, false, false], "no report on the teacher or oneself")
        XCTAssertEqual(p.visibleComments(hiding: ["aaaaaaaaaaaaaaaaaaaa"]).map(\.id), ["c2", "c3"])
        XCTAssertFalse(page.posts[1].allowComments)
        XCTAssertTrue(Classroom.commentIsValid(" شكرًا "))
        XCTAssertFalse(Classroom.commentIsValid("   "))
    }

    func testCourseCarriesItsGroupAndClassroomNotificationsOpenIt() throws {
        let course = try decode(NativeCourse.self, #"{"ok":true,"data":{"needsTerms":false,"course":{"slug":"s","title":"t","groupId":"g1"},"sections":[],"upcoming":[],"webPath":"/x"}}"#)
        XCTAssertEqual(course.course.groupId, "g1")
        XCTAssertEqual(NotificationLink(link: "/student/classroom#post-8f2c7a10-1234-4abc-8def-0123456789ab"), .classroom)
        XCTAssertEqual(NotificationLink(link: "/student/classroom?group=g1"), .classroom)
    }
}
