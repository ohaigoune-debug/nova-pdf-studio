import Foundation

/// The student's stream for the suggested timetable. Weights follow the BAC coefficients
/// of each stream (to be reviewed by the owner), so heavier subjects get more sessions.
public enum StudyStream: String, CaseIterable, Identifiable, Codable, Sendable {
    case literature, languages, sciences, mathematics, technical, management, middle

    public var id: String { rawValue }

    public var weights: [(subject: RevisionSubject, weight: Int)] {
        switch self {
        case .literature:
            return [(.arabic, 6), (.philosophy, 6), (.historyGeography, 4), (.french, 3), (.english, 3), (.math, 2), (.islamic, 2)]
        case .languages:
            return [(.arabic, 5), (.french, 5), (.english, 5), (.otherLanguage, 4), (.historyGeography, 3), (.philosophy, 2), (.math, 2), (.islamic, 2)]
        case .sciences:
            return [(.science, 6), (.physics, 5), (.math, 5), (.arabic, 3), (.philosophy, 2), (.historyGeography, 2), (.french, 2), (.english, 2), (.islamic, 2)]
        case .mathematics:
            return [(.math, 7), (.physics, 6), (.arabic, 3), (.science, 2), (.philosophy, 2), (.historyGeography, 2), (.french, 2), (.english, 2), (.islamic, 2)]
        case .technical:
            return [(.engineering, 7), (.math, 6), (.physics, 6), (.arabic, 2), (.philosophy, 2), (.historyGeography, 2), (.french, 2), (.english, 2), (.islamic, 2)]
        case .management:
            return [(.economics, 11), (.math, 5), (.historyGeography, 4), (.arabic, 3), (.other, 2), (.philosophy, 2), (.french, 2), (.english, 2), (.islamic, 2)]
        case .middle:
            return [(.arabic, 5), (.math, 4), (.french, 3), (.english, 2), (.science, 2), (.physics, 2), (.historyGeography, 2), (.islamic, 2)]
        }
    }
}

/// When the student can study, outside school hours. School days are Sunday to Thursday;
/// Friday and Saturday get longer sessions.
public struct TimetableOptions: Equatable, Sendable {
    /// A short recall session before school.
    public var morning = true
    public var morningHour = 6
    public var morningMinute = 15
    /// 1–4 evening sessions of 45 minutes, one per hour from `eveningHour`.
    public var eveningSessions = 3
    public var eveningHour = 18
    /// 0–4 weekend sessions of 60 minutes (09:00, 10:30, 15:00, 16:30).
    public var weekendSessions = 4

    public init() {}

    public static let morningMinutes = 30
    public static let eveningMinutes = 45
    public static let weekendMinutes = 60
    static let weekendStarts: [(hour: Int, minute: Int)] = [(9, 0), (10, 30), (15, 0), (16, 30)]
}

public enum WeeklyTimetable {
    public struct Slot: Equatable, Sendable {
        public let date: Date
        public let minutes: Int
        public let activity: RevisionActivity
    }

    public static func isWeekend(_ date: Date, calendar: Calendar) -> Bool {
        let weekday = calendar.component(.weekday, from: date) // 1 = Sunday … 7 = Saturday
        return weekday == 6 || weekday == 7
    }

    /// The study times of the next `days` days, starting with the day of `now`; only
    /// times at least five minutes away are kept.
    public static func slots(now: Date, days: Int = 7, options: TimetableOptions, calendar: Calendar = .current) -> [Slot] {
        let first = calendar.startOfDay(for: now)
        var result: [Slot] = []
        for offset in 0..<max(0, days) {
            guard let day = calendar.date(byAdding: .day, value: offset, to: first) else { continue }
            func at(_ hour: Int, _ minute: Int) -> Date? { calendar.date(bySettingHour: hour, minute: minute, second: 0, of: day) }
            var today: [Slot] = []
            if isWeekend(day, calendar: calendar) {
                for (index, start) in TimetableOptions.weekendStarts.prefix(min(4, max(0, options.weekendSessions))).enumerated() {
                    guard let date = at(start.hour, start.minute) else { continue }
                    let activity: RevisionActivity = index == 3 ? .correction : index % 2 == 0 ? .exercises : .review
                    today.append(Slot(date: date, minutes: TimetableOptions.weekendMinutes, activity: activity))
                }
            } else {
                if options.morning, let date = at(options.morningHour, options.morningMinute) {
                    today.append(Slot(date: date, minutes: TimetableOptions.morningMinutes, activity: .memorize))
                }
                for index in 0..<min(4, max(0, options.eveningSessions)) {
                    guard let date = at(options.eveningHour + index, 0) else { continue }
                    today.append(Slot(date: date, minutes: TimetableOptions.eveningMinutes, activity: index % 2 == 0 ? .review : .exercises))
                }
            }
            result += today.filter { $0.date > now.addingTimeInterval(300) }
        }
        return result
    }

    /// How many of `count` sessions each subject gets: proportional to its weight, the
    /// remainders going to the heaviest subjects first.
    public static func quotas(for stream: StudyStream, count: Int) -> [RevisionSubject: Int] {
        let weights = stream.weights
        let total = weights.reduce(0) { $0 + $1.weight }
        guard count > 0, total > 0 else { return [:] }
        var quota: [RevisionSubject: Int] = [:]
        var remainders: [(subject: RevisionSubject, rest: Double, weight: Int)] = []
        for entry in weights {
            let exact = Double(count) * Double(entry.weight) / Double(total)
            quota[entry.subject] = Int(exact.rounded(.down))
            remainders.append((entry.subject, exact - exact.rounded(.down), entry.weight))
        }
        var left = count - quota.values.reduce(0, +)
        for entry in remainders.sorted(by: { $0.rest != $1.rest ? $0.rest > $1.rest : $0.weight > $1.weight }) where left > 0 {
            quota[entry.subject, default: 0] += 1
            left -= 1
        }
        return quota
    }

    /// The week as ordinary local revision tasks: each time gets the subject with the most
    /// sessions still to place, never the same subject twice in a row when another is left.
    public static func build(stream: StudyStream,
                             now: Date,
                             days: Int = 7,
                             options: TimetableOptions,
                             reminders: Bool,
                             calendar: Calendar = .current,
                             title: (RevisionSubject, RevisionActivity) -> String) -> [RevisionTask] {
        let times = slots(now: now, days: days, options: options, calendar: calendar)
        var left = quotas(for: stream, count: times.count)
        let order = stream.weights.map(\.subject)
        var previous: RevisionSubject?
        var tasks: [RevisionTask] = []
        for slot in times {
            let candidates = order.filter { (left[$0] ?? 0) > 0 }
            guard !candidates.isEmpty else { break }
            let preferred = candidates.filter { $0 != previous }
            let pool = preferred.isEmpty ? candidates : preferred
            // Most sessions left first; on a tie, the order of the stream (heavier first).
            guard let subject = pool.max(by: { (left[$0] ?? 0) < (left[$1] ?? 0) || ((left[$0] ?? 0) == (left[$1] ?? 0) && (order.firstIndex(of: $0) ?? 0) > (order.firstIndex(of: $1) ?? 0)) }) else { break }
            left[subject, default: 0] -= 1
            previous = subject
            tasks.append(RevisionTask(title: String(title(subject, slot.activity).prefix(200)), date: slot.date, reminderEnabled: reminders,
                                      subjectID: subject.rawValue, activityID: slot.activity.rawValue,
                                      durationMinutes: slot.minutes, planID: "weekly-" + stream.rawValue))
        }
        return tasks
    }
}
