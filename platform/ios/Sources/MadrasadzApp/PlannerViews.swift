import SwiftUI
import MadrasadzCore

// MARK: - Presentation of subjects, activities and plans

extension RevisionSubject {
    var name: String { L10n.text("subj." + rawValue) }

    var symbol: String {
        switch self {
        case .arabic: return "character.book.closed.ar"
        case .math: return "function"
        case .physics: return "atom"
        case .science: return "leaf.fill"
        case .philosophy: return "brain.head.profile"
        case .historyGeography: return "globe.europe.africa.fill"
        case .islamic: return "moon.stars.fill"
        case .french: return "text.bubble.fill"
        case .english: return "globe"
        case .otherLanguage: return "character.bubble.fill"
        case .tamazight: return "character.bubble"
        case .economics: return "chart.line.uptrend.xyaxis"
        case .engineering: return "gearshape.2.fill"
        case .other: return "square.grid.2x2.fill"
        }
    }

    var tint: Color {
        switch self {
        case .arabic: return .blue
        case .math: return .orange
        case .physics: return .purple
        case .science: return .green
        case .philosophy: return .teal
        case .historyGeography: return .brown
        case .islamic: return .mint
        case .french: return .indigo
        case .english: return .cyan
        case .otherLanguage: return .pink
        case .tamazight: return .red
        case .economics: return .yellow
        case .engineering: return .gray
        case .other: return .secondary
        }
    }
}

extension RevisionActivity {
    var name: String { L10n.text("act." + rawValue) }

    var symbol: String {
        switch self {
        case .review: return "book.fill"
        case .exercises: return "pencil.and.list.clipboard"
        case .memorize: return "brain"
        case .mockExam: return "timer"
        case .correction: return "checkmark.seal.fill"
        }
    }
}

extension RevisionPlanTemplate {
    var name: String { L10n.text("tpl.\(id).name") }
    var summary: String { L10n.text("tpl.\(id).summary") }

    var symbol: String {
        switch id {
        case RevisionPlanTemplate.arabicWeek.id: return "character.book.closed.ar"
        case RevisionPlanTemplate.testInThreeDays.id: return "flag.checkered"
        case RevisionPlanTemplate.spacedLesson.id: return "arrow.triangle.2.circlepath"
        case RevisionPlanTemplate.dailyFocus.id: return "flame.fill"
        default: return "graduationcap.fill"
        }
    }

    var tint: Color {
        switch id {
        case RevisionPlanTemplate.arabicWeek.id: return .blue
        case RevisionPlanTemplate.testInThreeDays.id: return .orange
        case RevisionPlanTemplate.spacedLesson.id: return .green
        case RevisionPlanTemplate.dailyFocus.id: return .pink
        default: return .purple
        }
    }

    var meta: String { String(format: L10n.text("planMeta"), sessions.count, dayCount) }
}

private func minutesText(_ minutes: Int) -> String { String(format: L10n.text("minutesShort"), minutes) }

/// Rounded tinted square with a subject (or activity) symbol.
struct SubjectBadge: View {
    let subject: RevisionSubject?
    let activity: RevisionActivity?
    var size: CGFloat = 44

    var body: some View {
        let tint = subject?.tint ?? .accentColor
        Image(systemName: subject?.symbol ?? activity?.symbol ?? "calendar")
            .font(.system(size: size * 0.42, weight: .semibold))
            .foregroundStyle(tint)
            .frame(width: size, height: size)
            .background(RoundedRectangle(cornerRadius: size * 0.28, style: .continuous).fill(tint.opacity(0.16)))
            .accessibilityHidden(true)
    }
}

// MARK: - Planner tab

struct PlannerView: View {
    @ObservedObject var model: AppModel
    @State private var adding = false
    @State private var editing: RevisionTask?
    @State private var template: RevisionPlanTemplate?
    @State private var showingDone = false

    var body: some View {
        Group {
            if !model.personalSpaceReady { IdentityGate(model: model) }
            else { planner }
        }
        .privacySensitive() // Personal plan only; the web host is not redacted.
        .navigationTitle(L10n.text("planner"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if model.personalSpaceReady {
                Menu {
                    Button { adding = true } label: { Label(L10n.text("newSession"), systemImage: "plus.circle") }
                    Section(L10n.text("suggestedPlans")) {
                        ForEach(RevisionPlanTemplate.all) { plan in
                            Button { template = plan } label: { Label(plan.name, systemImage: plan.symbol) }
                        }
                    }
                } label: { Image(systemName: "plus") }
                .accessibilityLabel(L10n.text("add"))
                .accessibilityIdentifier("plannerAdd")
            }
        }
        .sheet(isPresented: $adding) { NewRevisionView(model: model) }
        .sheet(item: $editing) { task in NewRevisionView(model: model, task: task) }
        .sheet(item: $template) { plan in PlanTemplateView(model: model, template: plan) }
        .onChange(of: model.verifiedAccountID) { _, _ in adding = false; editing = nil; template = nil }
    }

    private var planner: some View {
        let tasks = model.snapshot.tasks
        return TimelineView(.periodic(from: .now, by: 60)) { context in
            List {
                if tasks.isEmpty {
                    Section { emptyHero }
                } else {
                    Section { PlannerSummaryCard(tasks: tasks, now: context.date) }
                    ForEach(RevisionAgenda.grouped(tasks, now: context.date)) { group in
                        let bucket = group.bucket
                        let items = group.tasks
                        if bucket == .done {
                            Section {
                                if showingDone { rows(items, bucket: bucket) }
                            } header: {
                                Button {
                                    withAnimation { showingDone.toggle() }
                                } label: {
                                    HStack {
                                        Text(header(for: bucket)) + Text(" (\(items.count))")
                                        Spacer()
                                        Image(systemName: showingDone ? "chevron.up" : "chevron.down")
                                    }
                                }
                                .buttonStyle(.borderless)
                            }
                        } else {
                            Section {
                                rows(items, bucket: bucket)
                            } header: {
                                Text(header(for: bucket)).foregroundStyle(bucket == .overdue ? Color.red : Color.secondary)
                            }
                        }
                    }
                }
                Section {
                    ForEach(RevisionPlanTemplate.all) { plan in
                        Button { template = plan } label: { PlanCard(plan: plan) }
                            .buttonStyle(.plain)
                    }
                } header: {
                    Label(L10n.text("suggestedPlans"), systemImage: "sparkles")
                } footer: {
                    Text(L10n.text("suggestedPlansFooter"))
                }
            }
            .listStyle(.insetGrouped)
        }
    }

    private var emptyHero: some View {
        VStack(spacing: 14) {
            Image(systemName: "calendar.badge.clock")
                .font(.system(size: 34, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 72, height: 72)
                .background(Circle().fill(LinearGradient(colors: [.blue, .teal], startPoint: .topLeading, endPoint: .bottomTrailing)))
                .accessibilityHidden(true)
            Text(L10n.text("planEmpty")).font(.title3.bold()).multilineTextAlignment(.center)
            Text(L10n.text("planBody")).font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)
            Button { adding = true } label: {
                Label(L10n.text("newSession"), systemImage: "plus").frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .controlSize(.large)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
    }

    private func header(for bucket: RevisionAgenda.Bucket) -> String {
        switch bucket {
        case .overdue: return L10n.text("bucketOverdue")
        case .today: return L10n.text("bucketToday")
        case .tomorrow: return L10n.text("bucketTomorrow")
        case .day(let day): return day.formatted(.dateTime.weekday(.wide).day().month(.wide))
        case .later: return L10n.text("bucketLater")
        case .done: return L10n.text("bucketDone")
        }
    }

    @ViewBuilder
    private func rows(_ items: [RevisionTask], bucket: RevisionAgenda.Bucket) -> some View {
        let showsDate = bucket == .overdue || bucket == .later || bucket == .done
        ForEach(items) { task in
            RevisionRow(task: task, showsDate: showsDate, overdue: bucket == .overdue) { toggle(task) }
                .contentShape(Rectangle())
                .onTapGesture { editing = task }
                .accessibilityAction(named: L10n.text("edit")) { editing = task }
                .swipeActions(edge: .leading) {
                    Button { toggle(task) } label: {
                        Label(L10n.text(task.completed ? "reopen" : "complete"), systemImage: task.completed ? "arrow.uturn.backward" : "checkmark")
                    }
                    .tint(.green)
                }
                .swipeActions(edge: .trailing) {
                    Button(L10n.text("delete"), role: .destructive) { Task { await model.deleteTask(task) } }
                }
        }
    }

    private func toggle(_ task: RevisionTask) {
        var updated = task
        updated.completed.toggle()
        Task { await model.saveTask(updated) }
    }
}

struct RevisionRow: View {
    let task: RevisionTask
    let showsDate: Bool
    let overdue: Bool
    let toggle: () -> Void

    private var timeStyle: Date.FormatStyle {
        showsDate ? .dateTime.day().month().hour().minute() : .dateTime.hour().minute()
    }

    var body: some View {
        HStack(spacing: 12) {
            SubjectBadge(subject: task.subject, activity: task.activity)
                .opacity(task.completed ? 0.5 : 1)
            VStack(alignment: .leading, spacing: 4) {
                Text(task.title)
                    .font(.body.weight(.semibold))
                    .strikethrough(task.completed)
                    .foregroundStyle(task.completed ? .secondary : .primary)
                    .lineLimit(2)
                HStack(spacing: 6) {
                    Image(systemName: "clock").imageScale(.small)
                    Text(task.date, format: timeStyle)
                    if let minutes = task.durationMinutes { Text("· " + minutesText(minutes)) }
                    if let activity = task.activity { Text("· " + activity.name).lineLimit(1) }
                    if task.reminderEnabled { Image(systemName: "bell.fill").imageScale(.small).accessibilityLabel(L10n.text("reminder")) }
                }
                .font(.caption)
                .foregroundStyle(overdue ? Color.red : Color.secondary)
            }
            Spacer(minLength: 4)
            Button(action: toggle) {
                Image(systemName: task.completed ? "checkmark.circle.fill" : "circle")
                    .font(.title2)
                    .foregroundStyle(task.completed ? (task.subject?.tint ?? .green) : Color.secondary)
                    .frame(minWidth: 44, minHeight: 44)
            }
            .buttonStyle(.borderless)
            .accessibilityLabel(L10n.text(task.completed ? "reopen" : "complete"))
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
        .accessibilityAction(named: L10n.text(task.completed ? "reopen" : "complete")) { toggle() }
    }
}

/// This week's progress and the next session.
struct PlannerSummaryCard: View {
    let tasks: [RevisionTask]
    let now: Date

    var body: some View {
        let progress = RevisionAgenda.weekProgress(tasks, now: now)
        let fraction = progress.total == 0 ? 0 : Double(progress.done) / Double(progress.total)
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 16) {
                ZStack {
                    Circle().stroke(Color.accentColor.opacity(0.15), lineWidth: 8)
                    Circle()
                        .trim(from: 0, to: fraction)
                        .stroke(AngularGradient(colors: [.blue, .teal, .green, .blue], center: .center),
                                style: StrokeStyle(lineWidth: 8, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    Text("\(progress.done)/\(progress.total)").font(.subheadline.bold().monospacedDigit())
                }
                .frame(width: 64, height: 64)
                .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 4) {
                    Text(L10n.text("plannerWeek")).font(.headline)
                    Text(String(format: L10n.text("plannerProgress"), progress.done, progress.total))
                        .font(.subheadline).foregroundStyle(.secondary)
                    if progress.minutes > 0 {
                        Label(String(format: L10n.text("plannerMinutes"), progress.minutes), systemImage: "hourglass")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
            .accessibilityElement(children: .combine)
            Divider()
            if let next = RevisionAgenda.next(tasks, now: now) {
                HStack(spacing: 12) {
                    SubjectBadge(subject: next.subject, activity: next.activity, size: 36)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(L10n.text("plannerNext")).font(.caption).foregroundStyle(.secondary)
                        Text(next.title).font(.subheadline.weight(.semibold)).lineLimit(1)
                    }
                    Spacer(minLength: 4)
                    Text(next.date, style: .relative)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(next.subject?.tint ?? .accentColor)
                        .multilineTextAlignment(.trailing)
                }
                .accessibilityElement(children: .combine)
            } else {
                Label(L10n.text("plannerNothingNext"), systemImage: "checkmark.seal")
                    .font(.subheadline).foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 6)
    }
}

struct PlanCard: View {
    let plan: RevisionPlanTemplate

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: plan.symbol)
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 48, height: 48)
                .background(RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(LinearGradient(colors: [plan.tint, plan.tint.opacity(0.7)], startPoint: .topLeading, endPoint: .bottomTrailing)))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                Text(plan.name).font(.subheadline.weight(.semibold)).foregroundStyle(.primary)
                Text(plan.summary).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                Text(plan.meta).font(.caption2.weight(.semibold)).foregroundStyle(plan.tint)
            }
            Spacer(minLength: 4)
            Image(systemName: "chevron.forward").font(.caption.weight(.semibold)).foregroundStyle(.tertiary)
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
    }
}

// MARK: - Pickers

struct SubjectPicker: View {
    @Binding var selection: RevisionSubject?

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 96), spacing: 8)], spacing: 8) {
            ForEach(RevisionSubject.allCases, id: \.self) { subject in
                let selected = selection == subject
                Button {
                    selection = selected ? nil : subject
                } label: {
                    VStack(spacing: 6) {
                        Image(systemName: subject.symbol).font(.title3)
                        Text(subject.name).font(.caption2).lineLimit(2).multilineTextAlignment(.center).minimumScaleFactor(0.8)
                    }
                    .foregroundStyle(selected ? subject.tint : Color.primary)
                    .frame(maxWidth: .infinity, minHeight: 64)
                    .padding(6)
                    .background(RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(selected ? subject.tint.opacity(0.18) : Color(.tertiarySystemFill)))
                    .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .strokeBorder(selected ? subject.tint : Color.clear, lineWidth: 1.5))
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selected ? .isSelected : [])
            }
        }
        .padding(.vertical, 4)
    }
}

struct ActivityPicker: View {
    @Binding var selection: RevisionActivity?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(RevisionActivity.allCases, id: \.self) { activity in
                    let selected = selection == activity
                    Button {
                        selection = selected ? nil : activity
                    } label: {
                        Label(activity.name, systemImage: activity.symbol)
                            .font(.subheadline)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .foregroundStyle(selected ? Color.white : Color.primary)
                            .background(Capsule().fill(selected ? Color.accentColor : Color(.tertiarySystemFill)))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(selected ? .isSelected : [])
                }
            }
            .padding(.vertical, 4)
        }
    }
}

// MARK: - Add / edit one session

struct NewRevisionView: View {
    @ObservedObject var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var subject: RevisionSubject?
    @State private var activity: RevisionActivity?
    @State private var duration = 45
    @State private var date = Date().addingTimeInterval(3600)
    @State private var reminder = false
    @State private var saving = false
    @State private var editorAccount: String?
    private let original: RevisionTask?
    private static let durations = [20, 30, 45, 60, 90, 120]

    init(model: AppModel, task: RevisionTask? = nil) {
        self.model = model
        original = task
        _title = State(initialValue: task?.title ?? "")
        _subject = State(initialValue: task?.subject)
        _activity = State(initialValue: task?.activity)
        _duration = State(initialValue: task?.durationMinutes.map { value in
            Self.durations.min { abs($0 - value) < abs($1 - value) } ?? 45
        } ?? 45)
        _date = State(initialValue: task?.date ?? Date().addingTimeInterval(3600))
        _reminder = State(initialValue: task?.reminderEnabled ?? false)
    }

    /// A typed title wins; otherwise "activity — subject" from the chips.
    private var finalTitle: String {
        let typed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        if !typed.isEmpty { return typed }
        return [activity?.name, subject?.name].compactMap { $0 }.joined(separator: " — ")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(L10n.text("title"), text: $title, prompt: Text(L10n.text("titleHint")), axis: .vertical)
                        .lineLimit(1...4)
                } header: { Text(L10n.text("title")) }
                Section(L10n.text("subject")) { SubjectPicker(selection: $subject) }
                Section(L10n.text("activity")) { ActivityPicker(selection: $activity) }
                Section(L10n.text("duration")) {
                    Picker(L10n.text("duration"), selection: $duration) {
                        ForEach(Self.durations, id: \.self) { Text(minutesText($0)).tag($0) }
                    }
                    .pickerStyle(.segmented)
                }
                Section {
                    DatePicker(L10n.text("date"), selection: $date, in: Date()..., displayedComponents: [.date, .hourAndMinute])
                    Toggle(isOn: $reminder) { Label(L10n.text("reminder"), systemImage: "bell") }
                        .disabled(original?.completed == true)
                } footer: { Text(L10n.text("reminderPrivacy")) }
            }
            .navigationTitle(L10n.text(original == nil ? "add" : "edit"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(L10n.text("cancel")) { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(L10n.text("save")) {
                        saving = true
                        Task {
                            let task = RevisionTask(id: original?.id ?? UUID(), title: finalTitle, date: date,
                                                    completed: original?.completed ?? false, reminderEnabled: reminder,
                                                    subjectID: subject?.rawValue, activityID: activity?.rawValue,
                                                    durationMinutes: duration, planID: original?.planID)
                            let success = await model.saveTask(task)
                            saving = false
                            if success { dismiss() }
                        }
                    }
                    .disabled(saving || finalTitle.isEmpty || finalTitle.count > 200 || !model.personalSpaceReady)
                }
            }
        }
        .onAppear { editorAccount = model.verifiedAccountID }
        .onChange(of: model.verifiedAccountID) { _, account in
            if account != editorAccount { title = ""; dismiss() }
        }
    }
}

// MARK: - Apply a suggested plan

struct PlanTemplateView: View {
    @ObservedObject var model: AppModel
    let template: RevisionPlanTemplate
    @Environment(\.dismiss) private var dismiss
    @State private var subject: RevisionSubject?
    @State private var lesson = ""
    @State private var start = PlanTemplateView.defaultStart()
    @State private var reminders = false
    @State private var saving = false
    @State private var editorAccount: String?

    /// Next 17:00 (after school) that is at least a few minutes away.
    static func defaultStart(now: Date = Date(), calendar: Calendar = .current) -> Date {
        let today = calendar.date(bySettingHour: 17, minute: 0, second: 0, of: now) ?? now
        if today > now.addingTimeInterval(300) { return today }
        return calendar.date(byAdding: .day, value: 1, to: today) ?? now.addingTimeInterval(86_400)
    }

    private var needsSubject: Bool { template.fixedSubject == nil && subject == nil }

    private func build() -> [RevisionTask] {
        RevisionPlanBuilder.tasks(for: template, start: start, subject: subject, lesson: lesson, reminders: reminders,
                                  title: { L10n.text($0) }, subjectName: { $0.name })
    }

    var body: some View {
        let preview = build()
        NavigationStack {
            Form {
                Section {
                    HStack(alignment: .top, spacing: 14) {
                        Image(systemName: template.symbol)
                            .font(.system(size: 24, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(width: 56, height: 56)
                            .background(RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .fill(LinearGradient(colors: [template.tint, template.tint.opacity(0.7)], startPoint: .topLeading, endPoint: .bottomTrailing)))
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 6) {
                            Text(template.name).font(.headline)
                            Text(template.summary).font(.subheadline).foregroundStyle(.secondary)
                            Label(template.meta + " · " + minutesText(template.totalMinutes), systemImage: "clock")
                                .font(.caption.weight(.semibold)).foregroundStyle(template.tint)
                        }
                    }
                    .padding(.vertical, 6)
                }
                if template.fixedSubject == nil {
                    Section {
                        SubjectPicker(selection: $subject)
                    } header: { Text(L10n.text("subject")) } footer: {
                        if subject == nil { Text(L10n.text("planChooseSubject")) }
                    }
                }
                if template.asksForLesson {
                    Section {
                        TextField(L10n.text("lessonName"), text: $lesson, prompt: Text(L10n.text("lessonHint")))
                    }
                }
                Section {
                    DatePicker(L10n.text("planStart"), selection: $start, in: Date()..., displayedComponents: [.date, .hourAndMinute])
                    Toggle(isOn: $reminders) { Label(L10n.text("planRemind"), systemImage: "bell") }
                } footer: { Text(L10n.text("reminderPrivacy")) }
                Section(L10n.text("planSessions")) {
                    ForEach(Array(preview.enumerated()), id: \.offset) { _, task in
                        HStack(spacing: 12) {
                            SubjectBadge(subject: task.subject, activity: task.activity, size: 36)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(task.title).font(.subheadline.weight(.semibold)).lineLimit(2)
                                HStack(spacing: 4) {
                                    Text(task.date, format: .dateTime.weekday(.abbreviated).day().month().hour().minute())
                                    if let minutes = task.durationMinutes { Text("· " + minutesText(minutes)) }
                                    if let activity = task.activity { Text("· " + activity.name).lineLimit(1) }
                                }
                                .font(.caption).foregroundStyle(.secondary)
                            }
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
            }
            .navigationTitle(L10n.text("readyPlan"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(L10n.text("cancel")) { dismiss() } }
            }
            .safeAreaInset(edge: .bottom) {
                Button {
                    saving = true
                    Task {
                        let success = await model.addPlan(build())
                        saving = false
                        if success { dismiss() }
                    }
                } label: {
                    Text(String(format: L10n.text("addPlan"), preview.count))
                        .font(.headline)
                        .frame(maxWidth: .infinity, minHeight: 30)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .tint(template.tint)
                .disabled(saving || needsSubject || preview.isEmpty || !model.personalSpaceReady)
                .padding(.horizontal)
                .padding(.vertical, 8)
                .background(.bar)
                .accessibilityIdentifier("addPlan")
            }
        }
        .onAppear { editorAccount = model.verifiedAccountID }
        .onChange(of: model.verifiedAccountID) { _, account in
            if account != editorAccount { lesson = ""; dismiss() }
        }
    }
}
