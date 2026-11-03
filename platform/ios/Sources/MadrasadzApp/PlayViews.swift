import SwiftUI
import UIKit
import MadrasadzCore

// MARK: - PLAY home

struct PlayHomeView: View {
    @ObservedObject var model: AppModel
    @ObservedObject var play: PlayModel
    @StateObject private var loader = Loader<Play.Subjects>()

    private let path = "/api/v1/ios/play/subjects"

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                header
                if loader.value != nil, loader.savedAt != nil || !model.online { OfflineBanner(savedAt: loader.savedAt) }
                if play.pendingCount > 0 { syncCard }
                NavigationLink { BacBankView(model: model) } label: { bacCard }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("bacBankEntry")
                if let subjects = loader.value {
                    if subjects.needsProfile {
                        ProfilePicker(model: model, grades: subjects.grades) { await loader.load(path, model: model, force: true) }
                    } else if subjects.subjects.isEmpty {
                        Text(L10n.text("playNoSubjects")).foregroundStyle(.secondary).card()
                    } else {
                        Text(L10n.text("playSubjects")).font(.title3.bold())
                        LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                            ForEach(subjects.subjects) { subject in
                                NavigationLink { SubjectSetsView(model: model, play: play, subject: subject) } label: { SubjectTile(subject: subject) }
                                    .buttonStyle(.plain)
                                    .accessibilityIdentifier("subject-\(subject.code)")
                            }
                        }
                    }
                } else if let failure = loader.failure {
                    FailureView(message: failure.message) { Task { await loader.load(path, model: model, force: true) } }
                } else {
                    LoadingView()
                }
                if !play.downloaded.isEmpty { saved }
                if !play.attempts.isEmpty { results }
            }
            .padding(16)
        }
        .background(Brand.page)
        .navigationTitle("مدرسة PLAY")
        .refreshable {
            await loader.load(path, model: model, force: true)
            await play.sync()
        }
        .task { await loader.load(path, model: model) }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(L10n.text("playHeadline")).font(.title2.bold()).foregroundStyle(.white)
            Text(L10n.text("playOffline")).font(.subheadline).foregroundStyle(.white.opacity(0.88))
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(LinearGradient(colors: [Brand.blue, Brand.navy], startPoint: .topLeading, endPoint: .bottomTrailing),
                    in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }

    /// The past BAC papers bank: free, next to the game.
    private var bacCard: some View {
        HStack(spacing: 14) {
            Image(systemName: "doc.text.magnifyingglass")
                .font(.title2)
                .foregroundStyle(Brand.blue)
                .frame(width: 46, height: 46)
                .background(Brand.blue.opacity(0.12), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            VStack(alignment: .leading, spacing: 3) {
                Text(L10n.text("bacBank")).font(.headline).foregroundStyle(.primary)
                Text(L10n.text("bacBankHint")).font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.leading)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.forward").foregroundStyle(.tertiary)
        }
        .card()
    }

    private var syncCard: some View {
        HStack {
            Label(String(format: L10n.text("pendingSync"), play.pendingCount), systemImage: "arrow.triangle.2.circlepath")
                .font(.subheadline.weight(.semibold))
            Spacer()
            if play.syncing { ProgressView() } else {
                Button(L10n.text("syncNow")) { Task { await play.sync() } }.disabled(!model.online)
            }
        }
        .card()
    }

    private var saved: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(L10n.text("savedSets")).font(.title3.bold())
            ForEach(play.downloaded) { set in
                NavigationLink { ExamLauncher(model: model, play: play, setID: set.id, title: set.title) } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "arrow.down.circle.fill").foregroundStyle(Brand.success)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(set.title).font(.subheadline.bold()).foregroundStyle(.primary).multilineTextAlignment(.leading)
                            Text(kindName(set.kind) + (set.year.map { " · \($0)" } ?? "")).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer(minLength: 0)
                        Image(systemName: "chevron.forward").foregroundStyle(.tertiary)
                    }
                    .card()
                }
                .buttonStyle(.plain)
                .contextMenu {
                    Button(L10n.text("delete"), role: .destructive) { Task { await play.remove(set.id) } }
                }
            }
        }
    }

    private var results: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(L10n.text("myResults")).font(.title3.bold())
            ForEach(play.attempts.prefix(8)) { attempt in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(attempt.title).font(.subheadline.bold()).lineLimit(2)
                        Text(attempt.finishedAt.formatted(date: .abbreviated, time: .shortened)).font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 2) {
                        let score = attempt.serverScore ?? Play.Score(score: attempt.score, max: attempt.max)
                        Text("\(scoreText(score.score)) / \(scoreText(score.max))").font(.headline.monospacedDigit())
                        Text(attempt.pending ? L10n.text("notSynced") : attempt.rejected ? L10n.text("syncRefused") : L10n.text("synced"))
                            .font(.caption2).foregroundStyle(attempt.pending ? .orange : .secondary)
                    }
                    .environment(\.layoutDirection, .leftToRight)
                }
                .card()
            }
        }
    }
}

func kindName(_ kind: String) -> String {
    switch kind {
    case "BAC": return L10n.text("kindBac")
    case "DEVOIR": return L10n.text("kindDevoir")
    default: return L10n.text("kindTest")
    }
}

struct SubjectTile: View {
    let subject: Play.Subject

    private var tint: Color {
        guard let hex = subject.color, hex.hasPrefix("#"), hex.count == 7, let value = Int(hex.dropFirst(), radix: 16) else { return Brand.blue }
        return Color(red: Double((value >> 16) & 0xff) / 255, green: Double((value >> 8) & 0xff) / 255, blue: Double(value & 0xff) / 255)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: "book.closed.fill").font(.title2).foregroundStyle(.white)
                .frame(width: 44, height: 44)
                .background(tint, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            Text(subject.nameAr).font(.headline).foregroundStyle(.primary).lineLimit(2).multilineTextAlignment(.leading)
        }
        .frame(maxWidth: .infinity, minHeight: 104, alignment: .topLeading)
        .padding(14)
        .background(Brand.card, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}

/// When the account has no PLAY year yet: choose it once, as on the website.
struct ProfilePicker: View {
    @ObservedObject var model: AppModel
    let grades: [Play.Grade]
    let saved: () async -> Void
    @State private var grade: Play.Grade?
    @State private var stream: Play.Stream?
    @State private var working = false
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(L10n.text("playChooseYear")).font(.headline)
            Text(L10n.text("playChooseYearBody")).font(.footnote).foregroundStyle(.secondary)
            if grades.isEmpty {
                Text(L10n.text("termsUpdateServer")).font(.footnote).foregroundStyle(.secondary)
            } else {
                Picker(L10n.text("playYear"), selection: $grade) {
                    Text("—").tag(Play.Grade?.none)
                    ForEach(grades) { Text($0.nameAr).tag(Play.Grade?.some($0)) }
                }
                .pickerStyle(.menu)
                if let grade, !grade.streams.isEmpty {
                    Picker(L10n.text("playStream"), selection: $stream) {
                        Text("—").tag(Play.Stream?.none)
                        ForEach(grade.streams) { Text($0.nameAr).tag(Play.Stream?.some($0)) }
                    }
                    .pickerStyle(.menu)
                }
                if let error { Text(error).font(.footnote).foregroundStyle(Brand.danger) }
                Button {
                    Task { await save() }
                } label: {
                    HStack { if working { ProgressView() }; Text(L10n.text("save")).fontWeight(.bold) }.frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(working || grade == nil || (grade?.streams.isEmpty == false && stream == nil))
            }
        }
        .card()
        .onChange(of: grade) { _, _ in stream = nil }
    }

    private func save() async {
        guard let grade else { return }
        struct Body: Encodable { let gradeCode: String; let streamCode: String? }
        struct Reply: Decodable { let gradeCode: String }
        working = true
        defer { working = false }
        do {
            _ = try await model.api.post(Reply.self, "/api/v1/ios/play/profile", body: Body(gradeCode: grade.code, streamCode: stream?.code))
            await saved()
        } catch let failure as APIFailure {
            model.handle(failure)
            error = failure.message
        } catch {
            self.error = L10n.text("error")
        }
    }
}

// MARK: - Sets of a subject

struct SubjectSetsView: View {
    @ObservedObject var model: AppModel
    @ObservedObject var play: PlayModel
    let subject: Play.Subject
    /// Lessons (card game, as on the website) first; then BAC, homework and tests.
    @State private var mode: Mode = .lessons
    @StateObject private var loader = Loader<Play.SetList>()
    @StateObject private var lessons = Loader<Cards.LessonList>()

    enum Mode: Hashable { case lessons, exams(Play.Kind) }

    private var setsPath: String? {
        if case .exams(let kind) = mode { return "/api/v1/ios/play/sets?subject=\(subject.code)&kind=\(kind.rawValue)" }
        return nil
    }
    private var lessonsPath: String { "/api/v1/ios/play/lessons?subject=\(subject.code)" }

    var body: some View {
        List {
            Section {
                Picker(L10n.text("playKind"), selection: $mode) {
                    Text(L10n.text("kindLessons")).tag(Mode.lessons)
                    Text(L10n.text("kindBac")).tag(Mode.exams(.bac))
                    Text(L10n.text("kindDevoir")).tag(Mode.exams(.devoir))
                    Text(L10n.text("kindTest")).tag(Mode.exams(.test))
                }
                .pickerStyle(.segmented)
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())
            }
            if mode == .lessons {
                LessonCardsSection(model: model, play: play, loader: lessons) { Task { await lessons.load(lessonsPath, model: model, force: true) } }
            } else {
                sets
            }
        }
        .navigationTitle(subject.nameAr)
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await reload(force: true) }
        .task(id: mode) { await reload(force: false) }
    }

    private func reload(force: Bool) async {
        if let setsPath { await loader.load(setsPath, model: model, force: force) }
        else { await lessons.load(lessonsPath, model: model, force: force) }
    }

    @ViewBuilder
    private var sets: some View {
        if loader.value != nil, loader.savedAt != nil || !model.online {
            OfflineBanner(savedAt: loader.savedAt).listRowBackground(Color.clear).listRowInsets(EdgeInsets())
        }
        if let list = loader.value {
            if list.items.isEmpty {
                Text(L10n.text("playNoSets")).foregroundStyle(.secondary)
            } else {
                ForEach(list.items) { item in
                    NavigationLink { ExamLauncher(model: model, play: play, setID: item.id, title: item.title) } label: { SetRow(item: item, saved: play.isDownloaded(item.id)) }
                        .accessibilityIdentifier("set-\(item.setId)")
                }
            }
        } else if let failure = loader.failure {
            FailureView(message: failure.message) { Task { if let setsPath { await loader.load(setsPath, model: model, force: true) } } }
                .listRowBackground(Color.clear)
        } else {
            LoadingView().listRowBackground(Color.clear)
        }
    }
}

struct SetRow: View {
    let item: Play.SetSummary
    let saved: Bool

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(item.title).font(.subheadline.bold())
                HStack(spacing: 6) {
                    if let year = item.year { Text(String(year)) }
                    if let term = item.term { Text("· " + String(format: L10n.text("termNumber"), term)) }
                    Text("· " + String(format: L10n.text("stepsCount"), item.stepCount))
                }
                .font(.caption).foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
            if let best = item.best {
                Text("\(scoreText(best.score))/\(scoreText(best.max))").font(.caption.bold().monospacedDigit())
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(Brand.sky, in: Capsule())
                    .environment(\.layoutDirection, .leftToRight)
            }
            if saved { Image(systemName: "arrow.down.circle.fill").foregroundStyle(Brand.success).accessibilityLabel(L10n.text("savedOffline")) }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Opening a set (download or saved copy)

struct ExamLauncher: View {
    @ObservedObject var model: AppModel
    @ObservedObject var play: PlayModel
    let setID: String
    let title: String
    @State private var package: Play.Package?
    @State private var failure: String?
    @State private var trialEnded = false
    @State private var attempt = UUID()

    var body: some View {
        Group {
            if let package {
                ExamRunner(play: play, package: package, baseURL: model.api.baseURL) { attempt = UUID() }
                    .id(attempt)
            } else if trialEnded {
                // Not an error and nothing to retry: the account's free PLAY trial is over.
                ContentUnavailableView {
                    Label(L10n.text("playTrialEndedTitle"), systemImage: "hourglass.bottomhalf.filled")
                } description: {
                    Text(L10n.text("playTrialEnded"))
                }
                .accessibilityIdentifier("playTrialEnded")
            } else if let failure {
                ContentUnavailableView {
                    Label(L10n.text("nativeLoadFailed"), systemImage: "exclamationmark.triangle")
                } description: { Text(failure) } actions: {
                    Button(L10n.text("retry")) { Task { await load() } }.buttonStyle(.borderedProminent)
                }
            } else {
                ProgressView(L10n.text("preparingSet")).frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func load() async {
        failure = nil
        trialEnded = false
        // A saved copy opens at once; online, the latest version replaces it.
        if package == nil, let stored = await play.package(id: setID) { package = stored }
        do {
            let fresh = try await play.open(setID: setID)
            if package == nil || package?.checksum != fresh.checksum { package = fresh }
        } catch let error as APIFailure {
            guard package == nil else { return }
            if error.code == "PLAY_TRIAL_EXPIRED" { trialEnded = true; return }
            failure = error == .offline ? L10n.text("setNeedsInternet") : error.message
        } catch {
            if package == nil { failure = L10n.text("error") }
        }
    }
}

// MARK: - The runner: one step at a time, graded on the device

struct ExamRunner: View {
    @ObservedObject var play: PlayModel
    let package: Play.Package
    let baseURL: URL
    let restart: () -> Void

    @State private var index = 0
    @State private var drafts: [String: Draft] = [:]
    @State private var answers: [String: Play.Answer] = [:]
    @State private var checked: [String: Double] = [:]
    @State private var finished: PlayStore.Attempt?
    @State private var showSource = false

    var body: some View {
        if let finished {
            ResultView(package: package, attempt: finished, play: play, restart: restart)
        } else if package.steps.isEmpty {
            ContentUnavailableView(L10n.text("playNoSteps"), systemImage: "questionmark.circle")
        } else {
            runner
        }
    }

    private var step: Play.Step { package.steps[min(index, package.steps.count - 1)] }

    private var runner: some View {
        VStack(spacing: 0) {
            ProgressView(value: Double(index + (checked[step.id] != nil ? 1 : 0)), total: Double(package.steps.count))
                .tint(Brand.blue)
                .padding(.horizontal, 16).padding(.top, 8)
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    HStack {
                        Text(String(format: L10n.text("stepOf"), index + 1, package.steps.count)).font(.caption.bold()).foregroundStyle(Brand.blue)
                        Spacer()
                        Text(String(format: L10n.text("pointsShort"), scoreText(step.points))).font(.caption).foregroundStyle(.secondary)
                    }
                    if let label = step.rubricLabel { Text(label).font(.caption).foregroundStyle(.secondary) }
                    Group {
                        Text(step.prompt).font(.title3.weight(.semibold)).fixedSize(horizontal: false, vertical: true)
                        if let excerpt = step.excerpt { ExcerptView(excerpt: excerpt) }
                        if let source = step.source, !source.text.isEmpty || !source.documents.isEmpty {
                            DisclosureGroup(L10n.text("originalQuestion"), isExpanded: $showSource) { SourceView(source: source, baseURL: baseURL) }
                                .font(.subheadline)
                        }
                        StepInteraction(step: step, draft: binding(for: step), locked: checked[step.id] != nil, baseURL: baseURL)
                    }
                    .environment(\.layoutDirection, package.isLeftToRight ? .leftToRight : .rightToLeft)
                    if let grade = checked[step.id] { FeedbackView(step: step, grade: grade) }
                }
                .padding(16)
            }
            controls
        }
        .background(Brand.page)
        .onChange(of: index) { _, _ in showSource = false }
    }

    private var controls: some View {
        HStack(spacing: 12) {
            if checked[step.id] == nil {
                Button(L10n.text("skip")) { advance() }
                    .buttonStyle(.bordered)
                    .accessibilityIdentifier("playSkip")
                Button {
                    check()
                } label: { Text(L10n.text("check")).fontWeight(.bold).frame(maxWidth: .infinity) }
                    .buttonStyle(.borderedProminent)
                    .disabled((drafts[step.id] ?? Draft(step: step)).answer == nil)
                    .accessibilityIdentifier("playCheck")
            } else {
                Button {
                    advance()
                } label: {
                    Text(index + 1 < package.steps.count ? L10n.text("next") : L10n.text("finish")).fontWeight(.bold).frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .accessibilityIdentifier("playNext")
            }
        }
        .controlSize(.large)
        .padding(16)
        .background(.bar)
    }

    private func binding(for step: Play.Step) -> Binding<Draft> {
        Binding(get: { drafts[step.id] ?? Draft(step: step) }, set: { drafts[step.id] = $0 })
    }

    private func check() {
        guard let answer = (drafts[step.id] ?? Draft(step: step)).answer else { return }
        answers[step.id] = answer
        let grade = Play.grade(step, answer: answer)
        withAnimation { checked[step.id] = grade }
        UIImpactFeedbackGenerator(style: grade >= 1 ? .light : .rigid).impactOccurred()
    }

    private func advance() {
        if index + 1 < package.steps.count {
            withAnimation { index += 1 }
        } else {
            Task {
                finished = await play.finish(package, answers: answers)
                    ?? PlayStore.Attempt(id: UUID(), setId: package.id, title: package.title, answers: answers,
                                         score: Play.score(package, answers: answers).score, max: Play.score(package, answers: answers).max,
                                         scoreTotal: package.scoreTotal, finishedAt: Date(), serverScore: nil, rejected: false)
            }
        }
    }
}

/// The student's answer while it is being built.
struct Draft: Equatable {
    var choice: Int?
    var choices: Set<Int> = []
    var blanks: [String?] = []
    var order: [Int] = []
    var pairs: [Int] = []
    var text = ""
    let kind: Kind

    enum Kind: Equatable { case mcq, multi, fill, ordering, matching, portrait, numeric, short }

    init(step: Play.Step) {
        switch step.payload {
        case .mcq: kind = .mcq
        case .portrait: kind = .portrait
        case .multi: kind = .multi
        case .fillBlank: kind = .fill; blanks = Array(repeating: nil, count: step.blankCount)
        case .ordering(let items): kind = .ordering; order = Array(items.indices)
        case .matching(let lefts, _): kind = .matching; pairs = Array(repeating: -1, count: lefts.count)
        case .numeric: kind = .numeric
        case .shortText: kind = .short
        }
    }

    var answer: Play.Answer? {
        switch kind {
        case .mcq: return choice.map(Play.Answer.mcq)
        case .portrait: return choice.map(Play.Answer.portrait)
        case .multi: return choices.isEmpty ? nil : .multi(choices.sorted())
        case .fill: return blanks.isEmpty || blanks.contains(where: { $0 == nil }) ? nil : .fillBlank(blanks.compactMap { $0 })
        case .ordering: return .ordering(order)
        case .matching: return pairs.contains(-1) ? nil : .matching(pairs)
        case .numeric:
            let normalized = AppModel.normalizedIdentifier(text).replacingOccurrences(of: ",", with: ".").replacingOccurrences(of: "٫", with: ".")
            guard let value = Double(normalized), value.isFinite else { return nil }
            return .numeric(value)
        case .short:
            let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty ? nil : .shortText(trimmed)
        }
    }
}

private let letters = ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح", "ط", "ي"]

struct StepInteraction: View {
    let step: Play.Step
    @Binding var draft: Draft
    let locked: Bool
    let baseURL: URL

    var body: some View {
        switch step.payload {
        case .mcq(let options):
            choiceList(options, multiple: false)
        case .portrait(let media, let options):
            VStack(spacing: 12) {
                AsyncImage(url: URL(string: media.localPath, relativeTo: baseURL)) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Color(.tertiarySystemFill).overlay(Image(systemName: "photo").foregroundStyle(.secondary))
                }
                .frame(width: 180, height: 225)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .accessibilityLabel(media.alt)
                if let attribution = media.attribution { Text(attribution).font(.caption2).foregroundStyle(.secondary) }
                choiceList(options, multiple: false)
            }
        case .multi(let options):
            VStack(alignment: .leading, spacing: 6) {
                Text(L10n.text("chooseAll")).font(.caption.bold()).foregroundStyle(.secondary)
                choiceList(options, multiple: true)
            }
        case .fillBlank(let text, let bank):
            fill(text: text, bank: bank)
        case .ordering(let items):
            ordering(items)
        case .matching(let lefts, let rights):
            matching(lefts: lefts, rights: rights)
        case .numeric(let unit):
            HStack {
                TextField(L10n.text("yourAnswer"), text: $draft.text)
                    .keyboardType(.decimalPad)
                    .disabled(locked)
                    .padding(12)
                    .background(Brand.card, in: RoundedRectangle(cornerRadius: 12))
                    .accessibilityIdentifier("numericAnswer")
                if let unit { Text(unit).font(.headline) }
            }
            .environment(\.layoutDirection, .leftToRight)
        case .shortText:
            TextField(L10n.text("yourAnswer"), text: $draft.text, axis: .vertical)
                .disabled(locked)
                .padding(12)
                .background(Brand.card, in: RoundedRectangle(cornerRadius: 12))
                .accessibilityIdentifier("textAnswer")
        }
    }

    private func correctIndices() -> Set<Int> {
        switch step.key {
        case .mcq(let c), .portrait(let c): return [c]
        case .multi(let c): return Set(c)
        default: return []
        }
    }

    private func choiceList(_ options: [String], multiple: Bool) -> some View {
        let correct = correctIndices()
        return VStack(spacing: 10) {
            ForEach(Array(options.enumerated()), id: \.offset) { i, option in
                let picked = multiple ? draft.choices.contains(i) : draft.choice == i
                let look: OptionRow.Look = locked ? (correct.contains(i) ? .correct : picked ? .wrong : .dim) : (picked ? .picked : .idle)
                Button {
                    guard !locked else { return }
                    if multiple {
                        if picked { draft.choices.remove(i) } else { draft.choices.insert(i) }
                    } else {
                        draft.choice = i
                    }
                } label: {
                    OptionRow(label: i < letters.count ? letters[i] : "\(i + 1)", text: option, look: look, square: multiple)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("option-\(i)")
                .accessibilityAddTraits(picked ? .isSelected : [])
            }
        }
    }

    private func fill(text: String, bank: [String]) -> some View {
        let parts = text.components(separatedBy: "____")
        var sentence = Text("")
        for (i, part) in parts.enumerated() {
            sentence = sentence + Text(part)
            if i < parts.count - 1 {
                let value = i < draft.blanks.count ? draft.blanks[i] : nil
                sentence = sentence + Text(" [\(i + 1): \(value ?? "……")] ").foregroundColor(Brand.blue).bold()
            }
        }
        let used = draft.blanks.compactMap { $0 }
        return VStack(alignment: .leading, spacing: 14) {
            sentence.font(.body).lineSpacing(8).fixedSize(horizontal: false, vertical: true)
            ForEach(Array(draft.blanks.enumerated()), id: \.offset) { i, value in
                HStack {
                    Text(String(format: L10n.text("blankNumber"), i + 1)).font(.caption.bold())
                    Text(value ?? "—").foregroundStyle(value == nil ? .secondary : .primary)
                    Spacer()
                    if value != nil, !locked {
                        Button { draft.blanks[i] = nil } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary) }
                            .accessibilityLabel(L10n.text("clear"))
                    }
                }
                .padding(10)
                .background(Brand.card, in: RoundedRectangle(cornerRadius: 10))
            }
            FlowLayout {
                ForEach(Array(bank.enumerated()), id: \.offset) { i, word in
                    let taken = used.filter { $0 == word }.count >= bank.prefix(i + 1).filter { $0 == word }.count
                    Button {
                        if let at = draft.blanks.firstIndex(where: { $0 == nil }) { draft.blanks[at] = word }
                    } label: {
                        Text(word).font(.callout.weight(.semibold))
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(Brand.card, in: Capsule())
                            .overlay(Capsule().stroke(Brand.sky, lineWidth: 1.5))
                    }
                    .buttonStyle(.plain)
                    .disabled(locked || taken)
                    .opacity(taken ? 0.35 : 1)
                    .accessibilityIdentifier("bank-\(i)")
                }
            }
        }
    }

    private func ordering(_ items: [String]) -> some View {
        VStack(spacing: 8) {
            Text(L10n.text("orderHint")).font(.caption.bold()).foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .leading)
            ForEach(Array(draft.order.enumerated()), id: \.offset) { position, item in
                HStack(spacing: 10) {
                    Text("\(position + 1)").font(.headline.monospacedDigit()).frame(width: 28)
                    Text(item < items.count ? items[item] : "").frame(maxWidth: .infinity, alignment: .leading)
                    if !locked {
                        VStack(spacing: 4) {
                            Button { move(position, by: -1) } label: { Image(systemName: "chevron.up") }.disabled(position == 0)
                            Button { move(position, by: 1) } label: { Image(systemName: "chevron.down") }.disabled(position == draft.order.count - 1)
                        }
                        .buttonStyle(.bordered).controlSize(.small)
                    }
                }
                .padding(10)
                .background(orderColor(position), in: RoundedRectangle(cornerRadius: 12))
            }
        }
    }

    private func orderColor(_ position: Int) -> Color {
        guard locked, case .ordering(let order) = step.key, position < order.count else { return Brand.card }
        return draft.order[position] == order[position] ? Brand.success.opacity(0.15) : Brand.danger.opacity(0.12)
    }

    private func move(_ position: Int, by offset: Int) {
        let target = position + offset
        guard target >= 0, target < draft.order.count else { return }
        draft.order.swapAt(position, target)
    }

    private func matching(lefts: [String], rights: [String]) -> some View {
        VStack(spacing: 10) {
            ForEach(Array(lefts.enumerated()), id: \.offset) { i, left in
                let chosen = i < draft.pairs.count ? draft.pairs[i] : -1
                VStack(alignment: .leading, spacing: 8) {
                    Text(left).font(.subheadline.bold())
                    Menu {
                        ForEach(Array(rights.enumerated()), id: \.offset) { j, right in
                            Button(right) { draft.pairs[i] = j }
                        }
                    } label: {
                        HStack {
                            Text(chosen >= 0 && chosen < rights.count ? rights[chosen] : L10n.text("chooseMatch"))
                                .foregroundStyle(chosen >= 0 ? .primary : .secondary)
                                .multilineTextAlignment(.leading)
                            Spacer()
                            Image(systemName: "chevron.up.chevron.down").font(.caption)
                        }
                        .padding(10)
                        .background(Color(.tertiarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 10))
                    }
                    .disabled(locked)
                    .accessibilityIdentifier("match-\(i)")
                }
                .padding(12)
                .background(matchColor(i), in: RoundedRectangle(cornerRadius: 14))
            }
        }
    }

    private func matchColor(_ i: Int) -> Color {
        guard locked, case .matching(let pairs) = step.key, i < pairs.count, i < draft.pairs.count else { return Brand.card }
        return draft.pairs[i] == pairs[i] ? Brand.success.opacity(0.15) : Brand.danger.opacity(0.12)
    }
}

struct OptionRow: View {
    enum Look { case idle, picked, correct, wrong, dim }
    let label: String
    let text: String
    let look: Look
    let square: Bool

    private var border: Color {
        switch look {
        case .picked: return Brand.blue
        case .correct: return Brand.success
        case .wrong: return Brand.danger
        default: return Color(.separator)
        }
    }

    private var fill: Color {
        switch look {
        case .picked: return Brand.sky
        case .correct: return Brand.success.opacity(0.14)
        case .wrong: return Brand.danger.opacity(0.12)
        default: return Brand.card
        }
    }

    var body: some View {
        HStack(spacing: 12) {
            Group {
                switch look {
                case .correct: Image(systemName: "checkmark")
                case .wrong: Image(systemName: "xmark")
                default: Text(label)
                }
            }
            .font(.subheadline.bold())
            .frame(width: 30, height: 30)
            .background(Color(.systemBackground), in: square ? AnyShape(RoundedRectangle(cornerRadius: 7)) : AnyShape(Circle()))
            .overlay((square ? AnyShape(RoundedRectangle(cornerRadius: 7)) : AnyShape(Circle())).stroke(border, lineWidth: 1.5))
            Text(text).font(.body.weight(.semibold)).frame(maxWidth: .infinity, alignment: .leading).multilineTextAlignment(.leading)
        }
        .padding(12)
        .background(fill, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(border, lineWidth: 1.5))
        .opacity(look == .dim ? 0.55 : 1)
        .contentShape(Rectangle())
    }
}

struct FeedbackView: View {
    let step: Play.Step
    let grade: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(grade >= 0.999 ? L10n.text("correct") : grade > 0 ? String(format: L10n.text("partial"), Int((grade * 100).rounded())) : L10n.text("wrong"),
                  systemImage: grade >= 0.999 ? "checkmark.seal.fill" : grade > 0 ? "circle.lefthalf.filled" : "xmark.octagon.fill")
                .font(.headline)
                .foregroundStyle(grade >= 0.999 ? Brand.success : grade > 0 ? .orange : Brand.danger)
                .accessibilityIdentifier("playFeedback")
            if grade < 0.999, !step.correctText.isEmpty {
                Text(L10n.text("rightAnswer")).font(.caption.bold()).foregroundStyle(.secondary)
                Text(step.correctText).font(.body.weight(.semibold))
            }
            if !step.explanation.isEmpty {
                Text(step.explanation).font(.callout).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }
        }
        .card()
    }
}

struct ExcerptView: View {
    let excerpt: Play.Excerpt

    var body: some View {
        VStack(spacing: 8) {
            switch excerpt {
            case .verses(let verses):
                ForEach(Array(verses.enumerated()), id: \.offset) { _, verse in
                    VStack(spacing: 2) {
                        Text(verse.first)
                        Text(verse.second)
                    }
                    .font(.body.weight(.medium))
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                }
            case .prose(let parts):
                ForEach(Array(parts.enumerated()), id: \.offset) { _, part in
                    Text(part).font(.body).frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .padding(14)
        .background(Brand.sky.opacity(0.55), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

struct SourceView: View {
    let source: Play.SourceQuestion
    let baseURL: URL

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if !source.number.isEmpty { Text(source.number).font(.caption.bold()).foregroundStyle(.secondary) }
            if !source.text.isEmpty { Text(source.text).font(.callout) }
            ForEach(Array(source.documents.enumerated()), id: \.offset) { _, document in
                VStack(alignment: .leading, spacing: 6) {
                    if !document.caption.isEmpty { Text(document.caption).font(.caption.bold()) }
                    if let text = document.text { Text(text).font(.callout) }
                    if !document.table.isEmpty {
                        ScrollView(.horizontal) {
                            Grid(alignment: .leading, horizontalSpacing: 10, verticalSpacing: 6) {
                                ForEach(Array(document.table.enumerated()), id: \.offset) { _, row in
                                    GridRow { ForEach(Array(row.enumerated()), id: \.offset) { _, cell in Text(cell).font(.caption) } }
                                }
                            }
                        }
                    }
                    if let media = document.media {
                        AsyncImage(url: URL(string: media.localPath, relativeTo: baseURL)) { $0.resizable().scaledToFit() } placeholder: { EmptyView() }
                            .frame(maxHeight: 240)
                            .accessibilityLabel(media.alt)
                    }
                }
            }
        }
        .padding(.top, 6)
    }
}

struct ResultView: View {
    let package: Play.Package
    let attempt: PlayStore.Attempt
    @ObservedObject var play: PlayModel
    let restart: () -> Void

    private var current: PlayStore.Attempt { play.attempts.first(where: { $0.id == attempt.id }) ?? attempt }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                Image(systemName: "trophy.fill").font(.system(size: 54)).foregroundStyle(Brand.blue).padding(.top, 24)
                Text(L10n.text("setDone")).font(.title2.bold())
                let score = current.serverScore ?? Play.Score(score: current.score, max: current.max)
                Text("\(scoreText(score.score)) / \(scoreText(score.max))")
                    .font(.system(size: 44, weight: .heavy, design: .rounded).monospacedDigit())
                    .environment(\.layoutDirection, .leftToRight)
                    .accessibilityIdentifier("playScore")
                if score.max > 0, abs(score.max - package.scoreTotal) > 0.01 {
                    Text(String(format: L10n.text("scaledScore"), scoreText(Play.scaled(score, total: package.scoreTotal)), scoreText(package.scoreTotal)))
                        .font(.subheadline).foregroundStyle(.secondary)
                }
                Label(current.pending ? L10n.text("resultPending") : current.rejected ? L10n.text("syncRefused") : L10n.text("resultSynced"),
                      systemImage: current.pending ? "icloud.slash" : "checkmark.icloud")
                    .font(.footnote).foregroundStyle(.secondary)
                Button(L10n.text("tryAgain")) { restart() }
                    .buttonStyle(.borderedProminent).controlSize(.large)
                    .accessibilityIdentifier("playRestart")
            }
            .frame(maxWidth: .infinity)
            .padding(16)
        }
        .background(Brand.page)
    }
}
