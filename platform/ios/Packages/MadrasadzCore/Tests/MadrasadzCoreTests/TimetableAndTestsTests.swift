import Foundation
import XCTest
@testable import MadrasadzCore

final class TimetableAndTestsTests: XCTestCase {
    private var calendar: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "Africa/Algiers")!
        return c
    }

    /// Sunday 1 November 2026, 12:00 in Algiers.
    private var sundayNoon: Date {
        calendar.date(from: DateComponents(year: 2026, month: 11, day: 1, hour: 12))!
    }

    func testSlotsAreOutsideSchoolHoursWithLongerWeekends() {
        let slots = WeeklyTimetable.slots(now: sundayNoon, options: TimetableOptions(), calendar: calendar)
        // Sunday: the morning is gone, 3 evening sessions. Monday–Thursday: 1 + 3. Friday, Saturday: 4 each.
        XCTAssertEqual(slots.count, 3 + 4 * 4 + 4 + 4)
        let hours = Set(slots.map { calendar.component(.hour, from: $0.date) })
        XCTAssertTrue(hours.isSubset(of: [6, 9, 10, 15, 16, 18, 19, 20]), "\(hours)")
        let friday = slots.filter { calendar.component(.weekday, from: $0.date) == 6 }
        XCTAssertEqual(friday.map(\.minutes), [60, 60, 60, 60])
        XCTAssertFalse(slots.contains { calendar.component(.weekday, from: $0.date) == 6 && calendar.component(.hour, from: $0.date) == 18 }, "no evening slots on the weekend")
        XCTAssertTrue(slots.allSatisfy { $0.date > sundayNoon })

        var light = TimetableOptions()
        light.morning = false
        light.eveningSessions = 2
        light.weekendSessions = 2
        XCTAssertEqual(WeeklyTimetable.slots(now: sundayNoon, options: light, calendar: calendar).count, 2 + 4 * 2 + 2 + 2)
    }

    func testQuotasFollowTheCoefficients() {
        let quota = WeeklyTimetable.quotas(for: .literature, count: 26)
        XCTAssertEqual(quota.values.reduce(0, +), 26)
        XCTAssertEqual(quota[.arabic], quota[.philosophy])
        XCTAssertGreaterThan(quota[.arabic] ?? 0, quota[.historyGeography] ?? 0)
        XCTAssertGreaterThan(quota[.historyGeography] ?? 0, quota[.math] ?? 0)
        XCTAssertGreaterThan(quota[.math] ?? 0, 0)
        let sciences = WeeklyTimetable.quotas(for: .sciences, count: 26)
        XCTAssertGreaterThan(sciences[.science] ?? 0, sciences[.arabic] ?? 0)
        XCTAssertEqual(WeeklyTimetable.quotas(for: .sciences, count: 0), [:])
    }

    func testTheWeekBecomesTasksWithoutTheSameSubjectTwiceInARow() {
        let tasks = WeeklyTimetable.build(stream: .literature, now: sundayNoon, options: TimetableOptions(), reminders: true, calendar: calendar) { subject, activity in
            "\(activity.rawValue) — \(subject.rawValue)"
        }
        XCTAssertEqual(tasks.count, 27)
        XCTAssertTrue(tasks.allSatisfy { $0.reminderEnabled && $0.planID == "weekly-literature" && $0.durationMinutes != nil })
        for (a, b) in zip(tasks, tasks.dropFirst()) { XCTAssertNotEqual(a.subjectID, b.subjectID) }
        let arabic = tasks.filter { $0.subject == .arabic }.count
        let math = tasks.filter { $0.subject == .math }.count
        XCTAssertGreaterThan(arabic, math)
        XCTAssertEqual(tasks.first?.activity, .review)
    }

    func testTestsBankDecodesEveryStep() throws {
        let json = #"{"ok":true,"data":{"terms":[{"term":1,"count":4},{"term":2,"count":0},{"term":3,"count":1}],"levels":[{"id":"l2","name":"الثانية ثانوي","code":"2AS","count":3},{"id":"x"}],"myLevelId":"l2","subjects":[{"id":"ar","name":"اللغة العربية","count":2}],"papers":[{"id":"p1","title":"الفرض الأول","typeLabel":"فرض","year":2025,"hasSolution":true,"hasFile":true}],"nextCursor":null,"interactive":[{"id":"s1","title":"الفرض الأول — تفاعلي","kind":"DEVOIR","year":2025}]}}"#
        let page = try XCTUnwrap(JSONDecoder().decode(IOSAPI.Envelope<TestsBank.Page>.self, from: Data(json.utf8)).data)
        XCTAssertEqual(page.terms.map(\.count), [4, 0, 1])
        XCTAssertEqual(page.levels.map(\.id), ["l2"], "an entry without a name is skipped")
        XCTAssertEqual(page.papers.first?.hasSolution, true)
        XCTAssertEqual(page.interactive.first?.kind, "DEVOIR")
        XCTAssertEqual(TestsBank.path(), "/api/v1/ios/tests")
        XCTAssertEqual(TestsBank.path(term: 1, level: "l2", subject: "ar"), "/api/v1/ios/tests?term=1&level=l2&subject=ar")

        let paper = try XCTUnwrap(JSONDecoder().decode(IOSAPI.Envelope<Bac.Paper>.self, from: Data(#"{"ok":true,"data":{"id":"p1","title":"الفرض الأول","official":false,"term":1,"paper":null,"solution":null,"play":{"id":"s1","title":"تفاعلي"}}}"#.utf8)).data)
        XCTAssertEqual(paper.play?.id, "s1")
        XCTAssertEqual(paper.term, 1)
        XCTAssertEqual(Bac.paperPath("p1", bank: .tests), "/api/v1/ios/papers/p1")
        XCTAssertEqual(Bac.paperPath("p1", bank: .bac), "/api/v1/ios/bac/p1")
    }
}
