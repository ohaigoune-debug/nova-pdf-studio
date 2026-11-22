import SwiftUI
import MadrasadzCore

// MARK: - Course doors (Build 18, 22 Nov 2026)
//
// «دوراتي» in the app shows what the website's course page shows (server/lib/course-doors.ts):
// the live door first (next session, countdown, «انضمّ» from a quarter of an hour before), then
// four tiles — recorded sessions, files, QCM exercises (with the Madrasa-bank exercises under
// lessons) and the forum. Nothing here sells anything: the course is already the student's.

private let liveGold = Color(red: 0.902, green: 0.812, blue: 0.584)
private let liveNavy = Color(red: 0.059, green: 0.145, blue: 0.267)
private let liveNavy2 = Color(red: 0.110, green: 0.227, blue: 0.388)

/// Counts like the website's tiles: «حصة واحدة، حصتان، 3 حصص، 11 حصة».
func doorCountText(_ count: Int, door: CourseDoor) -> String {
    guard count > 0 else { return L10n.text("doorNothingYet") }
    let language = Bundle.main.preferredLocalizations.first ?? "ar"
    if language == "fr" || language == "en" {
        let key: String
        switch door {
        case .recorded: key = "doorCountRecorded"
        case .files: key = "doorCountFiles"
        default: key = "doorCountPractice"
        }
        return String(format: L10n.text(key), count)
    }
    let forms: [String]
    switch door {
    case .recorded: forms = ["حصة واحدة", "حصتان", "حصص", "حصة"]
    case .files: forms = ["ملف واحد", "ملفان", "ملفات", "ملفًا"]
    default: forms = ["تمرين واحد", "تمرينان", "تمارين", "تمرينًا"]
    }
    if count == 1 { return forms[0] }
    if count == 2 { return forms[1] }
    return "\(count) " + (count <= 10 ? forms[2] : forms[3])
}

func courseSectionTitle(_ kind: NativeCourse.SectionKind) -> String {
    switch kind {
    case .lessons: return L10n.text("sectionLessons")
    case .videos: return L10n.text("sectionVideos")
    case .homework: return L10n.text("sectionHomework")
    case .tests: return L10n.text("sectionTests")
    case .files: return L10n.text("sectionFiles")
    }
}

func courseDoorTitle(_ door: CourseDoor) -> String {
    switch door {
    case .live: return L10n.text("doorLive")
    case .recorded: return L10n.text("doorRecorded")
    case .files: return L10n.text("doorFiles")
    case .practice: return L10n.text("doorPractice")
    case .forum: return L10n.text("doorForum")
    }
}

/// The course page once the terms are accepted: header, live door, then the four tiles.
struct CourseDoorsPage: View {
    @ObservedObject var model: AppModel
    let course: NativeCourse
    let savedAt: Date?

    private let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if savedAt != nil || !model.online { OfflineBanner(savedAt: savedAt) }
            header
            LiveDoorCard(model: model, course: course)
            LazyVGrid(columns: columns, spacing: 12) {
                ForEach([CourseDoor.recorded, .files, .practice], id: \.self) { door in
                    NavigationLink { CourseDoorView(model: model, course: course, door: door) } label: {
                        DoorTile(title: courseDoorTitle(door), hint: doorCountText(course.count(for: door), door: door),
                                 icon: icon(door), tint: tint(door))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("door-\(door.rawValue)")
                }
                if let groupId = course.course.groupId {
                    NavigationLink { ClassroomView(model: model, groupId: groupId) } label: {
                        DoorTile(title: L10n.text("doorForum"), hint: L10n.text("doorForumHint"),
                                 icon: "bubble.left.and.bubble.right.fill", tint: Color(red: 0.349, green: 0.145, blue: 0.863))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("courseClassroom")
                }
            }
            if let description = course.course.description, !description.isEmpty {
                Text(description).font(.callout).foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(course.course.title).font(.title3.bold()).accessibilityIdentifier("courseTitle")
            let line = [course.course.teacherName, course.course.season].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
            if !line.isEmpty { Text(line).font(.footnote).foregroundStyle(.secondary) }
            if let ends = course.course.accessEndsOn {
                Label(String(format: L10n.text("accessEnds"), ends), systemImage: "clock").font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    private func icon(_ door: CourseDoor) -> String {
        switch door {
        case .recorded: return "play.circle.fill"
        case .files: return "folder.fill"
        case .practice: return "checklist"
        case .live: return "dot.radiowaves.left.and.right"
        case .forum: return "bubble.left.and.bubble.right.fill"
        }
    }

    private func tint(_ door: CourseDoor) -> Color {
        switch door {
        case .recorded: return Color.orange
        case .files: return Brand.blue
        case .practice: return Brand.success
        default: return Brand.navy
        }
    }
}

struct DoorTile: View {
    let title: String
    let hint: String
    let icon: String
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: icon)
                .font(.title2.weight(.semibold))
                .foregroundStyle(tint)
                .frame(width: 52, height: 52)
                .background(tint.opacity(0.12), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.headline).foregroundStyle(.primary).lineLimit(2).multilineTextAlignment(.leading)
                Text(hint).font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 112, alignment: .topLeading)
        .padding(14)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .contentShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}

// MARK: - Live door

/// The navy card of the live door: the running or next session, a countdown, and «انضمّ» while
/// the join window is open (the server checks it again, records attendance and gives the link).
struct LiveDoorCard: View {
    @ObservedObject var model: AppModel
    let course: NativeCourse
    @State private var joining = false
    @State private var joinError: String?
    @Environment(\.openURL) private var openURL

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            card(now: context.date)
        }
    }

    @ViewBuilder
    private func card(now: Date) -> some View {
        let next = course.nextLive(at: now)
        let live = next?.isLive(at: now) ?? false
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Circle()
                    .fill(Color(red: 0.941, green: 0.267, blue: 0.220))
                    .frame(width: 10, height: 10)
                    .opacity(live && Int(now.timeIntervalSince1970) % 2 == 1 ? 0.35 : 1)
                Text(L10n.text("doorLive") + " · " + L10n.text(live ? "liveNow" : next == nil ? "liveNone" : "liveNext"))
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(liveGold)
            }
            if let next {
                Text(next.title).font(.title3.bold()).foregroundStyle(.white).accessibilityIdentifier("liveTitle")
                if let start = next.startDate {
                    Text(start.formatted(date: .complete, time: .shortened)).font(.footnote).foregroundStyle(.white.opacity(0.8))
                }
                switch next.joinState(at: now) {
                case .open:
                    joinButton(next)
                case .opensAt:
                    if let start = next.startDate { countdown(to: start, now: now) }
                    Text(L10n.text("liveJoinOpensHint")).font(.caption).foregroundStyle(.white.opacity(0.75))
                case .unavailable, .closed:
                    EmptyView()
                }
                if let joinError {
                    Text(joinError).font(.footnote.weight(.semibold)).foregroundStyle(liveGold).accessibilityIdentifier("liveJoinError")
                }
            } else {
                Text(L10n.text("liveNoneBody")).font(.subheadline).foregroundStyle(.white.opacity(0.85))
            }
            let later = course.upcoming.filter { $0.joinState(at: now) != .closed && $0.id != next?.id }.prefix(3)
            if !later.isEmpty {
                Divider().overlay(Color.white.opacity(0.2))
                Text(L10n.text("liveLater")).font(.caption.weight(.semibold)).foregroundStyle(liveGold)
                ForEach(Array(later.enumerated()), id: \.offset) { _, session in
                    HStack(alignment: .firstTextBaseline) {
                        Text(session.title).font(.subheadline).foregroundStyle(.white).lineLimit(1)
                        Spacer(minLength: 8)
                        if let start = session.startDate {
                            Text(start.formatted(date: .abbreviated, time: .shortened)).font(.caption).foregroundStyle(.white.opacity(0.75))
                        }
                    }
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(LinearGradient(colors: [liveNavy2, liveNavy], startPoint: .topLeading, endPoint: .bottomTrailing),
                    in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color(red: 0.761, green: 0.608, blue: 0.271)).frame(height: 3).padding(.horizontal, 18)
        }
    }

    private func joinButton(_ session: NativeCourse.Upcoming) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Button {
                Task { await join(session) }
            } label: {
                HStack(spacing: 8) {
                    if joining { ProgressView().tint(liveNavy) } else { Image(systemName: "video.fill") }
                    Text(L10n.text("liveJoin")).fontWeight(.bold)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .foregroundStyle(liveNavy)
                .background(liveGold, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(joining || !model.online)
            .accessibilityIdentifier("liveJoin")
            if session.provider == "ZOOM" {
                Text(L10n.text("liveZoomHint")).font(.caption).foregroundStyle(.white.opacity(0.75))
            }
        }
    }

    private func countdown(to start: Date, now: Date) -> some View {
        let seconds = max(0, Int(start.timeIntervalSince(now)))
        let days = seconds / 86_400, hours = (seconds % 86_400) / 3600, minutes = (seconds % 3600) / 60, secs = seconds % 60
        let parts: [(Int, String)] = days > 0
            ? [(days, L10n.text("liveDays")), (hours, L10n.text("liveHours")), (minutes, L10n.text("liveMinutes"))]
            : [(hours, L10n.text("liveHours")), (minutes, L10n.text("liveMinutes")), (secs, L10n.text("liveSeconds"))]
        return HStack(spacing: 8) {
            ForEach(Array(parts.enumerated()), id: \.offset) { _, part in
                VStack(spacing: 2) {
                    Text("\(part.0)").font(.title3.bold().monospacedDigit()).foregroundStyle(.white)
                    Text(part.1).font(.caption2).foregroundStyle(.white.opacity(0.75))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(Color.white.opacity(0.1), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        }
        .accessibilityIdentifier("liveCountdown")
    }

    private func join(_ session: NativeCourse.Upcoming) async {
        guard let id = session.id, !joining else { return }
        struct Reply: Decodable { let url: String; let appUrl: String? }
        joining = true
        defer { joining = false }
        do {
            let encodedID = id.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? id
            let reply = try await model.api.post(Reply.self, "/api/v1/ios/live/\(encodedID)/join", body: Empty())
            joinError = nil
            let web = URL(string: reply.url).flatMap { $0.scheme == "https" ? $0 : nil }
            // The Zoom app first (under the student's account name, with the passcode); without it, the link.
            if let raw = reply.appUrl, let app = URL(string: raw) {
                openURL(app) { accepted in
                    if !accepted, let web { openURL(web) }
                }
            } else if let web {
                openURL(web)
            }
        } catch let failure as APIFailure {
            model.handle(failure)
            joinError = failure.message
        } catch {
            joinError = L10n.text("error")
        }
    }
}

// MARK: - One door's list

struct CourseDoorView: View {
    @ObservedObject var model: AppModel
    let course: NativeCourse
    let door: CourseDoor

    var body: some View {
        List {
            if door == .recorded {
                Text(L10n.text("recordedHint")).font(.footnote).foregroundStyle(.secondary)
            }
            if door == .practice, !course.practiceLessons.isEmpty {
                Section(L10n.text("practiceUnderLessons")) {
                    ForEach(course.practiceLessons) { item in
                        NavigationLink { LessonView(model: model, slug: item.slug) } label: {
                            HStack {
                                ItemRow(item: item)
                                Spacer(minLength: 6)
                                Text(doorCountText(item.practiceCount, door: .practice)).font(.caption.bold()).foregroundStyle(Brand.success)
                            }
                        }
                        .accessibilityIdentifier("practiceLesson-\(item.slug)")
                    }
                }
            }
            ForEach(course.sections(for: door)) { section in
                Section(courseSectionTitle(section.kind)) {
                    ForEach(section.items) { item in
                        NavigationLink { LessonView(model: model, slug: item.slug) } label: { ItemRow(item: item) }
                            .accessibilityIdentifier("item-\(item.slug)")
                    }
                }
            }
            if course.count(for: door) == 0 {
                Text(L10n.text(emptyKey)).foregroundStyle(.secondary).accessibilityIdentifier("doorEmpty")
            }
        }
        .navigationTitle(courseDoorTitle(door))
        .navigationBarTitleDisplayMode(.inline)
    }

    private var emptyKey: String {
        switch door {
        case .recorded: return "doorEmptyRecorded"
        case .files: return "doorEmptyFiles"
        default: return "doorEmptyPractice"
        }
    }
}

// MARK: - «تدرّب على هذا الدرس»

/// Madrasa-bank exercises under a course lesson: the native card game or the native set, opened
/// with the course link (the subscription, not the PLAY trial).
struct LessonPracticeCard: View {
    @ObservedObject var model: AppModel
    let items: [NativeLesson.Practice]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label(L10n.text("lessonPracticeTitle"), systemImage: "target").font(.headline).foregroundStyle(Brand.navy)
            ForEach(items) { item in
                NavigationLink {
                    switch item.kind {
                    case .lesson:
                        CardLauncher(model: model, play: model.play, lessonID: item.refId, title: item.title, practiceLinkID: item.linkId)
                    case .examSet:
                        ExamLauncher(model: model, play: model.play, setID: item.refId, title: item.title, practiceLinkID: item.linkId)
                    }
                } label: {
                    PracticeItemRow(item: item)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("practice-\(item.linkId)")
            }
        }
        .card()
        .accessibilityIdentifier("lessonPractice")
    }
}

struct PracticeItemRow: View {
    let item: NativeLesson.Practice

    private var tint: Color { item.kind == .lesson ? Brand.blue : Color.orange }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: item.kind == .lesson ? "gamecontroller.fill" : "square.and.pencil")
                .font(.title3)
                .foregroundStyle(tint)
                .frame(width: 44, height: 44)
                .background(tint.opacity(0.12), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            VStack(alignment: .leading, spacing: 4) {
                Text(item.title).font(.subheadline.bold()).foregroundStyle(.primary).multilineTextAlignment(.leading).lineLimit(3)
                if let pct = item.bestPct {
                    ProgressView(value: Double(pct), total: 100).tint(Brand.success)
                    Text(item.bestLabel ?? "\(pct)%").font(.caption).foregroundStyle(.secondary)
                } else {
                    Text(L10n.text(item.kind == .lesson ? "lessonPracticeNotPlayed" : "lessonPracticeNotTried")).font(.caption).foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 4)
            Text(L10n.text(item.kind == .lesson ? "lessonPracticePlay" : "lessonPracticeStart"))
                .font(.subheadline.bold())
                .foregroundStyle(.white)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(Brand.blue, in: Capsule())
        }
        .padding(12)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Color.secondary.opacity(0.2)))
        .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}
