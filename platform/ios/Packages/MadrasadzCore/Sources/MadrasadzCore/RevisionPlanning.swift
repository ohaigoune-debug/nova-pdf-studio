import Foundation

/// School subjects a revision session can be tagged with (Algerian secondary
/// curriculum). Stored as a short raw identifier; an identifier written by a
/// newer build that this build does not know is shown as `.other`, never lost.
public enum RevisionSubject: String, CaseIterable, Codable, Sendable {
    case arabic
    case math
    case physics
    case science
    case philosophy
    case historyGeography = "history-geography"
    case islamic
    case french
    case english
    case otherLanguage = "other-language"
    case tamazight
    case economics
    case engineering
    case other

    public static func from(_ identifier: String?) -> RevisionSubject? {
        guard let identifier else { return nil }
        return RevisionSubject(rawValue: identifier) ?? .other
    }
}

/// What the student does during a session.
public enum RevisionActivity: String, CaseIterable, Codable, Sendable {
    case review
    case exercises
    case memorize
    case mockExam = "mock-exam"
    case correction

    public static func from(_ identifier: String?) -> RevisionActivity? {
        guard let identifier else { return nil }
        return RevisionActivity(rawValue: identifier) ?? .review
    }
}

/// One session of a ready-made plan. Titles are localisation keys; the app
/// layer supplies the text, so this module stays free of UI strings.
public struct RevisionPlanSession: Equatable, Sendable {
    public let dayOffset: Int
    public let activity: RevisionActivity
    public let minutes: Int
    public let titleKey: String

    public init(dayOffset: Int, activity: RevisionActivity, minutes: Int, titleKey: String) {
        self.dayOffset = dayOffset
        self.activity = activity
        self.minutes = minutes
        self.titleKey = titleKey
    }
}

/// A suggested plan. Applying it only creates ordinary local revision tasks for
/// the verified account; it unlocks no content and contacts no server.
public struct RevisionPlanTemplate: Equatable, Identifiable, Sendable {
    public let id: String
    /// nil: the student chooses the subject. Otherwise the plan is for that subject.
    public let fixedSubject: RevisionSubject?
    /// The student may name the lesson the plan is about (spaced repetition).
    public let asksForLesson: Bool
    public let sessions: [RevisionPlanSession]

    public var totalMinutes: Int { sessions.reduce(0) { $0 + $1.minutes } }
    public var dayCount: Int { (sessions.map(\.dayOffset).max() ?? 0) + 1 }

    public static let arabicWeek = RevisionPlanTemplate(
        id: "arabic-week", fixedSubject: .arabic, asksForLesson: false,
        sessions: [
            .init(dayOffset: 0, activity: .review, minutes: 45, titleKey: "planArabicTexts"),
            .init(dayOffset: 1, activity: .exercises, minutes: 40, titleKey: "planArabicGrammar"),
            .init(dayOffset: 2, activity: .exercises, minutes: 40, titleKey: "planArabicRhetoric"),
            .init(dayOffset: 3, activity: .memorize, minutes: 40, titleKey: "planArabicIdeas"),
            .init(dayOffset: 4, activity: .exercises, minutes: 45, titleKey: "planArabicWriting"),
            .init(dayOffset: 5, activity: .mockExam, minutes: 120, titleKey: "planArabicMock"),
            .init(dayOffset: 6, activity: .correction, minutes: 30, titleKey: "planArabicCorrection")
        ])

    public static let testInThreeDays = RevisionPlanTemplate(
        id: "test-3-days", fixedSubject: nil, asksForLesson: false,
        sessions: [
            .init(dayOffset: 0, activity: .review, minutes: 60, titleKey: "planTestReview"),
            .init(dayOffset: 1, activity: .exercises, minutes: 60, titleKey: "planTestExercises"),
            .init(dayOffset: 2, activity: .mockExam, minutes: 60, titleKey: "planTestMock"),
            .init(dayOffset: 2, activity: .correction, minutes: 30, titleKey: "planTestCorrection")
        ])

    /// Reviews after 1, 3, 7 and 14 days: spaced retrieval practice.
    public static let spacedLesson = RevisionPlanTemplate(
        id: "spaced-lesson", fixedSubject: nil, asksForLesson: true,
        sessions: [
            .init(dayOffset: 0, activity: .review, minutes: 45, titleKey: "planSpacedLearn"),
            .init(dayOffset: 1, activity: .memorize, minutes: 20, titleKey: "planSpacedRecall"),
            .init(dayOffset: 3, activity: .exercises, minutes: 30, titleKey: "planSpacedExercises"),
            .init(dayOffset: 7, activity: .memorize, minutes: 20, titleKey: "planSpacedQuick"),
            .init(dayOffset: 14, activity: .mockExam, minutes: 30, titleKey: "planSpacedSelfTest")
        ])

    public static let dailyFocus = RevisionPlanTemplate(
        id: "daily-focus", fixedSubject: nil, asksForLesson: false,
        sessions: (0..<5).map { RevisionPlanSession(dayOffset: $0, activity: .review, minutes: 25, titleKey: "planDailyFocus") })

    public static let finalWeek = RevisionPlanTemplate(
        id: "final-week", fixedSubject: nil, asksForLesson: false,
        sessions: [
            .init(dayOffset: 0, activity: .review, minutes: 45, titleKey: "planFinalMap"),
            .init(dayOffset: 1, activity: .review, minutes: 60, titleKey: "planFinalSummaries"),
            .init(dayOffset: 2, activity: .exercises, minutes: 60, titleKey: "planFinalExercises"),
            .init(dayOffset: 3, activity: .mockExam, minutes: 120, titleKey: "planFinalMock"),
            .init(dayOffset: 4, activity: .correction, minutes: 45, titleKey: "planFinalCorrection"),
            .init(dayOffset: 5, activity: .memorize, minutes: 30, titleKey: "planFinalLight")
        ])

    public static let all: [RevisionPlanTemplate] = [arabicWeek, testInThreeDays, spacedLesson, dailyFocus, finalWeek]

    public static func with(id: String?) -> RevisionPlanTemplate? {
        all.first { $0.id == id }
    }
}

public enum RevisionPlanBuilder {
    public static let maximumLessonNameLength = 80

    /// Builds the plan's tasks: session N on `start` + dayOffset days, at the
    /// clock time of `start`. Calendar arithmetic keeps the wall-clock time
    /// across daylight-saving changes.
    public static func tasks(for template: RevisionPlanTemplate,
                             start: Date,
                             subject: RevisionSubject?,
                             lesson: String?,
                             reminders: Bool,
                             calendar: Calendar = .current,
                             title: (_ key: String) -> String,
                             subjectName: (RevisionSubject) -> String) -> [RevisionTask] {
        let chosen = template.fixedSubject ?? subject
        let lessonName = lesson.map { String($0.trimmingCharacters(in: .whitespacesAndNewlines).prefix(maximumLessonNameLength)) }
            .flatMap { $0.isEmpty ? nil : $0 }
        return template.sessions.compactMap { session in
            guard let date = calendar.date(byAdding: .day, value: session.dayOffset, to: start) else { return nil }
            var text = title(session.titleKey)
            if template.asksForLesson, let lessonName {
                text = lessonName + " — " + text
            } else if template.fixedSubject == nil, let chosen {
                text = text + " — " + subjectName(chosen)
            }
            return RevisionTask(title: String(text.prefix(200)), date: date, reminderEnabled: reminders,
                                subjectID: chosen?.rawValue, activityID: session.activity.rawValue,
                                durationMinutes: session.minutes, planID: template.id)
        }
    }
}

/// Groups for the planner list. Pure so the boundaries are unit-tested.
public enum RevisionAgenda {
    public enum Bucket: Equatable, Hashable, Sendable {
        case overdue
        case today
        case tomorrow
        case day(Date) // start of a later day within the next 7 days
        case later
        case done
    }

    public static func bucket(for task: RevisionTask, now: Date, calendar: Calendar = .current) -> Bucket {
        if task.completed { return .done }
        let today = calendar.startOfDay(for: now)
        let day = calendar.startOfDay(for: task.date)
        if day < today { return .overdue }
        let days = calendar.dateComponents([.day], from: today, to: day).day ?? 0
        switch days {
        case 0: return .today
        case 1: return .tomorrow
        case 2..<7: return .day(day)
        default: return .later
        }
    }

    public struct Group: Equatable, Identifiable, Sendable {
        public let bucket: Bucket
        public let tasks: [RevisionTask]
        public var id: Bucket { bucket }
    }

    public static func grouped(_ tasks: [RevisionTask], now: Date, calendar: Calendar = .current) -> [Group] {
        var order: [Bucket] = []
        var groups: [Bucket: [RevisionTask]] = [:]
        for task in tasks.sorted(by: { $0.date < $1.date }) {
            let key = bucket(for: task, now: now, calendar: calendar)
            if groups[key] == nil { order.append(key) }
            groups[key, default: []].append(task)
        }
        func rank(_ bucket: Bucket) -> Int {
            switch bucket {
            case .overdue: return 0
            case .today: return 1
            case .tomorrow: return 2
            case .day: return 3
            case .later: return 4
            case .done: return 5
            }
        }
        // Stable: days keep chronological order within rank 3.
        let sortedKeys = order.enumerated().sorted { lhs, rhs in
            rank(lhs.element) == rank(rhs.element) ? lhs.offset < rhs.offset : rank(lhs.element) < rank(rhs.element)
        }.map(\.element)
        return sortedKeys.map { key in
            let items = groups[key] ?? []
            // Most recently done first; everything else chronological.
            return Group(bucket: key, tasks: key == .done ? items.sorted { $0.date > $1.date } : items)
        }
    }

    /// Progress over the calendar week containing `now`.
    public static func weekProgress(_ tasks: [RevisionTask], now: Date, calendar: Calendar = .current) -> (done: Int, total: Int, minutes: Int) {
        guard let week = calendar.dateInterval(of: .weekOfYear, for: now) else { return (0, 0, 0) }
        let inWeek = tasks.filter { week.contains($0.date) }
        return (inWeek.filter(\.completed).count, inWeek.count, inWeek.reduce(0) { $0 + ($1.durationMinutes ?? 0) })
    }

    public static func next(_ tasks: [RevisionTask], now: Date) -> RevisionTask? {
        tasks.filter { !$0.completed && $0.date >= now }.min { $0.date < $1.date }
    }
}
