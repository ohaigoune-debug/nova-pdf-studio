import Foundation
import XCTest
@testable import MadrasadzCore

final class RevisionPlanningTests: XCTestCase {
    private let account = "31e95cad-e92a-41c2-bfe8-fda706883d24"
    private var directories: [URL] = []

    override func tearDown() {
        for url in directories { try? FileManager.default.removeItem(at: url) }
        super.tearDown()
    }

    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Africa/Algiers")!
        calendar.firstWeekday = 7 // Saturday
        return calendar
    }

    private func date(_ day: Int, _ hour: Int, _ minute: Int = 0, month: Int = 10) -> Date {
        calendar.date(from: DateComponents(year: 2026, month: month, day: day, hour: hour, minute: minute))!
    }

    private func build(_ template: RevisionPlanTemplate, subject: RevisionSubject? = nil, lesson: String? = nil,
                       reminders: Bool = false, start: Date? = nil) -> [RevisionTask] {
        RevisionPlanBuilder.tasks(for: template, start: start ?? date(28, 17), subject: subject, lesson: lesson,
                                  reminders: reminders, calendar: calendar,
                                  title: { "<\($0)>" }, subjectName: { "[\($0.rawValue)]" })
    }

    func testTaskWrittenByEarlierBuildDecodesWithoutDetails() throws {
        let json = #"{"id":"6258C6A8-367F-4E0B-A5A7-EA4051B92201","title":"مراجعة","date":0,"completed":false,"reminderEnabled":true}"#
        let task = try JSONDecoder().decode(RevisionTask.self, from: Data(json.utf8))
        XCTAssertEqual(task.title, "مراجعة")
        XCTAssertNil(task.subjectID)
        XCTAssertNil(task.subject)
        XCTAssertNil(task.durationMinutes)
        XCTAssertNil(task.plan)
        let encoded = String(data: try JSONEncoder().encode(task), encoding: .utf8)!
        XCTAssertFalse(encoded.contains("subjectID"), "nil details are not written")
    }

    func testUnknownIdentifiersFromANewerBuildStayVisible() {
        XCTAssertEqual(RevisionSubject.from("astronomy"), .other)
        XCTAssertEqual(RevisionActivity.from("flashcards"), .review)
        XCTAssertNil(RevisionSubject.from(nil))
        XCTAssertEqual(RevisionSubject.from("history-geography"), .historyGeography)
    }

    func testArabicWeekKeepsClockTimeAndSubject() {
        let tasks = build(.arabicWeek, subject: .math)
        XCTAssertEqual(tasks.count, 7)
        XCTAssertEqual(tasks.map(\.date), [date(28, 17), date(29, 17), date(30, 17), date(31, 17),
                                           date(1, 17, month: 11), date(2, 17, month: 11), date(3, 17, month: 11)])
        XCTAssertTrue(tasks.allSatisfy { $0.subjectID == "arabic" && $0.planID == "arabic-week" && !$0.completed })
        XCTAssertEqual(tasks.first?.title, "<planArabicTexts>", "a fixed-subject plan does not repeat the subject")
        XCTAssertEqual(tasks.map(\.durationMinutes), [45, 40, 40, 40, 45, 120, 30])
        XCTAssertEqual(Set(tasks.map(\.id)).count, 7)
    }

    func testChosenSubjectAndLessonNameAreUsedInTitles() {
        let test = build(.testInThreeDays, subject: .physics)
        XCTAssertEqual(test.first?.title, "<planTestReview> — [physics]")
        XCTAssertTrue(test.allSatisfy { $0.subjectID == "physics" })
        XCTAssertEqual(test.last?.date, date(30, 17))

        let longName = "  " + String(repeating: "ب", count: 300) + "  "
        let spaced = build(.spacedLesson, subject: .arabic, lesson: longName)
        XCTAssertEqual(spaced.map(\.date), [date(28, 17), date(29, 17), date(31, 17), date(4, 17, month: 11), date(11, 17, month: 11)])
        XCTAssertTrue(spaced[0].title.hasPrefix(String(repeating: "ب", count: 80) + " — "))
        XCTAssertTrue(spaced.allSatisfy { $0.title.count <= 200 })
        XCTAssertEqual(build(.spacedLesson, subject: .arabic, lesson: "   ").first?.title, "<planSpacedLearn> — [arabic]",
                       "without a lesson name the subject names the plan")
    }

    func testRemindersFlagIsCarriedToEverySession() {
        XCTAssertTrue(build(.dailyFocus, subject: .english, reminders: true).allSatisfy(\.reminderEnabled))
        XCTAssertEqual(RevisionPlanTemplate.dailyFocus.totalMinutes, 125)
        XCTAssertEqual(RevisionPlanTemplate.spacedLesson.dayCount, 15)
    }

    func testAgendaBuckets() {
        let now = date(28, 10)
        func bucket(_ when: Date, done: Bool = false) -> RevisionAgenda.Bucket {
            RevisionAgenda.bucket(for: RevisionTask(title: "x", date: when, completed: done), now: now, calendar: calendar)
        }
        XCTAssertEqual(bucket(date(27, 23)), .overdue)
        XCTAssertEqual(bucket(date(28, 0, 1)), .today, "earlier today is still today")
        XCTAssertEqual(bucket(date(28, 23)), .today)
        XCTAssertEqual(bucket(date(29, 8)), .tomorrow)
        XCTAssertEqual(bucket(date(30, 8)), .day(date(30, 0)))
        XCTAssertEqual(bucket(date(3, 8, month: 11)), .day(date(3, 0, month: 11)))
        XCTAssertEqual(bucket(date(4, 8, month: 11)), .later)
        XCTAssertEqual(bucket(date(20, 8), done: true), .done)
    }

    func testAgendaOrderAndProgress() {
        let now = date(28, 10)
        let tasks = [
            RevisionTask(title: "later", date: date(10, 9, month: 11)),
            RevisionTask(title: "done", date: date(27, 9), completed: true, durationMinutes: 30),
            RevisionTask(title: "today", date: date(28, 18), durationMinutes: 45),
            RevisionTask(title: "late", date: date(26, 9)),
            RevisionTask(title: "fri", date: date(30, 9), durationMinutes: 20)
        ]
        let groups = RevisionAgenda.grouped(tasks, now: now, calendar: calendar)
        XCTAssertEqual(groups.map(\.bucket), [.overdue, .today, .day(date(30, 0)), .later, .done])
        XCTAssertEqual(groups.last?.tasks.map(\.title), ["done"])
        XCTAssertEqual(RevisionAgenda.next(tasks, now: now)?.title, "today")
        // Week of Sat 24 Oct – Fri 30 Oct (Saturday first weekday).
        let progress = RevisionAgenda.weekProgress(tasks, now: now, calendar: calendar)
        XCTAssertEqual(progress.done, 1)
        XCTAssertEqual(progress.total, 4)
        XCTAssertEqual(progress.minutes, 95)
    }

    func testPlanIsSavedAtomicallyAndReloadsWithDetails() async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("madrasadz-plan-" + UUID().uuidString)
        directories.append(directory)
        let store = StudyStore(directoryURL: directory)
        let session = try await store.activate(accountID: account)
        let plan = build(.finalWeek, subject: .philosophy)
        let saved = try await store.addTasks(plan, session: session)
        XCTAssertEqual(saved.count, 6)

        var invalid = build(.dailyFocus, subject: .math)
        invalid[2].durationMinutes = 2
        do { _ = try await store.addTasks(invalid, session: session); XCTFail("expected invalidDetails") }
        catch { XCTAssertEqual(error as? StudyStoreError, .invalidDetails) }
        var freeText = build(.dailyFocus, subject: .math)
        freeText[0].subjectID = "Math <script>"
        do { _ = try await store.addTasks(freeText, session: session); XCTFail("expected invalidDetails") }
        catch { XCTAssertEqual(error as? StudyStoreError, .invalidDetails) }
        do { _ = try await store.addTasks(saved, session: session); XCTFail("duplicate ids must be rejected") }
        catch { XCTAssertEqual(error as? StudyStoreError, .invalidDetails) }
        let afterRejects = try await store.snapshot(using: session)
        XCTAssertEqual(afterRejects.tasks.count, 6, "a rejected plan writes nothing")

        let reloaded = StudyStore(directoryURL: directory)
        let again = try await reloaded.activate(accountID: account)
        let tasks = try await reloaded.snapshot(using: again).tasks
        XCTAssertEqual(tasks.map(\.subject), Array(repeating: Optional(RevisionSubject.philosophy), count: 6))
        XCTAssertEqual(tasks.first?.plan?.id, "final-week")
        XCTAssertEqual(tasks.map(\.activityID).compactMap { $0 }.count, 6)
    }

    func testPlanRespectsTaskLimit() async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("madrasadz-plan-" + UUID().uuidString)
        directories.append(directory)
        let store = StudyStore(directoryURL: directory)
        let session = try await store.activate(accountID: account)
        for index in 0..<(StudyStore.maximumTasks - 3) {
            _ = try await store.upsertTask(RevisionTask(title: "t\(index)", date: date(1, 9, month: 12)), session: session)
        }
        do { _ = try await store.addTasks(build(.dailyFocus, subject: .math), session: session); XCTFail("expected limit") }
        catch { XCTAssertEqual(error as? StudyStoreError, .limitReached) }
        let count = try await store.snapshot(using: session).tasks.count
        XCTAssertEqual(count, StudyStore.maximumTasks - 3)
    }
}
