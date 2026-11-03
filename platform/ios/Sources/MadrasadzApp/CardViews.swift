import SwiftUI
import UIKit
import MadrasadzCore

// MARK: - Lessons of a subject (units → lessons), like the website's subject page

struct LessonCardsSection: View {
    @ObservedObject var model: AppModel
    @ObservedObject var play: PlayModel
    @ObservedObject var loader: Loader<Cards.LessonList>
    let retry: () -> Void

    var body: some View {
        if loader.value != nil, loader.savedAt != nil || !model.online {
            OfflineBanner(savedAt: loader.savedAt).listRowBackground(Color.clear).listRowInsets(EdgeInsets())
        }
        if let list = loader.value {
            if let stats = list.stats { statsRow(stats) }
            if list.units.isEmpty {
                Text(L10n.text("playNoLessons")).foregroundStyle(.secondary)
            }
            ForEach(list.units) { unit in
                Section {
                    ForEach(unit.lessons) { lesson in
                        NavigationLink { CardLauncher(model: model, play: play, lessonID: lesson.id, title: lesson.lessonName) } label: {
                            LessonCardRow(lesson: lesson, saved: play.isCardLessonSaved(lesson.id))
                        }
                        .disabled(lesson.questions == 0 && !play.isCardLessonSaved(lesson.id))
                        .accessibilityIdentifier("lesson-\(lesson.id)")
                    }
                } header: {
                    HStack {
                        Image(systemName: "square.stack.3d.up.fill").foregroundStyle(Brand.blue)
                        Text(unit.unitName).font(.subheadline.bold())
                        Spacer()
                        Text(String(format: L10n.text("lessonsCountCards"), unit.lessons.count)).font(.caption)
                    }
                }
            }
        } else if let failure = loader.failure {
            FailureView(message: failure.message, retry: retry).listRowBackground(Color.clear)
        } else {
            LoadingView().listRowBackground(Color.clear)
        }
    }

    private func statsRow(_ stats: Cards.Stats) -> some View {
        HStack(spacing: 14) {
            Label("\(stats.xpTotal) XP", systemImage: "star.fill").foregroundStyle(Brand.blue)
            if let level = stats.level, !level.title.isEmpty { Label(level.title, systemImage: "rosette") }
            if stats.streakDays > 0 { Label(String(format: L10n.text("streakDays"), stats.streakDays), systemImage: "flame.fill").foregroundStyle(.orange) }
        }
        .font(.subheadline.weight(.semibold))
        .environment(\.layoutDirection, .rightToLeft)
        .accessibilityIdentifier("cardStats")
    }
}

struct LessonCardRow: View {
    let lesson: Cards.LessonRow
    let saved: Bool

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: lesson.mastered ? "checkmark.seal.fill" : "book.fill")
                .foregroundStyle(lesson.mastered ? Brand.success : Brand.blue)
                .frame(width: 36, height: 36)
                .background((lesson.mastered ? Brand.success : Brand.blue).opacity(0.12), in: RoundedRectangle(cornerRadius: 10))
            VStack(alignment: .leading, spacing: 5) {
                Text(lesson.lessonName).font(.subheadline.bold())
                HStack(spacing: 8) {
                    ProgressView(value: Double(lesson.masteryPct), total: 100)
                        .tint(lesson.mastered ? Brand.success : Brand.blue)
                        .frame(width: 90)
                    Text((lesson.answered > 0 ? "\(lesson.masteryPct)%" : "—") + " · " + String(format: L10n.text("stepsCount"), lesson.questions))
                        .font(.caption2).foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 0)
            if saved { Image(systemName: "arrow.down.circle.fill").foregroundStyle(Brand.success).accessibilityLabel(L10n.text("savedOffline")) }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Opening a lesson (download or saved copy)

struct CardLauncher: View {
    @ObservedObject var model: AppModel
    @ObservedObject var play: PlayModel
    let lessonID: String
    let title: String
    @State private var pack: Cards.Pack?
    @State private var failure: String?
    @State private var trialEnded = false
    @State private var round = UUID()

    var body: some View {
        Group {
            if let pack {
                CardGame(play: play, pack: pack, baseURL: model.api.baseURL) { round = UUID() }
                    .id(round)
            } else if trialEnded {
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
                ProgressView(L10n.text("preparingCards")).frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func load() async {
        failure = nil
        trialEnded = false
        if pack == nil, let stored = await play.storedLesson(id: lessonID) { pack = stored }
        do {
            let fresh = try await play.openLesson(id: lessonID)
            if pack == nil || pack?.checksum != fresh.checksum { pack = fresh }
        } catch let error as APIFailure {
            guard pack == nil else { return }
            if error.code == "PLAY_TRIAL_EXPIRED" { trialEnded = true; return }
            failure = error == .offline ? L10n.text("setNeedsInternet") : error.code == "PLAY_NO_QUESTIONS" ? L10n.text("playNoCards") : error.message
        } catch {
            if pack == nil { failure = L10n.text("error") }
        }
    }
}

// MARK: - The game: one card at a time — tap the back, it flips, answer on the white face

struct CardGame: View {
    @ObservedObject var play: PlayModel
    let pack: Cards.Pack
    let baseURL: URL
    let restart: () -> Void

    private enum Phase { case covered, front, answered }

    @State private var deck: [Cards.Question] = []
    @State private var faces: [String: Cards.Payload] = [:]
    @State private var index = 0
    @State private var phase: Phase = .covered
    @State private var drafts: [String: CardDraft] = [:]
    @State private var results: [String: Cards.Grade] = [:]
    @State private var answers: [PlayStore.CardAnswer] = []
    @State private var shownAt = Date()
    @State private var finished: PlayStore.CardRound?
    @State private var done = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Group {
            if done {
                RoundResultView(play: play, pack: pack, roundID: finished?.id, total: deck.count, answered: answers.count,
                                correct: answers.filter(\.correct).count,
                                estimatedXP: Cards.estimatedXP(deck, results: results, rules: pack.xp, complete: answers.count == deck.count),
                                restart: restart)
            } else if deck.isEmpty {
                ProgressView()
            } else {
                game
            }
        }
        .background(Brand.page)
        .task {
            guard deck.isEmpty else { return }
            let memory = await play.cardMemory()
            let seed = UInt64(Date().timeIntervalSince1970 * 1000)
            let picked = Cards.pickRound(pack, size: pack.roundSize, memory: memory, seed: seed)
            var shown: [String: Cards.Payload] = [:]
            for (i, q) in picked.enumerated() { shown[q.id] = Cards.shuffled(q.payload, seed: seed &+ UInt64(i + 1)) }
            faces = shown
            deck = picked
        }
    }

    private var card: Cards.Question { deck[min(index, deck.count - 1)] }

    /// The draft starts from the shuffled face shown to the student.
    private func draft(_ q: Cards.Question) -> CardDraft { drafts[q.id] ?? CardDraft(faces[q.id] ?? q.payload) }

    private var game: some View {
        VStack(spacing: 0) {
            HStack {
                Text(String(format: L10n.text("cardOf"), index + 1, deck.count)).font(.subheadline.bold()).foregroundStyle(Brand.blue)
                Spacer()
                Label("\(Cards.estimatedXP(deck, results: results, rules: pack.xp, complete: false)) XP", systemImage: "star.fill")
                    .font(.subheadline.weight(.semibold)).foregroundStyle(Brand.blue)
                    .environment(\.layoutDirection, .rightToLeft)
            }
            .padding(.horizontal, 16).padding(.top, 10)
            ProgressView(value: Double(index + (phase == .answered ? 1 : 0)), total: Double(deck.count))
                .tint(Brand.blue).padding(.horizontal, 16).padding(.top, 6)
            ScrollView {
                VStack(spacing: 18) {
                    if phase == .covered {
                        CardFlip(reduceMotion: reduceMotion) {
                            shownAt = Date()
                            phase = .front
                        }
                        .id(card.id)
                        .padding(.top, 24)
                        Text(L10n.text("tapToReveal")).font(.footnote).foregroundStyle(.secondary)
                    } else {
                        front
                            .transition(.scale(scale: 0.92).combined(with: .opacity))
                    }
                }
                .padding(16)
            }
            if phase != .covered { controls }
        }
    }

    private var front: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text(card.isHard ? L10n.text("difficultyHard") : card.difficulty == "EASY" ? L10n.text("difficultyEasy") : L10n.text("difficultyMedium"))
                    .font(.caption.bold())
                    .padding(.horizontal, 10).padding(.vertical, 4)
                    .background((card.isHard ? Color.orange : Brand.blue).opacity(0.12), in: Capsule())
                    .foregroundStyle(card.isHard ? .orange : Brand.blue)
                Spacer()
                Text(pack.lesson.lessonName).font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
            Group {
                if case .fill = card.payload {
                    EmptyView()
                } else {
                    Text(card.text).font(.title3.weight(.bold)).fixedSize(horizontal: false, vertical: true)
                }
                CardInteraction(question: card, face: faces[card.id] ?? card.payload,
                                draft: Binding(get: { draft(card) }, set: { drafts[card.id] = $0 }),
                                locked: phase == .answered)
            }
            .environment(\.layoutDirection, card.isLeftToRight ? .leftToRight : .rightToLeft)
            if phase == .answered, let grade = results[card.id] { CardFeedback(question: card, grade: grade) }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(Brand.sky, lineWidth: 1.5))
        .shadow(color: Brand.blue.opacity(0.18), radius: 16, y: 10)
        // A container: the options, blanks and feedback inside keep their own identifiers.
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("cardFront")
    }

    private var controls: some View {
        HStack(spacing: 12) {
            if phase == .front {
                Button(L10n.text("skip")) { advance() }
                    .buttonStyle(.bordered)
                    .accessibilityIdentifier("cardSkip")
                Button { check() } label: { Text(L10n.text("check")).fontWeight(.heavy).frame(maxWidth: .infinity) }
                    .buttonStyle(DeckButtonStyle())
                    .disabled(draft(card).answer == nil)
                    .accessibilityIdentifier("cardCheck")
            } else {
                Button { advance() } label: {
                    Text(index + 1 < deck.count ? L10n.text("nextCard") : L10n.text("finish")).fontWeight(.heavy).frame(maxWidth: .infinity)
                }
                .buttonStyle(DeckButtonStyle())
                .accessibilityIdentifier("cardNext")
            }
        }
        .controlSize(.large)
        .padding(16)
        .background(.bar)
    }

    private func check() {
        guard let answer = draft(card).answer else { return }
        let grade = Cards.grade(card, answer: answer)
        results[card.id] = grade
        let ms = Int(min(3_600_000, max(0, Date().timeIntervalSince(shownAt) * 1000)))
        answers.append(.init(questionId: card.id, answer: answer, timeMs: ms, correct: grade.isCorrect))
        withAnimation(.easeOut(duration: 0.2)) { phase = .answered }
        UINotificationFeedbackGenerator().notificationOccurred(grade.isCorrect ? .success : .error)
    }

    private func advance() {
        if index + 1 < deck.count {
            index += 1
            phase = .covered
        } else {
            Task {
                if !answers.isEmpty {
                    finished = await play.finishRound(pack, answers: answers,
                                                      estimatedXP: Cards.estimatedXP(deck, results: results, rules: pack.xp, complete: answers.count == deck.count))
                }
                done = true
            }
        }
    }
}

/// The website's blue pill button (gradient #3B83F0 → #1457C5).
struct DeckButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var enabled
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.title3)
            .foregroundStyle(.white)
            .padding(.horizontal, 22)
            .frame(minHeight: 52)
            .background(LinearGradient(colors: [Color(red: 0.231, green: 0.514, blue: 0.941), Color(red: 0.078, green: 0.341, blue: 0.773)],
                                       startPoint: .top, endPoint: .bottom), in: Capsule())
            .shadow(color: Color(red: 0.078, green: 0.341, blue: 0.773).opacity(0.45), radius: 10, y: 8)
            .opacity(enabled ? (configuration.isPressed ? 0.85 : 1) : 0.45)
    }
}

// MARK: - Card back and flip (the approved reference: blue card in a white frame on a white deck)

struct CardFlip: View {
    let reduceMotion: Bool
    let revealed: () -> Void
    @State private var angle: Double = 0
    @State private var showFront = false
    @State private var flipping = false

    var body: some View {
        ZStack {
            // The white deck under the card.
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color.white)
                .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Color(red: 0.83, green: 0.87, blue: 0.94), lineWidth: 1))
                .offset(y: 8)
                .scaleEffect(0.96)
            Group {
                if showFront {
                    RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Color.white)
                        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Brand.sky, lineWidth: 1.5))
                } else {
                    CardBackArt()
                }
            }
            .rotation3DEffect(.degrees(angle), axis: (x: 0, y: 1, z: 0), perspective: 0.55)
        }
        .aspectRatio(4.0 / 5.0, contentMode: .fit)
        .frame(maxWidth: 270)
        .contentShape(Rectangle())
        .onTapGesture { flip() }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(L10n.text("tapToReveal"))
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("cardBack")
    }

    private func flip() {
        guard !flipping else { return }
        flipping = true
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        if reduceMotion {
            revealed()
            return
        }
        withAnimation(.easeIn(duration: 0.22)) { angle = -90 } completion: {
            showFront = true
            angle = 90
            withAnimation(.easeOut(duration: 0.22)) { angle = 0 } completion: {
                withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) { revealed() }
            }
        }
    }
}

struct CardBackArt: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 18, style: .continuous)
            .fill(Color.white)
            .overlay {
                ZStack {
                    RadialGradient(colors: [Color(red: 0.184, green: 0.471, blue: 0.902), Color(red: 0.102, green: 0.384, blue: 0.827), Color(red: 0.055, green: 0.290, blue: 0.702)],
                                   center: UnitPoint(x: 0.5, y: 0.45), startRadius: 4, endRadius: 260)
                    Lattice().stroke(Color.white.opacity(0.09), lineWidth: 1)
                    RoundedRectangle(cornerRadius: 9, style: .continuous).stroke(Color.white.opacity(0.25), lineWidth: 1).padding(7)
                    VStack(spacing: 10) {
                        HStack(spacing: 2) {
                            Image(systemName: "laurel.leading")
                            Image(systemName: "graduationcap.fill").font(.system(size: 40, weight: .bold)).foregroundStyle(.white)
                            Image(systemName: "laurel.trailing")
                        }
                        .font(.system(size: 52, weight: .semibold))
                        .foregroundStyle(LinearGradient(colors: [Color(red: 1, green: 0.88, blue: 0.48), Color(red: 0.86, green: 0.6, blue: 0.13)], startPoint: .top, endPoint: .bottom))
                        Text("PLAY").font(.system(size: 22, weight: .black, design: .rounded)).tracking(4).foregroundStyle(.white)
                        Text("مدرسة").font(.headline.weight(.heavy)).foregroundStyle(.white.opacity(0.9))
                    }
                    .shadow(color: Color(red: 0.02, green: 0.12, blue: 0.35).opacity(0.35), radius: 4, y: 3)
                }
                .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
                .padding(6)
            }
            .shadow(color: Color(red: 0.078, green: 0.341, blue: 0.773).opacity(0.45), radius: 16, y: 12)
    }
}

/// The faint lattice of the card back (30 pt tiles: square, diamond and corner strokes).
private struct Lattice: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        let s: CGFloat = 30
        var y: CGFloat = 0
        while y < rect.height {
            var x: CGFloat = 0
            while x < rect.width {
                p.addRect(CGRect(x: x + 8, y: y + 8, width: 14, height: 14))
                p.move(to: CGPoint(x: x + 15, y: y + 4))
                p.addLine(to: CGPoint(x: x + 26, y: y + 15))
                p.addLine(to: CGPoint(x: x + 15, y: y + 26))
                p.addLine(to: CGPoint(x: x + 4, y: y + 15))
                p.closeSubpath()
                x += s
            }
            y += s
        }
        return p
    }
}

// MARK: - Answering a card

struct CardDraft: Equatable {
    var choice: String?
    var blanks: [String?] = []
    var matches: [String: String] = [:]
    var order: [String] = []
    private let kind: Int
    private var needed = 0

    init(_ payload: Cards.Payload) {
        switch payload {
        case .mcq: kind = 0
        case .fill(_, let blanks, _): kind = 1; self.blanks = Array(repeating: nil, count: blanks)
        case .matching(let lefts, _): kind = 2; needed = lefts.count
        case .ordering(let items): kind = 3; order = items.map(\.key)
        }
    }

    var answer: Cards.Answer? {
        switch kind {
        case 0: return choice.map(Cards.Answer.mcq)
        case 1: return blanks.isEmpty || blanks.contains(where: { $0 == nil }) ? nil : .fill(blanks.compactMap { $0 })
        case 2: return matches.isEmpty || matches.count < needed ? nil : .matching(matches)
        default: return order.isEmpty ? nil : .ordering(order)
        }
    }
}

private let cardLetters = ["أ", "ب", "ج", "د", "هـ", "و"]

struct CardInteraction: View {
    let question: Cards.Question
    /// The shuffled face shown to the student (grading uses keys, not positions).
    let face: Cards.Payload
    @Binding var draft: CardDraft
    let locked: Bool

    var body: some View {
        switch face {
        case .mcq(let options): mcq(options)
        case .fill(let segments, _, let bank): fill(segments, bank: bank)
        case .matching(let lefts, let rights): matching(lefts, rights)
        case .ordering: ordering
        }
    }

    // ORDERING keeps the draft order initialised from the shuffled face.
    private var orderingItems: [Cards.Option] {
        if case .ordering(let items) = face { return items }
        return []
    }

    private func mcq(_ options: [Cards.Option]) -> some View {
        var correct: String?
        if case .mcq(let k) = question.key { correct = k }
        return VStack(spacing: 10) {
            ForEach(Array(options.enumerated()), id: \.element.key) { i, option in
                let picked = draft.choice == option.key
                let look: OptionRow.Look = locked ? (option.key == correct ? .correct : picked ? .wrong : .dim) : (picked ? .picked : .idle)
                Button {
                    guard !locked else { return }
                    draft.choice = option.key
                } label: {
                    OptionRow(label: i < cardLetters.count ? cardLetters[i] : "\(i + 1)", text: option.text, look: look, square: false)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("cardOption-\(i)")
                .accessibilityAddTraits(picked ? .isSelected : [])
            }
        }
    }

    private func fill(_ segments: [Cards.Segment], bank: [String]) -> some View {
        var sentence = Text("")
        for segment in segments {
            switch segment {
            case .text(let t): sentence = sentence + Text(t)
            case .blank(let b):
                let value = b < draft.blanks.count ? draft.blanks[b] : nil
                sentence = sentence + Text(" [\(b + 1): \(value ?? "……")] ").foregroundColor(Brand.blue).bold()
            }
        }
        var expected: [[String]] = []
        if case .fill(let answers) = question.key { expected = answers }
        let used = draft.blanks.compactMap { $0 }
        return VStack(alignment: .leading, spacing: 14) {
            sentence.font(.title3.weight(.semibold)).lineSpacing(8).fixedSize(horizontal: false, vertical: true)
            ForEach(Array(draft.blanks.enumerated()), id: \.offset) { i, value in
                let ok = locked && i < expected.count && value.map { expected[i].contains(Cards.exactToken($0)) } == true
                HStack {
                    Text(String(format: L10n.text("blankNumber"), i + 1)).font(.caption.bold())
                    Text(value ?? "—").foregroundStyle(value == nil ? .secondary : .primary)
                    Spacer()
                    if locked {
                        Image(systemName: ok ? "checkmark.circle.fill" : "xmark.circle.fill").foregroundStyle(ok ? Brand.success : Brand.danger)
                    } else if value != nil {
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
                    .accessibilityIdentifier("cardBank-\(i)")
                }
            }
        }
    }

    private func matching(_ lefts: [Cards.Option], _ rights: [Cards.Option]) -> some View {
        var pairs: [String: String] = [:]
        if case .matching(let p) = question.key { pairs = p }
        return VStack(spacing: 10) {
            ForEach(lefts, id: \.key) { left in
                let chosen = draft.matches[left.key]
                let color: Color = locked ? (chosen == pairs[left.key] ? Brand.success.opacity(0.15) : Brand.danger.opacity(0.12)) : Brand.card
                VStack(alignment: .leading, spacing: 8) {
                    Text(left.text).font(.subheadline.bold())
                    Menu {
                        ForEach(rights, id: \.key) { right in
                            Button(right.text) { draft.matches[left.key] = right.key }
                        }
                    } label: {
                        HStack {
                            Text(rights.first { $0.key == chosen }?.text ?? L10n.text("chooseMatch"))
                                .foregroundStyle(chosen == nil ? .secondary : .primary)
                                .multilineTextAlignment(.leading)
                            Spacer()
                            Image(systemName: "chevron.up.chevron.down").font(.caption)
                        }
                        .padding(10)
                        .background(Color(.tertiarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 10))
                    }
                    .disabled(locked)
                    .accessibilityIdentifier("cardMatch-\(left.key)")
                }
                .padding(12)
                .background(color, in: RoundedRectangle(cornerRadius: 14))
            }
        }
    }

    private var ordering: some View {
        var expected: [String] = []
        if case .ordering(let o) = question.key { expected = o }
        let items = orderingItems
        return VStack(spacing: 8) {
            Text(L10n.text("orderHint")).font(.caption.bold()).foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .leading)
            ForEach(Array(draft.order.enumerated()), id: \.element) { position, key in
                let ok = locked && position < expected.count && expected[position] == key
                HStack(spacing: 10) {
                    Text("\(position + 1)").font(.headline.monospacedDigit()).frame(width: 28)
                    Text(items.first { $0.key == key }?.text ?? "").frame(maxWidth: .infinity, alignment: .leading)
                    if !locked {
                        VStack(spacing: 4) {
                            Button { move(position, -1) } label: { Image(systemName: "chevron.up") }.disabled(position == 0)
                            Button { move(position, 1) } label: { Image(systemName: "chevron.down") }.disabled(position == draft.order.count - 1)
                        }
                        .buttonStyle(.bordered).controlSize(.small)
                    }
                }
                .padding(10)
                .background(locked ? (ok ? Brand.success.opacity(0.15) : Brand.danger.opacity(0.12)) : Brand.card, in: RoundedRectangle(cornerRadius: 12))
            }
        }
    }

    private func move(_ position: Int, _ offset: Int) {
        let target = position + offset
        guard target >= 0, target < draft.order.count else { return }
        draft.order.swapAt(position, target)
    }
}

struct CardFeedback: View {
    let question: Cards.Question
    let grade: Cards.Grade

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(grade.isCorrect ? L10n.text("correct") : grade.score > 0 ? String(format: L10n.text("partial"), Int((grade.score * 100).rounded())) : L10n.text("wrong"),
                  systemImage: grade.isCorrect ? "checkmark.seal.fill" : grade.score > 0 ? "circle.lefthalf.filled" : "xmark.octagon.fill")
                .font(.headline)
                .foregroundStyle(grade.isCorrect ? Brand.success : grade.score > 0 ? .orange : Brand.danger)
                .accessibilityIdentifier("cardFeedback")
            if !grade.isCorrect, !question.correctText.isEmpty {
                Text(L10n.text("rightAnswer")).font(.caption.bold()).foregroundStyle(.secondary)
                Text(question.correctText).font(.body.weight(.semibold))
            }
            if !question.explanation.isEmpty {
                Text(question.explanation).font(.callout).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background((grade.isCorrect ? Brand.success : Brand.blue).opacity(0.07), in: RoundedRectangle(cornerRadius: 16))
    }
}

// MARK: - End of a round

struct RoundResultView: View {
    @ObservedObject var play: PlayModel
    let pack: Cards.Pack
    let roundID: UUID?
    let total: Int
    let answered: Int
    let correct: Int
    let estimatedXP: Int
    let restart: () -> Void
    @Environment(\.dismiss) private var dismiss

    private var round: PlayStore.CardRound? { play.cardRounds.first { $0.id == roundID } }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                Image(systemName: correct * 2 >= max(1, answered) ? "trophy.fill" : "sparkles")
                    .font(.system(size: 56)).foregroundStyle(Brand.blue).padding(.top, 28)
                Text(L10n.text("roundDone")).font(.title2.bold())
                Text("\(correct) / \(total)")
                    .font(.system(size: 46, weight: .heavy, design: .rounded).monospacedDigit())
                    .environment(\.layoutDirection, .leftToRight)
                    .accessibilityIdentifier("cardsScore")
                if let server = round?.server {
                    Label("+\(server.xpEarned) XP", systemImage: "star.fill").font(.title3.bold()).foregroundStyle(Brand.blue)
                    Text(String(format: L10n.text("xpTotalLevel"), server.xpTotal, server.levelTitle ?? "")).font(.subheadline).foregroundStyle(.secondary)
                    if server.lessonMastered {
                        Label(L10n.text("lessonMasteredNow"), systemImage: "checkmark.seal.fill").font(.headline).foregroundStyle(Brand.success)
                    }
                } else if answered > 0 {
                    Label("≈ +\(estimatedXP) XP", systemImage: "star").font(.title3.bold()).foregroundStyle(Brand.blue)
                    Label(round?.rejected == true ? L10n.text("syncRefused") : L10n.text("resultPending"),
                          systemImage: round?.rejected == true ? "exclamationmark.icloud" : "icloud.and.arrow.up")
                        .font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.center)
                }
                Button { restart() } label: { Text(L10n.text("newRound")).fontWeight(.heavy).frame(maxWidth: .infinity) }
                    .buttonStyle(DeckButtonStyle())
                    .padding(.horizontal, 24)
                    .accessibilityIdentifier("cardsRestart")
                Button(L10n.text("backToLessons")) { dismiss() }
                    .padding(.bottom, 20)
            }
            .frame(maxWidth: .infinity)
            .padding(16)
        }
    }
}
